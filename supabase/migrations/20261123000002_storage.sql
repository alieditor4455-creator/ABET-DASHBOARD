-- File storage: one private bucket. Files are only reachable through signed URLs
-- issued to active team members. Nothing is deleted by the app: assets are archived.

insert into storage.buckets (id, name, public, file_size_limit)
values ('content', 'content', false, 52428800)   -- 50 MB, the Supabase free-plan per-file limit
on conflict (id) do nothing;

create policy content_read on storage.objects for select to authenticated
  using (bucket_id = 'content' and public.is_member());

create policy content_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and public.has_perm('content.create'));
