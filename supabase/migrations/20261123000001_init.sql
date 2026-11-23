-- ABET Content OS: initial schema.
-- Permissions are enforced in the database with row-level security (RLS),
-- so they also apply to the Claude connector and any future API.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- roles & permissions
create type public.app_role as enum (
  'super_admin','admin','marketing_manager','content_strategist','scriptwriter',
  'video_editor','motion_designer','graphic_designer','social_media_manager',
  'compliance_reviewer','viewer'
);

create type public.app_permission as enum (
  'content.create','content.edit_any','content.approve','content.compliance',
  'content.publish','styles.manage','team.manage','settings.manage'
);

create table public.role_permissions (
  role public.app_role not null,
  permission public.app_permission not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select r::public.app_role, p::public.app_permission from (values
  ('super_admin','content.create'),('super_admin','content.edit_any'),('super_admin','content.approve'),('super_admin','content.compliance'),('super_admin','content.publish'),('super_admin','styles.manage'),('super_admin','team.manage'),('super_admin','settings.manage'),
  ('admin','content.create'),('admin','content.edit_any'),('admin','content.approve'),('admin','content.compliance'),('admin','content.publish'),('admin','styles.manage'),('admin','team.manage'),
  ('marketing_manager','content.create'),('marketing_manager','content.edit_any'),('marketing_manager','content.approve'),('marketing_manager','content.publish'),('marketing_manager','styles.manage'),
  ('content_strategist','content.create'),('content_strategist','styles.manage'),
  ('scriptwriter','content.create'),
  ('video_editor','content.create'),('video_editor','styles.manage'),
  ('motion_designer','content.create'),('motion_designer','styles.manage'),
  ('graphic_designer','content.create'),('graphic_designer','styles.manage'),
  ('social_media_manager','content.create'),('social_media_manager','content.publish'),
  ('compliance_reviewer','content.approve'),('compliance_reviewer','content.compliance')
) as v(r, p);

-- ---------------------------------------------------------------- people
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_perm(p public.app_permission) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.active and rp.permission = p
  )
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

-- New sign-ups get a Viewer profile. The very first user becomes Super Admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'viewer'::public.app_role else 'super_admin'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- creative styles
create type public.style_category as enum ('video','motion','graphic','ad','pdf');

create table public.styles (
  id uuid primary key default gen_random_uuid(),
  category public.style_category not null,
  name text not null,
  description text not null default '',
  motif text not null default 'mini',
  complexity text not null default 'Medium' check (complexity in ('Low','Medium','High')),
  spec jsonb not null default '[]'::jsonb,       -- [[label, value], ...]
  is_custom boolean not null default false,
  archived boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);

-- ---------------------------------------------------------------- content
create type public.content_type as enum ('reel','yt','explainer','motion','graphic','carousel','poster','ad','pdf');
create type public.content_status as enum ('draft','in_production','in_review','approved','completed');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  topic text not null default '',
  type public.content_type not null,
  style_id uuid references public.styles(id),
  owner_id uuid not null references public.profiles(id),
  status public.content_status not null default 'draft',
  platforms text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  compliance_note text,                          -- open note blocks approval
  audience text,
  objective text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.content_items (status);
create index on public.content_items (scheduled_at);

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  version int not null,
  title text not null,
  length_label text,
  units jsonb not null default '[]'::jsonb,      -- [{label, tc, vo, on, vis}]
  source text not null default 'manual' check (source in ('manual','claude')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

create table public.captions (
  item_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null check (platform in ('IG','FB','YT','TT','LI','X')),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (item_id, platform)
);

-- ---------------------------------------------------------------- assets
create type public.asset_state as enum ('ready','published','archived');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.content_items(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('Video','Graphic','PDF','Reference')),
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  state public.asset_state not null default 'ready',
  backup_verified boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- approvals & activity (audit trail)
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  kind text not null check (kind in ('creative','compliance')),
  decision text not null check (decision in ('approved','changes_requested','note_resolved')),
  note text,
  decided_by uuid not null default auth.uid() references public.profiles(id),
  decided_at timestamptz not null default now()
);

create table public.activity (
  id bigint generated always as identity primary key,
  item_id uuid references public.content_items(id) on delete set null,
  actor_id uuid references public.profiles(id),
  via text not null default 'app' check (via in ('app','claude','system')),
  message text not null,
  created_at timestamptz not null default now()
);
create index on public.activity (created_at desc);

