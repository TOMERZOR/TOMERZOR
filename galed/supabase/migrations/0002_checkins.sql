-- Galed: safe-trip check-ins ("חזרתי").
-- A hiker sets a return time for a hike they are on. If they have not
-- marked themselves back by then (plus a grace period), the
-- checkin-alerts edge function texts their emergency contact. If they mark
-- themselves back after an alert went out, the contact gets an all-clear.

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  return_by timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'returned', 'cancelled', 'alerted')),
  returned_at timestamptz,
  alerted_at timestamptz,
  all_clear_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index checkins_due_idx on public.checkins (return_by) where status = 'scheduled';

-- The organiser and accepted members of a hike.
create function public.is_post_crew(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts where id = p and author_id = u)
      or exists (select 1 from join_requests where post_id = p and user_id = u and status = 'accepted')
$$;

create function public.check_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- rules for the hiker; the alert job runs without a user and skips them
  if auth.uid() is not null then
    if tg_op = 'INSERT' or new.return_by is distinct from old.return_by then
      if new.return_by <= now() then raise exception 'the return time has to be in the future'; end if;
      if new.return_by > now() + interval '15 days' then raise exception 'the return time is too far ahead'; end if;
    end if;
    if tg_op = 'UPDATE' and new.status <> old.status then
      if new.status = 'alerted' then raise exception 'only the alert job marks a check-in as alerted'; end if;
      if old.status = 'alerted' and new.status <> 'returned' then
        raise exception 'after an alert the only change is marking yourself back';
      end if;
    end if;
    if tg_op = 'UPDATE' and old.status = 'alerted' and new.return_by is distinct from old.return_by then
      raise exception 'the alert already went out; mark yourself back instead';
    end if;
  end if;
  if new.status = 'returned' and (tg_op = 'INSERT' or old.status <> 'returned') then
    new.returned_at := now();
  elsif new.status <> 'returned' then
    new.returned_at := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger checkins_check
  before insert or update on public.checkins
  for each row execute function public.check_checkin();

alter table public.checkins enable row level security;
revoke all on public.checkins from anon, authenticated;
grant select, insert (post_id, return_by), update (return_by, status) on public.checkins to authenticated;
revoke execute on function public.is_post_crew(uuid, uuid), public.check_checkin() from public, anon;
grant execute on function public.is_post_crew(uuid, uuid) to authenticated;

-- Hike partners see each other's check-in, so the group knows everyone is back.
create policy "own and crew check-ins" on public.checkins
  for select to authenticated
  using (user_id = auth.uid() or public.is_post_crew(post_id, auth.uid()));
create policy "check in on hikes you are on" on public.checkins
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_post_crew(post_id, auth.uid()));
create policy "update own check-in" on public.checkins
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('scheduled', 'returned', 'cancelled'));

-- ── Alert job ───────────────────────────────────────────────
-- Called by the checkin-alerts edge function with the service role.
-- Each call claims the rows it returns, so two overlapping runs never
-- text the same contact twice.

create function public.claim_overdue_checkins(grace interval default interval '30 minutes')
returns table (
  checkin_id uuid,
  kind text,
  hiker_name text,
  hiker_gender text,
  contact_name text,
  contact_phone text,
  trail_name text,
  meet text,
  start_date date,
  start_time time,
  return_by timestamptz,
  partners text[]
)
language sql security definer set search_path = public as $$
  with due as (
    update checkins c
       set status = 'alerted', alerted_at = now()
     where c.status = 'scheduled' and c.return_by + grace < now()
    returning c.id, 'overdue'::text as kind, c.user_id, c.post_id, c.return_by
  ), clear as (
    update checkins c
       set all_clear_at = now()
     where c.status = 'returned' and c.alerted_at is not null and c.all_clear_at is null
    returning c.id, 'all-clear'::text as kind, c.user_id, c.post_id, c.return_by
  ), picked as (
    select * from due union all select * from clear
  )
  select
    k.id, k.kind, pr.name, pr.gender, ps.emergency_name, ps.emergency_phone,
    tr.name, po.meet, po.start_date, po.start_time, k.return_by,
    array(
      select p2.name from profiles p2
      where p2.id <> k.user_id
        and (p2.id = po.author_id
          or exists (select 1 from join_requests jr where jr.post_id = po.id and jr.user_id = p2.id and jr.status = 'accepted'))
      order by p2.name
    )
  from picked k
  join profiles pr on pr.id = k.user_id
  join private_settings ps on ps.user_id = k.user_id
  join posts po on po.id = k.post_id
  join trails tr on tr.id = po.trail_id
$$;

-- Puts a claimed row back when the message could not be sent, so the next run retries.
create function public.release_checkin_claim(id uuid, kind text) returns void
language sql security definer set search_path = public as $$
  update checkins c set status = 'scheduled', alerted_at = null
   where c.id = release_checkin_claim.id and release_checkin_claim.kind = 'overdue' and c.status = 'alerted';
  update checkins c set all_clear_at = null
   where c.id = release_checkin_claim.id and release_checkin_claim.kind = 'all-clear';
$$;

revoke execute on function public.claim_overdue_checkins(interval), public.release_checkin_claim(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_overdue_checkins(interval), public.release_checkin_claim(uuid, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.checkins;
  end if;
end $$;
