-- 9Pay POS terminal credentials, per branch.
--
-- Same reasoning as branch_secrets' webhook secret, and the same protection:
-- whoever holds the signing key can create charges in the restaurant's name,
-- and whoever holds the checksum key can forge a "card payment succeeded"
-- that closes a bill nobody paid. So these never go near synced_records —
-- every member of a branch can read those — and this table keeps RLS on with
-- NO policies, which in Postgres means service-role only.
--
-- The POS terminal's serial number is NOT a secret and lives here anyway,
-- because it is useless without the keys and belongs with them.
--
-- Run once, after branch-secrets-schema.sql.

alter table branch_secrets add column if not exists ninepay_merchant_key text;
alter table branch_secrets add column if not exists ninepay_secret_key   text;
alter table branch_secrets add column if not exists ninepay_checksum_key text;
alter table branch_secrets add column if not exists ninepay_serial       text;
-- Sandbox until a branch has been proven against real cards.
alter table branch_secrets add column if not exists ninepay_endpoint     text;

-- webhook_secret was NOT NULL because it was once the only reason a row
-- existed. A branch may now have 9Pay terminal keys and no bank webhook.
alter table branch_secrets alter column webhook_secret drop not null;
