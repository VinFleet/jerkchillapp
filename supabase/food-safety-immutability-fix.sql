-- The append-only guard was checking the wrong thing.
--
-- guard_food_safety_append_only() (sync-schema.sql) blocked deleting a
-- food-safety row and blocked re-keying one, but never compared new.data to
-- old.data — so a raw REST call with any authenticated staff session could
-- silently rewrite the CONTENTS of an already-filed legal record, exactly
-- the tampering CLAUDE.md's rule 3 says the database guarantees against.
--
-- Four fs_ collections are legitimately mutable in place — a cleaning
-- sign-off withdrawn, a sample marked discarded, a pest report closed, a
-- complaint's outcome added (see the `mutable: true` collections in
-- src/lib/sync/collections.ts). Every other fs_ collection corrects by
-- writing a NEW row with correctionOfId; the app itself never rewrites one
-- of those in place (confirmed: pushCollection's skipAlreadyPushed logic
-- means the client never re-pushes an already-synced immutable-family
-- record), so this migration changes no app behavior — it only closes the
-- gap between what was documented and what was enforced.
--
-- Run once, after sync-schema.sql.

create or replace function guard_food_safety_append_only()
returns trigger as $$
begin
  if old.collection like 'fs\_%' then
    if new.deleted then
      raise exception 'Food-safety records cannot be deleted (collection %, record %)', old.collection, old.record_id;
    end if;
    if new.record_id <> old.record_id or new.collection <> old.collection then
      raise exception 'Food-safety records cannot be re-keyed';
    end if;
    if old.collection not in ('fs_cleaning_signoffs', 'fs_samples', 'fs_pest', 'fs_complaints')
       and new.data is distinct from old.data then
      raise exception 'This food-safety record is immutable — log a new entry with correctionOfId instead (collection %, record %)', old.collection, old.record_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
