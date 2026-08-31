-- Photographed card slips live in a PRIVATE bucket.
--
-- Deliberately unlike menu-photos, which is public. A slip carries the masked
-- card number, the merchant id and the approval code. None of that is
-- catastrophic on its own, and none of it belongs on a public URL that anyone
-- who guesses a path can read. Reads go through short-lived signed URLs, and
-- only for a signed-in device.
--
-- Run once, in the Supabase SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-slips',
  'payment-slips',
  false,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Staff only, in every direction. There is no public read here on purpose.
drop policy if exists "signed-in staff can read card slips" on storage.objects;
create policy "signed-in staff can read card slips"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips');

drop policy if exists "signed-in staff can upload card slips" on storage.objects;
create policy "signed-in staff can upload card slips"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips');

-- Upsert, so a blurry photo can simply be retaken.
drop policy if exists "signed-in staff can replace card slips" on storage.objects;
create policy "signed-in staff can replace card slips"
  on storage.objects for update to authenticated
  using (bucket_id = 'payment-slips');
