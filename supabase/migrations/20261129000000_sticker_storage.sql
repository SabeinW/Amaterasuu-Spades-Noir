-- Players' own stickers for table talk (the "Mine" tab in the GIF picker).
--
-- One public bucket, so everyone at the table can see a sticker once it's
-- thrown. Each player can only list, add to and remove from their own folder
-- (`<user id>/...`), at most 40 stickers each. The app shrinks images to
-- 320px before uploading; the bucket refuses anything over 512 KB or that
-- isn't a picture.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 524288, array['image/png', 'image/webp', 'image/gif', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Stickers: see my own" on storage.objects;
create policy "Stickers: see my own" on storage.objects
  for select to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Stickers: add my own, 40 at most" on storage.objects;
create policy "Stickers: add my own, 40 at most" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'stickers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'stickers' and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 40
  );

drop policy if exists "Stickers: remove my own" on storage.objects;
create policy "Stickers: remove my own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);
