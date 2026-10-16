-- Galed: initial schema.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table has row level security on; anonymous visitors can read nothing.

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  gender text not null default 'x' check (gender in ('f', 'm', 'x')),
  birth_year int check (birth_year between 1930 and 2015),
  city text not null default '' check (char_length(city) <= 60),
  pace numeric(3, 1) not null default 4.0 check (pace between 2 and 8),
  level text not null default 'בינוני' check (level in ('קל', 'בינוני', 'קשה', 'מאתגר')),
  langs text[] not null default '{עברית}',
  has_car boolean not null default false,
  bio text not null default '' check (char_length(bio) <= 500),
  ink text not null default 'ultra' check (ink in ('ultra', 'flame', 'moss', 'brick')),
  verified boolean not null default false, -- set only by the service role after an ID check
  free_days date[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Things only the owner may read: never joined into anything public.
create table public.private_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  emergency_name text not null default '' check (char_length(emergency_name) <= 60),
  emergency_phone text not null default '' check (char_length(emergency_phone) <= 30)
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, ink)
  values (new.id, (array['ultra', 'flame', 'moss', 'brick'])[1 + floor(random() * 4)::int]);
  insert into public.private_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trail catalog ───────────────────────────────────────────
-- Cover art, profiles and stats live in the app bundle (src/data/trails.ts);
-- the table pins the ids posts may use.

create table public.trails (
  id text primary key,
  name text not null
);

insert into public.trails (id, name) values
  ('ramon', 'מכתש רמון'),
  ('amud', 'נחל עמוד'),
  ('arbel', 'מצוק ארבל'),
  ('golan', 'שביל הגולן'),
  ('eilat', 'הרי אילת'),
  ('eingedi', 'עין גדי'),
  ('dolomites', 'Tre Cime'),
  ('tmb', 'Tour du Mont Blanc'),
  ('patagonia', 'W Trek');

-- ── Hike posts ──────────────────────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trail_id text not null references public.trails (id),
  start_date date not null,
  days int not null default 1 check (days between 1 and 60),
  flexible boolean not null default false,
  start_time time not null default '06:00',
  direction text check (char_length(direction) <= 40),
  spots int not null check (spots between 1 and 12),
  pace numeric(3, 1) not null check (pace between 2 and 8),
  level text not null check (level in ('קל', 'בינוני', 'קשה', 'מאתגר')),
  car text not null check (car in ('has-car', 'needs-ride', 'shuttle')),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  note text not null default '' check (char_length(note) <= 1000),
  meet text not null default '' check (char_length(meet) <= 200),
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create index posts_start_date_idx on public.posts (start_date) where not cancelled;

-- ── Join requests ───────────────────────────────────────────

create table public.join_requests (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  message text not null default '' check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create function public.is_post_author(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts where id = p and author_id = auth.uid())
$$;

-- Guards the request life cycle: no requests on your own or a cancelled
-- post, and no accepting past the number of spots.
create function public.check_join_request() returns trigger
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
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    -- allowed moves: organiser answers a pending request or removes someone,
    -- requester withdraws, or asks again after withdrawing
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined') and post_row.author_id = auth.uid())
      or (old.status = 'accepted' and new.status = 'declined' and post_row.author_id = auth.uid())
      or (old.status in ('pending', 'accepted') and new.status = 'withdrawn' and new.user_id = auth.uid())
      or (old.status = 'withdrawn' and new.status = 'pending' and new.user_id = auth.uid())
    ) then
      raise exception 'cannot change a request from % to %', old.status, new.status;
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

create trigger join_requests_check
  before insert or update on public.join_requests
  for each row execute function public.check_join_request();

-- ── Threads and messages ────────────────────────────────────

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete set null,
  plan jsonb not null default '{}' check (pg_column_size(plan) < 8000),
  created_at timestamptz not null default now()
);

create table public.thread_members (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index thread_members_user_idx on public.thread_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (thread_id, created_at);

create function public.is_thread_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from thread_members where thread_id = t and user_id = auth.uid())
$$;

