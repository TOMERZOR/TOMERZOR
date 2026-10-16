-- Galed: safety features the App Store requires for apps where strangers
-- meet (App Review Guideline 1.2 and 5.1.1(v)):
--   blocking (both ways), reporting, a filter for objectionable text,
--   accepting the terms (18+), and deleting your own account.

-- ── Blocking ────────────────────────────────────────────────

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  -- the name at the time, for the blocker's "blocked" list (the profile itself becomes hidden)
  blocked_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create function public.fill_blocked_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.blocked_name := coalesce((select name from profiles where id = new.blocked_id), '');
  return new;
end $$;

create trigger blocks_name before insert on public.blocks for each row execute function public.fill_blocked_name();

-- True when either person blocked the other.
create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- True when someone in the thread blocked (or was blocked by) the caller.
create function public.thread_has_block(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from thread_members m
    where m.thread_id = t and m.user_id <> auth.uid() and public.is_blocked_between(m.user_id, auth.uid())
  )
$$;

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, insert (blocked_id), delete on public.blocks to authenticated;

create policy "own blocks" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "block as yourself" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "unblock" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- Blocked people disappear from each other's feed, search and profiles.
drop policy "signed-in users read profiles" on public.profiles;
create policy "signed-in users read profiles" on public.profiles
  for select to authenticated using (not public.is_blocked_between(id, auth.uid()));

drop policy "signed-in users read hikes" on public.posts;
create policy "signed-in users read hikes" on public.posts
  for select to authenticated using (not public.is_blocked_between(author_id, auth.uid()));

-- …and cannot write to each other.
drop policy "members write as themselves" on public.messages;
create policy "members write as themselves" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_thread_member(thread_id) and not public.thread_has_block(thread_id));

create or replace function public.check_join_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  post_row posts;
  taken int;
begin
  select * into post_row from posts where id = new.post_id;
  if tg_op = 'INSERT' then
    if post_row.author_id = new.user_id then
      raise exception 'cannot request to join your own hike';
    end if;
    if post_row.cancelled then
      raise exception 'this hike was cancelled';
    end if;
    if new.status <> 'pending' then
      raise exception 'a new request must be pending';
    end if;
    if public.is_blocked_between(post_row.author_id, new.user_id) then
      raise exception 'blocked';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined') and post_row.author_id = auth.uid())
      or (old.status = 'accepted' and new.status = 'declined' and post_row.author_id = auth.uid())
      or (old.status in ('pending', 'accepted') and new.status = 'withdrawn' and new.user_id = auth.uid())
      or (old.status = 'withdrawn' and new.status = 'pending' and new.user_id = auth.uid())
    ) then
      raise exception 'cannot change a request from % to %', old.status, new.status;
    end if;
    if new.status = 'pending' and public.is_blocked_between(post_row.author_id, new.user_id) then
      raise exception 'blocked';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    select count(*) into taken from join_requests where post_id = new.post_id and status = 'accepted';
    if taken >= post_row.spots then
      raise exception 'the group is full';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Same as 0001, plus: no new conversations between blocked people.
create or replace function public.start_thread(other uuid, about uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t uuid;
  post_row posts;
begin
  if me is null then raise exception 'not signed in'; end if;
  if other = me then raise exception 'cannot message yourself'; end if;
  if public.is_blocked_between(me, other) then raise exception 'blocked'; end if;
  select * into post_row from posts where id = about;
  if post_row.id is null then raise exception 'hike not found'; end if;
  if post_row.author_id not in (me, other) then
    raise exception 'conversations are with the organiser of the hike';
  end if;

  select tm1.thread_id into t
  from thread_members tm1
  join thread_members tm2 on tm2.thread_id = tm1.thread_id and tm2.user_id = other
  join threads th on th.id = tm1.thread_id and th.post_id = about
  where tm1.user_id = me
  limit 1;

  if t is null then
    insert into threads (post_id, plan)
    values (
      about,
      jsonb_build_object(
        'meet', post_row.meet,
        'time', to_char(post_row.start_date, 'DD.MM') || ' · ' || to_char(post_row.start_time, 'HH24:MI'),
        'cars', '',
        'gear', '[]'::jsonb,
        'shareWithEmergency', false
      )
    )
    returning id into t;
    insert into thread_members (thread_id, user_id) values (t, me), (t, other);
  end if;
  return t;
end $$;

-- ── Reports ─────────────────────────────────────────────────
-- Reviewed by the team in the Supabase dashboard (Table Editor → reports).

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate', 'spam', 'fake', 'unsafe', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  -- a copy of what was reported, so it survives the author deleting it
  snapshot text not null default '' check (char_length(snapshot) <= 2000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> target_id)
);

