-- Five storage buckets made in the Supabase dashboard in July 2026
-- (Avatars, card-backs, table-themes, emotes, audio-taunts) were never used
-- by the app, and their "Allow Uploads" policies let anyone, signed in or
-- not, upload and overwrite files of up to 10 MB in them. Drop those
-- policies and the (empty) buckets. Only the `stickers` bucket stays.

drop policy if exists "Allow Uploads 1djiqkb_0" on storage.objects;
drop policy if exists "Allow Uploads 1djiqkb_1" on storage.objects;
drop policy if exists "Allow Uploads 1djiqkb_2" on storage.objects;
drop policy if exists "Allow Uploads 1rifckv_0" on storage.objects;
drop policy if exists "Allow Uploads 1rifckv_1" on storage.objects;
drop policy if exists "Allow Uploads 1rifckv_2" on storage.objects;
drop policy if exists "Allow Uploads 3evjjd_0" on storage.objects;
drop policy if exists "Allow Uploads 3evjjd_1" on storage.objects;
drop policy if exists "Allow Uploads 3evjjd_2" on storage.objects;
drop policy if exists "Allow Uploads h0za56_0" on storage.objects;
drop policy if exists "Allow Uploads h0za56_1" on storage.objects;
drop policy if exists "Allow Uploads h0za56_2" on storage.objects;
drop policy if exists "Allow Uploads nwz4bg_0" on storage.objects;
drop policy if exists "Allow Uploads nwz4bg_1" on storage.objects;
drop policy if exists "Allow Uploads nwz4bg_2" on storage.objects;

do $$
declare
  old text[] := array['Avatars', 'card-backs', 'table-themes', 'emotes', 'audio-taunts'];
begin
  if exists (select 1 from storage.objects where bucket_id = any (old)) then
    raise exception 'Not removing the old buckets: one of them has files in it.';
  end if;
  -- Storage guards against deleting bucket rows directly because it can
  -- orphan their files. These buckets are empty, so the guard is lifted for
  -- this transaction only.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = any (old);
end
$$;
