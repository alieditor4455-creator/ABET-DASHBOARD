-- ABET Content OS update 2: Claude queue, comments, notifications, two-step login, backups. Safe: keeps all data.
begin;
-- Update 2: Claude queue, comments, in-app notifications, two-step login enforcement, backups.

-- ---------------------------------------------------------------- two-step login (MFA)
-- People who turned on two-step login must complete it in every session (dashboard and Claude).
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

create or replace function public.has_perm(p public.app_permission) returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles pr
    join public.role_permissions rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.active and rp.permission = p
  )
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

-- ---------------------------------------------------------------- Claude queue
alter table public.content_items add column if not exists needs_script boolean not null default false;
alter table public.content_items add column if not exists request_note text;
alter table public.content_items add column if not exists requested_by uuid references public.profiles(id);
create index if not exists content_items_needs_script on public.content_items (needs_script) where needs_script;

-- ---------------------------------------------------------------- comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id),
  body text not null check (length(body) between 1 and 4000),
  via text not null default 'app' check (via in ('app', 'claude')),
  created_at timestamptz not null default now()
);
create index if not exists comments_item on public.comments (item_id, created_at);
alter table public.comments enable row level security;
drop policy if exists read_members on public.comments;
create policy read_members on public.comments for select to authenticated using (public.is_member());
drop policy if exists write_comments on public.comments;
create policy write_comments on public.comments for insert to authenticated with check (public.is_member() and author_id = auth.uid());

-- ---------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.content_items(id) on delete cascade,
  kind text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists own_notifications on public.notifications;
create policy own_notifications on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists read_own_notifications on public.notifications;
create policy read_own_notifications on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify(p_user uuid, p_item uuid, p_kind text, p_message text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, item_id, kind, message)
  select p_user, p_item, p_kind, left(p_message, 300)
  where p_user is not null and p_user is distinct from auth.uid()
    and exists (select 1 from public.profiles where id = p_user and active);
$$;
revoke all on function public.notify(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.notify_item_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is distinct from old.status then
    if new.status = 'in_review' then
      for r in select pr.id from public.profiles pr join public.role_permissions rp on rp.role = pr.role
               where pr.active and rp.permission = 'content.approve' loop
        perform public.notify(r.id, new.id, 'review', format('“%s” is ready for review', new.title));
      end loop;
    elsif new.status = 'approved' then
      perform public.notify(new.owner_id, new.id, 'approved', format('“%s” was approved', new.title));
    elsif new.status = 'draft' and old.status = 'in_review' then
      perform public.notify(new.owner_id, new.id, 'changes', format('Changes were requested on “%s”', new.title));
    end if;
  end if;
  if new.compliance_note is not null and old.compliance_note is distinct from new.compliance_note then
    perform public.notify(new.owner_id, new.id, 'compliance', format('Compliance note on “%s”: %s', new.title, new.compliance_note));
  end if;
  if new.owner_id is distinct from old.owner_id then
    perform public.notify(new.owner_id, new.id, 'assigned', format('“%s” was assigned to you', new.title));
  end if;
  return new;
end $$;
drop trigger if exists content_items_notify on public.content_items;
create trigger content_items_notify after update on public.content_items for each row execute function public.notify_item_changes();

-- A new script clears the Claude queue flag and tells the requester and owner.
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
  return new;
end $$;
drop trigger if exists scripts_saved on public.scripts;
create trigger scripts_saved after insert on public.scripts for each row execute function public.on_script_saved();

create or replace function public.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare it public.content_items; r record; who text;
begin
  select * into it from public.content_items where id = new.item_id;
  select full_name into who from public.profiles where id = new.author_id;
  for r in select distinct u from (select it.owner_id as u union select author_id from public.comments where item_id = it.id) x loop
    perform public.notify(r.u, it.id, 'comment', format('%s commented on “%s”', coalesce(who, 'Someone'), it.title));
  end loop;
  return new;
end $$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.on_comment();

-- ---------------------------------------------------------------- Claude connections and backups
alter table public.app_settings add column if not exists last_backup_at timestamptz;

create or replace function public.my_claude_connections() returns table (connected_at timestamptz, client_id text)
language sql stable security definer set search_path = public as $$
  select created_at, client_id from public.oauth_codes where user_id = auth.uid() and used order by created_at desc limit 20
$$;
revoke all on function public.my_claude_connections() from public, anon;
grant execute on function public.my_claude_connections() to authenticated;

-- Table access for the new tables (newer Supabase projects don't grant it automatically).
grant select, insert on public.comments to authenticated;
grant select, update on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.comments, public.notifications from anon;

commit;
