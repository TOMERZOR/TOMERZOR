-- Check-in tests. Runs after rls_test.sql and reuses its users, its hike
-- (11111111-…-0001, organised by Alice) and the test helpers.

\set alice '''a0000000-0000-0000-0000-000000000001'''
\set bob   '''b0000000-0000-0000-0000-000000000002'''
\set carol '''c0000000-0000-0000-0000-000000000003'''
\set hike  '''11111111-0000-0000-0000-000000000001'''

-- Bob is back on the crew; Carol was declined.
set role authenticated;
select test.act_as(:alice);
update public.join_requests set status = 'accepted' where user_id = :bob;
update public.private_settings set emergency_name = 'אמא של אליס';

-- ── Who may check in ──
insert into public.checkins (post_id, return_by) values (:hike, now() + interval '8 hours');

select test.act_as(:bob);
update public.profiles set name = 'בוב' where id = auth.uid();
insert into public.checkins (post_id, return_by) values (:hike, now() + interval '9 hours');
select test.expect_error(
  $q$insert into public.checkins (post_id, return_by) values ('11111111-0000-0000-0000-000000000001', now() - interval '1 hour')$q$,
  'duplicate key|future');

select test.act_as(:carol);
select test.expect_error(
  $q$insert into public.checkins (post_id, return_by) values ('11111111-0000-0000-0000-000000000001', now() + interval '2 hours')$q$,
  'row-level security');
do $$ begin
  assert (select count(*) from public.checkins) = 0, 'people outside the hike see no check-ins';
end $$;

select test.act_as(:bob);
do $$ begin
  assert (select count(*) from public.checkins) = 2, 'crew members see each other''s check-ins';
  assert test.rows($q$update public.checkins set return_by = now() + interval '1 day' where user_id <> auth.uid()$q$) = 0,
    'cannot change a partner''s check-in';
end $$;
select test.expect_error(
  $q$update public.checkins set return_by = now() - interval '1 minute' where user_id = auth.uid()$q$, 'future');
select test.expect_error(
  $q$update public.checkins set return_by = now() + interval '30 days' where user_id = auth.uid()$q$, 'too far');
select test.expect_error(
  $q$update public.checkins set status = 'alerted' where user_id = auth.uid()$q$, 'row-level security|alert job');

-- Marking yourself back stamps the time.
update public.checkins set status = 'returned' where user_id = auth.uid();
do $$ begin
  assert (select returned_at from public.checkins where user_id = auth.uid()) is not null, 'returned_at is stamped';
end $$;
update public.checkins set status = 'scheduled', return_by = now() + interval '3 hours' where user_id = auth.uid();
do $$ begin
  assert (select returned_at from public.checkins where user_id = auth.uid()) is null, 'returned_at clears when rescheduled';
end $$;

-- Only the service role runs the alert job.
select test.expect_error($q$select * from public.claim_overdue_checkins()$q$, 'permission denied');
reset role;
select test.act_as(null);

-- ── Alert job ──
-- Alice's return time passes (set directly, as time would).
update public.checkins set return_by = now() - interval '45 minutes' where user_id = :alice;

set role service_role;
create temp table run1 as select * from public.claim_overdue_checkins();
do $$ begin
  assert (select count(*) from run1) = 1, 'one overdue check-in is claimed';
  assert (select kind from run1) = 'overdue', 'it is an overdue alert';
  assert (select hiker_name from run1) = 'Alice', 'with the hiker''s name';
  assert (select contact_phone from run1) = '050-0000000', 'and the private emergency phone';
  assert (select contact_name from run1) = 'אמא של אליס', 'and the contact''s name';
  assert (select partners from run1) = array['בוב'], 'partners are listed by name';
  assert (select count(*) from public.claim_overdue_checkins()) = 0, 'a second run does not text again';
end $$;

-- A failed send is released and picked up again.
select public.release_checkin_claim((select checkin_id from run1), 'overdue');
do $$ begin
  assert (select count(*) from public.claim_overdue_checkins()) = 1, 'released claim is retried';
end $$;

-- Inside the grace period nothing goes out.
reset role;
select test.act_as(null);
update public.checkins set return_by = now() - interval '10 minutes' where user_id = :bob;
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_overdue_checkins()) = 0, 'grace period is respected';
end $$;
reset role;
select test.act_as(null);

-- After an alert, Alice can only mark herself back; that triggers an all-clear.
set role authenticated;
select test.act_as(:alice);
select test.expect_error(
  $q$update public.checkins set return_by = now() + interval '1 hour' where user_id = auth.uid()$q$, 'alert already went out');
select test.expect_error(
  $q$update public.checkins set status = 'cancelled' where user_id = auth.uid()$q$, 'only change is marking yourself back');
update public.checkins set status = 'returned' where user_id = auth.uid();
reset role;
select test.act_as(null);

set role service_role;
do $$ begin
  assert (select kind from public.claim_overdue_checkins()) = 'all-clear', 'marking back after an alert sends an all-clear';
  assert (select count(*) from public.claim_overdue_checkins()) = 0, 'the all-clear goes out once';
end $$;
reset role;
select test.act_as(null);