-- Opens (or reuses) the 1:1 thread between the caller and another person
-- about a post. Members can only be added through here, so nobody can pull
-- a stranger into a conversation.
create function public.start_thread(other uuid, about uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t uuid;
  post_row posts;
begin
  if me is null then raise exception 'not signed in'; end if;
  if other = me then raise exception 'cannot message yourself'; end if;
  select * into post_row from posts where id = about;
  if post_row.id is null then raise exception 'hike not found'; end if;
  -- one side of the conversation must be the hike's organiser
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

-- ── Stats ───────────────────────────────────────────────────

-- Past hikes a person organised or was accepted to.
create view public.profile_stats with (security_invoker = true) as
select
  p.id,
  (select count(*) from public.posts po
     where po.author_id = p.id and not po.cancelled and po.start_date < current_date)
  + (select count(*) from public.join_requests jr join public.posts po on po.id = jr.post_id
     where jr.user_id = p.id and jr.status = 'accepted' and not po.cancelled and po.start_date < current_date)
  as hikes
from public.profiles p;

-- ── Row level security ──────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.private_settings enable row level security;
alter table public.trails enable row level security;
alter table public.posts enable row level security;
alter table public.join_requests enable row level security;
alter table public.threads enable row level security;
alter table public.thread_members enable row level security;
alter table public.messages enable row level security;

-- Start from nothing, then grant exactly what the app needs.
revoke all on public.profiles, public.private_settings, public.trails, public.posts,
  public.join_requests, public.threads, public.thread_members, public.messages,
  public.profile_stats from anon, authenticated;
revoke execute on function public.start_thread(uuid, uuid), public.is_post_author(uuid),
  public.is_thread_member(uuid), public.handle_new_user(), public.check_join_request() from public, anon;

grant select on public.trails, public.profiles, public.posts, public.join_requests,
  public.threads, public.thread_members, public.messages, public.profile_stats to authenticated;
grant update (name, gender, birth_year, city, pace, level, langs, has_car, bio, ink, free_days)
  on public.profiles to authenticated;
grant select, update (emergency_name, emergency_phone) on public.private_settings to authenticated;
grant insert, update (start_date, days, flexible, start_time, direction, spots, pace, level, car, tags, note, meet, cancelled),
  delete on public.posts to authenticated;
grant insert (post_id, message), update (status) on public.join_requests to authenticated;
grant update (plan) on public.threads to authenticated;
grant update (last_read_at) on public.thread_members to authenticated;
grant insert (thread_id, body) on public.messages to authenticated;
grant execute on function public.start_thread(uuid, uuid), public.is_post_author(uuid),
  public.is_thread_member(uuid) to authenticated;

create policy "signed-in users read the catalog" on public.trails
  for select to authenticated using (true);

create policy "signed-in users read profiles" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own private settings" on public.private_settings
  for select to authenticated using (user_id = auth.uid());
create policy "edit own private settings" on public.private_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "signed-in users read hikes" on public.posts
  for select to authenticated using (true);
create policy "publish as yourself" on public.posts
  for insert to authenticated with check (author_id = auth.uid());
create policy "organiser edits" on public.posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "organiser deletes" on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- Accepted requests are the public crew list; pending and declined ones are
-- seen only by the requester and the organiser.
create policy "read requests" on public.join_requests
  for select to authenticated
  using (status = 'accepted' or user_id = auth.uid() or public.is_post_author(post_id));
create policy "request as yourself" on public.join_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy "requester withdraws" on public.join_requests
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('withdrawn', 'pending'));
create policy "organiser answers" on public.join_requests
  for update to authenticated
  using (public.is_post_author(post_id)) with check (status in ('accepted', 'declined'));

create policy "members read threads" on public.threads
  for select to authenticated using (public.is_thread_member(id));
create policy "members edit the plan" on public.threads
  for update to authenticated using (public.is_thread_member(id)) with check (public.is_thread_member(id));

create policy "members see members" on public.thread_members
  for select to authenticated using (public.is_thread_member(thread_id));
create policy "mark own read" on public.thread_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read messages" on public.messages
  for select to authenticated using (public.is_thread_member(thread_id));
create policy "members write as themselves" on public.messages
  for insert to authenticated with check (sender_id = auth.uid() and public.is_thread_member(thread_id));

-- ── Realtime ────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.join_requests, public.threads;
  end if;
end $$;
