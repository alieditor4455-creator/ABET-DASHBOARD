-- ABET Content OS: complete database setup.
-- Safe to run more than once: it first removes any earlier (or half-finished) ABET setup, then installs everything.
-- WARNING: re-running removes ABET content data. Only run it during setup.
begin;

drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists content_read on storage.objects;
drop policy if exists content_upload on storage.objects;
drop table if exists public.invitations, public.social_connections, public.app_settings, public.activity,
  public.approvals, public.assets, public.captions, public.scripts, public.content_items, public.styles,
  public.profiles, public.role_permissions cascade;
drop function if exists public.handle_new_user(), public.my_profile(), public.current_role_name(),
  public.has_perm(public.app_permission), public.is_member(), public.touch_updated_at(),
  public.enforce_status_rules(), public.enforce_profile_rules() cascade;
drop type if exists public.asset_state, public.content_status, public.content_type, public.style_category,
  public.app_permission, public.app_role cascade;

-- ===== 20261123000001_init.sql =====
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

-- Invitations: an admin adds an email and role; that person's sign-up is activated with the role.
create table public.invitations (
  email text primary key check (email = lower(email)),
  role public.app_role not null default 'viewer',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Sign-up rules:
--  * the very first account becomes an active Super Admin;
--  * an invited email becomes active with the invited role;
--  * anyone else gets an inactive Viewer profile and sees nothing until an admin activates them.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where email = lower(new.email) and accepted_at is null;
  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, full_name, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'super_admin', true);
  elsif inv.email is not null then
    insert into public.profiles (id, full_name, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), inv.role, true);
    update public.invitations set accepted_at = now() where email = inv.email;
  else
    insert into public.profiles (id, full_name, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'viewer', false);
  end if;
  return new;
end $$;

-- Lets a signed-in but not-yet-activated user see their own status.
create or replace function public.my_profile() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'full_name', full_name, 'role', role, 'active', active)
  from public.profiles where id = auth.uid()
$$;

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

-- Invitations: admins only.
alter table public.invitations enable row level security;
create policy manage_invites on public.invitations for all to authenticated
  using (public.has_perm('team.manage')) with check (public.has_perm('team.manage') and (role <> 'super_admin' or public.current_role_name() = 'super_admin'));

-- Nothing is ever hard-deleted except drafts (above) and unused invitations: no delete policies elsewhere.

-- ===== 20261123000002_storage.sql =====
-- File storage: one private bucket. Files are only reachable through signed URLs
-- issued to active team members. Nothing is deleted by the app: assets are archived.

insert into storage.buckets (id, name, public, file_size_limit)
values ('content', 'content', false, 52428800)   -- 50 MB, the Supabase free-plan per-file limit
on conflict (id) do nothing;

create policy content_read on storage.objects for select to authenticated
  using (bucket_id = 'content' and public.is_member());

create policy content_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and public.has_perm('content.create'));

