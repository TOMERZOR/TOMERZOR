-- Runs the checkin-alerts edge function every 5 minutes.
-- Before running: deploy the function, set its secrets (see README), and
-- replace the two placeholders below. Run once in the Supabase SQL editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The same value you set as the function's CRON_SECRET.
select vault.create_secret('<CRON_SECRET>', 'checkin_alerts_cron_secret');

select cron.schedule(
  'checkin-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/checkin-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_alerts_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
