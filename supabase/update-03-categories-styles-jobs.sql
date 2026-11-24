-- ABET Content OS update 3: six content categories, reference-based creative styles, production jobs. Safe: keeps all data.
begin;
-- Update 3: six content categories, reference-based creative styles, production jobs.
-- Category keys reuse existing values so no data is lost:
--   reel = Short Form, yt = Long Form, explainer, pdf, carousel, ad = Ads (video + static).

-- ---------------------------------------------------------------- categories
update public.content_items set type = 'reel' where type = 'motion';
update public.content_items set type = 'ad' where type in ('graphic', 'poster');
alter table public.content_items drop constraint if exists content_items_six_categories;
alter table public.content_items add constraint content_items_six_categories
  check (type in ('reel', 'yt', 'explainer', 'pdf', 'carousel', 'ad'));

-- ---------------------------------------------------------------- creative styles
alter table public.styles add column if not exists content_type public.content_type;
alter table public.styles add column if not exists status text not null default 'draft';
alter table public.styles add column if not exists active boolean not null default false;
alter table public.styles add column if not exists reference_asset_ids uuid[] not null default '{}';
alter table public.styles add column if not exists preview_asset_id uuid references public.assets(id) on delete set null;
alter table public.styles add column if not exists template_kind text;          -- renderer id in the production engine; null = not built yet
alter table public.styles add column if not exists template_version int not null default 0;
alter table public.styles add column if not exists output_formats text[] not null default '{}';
alter table public.styles add column if not exists required_assets jsonb not null default '[]'::jsonb;
alter table public.styles add column if not exists execution_config jsonb not null default '{}'::jsonb;
alter table public.styles add column if not exists approved_by uuid references public.profiles(id);
alter table public.styles add column if not exists approved_at timestamptz;
alter table public.styles drop constraint if exists styles_status_check;
alter table public.styles add constraint styles_status_check check (status in ('draft', 'in_development', 'pending_approval', 'approved'));
alter table public.styles drop constraint if exists styles_content_type_check;
alter table public.styles add constraint styles_content_type_check check (content_type is null or content_type in ('reel', 'yt', 'explainer', 'pdf', 'carousel', 'ad'));

-- The earlier generic presets are archived (hidden, recoverable). Categories start empty.
update public.styles set archived = true, active = false where content_type is null and not is_custom;
-- Items no longer point at archived presets.
update public.content_items c set style_id = null from public.styles s where c.style_id = s.id and s.archived;

-- Ordinary team members see only approved, active styles; style managers see everything.
drop policy if exists read_members on public.styles;
create policy read_members on public.styles for select to authenticated using (
  public.is_member() and (public.has_perm('styles.manage') or (status = 'approved' and active and not archived)));

-- Only approvers can mark a style approved.
create or replace function public.enforce_style_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if not (public.has_perm('content.approve') and public.has_perm('styles.manage')) then
      raise exception 'Only an admin or marketing manager can approve a style';
    end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  if new.status <> 'approved' then new.active := false; end if;
  return new;
end $$;
drop trigger if exists styles_rules on public.styles;
create trigger styles_rules before insert or update on public.styles for each row execute function public.enforce_style_rules();

-- ---------------------------------------------------------------- production jobs
create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  style_id uuid references public.styles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'waiting_for_claude')),
  stage text not null default 'Queued',
  progress int not null default 0 check (progress between 0 and 100),
  steps jsonb not null default '[]'::jsonb,     -- [{name, status, at, detail}]
  error text,
  result_asset_id uuid references public.assets(id) on delete set null,
  engine text,                                   -- 'claude-api', 'claude-queue', renderer id
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_jobs_item on public.production_jobs (item_id, created_at desc);
alter table public.production_jobs enable row level security;
drop policy if exists read_members on public.production_jobs;
create policy read_members on public.production_jobs for select to authenticated using (public.is_member());
drop policy if exists create_jobs on public.production_jobs;
create policy create_jobs on public.production_jobs for insert to authenticated with check (public.has_perm('content.create') and created_by = auth.uid());
drop policy if exists update_own_jobs on public.production_jobs;
create policy update_own_jobs on public.production_jobs for update to authenticated using (created_by = auth.uid() or public.has_perm('content.edit_any'));
drop trigger if exists production_jobs_touch on public.production_jobs;
create trigger production_jobs_touch before update on public.production_jobs for each row execute function public.touch_updated_at();

-- Finished job: tell the person who started it.
create or replace function public.on_job_finished() returns trigger
language plpgsql security definer set search_path = public as $$
declare it public.content_items;
begin
  if new.status is distinct from old.status and new.status in ('succeeded', 'failed') then
    select * into it from public.content_items where id = new.item_id;
    insert into public.notifications (user_id, item_id, kind, message)
    values (new.created_by, new.item_id, case when new.status = 'succeeded' then 'script' else 'compliance' end,
            case when new.status = 'succeeded' then format('“%s” is ready', it.title) else format('Generating “%s” failed: %s', it.title, coalesce(new.error, 'unknown error')) end);
  end if;
  return new;
end $$;
drop trigger if exists production_jobs_notify on public.production_jobs;
create trigger production_jobs_notify after update on public.production_jobs for each row execute function public.on_job_finished();

grant select, insert, update on public.production_jobs to authenticated;
revoke all on public.production_jobs from anon;

-- A script saved for an item (by Claude through the queue, or by anyone) completes jobs waiting for Claude.
create or replace function public.on_script_saved() returns trigger
language plpgsql security definer set search_path = public as $$
declare it public.content_items;
begin
  select * into it from public.content_items where id = new.item_id;
  if it.needs_script then
    update public.content_items set needs_script = false where id = it.id;
    perform public.notify(it.requested_by, it.id, 'script', format('Claude wrote the script for “%s”', it.title));
  end if;
  if it.owner_id is distinct from it.requested_by or not it.needs_script then
    perform public.notify(it.owner_id, it.id, 'script', format('New script version %s for “%s”', new.version, it.title));
  end if;
  update public.production_jobs
     set status = 'succeeded', progress = 100, stage = 'Script ready',
         steps = steps || jsonb_build_array(jsonb_build_object('name', 'Script written by Claude', 'status', 'done', 'at', now()))
   where item_id = it.id and status = 'waiting_for_claude';
  return new;
end $$;

commit;
