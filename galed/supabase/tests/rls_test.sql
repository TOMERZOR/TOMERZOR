-- Row-level-security tests. Each block acts as one user and asserts what it
-- may and may not do. Any failed assertion stops the run with an error.

create schema test;
grant usage on schema test to anon, authenticated;

-- Runs a statement and checks that it fails with a message matching `pattern`.
create function test.expect_error(stmt text, pattern text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected an error matching "%" from: %', pattern, stmt;
exception when others then
  if sqlerrm like 'expected an error%' then raise; end if;
  if sqlerrm !~* pattern then
    raise exception 'wrong error for %: got "%", wanted "%"', stmt, sqlerrm, pattern;
  end if;
end $$;

-- Runs a statement and returns how many rows it touched.
create function test.rows(stmt text) returns int language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema test to anon, authenticated;

create function test.act_as(who uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), false);
end $$;

\set alice '''a0000000-0000-0000-0000-000000000001'''
\set bob   '''b0000000-0000-0000-0000-000000000002'''
\set carol '''c0000000-0000-0000-0000-000000000003'''

-- Sign-up creates a profile and private settings.
insert into auth.users (id, email) values
  (:alice, 'alice@example.com'), (:bob, 'bob@example.com'), (:carol, 'carol@example.com');
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profiles created on sign-up';
  assert (select count(*) from public.private_settings) = 3, 'private settings created on sign-up';
end $$;

-- Anonymous visitors read nothing.
set role anon;
select test.act_as(null);
select test.expect_error('select * from public.posts', 'permission denied');
select test.expect_error('select * from public.profiles', 'permission denied');
reset role;

-- ── Profiles ──
set role authenticated;
select test.act_as(:alice);
do $$ begin
  assert test.rows($q$update public.profiles set name = 'Alice', pace = 4.5 where id = auth.uid()$q$) = 1, 'edit own profile';
  assert test.rows($q$update public.profiles set name = 'hacked' where id <> auth.uid()$q$) = 0, 'cannot edit others';
  assert test.rows($q$update public.private_settings set emergency_phone = '050-0000000'$q$) = 1, 'edit own emergency contact';
end $$;
select test.expect_error($q$update public.profiles set verified = true where id = auth.uid()$q$, 'permission denied');

select test.act_as(:bob);
do $$ begin
  assert (select count(*) from public.private_settings) = 1, 'only own private settings visible';
  assert (select emergency_phone from public.private_settings) = '', 'bob sees his own, not alice''s';
  assert (select count(*) from public.profiles) = 3, 'profiles are readable to signed-in users';
end $$;

-- ── Posts ──
select test.act_as(:alice);
insert into public.posts (id, trail_id, start_date, spots, pace, level, car, meet)
values ('11111111-0000-0000-0000-000000000001', 'ramon', current_date + 1, 1, 4.5, 'קשה', 'shuttle', 'מצפה רמון');
select test.expect_error(
  $q$insert into public.posts (author_id, trail_id, start_date, spots, pace, level, car) values ('b0000000-0000-0000-0000-000000000002', 'amud', current_date, 2, 4, 'קל', 'has-car')$q$,
  'row-level security');
select test.expect_error(
  $q$insert into public.posts (trail_id, start_date, spots, pace, level, car) values ('nowhere', current_date, 2, 4, 'קל', 'has-car')$q$,
  'foreign key');
select test.expect_error(
  $q$insert into public.join_requests (post_id) values ('11111111-0000-0000-0000-000000000001')$q$,
  'own hike');

select test.act_as(:bob);
do $$ begin
  assert test.rows($q$update public.posts set note = 'mine now'$q$) = 0, 'cannot edit someone else''s post';
  assert test.rows($q$delete from public.posts$q$) = 0, 'cannot delete someone else''s post';
end $$;

