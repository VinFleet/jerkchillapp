-- Menu photography lives in a PUBLIC bucket, unlike documents.
--
-- A certificate is served through a short-lived signed URL because only staff
-- should ever see it. A menu photo is the opposite: a guest's phone loads it
-- with no session at all, straight from a QR code, so a signed URL would be
-- expired before the second table scanned. Nothing here is sensitive — these
-- are the same photographs that go on the printed menu and the delivery apps.
--
-- Run once, in the Supabase SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  -- Uploads are downscaled in the browser to roughly 900px before they leave
  -- the device; this is the backstop for a client that skipped that.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read: that is the entire point of the bucket.
drop policy if exists "menu photos are publicly readable" on storage.objects;
create policy "menu photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

-- Only a signed-in device may add or replace one. Guests read; staff write.
drop policy if exists "signed-in staff can upload menu photos" on storage.objects;
create policy "signed-in staff can upload menu photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-photos');

drop policy if exists "signed-in staff can replace menu photos" on storage.objects;
create policy "signed-in staff can replace menu photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'menu-photos');

drop policy if exists "signed-in staff can remove menu photos" on storage.objects;
create policy "signed-in staff can remove menu photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-photos');
