-- ABET Content OS update 5: references library and styles built from references. Safe: keeps all data; safe to run again.
begin;
-- References library: the team collects reference videos, designs and links per category.
-- Admins turn a set of references into a new style (Claude builds it, an admin approves it);
-- anyone can attach references to a single request ("make it like this").

create table if not exists public.style_references (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  title text not null check (length(title) between 1 and 120),
  notes text not null default '' check (length(notes) <= 1000),
  asset_id uuid references public.assets(id) on delete set null,
  url text check (url is null or url ~* '^https?://'),
  archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint style_references_source check (asset_id is not null or url is not null)
);
create index if not exists style_references_type on public.style_references (content_type, created_at desc);
alter table public.style_references enable row level security;
drop policy if exists read_members on public.style_references;
create policy read_members on public.style_references for select to authenticated using (public.is_member());
drop policy if exists add_references on public.style_references;
create policy add_references on public.style_references for insert to authenticated with check (public.has_perm('content.create') and created_by = auth.uid());
drop policy if exists edit_references on public.style_references;
create policy edit_references on public.style_references for update to authenticated using (created_by = auth.uid() or public.has_perm('styles.manage'));
grant select, insert, update on public.style_references to authenticated;
revoke all on public.style_references from anon;

-- Styles requested from references
alter table public.styles add column if not exists source_reference_ids uuid[] not null default '{}';
alter table public.styles add column if not exists claude_requested_at timestamptz;
alter table public.styles add column if not exists claude_requested_by uuid references public.profiles(id);
alter table public.styles add column if not exists claude_note text;
alter table public.styles add column if not exists claude_built_at timestamptz;

create or replace function public.reference_brief(ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'notes', r.notes, 'url', r.url,
           'file', a.storage_path, 'file_name', a.name, 'size_bytes', a.size_bytes) order by r.created_at), '[]'::jsonb)
  from public.style_references r left join public.assets a on a.id = r.asset_id
  where r.id = any(ids)
$$;
revoke all on function public.reference_brief(uuid[]) from public, anon, authenticated;

-- Video briefs now include any references attached to the request.
create or replace function public.video_job_brief(j public.production_jobs) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'job_id', j.id, 'status', j.status, 'requested_at', j.created_at, 'request', j.request,
    'requested_by', (select full_name from public.profiles where id = j.created_by),
    'item', (select jsonb_build_object('id', i.id, 'title', i.title, 'topic', i.topic, 'type', i.type, 'audience', i.audience,
                                       'objective', i.objective, 'note', i.request_note) from public.content_items i where i.id = j.item_id),
    'style', (select jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'spec', s.spec, 'template', s.template_kind,
                                        'execution_config', s.execution_config, 'output_formats', s.output_formats, 'required_assets', s.required_assets,
                                        'references', public.reference_brief(s.source_reference_ids))
              from public.styles s where s.id = j.style_id),
    'references', public.reference_brief(coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(j.request->'reference_ids', '[]'::jsonb)) x), '{}')))
$$;
revoke all on function public.video_job_brief(public.production_jobs) from public, anon, authenticated;

-- Worker: styles waiting for Claude to build from references
create or replace function public.style_requests() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('content.create') then raise exception 'Your ABET role can’t work on style requests'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('style_id', s.id, 'name', s.name, 'content_type', s.content_type, 'note', s.claude_note,
      'requested_by', (select full_name from public.profiles where id = s.claude_requested_by), 'requested_at', s.claude_requested_at,
      'references', public.reference_brief(s.source_reference_ids)) order by s.claude_requested_at)
    from public.styles s
    where s.claude_requested_at is not null and s.claude_built_at is null and s.status = 'in_development' and not s.archived), '[]'::jsonb);
end $$;

-- Worker: save the style Claude built (needs an uploaded preview under styles/<style_id>/)
create or replace function public.save_style_draft(p_style uuid, p_description text, p_spec jsonb, p_config jsonb, p_preview_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.styles; obj record; a uuid; tmpl text;
begin
  if not public.has_perm('content.create') then raise exception 'Your ABET role can’t work on style requests'; end if;
  select * into s from public.styles where id = p_style for update;
  if s.id is null or s.claude_requested_at is null or s.claude_built_at is not null or s.status <> 'in_development' then
    raise exception 'This style isn’t waiting for Claude.';
  end if;
  if jsonb_typeof(p_spec) <> 'array' or jsonb_typeof(p_config) <> 'object' then raise exception 'spec must be a list and config an object.'; end if;
  tmpl := coalesce(p_config->>'template', 'cinema');
  if p_preview_path is not null then
    if p_preview_path not like 'styles/' || s.id || '/%' then raise exception 'Upload the preview with get_style_upload_url first.'; end if;
    select o.name, coalesce((o.metadata->>'size')::bigint, 0) as size into obj from storage.objects o where o.bucket_id = 'content' and o.name = p_preview_path;
    if obj.name is null then raise exception 'The preview file isn’t in storage yet.'; end if;
    insert into public.assets (item_id, name, kind, storage_path, size_bytes, created_by)
    values (null, s.name || ' preview', 'Reference', obj.name, obj.size, auth.uid())
    on conflict (storage_path) do update set size_bytes = excluded.size_bytes returning id into a;
  end if;
  update public.styles
     set description = left(coalesce(p_description, description), 400), spec = p_spec,
         execution_config = p_config || jsonb_build_object('engine', 'claude', 'template', tmpl),
         template_kind = 'claude:' || tmpl, template_version = template_version + 1,
         preview_asset_id = coalesce(a, preview_asset_id), status = 'pending_approval', claude_built_at = now()
   where id = s.id;
  perform public.notify(s.claude_requested_by, null, 'style', format('Claude built the style “%s”. Review and approve it in Creative Styles.', s.name));
  insert into public.activity (item_id, actor_id, via, message) values (null, auth.uid(), 'claude', format('built the style “%s” from %s references', s.name, coalesce(array_length(s.source_reference_ids, 1), 0)));
  return jsonb_build_object('ok', true, 'style_id', s.id, 'status', 'pending_approval');
end $$;

revoke all on function public.style_requests(), public.save_style_draft(uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.style_requests(), public.save_style_draft(uuid, text, jsonb, jsonb, text) to authenticated;

commit;