-- ===== 20261123000003_seed_styles.sql =====
-- Seed: the starting creative style library (editable in the app).
insert into public.styles (category, name, description, motif, complexity, spec) values
('video', 'Premium Minimalist', 'One idea per frame, generous space, calm pacing.', 'mini', 'Low', '[["Pacing","2.5–4 s per shot"],["Transitions","Soft cuts, 8-frame dissolves"],["Easing","Ease-out cubic, 400–600 ms"],["Typography","One display weight, max 6 words on screen"],["Colour treatment","Ink and white, red only on the key word"],["Captions","Single word, lower centre"],["B-roll","Desk and product detail, slow push-ins"],["Sound design","Low ambient bed"],["Aspect ratios","9:16, 1:1, 16:9"],["Complexity","Low"]]'::jsonb),
('video', 'High-Retention Educational', 'Fast hook, a visual change every 1–2 seconds.', 'caption', 'Medium', '[["Pacing","1–2 s per change"],["Transitions","Punch-in zooms, jump cuts"],["Easing","Ease-in-out quad, 200–300 ms"],["Typography","Bold sans, two-line captions"],["Colour treatment","Red keyword highlight on dark plates"],["Captions","Word by word with keyword highlight"],["B-roll","Screen grabs, icons, simple charts"],["Sound design","Light whooshes on zooms"],["Aspect ratios","9:16"],["Complexity","Medium"]]'::jsonb),
('video', 'Documentary Storytelling', 'Narrative arc with interviews and measured pacing.', 'doc', 'High', '[["Pacing","3–6 s per shot"],["Transitions","Straight cuts, J and L cuts"],["Easing","Linear titles, 800 ms fades"],["Typography","Display titles, small lower thirds"],["Colour treatment","Desaturated grade, warm highlights"],["Captions","Sentence captions"],["B-roll","Archival, location, detail shots"],["Sound design","Score-led, room tone kept"],["Aspect ratios","16:9, 4:5"],["Complexity","High"]]'::jsonb),
('video', 'Cinematic B-Roll', 'Atmospheric footage carried by music and voice-over.', 'cine', 'High', '[["Pacing","2–3 s per shot"],["Transitions","Match cuts, speed ramps"],["Easing","Ease-in-out sine, 600 ms"],["Typography","Wide-tracked caps titles"],["Colour treatment","Neutral grade, deep shadows"],["Captions","Title cards only"],["B-roll","City, screens, markets, hands"],["Sound design","Music-driven, hits on cuts"],["Aspect ratios","16:9"],["Complexity","High"]]'::jsonb),
('video', 'Kinetic Typography', 'Words move in rhythm with the voice.', 'type', 'Medium', '[["Pacing","Synced to syllables"],["Transitions","Type-driven wipes"],["Easing","Ease-out expo, 250–400 ms"],["Typography","Heavy display, stacked lines"],["Colour treatment","White on ink, red accent word"],["Captions","The type is the caption"],["B-roll","None"],["Sound design","Voice-led, subtle ticks"],["Aspect ratios","9:16, 1:1"],["Complexity","Medium"]]'::jsonb),
('video', 'Motion Graphics Intensive', 'Fully designed scenes with shapes, icons and data.', 'mg', 'High', '[["Pacing","A scene every 3–4 s"],["Transitions","Shape morphs, mask reveals"],["Easing","Ease-in-out cubic, 500 ms"],["Typography","Space Grotesk headings, Poppins labels"],["Colour treatment","Brand palette on ink"],["Captions","Built into layout"],["B-roll","Generated graphics only"],["Sound design","Designed SFX per element"],["Aspect ratios","16:9, 9:16"],["Complexity","High"]]'::jsonb),
('video', 'Corporate Clean', 'Polished and structured for company and policy content.', 'corp', 'Low', '[["Pacing","3–5 s per shot"],["Transitions","Cross dissolves, slides"],["Easing","Ease-out quad, 400 ms"],["Typography","Sans throughout, clear hierarchy"],["Colour treatment","White, ink, restrained red"],["Captions","Full captions in a clean box"],["B-roll","Office, team, interface"],["Sound design","Light corporate bed"],["Aspect ratios","16:9, 1:1"],["Complexity","Low"]]'::jsonb),
('video', 'Podcast Highlights', 'Two-camera conversation cutdowns with speaker labels.', 'pod', 'Low', '[["Pacing","Conversational"],["Transitions","Switch on speaker"],["Easing","Hard cuts"],["Typography","Speaker chips, bold captions"],["Colour treatment","Dark plates, red speaker chip"],["Captions","Active speaker colour"],["B-roll","None"],["Sound design","Voice only"],["Aspect ratios","9:16, 1:1"],["Complexity","Low"]]'::jsonb),
('video', 'UGC Authentic', 'Handheld, phone-native and personal on purpose.', 'ugc', 'Low', '[["Pacing","Fast, natural"],["Transitions","Jump cuts"],["Easing","None"],["Typography","Native-style captions"],["Colour treatment","Ungraded, natural light"],["Captions","Platform-native style"],["B-roll","Selfie inserts, street shots"],["Sound design","Natural audio"],["Aspect ratios","9:16"],["Complexity","Low"]]'::jsonb),
('video', 'Screen Recording Tutorials', 'MT5 walkthroughs with zoom-ins and cursor emphasis.', 'screen', 'Medium', '[["Pacing","Step paced"],["Transitions","Zoom to region, smooth pans"],["Easing","Ease-in-out cubic, 500 ms"],["Typography","Step numbers, UI labels"],["Colour treatment","Neutral UI, red highlight rings"],["Captions","Step captions at top"],["B-roll","Demo account screens only"],["Sound design","Soft clicks"],["Aspect ratios","16:9, 9:16"],["Complexity","Medium"]]'::jsonb),
('video', 'Financial Chart Explainers', 'Animated candles and annotations explain market ideas.', 'chart', 'Medium', '[["Pacing","Medium"],["Transitions","Draw-on lines, annotation pops"],["Easing","Ease-out cubic, 600 ms"],["Typography","Space Grotesk numbers"],["Colour treatment","Ink chart, green and red candles"],["Captions","Annotation-led"],["B-roll","Illustrative charts labelled “example”"],["Sound design","Ticks on data points"],["Aspect ratios","16:9, 9:16"],["Complexity","Medium"]]'::jsonb),
('video', 'UI-Based Explainers', 'Ideas explained through clean interface cards.', 'ui', 'Medium', '[["Pacing","Medium"],["Transitions","Card slides, depth shifts"],["Easing","Ease-out quint, 500 ms"],["Typography","UI type scale"],["Colour treatment","Light UI on ink frame"],["Captions","In-card labels"],["B-roll","Product UI only"],["Sound design","Interface clicks"],["Aspect ratios","9:16, 16:9"],["Complexity","Medium"]]'::jsonb),
('video', 'Split-Screen Comparison', 'This vs. that, side by side.', 'split', 'Low', '[["Pacing","Medium"],["Transitions","Synchronised wipes"],["Easing","Ease-in-out cubic, 400 ms"],["Typography","Matching headers each side"],["Colour treatment","Neutral left, red-accent right"],["Captions","Per-side labels"],["B-roll","Matched pairs"],["Sound design","Panned cues"],["Aspect ratios","9:16, 16:9"],["Complexity","Low"]]'::jsonb),
('video', 'Data Storytelling', 'Numbers become the story, always with sources.', 'data', 'High', '[["Pacing","Measured"],["Transitions","Counter roll-ups, bar grows"],["Easing","Ease-out cubic, 800 ms"],["Typography","Space Grotesk figures"],["Colour treatment","Single-hue scale, red for focus"],["Captions","Source line always visible"],["B-roll","Charts only"],["Sound design","Soft swells"],["Aspect ratios","16:9, 1:1"],["Complexity","High"]]'::jsonb),
('video', 'Fast-Paced Social', 'High-energy edits for short attention spans.', 'fast', 'Medium', '[["Pacing","Under 1 s cuts"],["Transitions","Whip pans, speed ramps"],["Easing","Ease-in expo, 150–250 ms"],["Typography","Heavy captions"],["Colour treatment","High contrast, red flashes"],["Captions","Word by word, large"],["B-roll","Quick inserts"],["Sound design","Beat-matched"],["Aspect ratios","9:16"],["Complexity","Medium"]]'::jsonb),
('video', 'Editorial Storytelling', 'Magazine-like layouts with photography and pull quotes.', 'edit', 'Medium', '[["Pacing","Calm"],["Transitions","Page-turn slides, crops"],["Easing","Ease-in-out sine, 700 ms"],["Typography","Display headline, small caps labels"],["Colour treatment","Paper white, ink, red rule"],["Captions","Pull-quote style"],["B-roll","Stills and portraits"],["Sound design","Minimal piano"],["Aspect ratios","4:5, 16:9"],["Complexity","Medium"]]'::jsonb),
('video', 'Typography-Led', 'Large, slow-moving type compositions for statements.', 'typeled', 'Low', '[["Pacing","Slow"],["Transitions","Hard cuts between compositions"],["Easing","Ease-out quad, 500 ms"],["Typography","One family, extreme size contrast"],["Colour treatment","Monochrome plus red"],["Captions","Type is the content"],["B-roll","None"],["Sound design","Quiet bed"],["Aspect ratios","1:1, 9:16"],["Complexity","Low"]]'::jsonb),
('video', 'Product Demonstrations', 'Feature-by-feature showcases of ABET tools and accounts.', 'product', 'Medium', '[["Pacing","Medium"],["Transitions","Device pushes, callout lines"],["Easing","Ease-in-out cubic, 500 ms"],["Typography","Feature titles, spec labels"],["Colour treatment","Brand neutrals, red callouts"],["Captions","Feature captions"],["B-roll","Device mock-ups, UI"],["Sound design","Product clicks"],["Aspect ratios","16:9, 9:16"],["Complexity","Medium"]]'::jsonb),
('video', 'Premium Brand Storytelling', 'The ABET story with a cinematic, values-led tone.', 'brand', 'High', '[["Pacing","Measured"],["Transitions","Slow dissolves"],["Easing","Ease-in-out sine, 900 ms"],["Typography","Space Grotesk display, wide tracking"],["Colour treatment","Ink, deep red, warm highlights"],["Captions","Sparse"],["B-roll","People, cities, markets"],["Sound design","Ambient score"],["Aspect ratios","16:9, 9:16"],["Complexity","High"]]'::jsonb),
('video', 'Interview Cutdowns', 'Expert interviews cut into short, quotable clips.', 'interview', 'Low', '[["Pacing","Conversational"],["Transitions","Cuts on sentence breaks"],["Easing","Ease-out quad, 300 ms"],["Typography","Name and title lower thirds"],["Colour treatment","Natural grade"],["Captions","Sentence captions"],["B-roll","Topic cutaways"],["Sound design","Voice, room tone"],["Aspect ratios","9:16, 1:1, 16:9"],["Complexity","Low"]]'::jsonb),
('motion', 'Minimal Kinetic Type', 'Restrained word animation that follows the voice.', 'type', 'Low', '[["Timing","Words land on stressed syllables"],["Easing","Ease-out cubic, 300 ms"],["Entry","Rise 12 px + fade"],["Exit","Fade 200 ms"],["Layout","Centred, max two lines"],["Sound sync","Voice-led"]]'::jsonb),
('motion', 'Premium Corporate Motion', 'Calm panels and lower thirds for company content.', 'corp', 'Low', '[["Timing","Hold 2–3 s per panel"],["Easing","Ease-in-out quad, 450 ms"],["Entry","Slide from left 24 px"],["Exit","Slide out, fade"],["Layout","12-column grid, left aligned"],["Sound sync","Light bed, no hits"]]'::jsonb),
('motion', 'Financial Chart Animation', 'Candles and lines that draw on with annotations.', 'chart', 'Medium', '[["Timing","Line draws over 1.2 s"],["Easing","Ease-out cubic"],["Entry","Stroke draw-on"],["Exit","Dim to 30 %"],["Layout","Chart 70 %, label 30 %"],["Sound sync","Tick on each annotation"]]'::jsonb),
('motion', 'UI Motion Graphics', 'Interface cards and screens that slide and stack.', 'ui', 'Medium', '[["Timing","350–500 ms per move"],["Easing","Ease-out quint"],["Entry","Scale 0.96 → 1 + fade"],["Exit","Push behind, blur 0"],["Layout","Centred device or card stack"],["Sound sync","Soft clicks"]]'::jsonb),
('motion', 'Animated Information Cards', 'Facts presented as cards with icons.', 'mg', 'Medium', '[["Timing","2 s per card"],["Easing","Ease-in-out cubic, 500 ms"],["Entry","Card flips up 16 px"],["Exit","Card slides left"],["Layout","One card centred"],["Sound sync","Pop per card"]]'::jsonb),
('motion', 'Mask Reveals', 'Clean geometric masks reveal type and footage.', 'fast', 'Medium', '[["Timing","400 ms reveals"],["Easing","Ease-in-out expo"],["Entry","Diagonal mask wipe"],["Exit","Reverse wipe"],["Layout","Full-bleed"],["Sound sync","Whoosh on wipe"]]'::jsonb),
('motion', 'Animated Infographics', 'Bars, counters and maps that build in sequence.', 'data', 'High', '[["Timing","Count-up 800 ms"],["Easing","Ease-out cubic"],["Entry","Bars grow from baseline"],["Exit","Fade"],["Layout","Title top, data centre, source bottom"],["Sound sync","Swell on reveal"]]'::jsonb),
('motion', 'Clean Lower Thirds', 'Name and title bars for interviews and webinars.', 'interview', 'Low', '[["Timing","On for 4 s"],["Easing","Ease-out quad, 300 ms"],["Entry","Bar extends from left"],["Exit","Bar retracts"],["Layout","Bottom-left safe area"],["Sound sync","None"]]'::jsonb),
('graphic', 'Clean Editorial Post', 'Headline, short body and a strong visual.', 'post', 'Low', '[["Layout","Headline top, visual centre, CTA bottom"],["Typography","Space Grotesk headline, Poppins body"],["Colour","White or ink background, red accent"],["Imagery","Product UI or abstract market visuals"],["Sizes","1:1, 4:5"],["Footer","Short risk warning"]]'::jsonb),
('graphic', 'Bold Statement', 'One big sentence for awareness posts.', 'typeled', 'Low', '[["Layout","Centred statement"],["Typography","Space Grotesk 700, tight leading"],["Colour","Ink background, red keyword"],["Imagery","None"],["Sizes","1:1, 4:5, 9:16"],["Footer","Short risk warning"]]'::jsonb),
('graphic', 'Step-by-Step Carousel', 'Numbered slides that teach one idea.', 'carousel', 'Medium', '[["Layout","Cover, 3–8 steps, recap, CTA"],["Typography","Step number + headline + 2 lines"],["Colour","Alternating white and ink slides"],["Imagery","Icons and simple diagrams"],["Sizes","4:5"],["Footer","Risk warning on last slide"]]'::jsonb),
('graphic', 'Market Hours Infographic', 'Sessions, times and key facts at a glance.', 'data', 'Medium', '[["Layout","Timeline or grid"],["Typography","Space Grotesk numbers"],["Colour","Ink with red highlights"],["Imagery","Map or clock graphics"],["Sizes","4:5, A4"],["Footer","Source and date line"]]'::jsonb),
('graphic', 'YouTube Thumbnail', 'Readable at small size, one face, three words.', 'edit', 'Low', '[["Layout","Face right, words left"],["Typography","Max three words, heavy weight"],["Colour","High contrast, red accent"],["Imagery","Presenter cut-out"],["Sizes","16:9"],["Footer","None"]]'::jsonb),
('ad', 'Demo Account Offer', 'Invites people to practise on an MT5 demo.', 'ad', 'Low', '[["Hook","Practise first, no real funds"],["Format","9:16 video and 1:1 static"],["CTA","Open a demo account"],["Variants","3 headlines × 2 visuals"],["Compliance","Risk warning on frame and in copy"],["Platforms","Meta, YouTube"]]'::jsonb),
('ad', 'Platform Feature', 'Shows one MT5 or account feature clearly.', 'product', 'Medium', '[["Hook","Feature in the first second"],["Format","16:9 and 9:16"],["CTA","Explore MT5"],["Variants","2 features × 2 hooks"],["Compliance","No performance claims"],["Platforms","YouTube, LinkedIn, Meta"]]'::jsonb),
('ad', 'Education Lead Magnet', 'Promotes a free guide or checklist.', 'pdfdoc', 'Low', '[["Hook","The question the guide answers"],["Format","1:1 static, 9:16 video"],["CTA","Download the free guide"],["Variants","3 cover styles"],["Compliance","Educational framing only"],["Platforms","Meta, LinkedIn"]]'::jsonb),
('ad', 'Retargeting Reminder', 'A short reminder for people who visited the site.', 'ui', 'Low', '[["Hook","Pick up where you left off"],["Format","1:1, 9:16"],["CTA","Finish opening your demo"],["Variants","2"],["Compliance","Frequency cap, risk warning"],["Platforms","Meta"]]'::jsonb),
('ad', 'Brand Trust', 'Registration, support and global reach, stated factually.', 'brand', 'Medium', '[["Hook","Who ABET is, in one line"],["Format","16:9, 9:16"],["CTA","Learn about ABET"],["Variants","2"],["Compliance","Only verified facts: Anguilla registration, 125+ countries served (site claim)"],["Platforms","YouTube, LinkedIn"]]'::jsonb),
('pdf', 'Beginner Guide', 'Cover, contents, chapters and a glossary.', 'pdfdoc', 'Medium', '[["Pages","12–30"],["Cover","Ink cover, red rule, logo top-left"],["Body","Poppins 10.5 pt, Space Grotesk headings"],["Elements","Callouts, glossary boxes, diagrams"],["Footer","Page number, registration line"],["Last page","Full risk warning"]]'::jsonb),
('pdf', 'Checklist', 'One-page or two-page practical checklist.', 'pdfcheck', 'Low', '[["Pages","1–2"],["Cover","None, title band"],["Body","Checkbox list in two columns"],["Elements","Section labels, tips"],["Footer","Registration line"],["Last page","Short risk warning"]]'::jsonb),
('pdf', 'E-book', 'Long-form, chapter-based reading experience.', 'edit', 'High', '[["Pages","20–40"],["Cover","Full-bleed visual, title"],["Body","Single column, generous margins"],["Elements","Pull quotes, chapter openers"],["Footer","Chapter name, page number"],["Last page","Full risk warning"]]'::jsonb),
('pdf', 'Brochure', 'Account types and services overview.', 'corp', 'Medium', '[["Pages","4–8"],["Cover","Logo, headline, MT5 visual"],["Body","Two-column grid"],["Elements","Account comparison table"],["Footer","Registration line"],["Last page","Full risk warning, contact details"]]'::jsonb)
on conflict (category, name) do nothing;


commit;