-- ---------------------------------------------------------------- settings
create table public.app_settings (
  id boolean primary key default true check (id),
  storage_limit_gb int not null default 1,
  temp_cleanup_days int not null default 30,
  auto_captions boolean not null default true,
  auto_calendar_suggestions boolean not null default true,
  notify_on_ready boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

create table public.social_connections (
  platform text primary key check (platform in ('IG','FB','YT','TT','LI','X')),
  handle text not null,
  status text not null default 'not_connected' check (status in ('not_connected','connected','error','pending_review')),
  updated_at timestamptz not null default now()
  -- OAuth tokens are stored in Supabase Vault, never in this table.
);
insert into public.social_connections (platform, handle) values
  ('IG','instagram.com/abet.global'),('FB','facebook.com/abetglobal'),('YT','youtube.com/@abetglobal'),
  ('TT','tiktok (not linked on website)'),('LI','linkedin.com/company/abetglobal'),('X','x.com/abetglobal');

-- ---------------------------------------------------------------- workflow rules
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger content_items_touch before update on public.content_items for each row execute function public.touch_updated_at();
create trigger styles_touch before update on public.styles for each row execute function public.touch_updated_at();

-- Status changes follow the production workflow and the approval rules.
create or replace function public.enforce_status_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      if old.status <> 'in_review' then raise exception 'Only content in review can be approved'; end if;
      if not public.has_perm('content.approve') then raise exception 'You do not have permission to approve content'; end if;
      if new.compliance_note is not null then raise exception 'Resolve the compliance note before approving'; end if;
    elsif new.status = 'completed' then
      if old.status <> 'approved' then raise exception 'Approve content before completing it'; end if;
    elsif new.status = 'in_review' then
      if old.status not in ('draft','in_production') then raise exception 'Only drafts or items in production can be sent for review'; end if;
    end if;
    insert into public.activity (item_id, actor_id, message)
    values (new.id, auth.uid(), format('moved "%s" from %s to %s', new.title, old.status, new.status));
  end if;
  if (new.scheduled_at is distinct from old.scheduled_at or new.published_at is distinct from old.published_at) then
    if new.status not in ('approved','completed') then raise exception 'Only approved content can be scheduled or published'; end if;
    if not public.has_perm('content.publish') then raise exception 'You do not have permission to publish'; end if;
  end if;
  if new.compliance_note is null and old.compliance_note is not null and not public.has_perm('content.compliance') then
    raise exception 'Only compliance reviewers can resolve compliance notes';
  end if;
  return new;
end $$;

create trigger content_items_rules before update on public.content_items
for each row execute function public.enforce_status_rules();

-- Profiles: only team managers change roles; nobody can change their own role.
create or replace function public.enforce_profile_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) then
    if not public.has_perm('team.manage') then raise exception 'Only admins can change roles'; end if;
    if new.id = auth.uid() then raise exception 'You cannot change your own role'; end if;
    if new.role = 'super_admin' and public.current_role_name() <> 'super_admin' then raise exception 'Only a super admin can grant super admin'; end if;
  end if;
  return new;
end $$;
create trigger profiles_rules before update on public.profiles for each row execute function public.enforce_profile_rules();

-- ---------------------------------------------------------------- row-level security
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.styles enable row level security;
alter table public.content_items enable row level security;
alter table public.scripts enable row level security;
alter table public.captions enable row level security;
alter table public.assets enable row level security;
alter table public.approvals enable row level security;
alter table public.activity enable row level security;
alter table public.app_settings enable row level security;
alter table public.social_connections enable row level security;

-- Every active team member can read the workspace.
create policy read_members on public.role_permissions for select to authenticated using (public.is_member());
create policy read_members on public.profiles for select to authenticated using (public.is_member());
create policy read_members on public.styles for select to authenticated using (public.is_member());
create policy read_members on public.content_items for select to authenticated using (public.is_member());
create policy read_members on public.scripts for select to authenticated using (public.is_member());
create policy read_members on public.captions for select to authenticated using (public.is_member());
create policy read_members on public.assets for select to authenticated using (public.is_member());
create policy read_members on public.approvals for select to authenticated using (public.is_member());
create policy read_members on public.activity for select to authenticated using (public.is_member());
create policy read_members on public.app_settings for select to authenticated using (public.is_member());
create policy read_members on public.social_connections for select to authenticated using (public.is_member());

-- Profiles
create policy update_self_name on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('team.manage')) with check (id = auth.uid() or public.has_perm('team.manage'));

-- Styles
create policy write_styles on public.styles for insert to authenticated with check (public.has_perm('styles.manage'));
create policy edit_styles on public.styles for update to authenticated using (public.has_perm('styles.manage')) with check (public.has_perm('styles.manage'));

-- Content: creators add their own; owners or editors-of-anything change them.
create policy create_content on public.content_items for insert to authenticated
  with check (public.has_perm('content.create') and created_by = auth.uid());
create policy edit_content on public.content_items for update to authenticated
  using (owner_id = auth.uid() or public.has_perm('content.edit_any') or public.has_perm('content.approve') or public.has_perm('content.publish'))
  with check (true);
create policy delete_content on public.content_items for delete to authenticated
  using (status = 'draft' and (owner_id = auth.uid() or public.has_perm('content.edit_any')));

-- Scripts & captions follow the content item.
create policy write_scripts on public.scripts for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.content_items c where c.id = item_id
    and (c.owner_id = auth.uid() or public.has_perm('content.edit_any'))));
create policy approve_scripts on public.scripts for update to authenticated using (
  exists (select 1 from public.content_items c where c.id = item_id and (c.owner_id = auth.uid() or public.has_perm('content.edit_any') or public.has_perm('content.approve'))));
create policy write_captions on public.captions for all to authenticated
  using (public.has_perm('content.publish') or exists (select 1 from public.content_items c where c.id = item_id and c.owner_id = auth.uid()))
  with check (public.has_perm('content.publish') or exists (select 1 from public.content_items c where c.id = item_id and c.owner_id = auth.uid()));

-- Assets: anyone who can create content can upload; archive is a state change, never a delete.
create policy write_assets on public.assets for insert to authenticated with check (public.has_perm('content.create') and created_by = auth.uid());
create policy edit_assets on public.assets for update to authenticated using (created_by = auth.uid() or public.has_perm('content.edit_any'));

-- Approvals: only approvers and compliance reviewers record decisions.
create policy write_approvals on public.approvals for insert to authenticated with check (
  decided_by = auth.uid() and (
    (kind = 'creative' and public.has_perm('content.approve')) or
    (kind = 'compliance' and public.has_perm('content.compliance'))));

-- Activity: members write their own entries.
create policy write_activity on public.activity for insert to authenticated with check (actor_id = auth.uid());

-- Settings and connections: admins only.
create policy edit_settings on public.app_settings for update to authenticated using (public.has_perm('settings.manage') or public.has_perm('team.manage'));
create policy edit_social on public.social_connections for update to authenticated using (public.has_perm('settings.manage'));

-- Nothing is ever hard-deleted except drafts (above): no delete policies elsewhere.