create index reports_open_idx on public.reports (created_at) where status = 'open';

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert (target_id, post_id, message_id, reason, details, snapshot) on public.reports to authenticated;

create policy "see own reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "report as yourself" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ── Objectionable text filter ───────────────────────────────
-- Moderators add terms in the dashboard; text containing one is rejected.

create table public.banned_terms (
  term text primary key check (term = lower(term) and char_length(term) >= 2)
);
alter table public.banned_terms enable row level security;
revoke all on public.banned_terms from anon, authenticated;

-- Whole words with their plural forms; stems would also catch innocent
-- words (e.g. "זונ" inside "מזונות").
insert into public.banned_terms (term) values
  ('זונה'), ('זונות'), ('שרמוטה'), ('שרמוטות'), ('כוס אמק'), ('כוסאמק'), ('מניאק'), ('מניאקים'),
  ('fuck'), ('cunt'), ('whore'), ('slut'), ('nigger');

create function public.has_banned_term(body text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from banned_terms where position(term in lower(coalesce(body, ''))) > 0)
$$;

create function public.check_text() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  body text;
begin
  -- each branch only touches its own table's columns
  if tg_table_name = 'messages' then
    body := new.body;
  elsif tg_table_name = 'posts' then
    body := concat_ws(' ', new.note, new.meet, array_to_string(new.tags, ' '));
  elsif tg_table_name = 'profiles' then
    body := concat_ws(' ', new.name, new.bio, new.city);
  elsif tg_table_name = 'join_requests' then
    body := new.message;
  end if;
  if public.has_banned_term(body) then
    raise exception 'objectionable text';
  end if;
  return new;
end $$;

create trigger messages_text before insert on public.messages for each row execute function public.check_text();
create trigger posts_text before insert or update on public.posts for each row execute function public.check_text();
create trigger profiles_text before update on public.profiles for each row execute function public.check_text();
create trigger join_requests_text before insert or update on public.join_requests for each row execute function public.check_text();

-- ── Terms and minimum age ───────────────────────────────────

alter table public.profiles add column terms_accepted_at timestamptz;
grant update (terms_accepted_at) on public.profiles to authenticated;

create function public.check_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- the server sets the acceptance time; a client can only switch it on
  if new.terms_accepted_at is distinct from old.terms_accepted_at then
    new.terms_accepted_at := case when new.terms_accepted_at is null then old.terms_accepted_at else now() end;
  end if;
  if new.birth_year is distinct from old.birth_year and new.birth_year > extract(year from now())::int - 18 then
    raise exception 'galed is for ages 18 and up';
  end if;
  return new;
end $$;

create trigger profiles_check before update on public.profiles for each row execute function public.check_profile();

-- ── Account deletion ────────────────────────────────────────
-- Deletes the sign-in and, through cascades, the profile, private settings,
-- hikes, requests, check-ins, messages and blocks. Reports the person filed
-- go too; reports about them stay with the snapshot until reviewed.

alter table public.reports drop constraint reports_target_id_fkey;
alter table public.reports alter column target_id drop not null;
alter table public.reports
  add constraint reports_target_id_fkey foreign key (target_id) references public.profiles (id) on delete set null;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = me;
end $$;

revoke execute on function public.fill_blocked_name() from public, anon, authenticated;
revoke execute on function public.is_blocked_between(uuid, uuid), public.thread_has_block(uuid),
  public.has_banned_term(text), public.check_text(), public.check_profile(), public.delete_my_account()
  from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid), public.thread_has_block(uuid),
  public.has_banned_term(text), public.delete_my_account() to authenticated;
