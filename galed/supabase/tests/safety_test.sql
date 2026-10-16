-- Safety tests: blocking, reporting, the text filter, terms and account
-- deletion. Runs after checkins_test.sql and reuses its users and data.

\set alice '''a0000000-0000-0000-0000-000000000001'''
\set bob   '''b0000000-0000-0000-0000-000000000002'''
\set carol '''c0000000-0000-0000-0000-000000000003'''
\set hike  '''11111111-0000-0000-0000-000000000001'''

insert into auth.users (id, email) values ('d0000000-0000-0000-0000-000000000004', 'dana@example.com');
\set dana '''d0000000-0000-0000-0000-000000000004'''

set role authenticated;

-- ── Text filter ──
select test.act_as(:bob);
select test.expect_error(
  format($q$insert into public.messages (thread_id, body) values ((select id from public.threads limit 1), %L)$q$, 'יא בן זונה'),
  'objectionable');
select test.expect_error($q$update public.profiles set bio = 'FUCK this' where id = auth.uid()$q$, 'objectionable');
insert into public.messages (thread_id, body) values ((select id from public.threads limit 1), 'נפגשים בחניון ב-5:15');

select test.act_as(:alice);
select test.expect_error(
  $q$insert into public.posts (trail_id, start_date, spots, pace, level, car, note) values ('amud', current_date + 3, 2, 4, 'קל', 'has-car', 'רק בלי שרמוטות')$q$,
  'objectionable');

-- ── Terms and age ──
select test.act_as(:dana);
select test.expect_error(
  format($q$update public.profiles set birth_year = %s where id = auth.uid()$q$, extract(year from now())::int - 16),
  '18 and up');
update public.profiles set name = 'דנה', birth_year = 1990, terms_accepted_at = '2001-01-01' where id = auth.uid();
do $$ begin
  assert (select terms_accepted_at from public.profiles where id = auth.uid()) > now() - interval '1 minute',
    'the server stamps the acceptance time, whatever the client sent';
  assert test.rows($q$update public.profiles set terms_accepted_at = null where id = auth.uid()$q$) = 1, 'update runs';
  assert (select terms_accepted_at from public.profiles where id = auth.uid()) is not null, 'acceptance cannot be withdrawn by clearing it';
end $$;

-- ── Blocking ──
-- Dana publishes a hike; Bob can see her and it.
insert into public.posts (id, trail_id, start_date, spots, pace, level, car)
values ('22222222-0000-0000-0000-000000000002', 'golan', current_date + 4, 3, 4, 'בינוני', 'has-car');
select test.act_as(:bob);
do $$ begin
  assert (select count(*) from public.profiles where id = 'd0000000-0000-0000-0000-000000000004') = 1, 'Bob sees Dana';
  assert (select count(*) from public.posts where id = '22222222-0000-0000-0000-000000000002') = 1, 'Bob sees her hike';
end $$;

-- Dana blocks Bob.
select test.act_as(:dana);
insert into public.blocks (blocked_id) values (:bob);
select test.expect_error(format($q$insert into public.blocks (blocked_id) values (%L)$q$, :dana), 'check');
do $$ begin
  assert (select count(*) from public.blocks) = 1, 'Dana sees her block';
  assert (select blocked_name from public.blocks) = 'בוב', 'with the name, for her blocked list';
  assert (select count(*) from public.profiles where id = 'b0000000-0000-0000-0000-000000000002') = 0, 'Dana no longer sees Bob';
end $$;

select test.act_as(:bob);
do $$ begin
  assert (select count(*) from public.blocks) = 0, 'Bob cannot see that Dana blocked him';
  assert (select count(*) from public.profiles where id = 'd0000000-0000-0000-0000-000000000004') = 0, 'Bob no longer sees Dana';
  assert (select count(*) from public.posts where id = '22222222-0000-0000-0000-000000000002') = 0, 'or her hike';
end $$;
select test.expect_error($q$insert into public.join_requests (post_id) values ('22222222-0000-0000-0000-000000000002')$q$, 'blocked');
select test.expect_error(
  $q$select public.start_thread('d0000000-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002')$q$, 'blocked');

-- Alice blocks Bob mid-conversation: Bob can no longer write in their thread.
select test.act_as(:alice);
insert into public.blocks (blocked_id) values (:bob);
select test.act_as(:bob);
select test.expect_error(
  $q$insert into public.messages (thread_id, body) values ((select id from public.threads limit 1), 'שלום?')$q$, 'row-level security');
select test.act_as(:alice);
select test.expect_error(
  $q$insert into public.messages (thread_id, body) values ((select id from public.threads limit 1), 'שלום')$q$, 'row-level security');
delete from public.blocks where blocked_id = :bob;
insert into public.messages (thread_id, body) values ((select id from public.threads limit 1), 'סליחה, לחצתי בטעות');

-- ── Reports ──
select test.act_as(:bob);
insert into public.reports (target_id, post_id, reason, details, snapshot)
values (:alice, :hike, 'unsafe', 'לא מצליח לפרט', 'מסלול קווי');
select test.expect_error(format($q$insert into public.reports (target_id, reason) values (%L, 'spam')$q$, :bob), 'check');
select test.expect_error(
  format($q$insert into public.reports (reporter_id, target_id, reason) values (%L, %L, 'spam')$q$, :carol, :alice), 'permission denied');
do $$ begin
  assert (select count(*) from public.reports) = 1, 'Bob sees his own report';
end $$;
select test.act_as(:alice);
do $$ begin
  assert (select count(*) from public.reports) = 0, 'the reported person does not see the report';
end $$;
select test.expect_error($q$select * from public.banned_terms$q$, 'permission denied');

-- ── Account deletion ──
select test.act_as(:dana);
select public.delete_my_account();
reset role;
select test.act_as(null);
do $$ begin
  assert (select count(*) from auth.users where id = 'd0000000-0000-0000-0000-000000000004') = 0, 'sign-in deleted';
  assert (select count(*) from public.profiles where id = 'd0000000-0000-0000-0000-000000000004') = 0, 'profile deleted';
  assert (select count(*) from public.posts where id = '22222222-0000-0000-0000-000000000002') = 0, 'her hikes deleted';
  assert (select count(*) from public.blocks where blocker_id = 'd0000000-0000-0000-0000-000000000004') = 0, 'her blocks deleted';
  assert (select count(*) from public.private_settings where user_id = 'd0000000-0000-0000-0000-000000000004') = 0, 'private settings deleted';
end $$;
set role anon;
select test.expect_error($q$select public.delete_my_account()$q$, 'permission denied');
reset role;