-- ── Join requests ──
insert into public.join_requests (post_id, message) values ('11111111-0000-0000-0000-000000000001', 'אשמח להצטרף');
select test.expect_error(
  $q$update public.join_requests set status = 'accepted' where user_id = auth.uid()$q$,
  'row-level security|cannot change');

select test.act_as(:carol);
do $$ begin
  assert (select count(*) from public.join_requests) = 0, 'strangers do not see pending requests';
end $$;
insert into public.join_requests (post_id) values ('11111111-0000-0000-0000-000000000001');

select test.act_as(:alice);
do $$ begin
  assert (select count(*) from public.join_requests) = 2, 'organiser sees all requests on the hike';
  assert test.rows($q$update public.join_requests set status = 'accepted' where user_id = 'b0000000-0000-0000-0000-000000000002'$q$) = 1, 'organiser accepts';
end $$;
-- one spot only: the second accept must fail
select test.expect_error(
  $q$update public.join_requests set status = 'accepted' where user_id = 'c0000000-0000-0000-0000-000000000003'$q$,
  'group is full');
update public.join_requests set status = 'declined' where user_id = :carol;

select test.act_as(:carol);
do $$ begin
  assert (select count(*) from public.join_requests where status = 'accepted') = 1, 'the crew list is public';
  assert (select status from public.join_requests where user_id = auth.uid()) = 'declined', 'requester sees own answer';
end $$;
select test.expect_error(
  $q$update public.join_requests set status = 'pending' where user_id = auth.uid()$q$,
  'cannot change');

select test.act_as(:bob);
update public.join_requests set status = 'withdrawn' where user_id = auth.uid();
update public.join_requests set status = 'pending' where user_id = auth.uid();

-- ── Threads and messages ──
select test.act_as(:bob);
select public.start_thread(:alice, '11111111-0000-0000-0000-000000000001') as thread_id \gset
do $$ begin
  assert public.start_thread('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001')
    = (select id from public.threads limit 1), 'start_thread reuses the existing thread';
  assert (select plan->>'meet' from public.threads) = 'מצפה רמון', 'plan starts from the post';
end $$;
insert into public.messages (thread_id, body) values (:'thread_id', 'היי, מתי יוצאים?');
select test.expect_error(
  format($q$insert into public.messages (thread_id, body, sender_id) values (%L, 'fake', 'a0000000-0000-0000-0000-000000000001')$q$, :'thread_id'),
  'permission denied');
select test.expect_error(
  $q$select public.start_thread('b0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001')$q$,
  'yourself');

select test.act_as(:alice);
insert into public.messages (thread_id, body) values (:'thread_id', 'נפגשים 5:15');
do $$ begin
  assert (select count(*) from public.messages) = 2, 'both members read the thread';
  assert test.rows($q$update public.threads set plan = plan || '{"cars":"רכב של אליס בסוף"}'$q$) = 1, 'members edit the plan';
  assert test.rows($q$update public.thread_members set last_read_at = now() where user_id = auth.uid()$q$) = 1, 'mark own thread read';
  assert test.rows($q$update public.thread_members set last_read_at = now() where user_id <> auth.uid()$q$) = 0, 'cannot mark for others';
end $$;

select test.act_as(:carol);
do $$ begin
  assert (select count(*) from public.threads) = 0, 'outsiders do not see the thread';
  assert (select count(*) from public.messages) = 0, 'outsiders do not read messages';
  assert test.rows($q$update public.threads set plan = '{}'$q$) = 0, 'outsiders cannot edit the plan';
end $$;
select test.expect_error(
  format($q$insert into public.messages (thread_id, body) values (%L, 'שלום')$q$, :'thread_id'),
  'row-level security');
-- carol cannot open a conversation between herself and bob about alice's hike
select test.expect_error(
  $q$select public.start_thread('b0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001')$q$,
  'organiser');

-- ── Stats ──
do $$ begin
  assert (select hikes from public.profile_stats where id = 'a0000000-0000-0000-0000-000000000001') = 0, 'future hikes do not count yet';
end $$;
reset role;
