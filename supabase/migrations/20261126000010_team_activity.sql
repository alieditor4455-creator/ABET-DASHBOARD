-- Team activity for admins: sign-ups, sign-ins and content actions are logged in public.activity and
-- sent to the notification bell of every active admin (anyone with team.manage), except the person who did it.

alter table public.activity add column if not exists kind text not null default 'content';
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check check (kind in ('content', 'signup', 'signin', 'team', 'style', 'claude'));
create index if not exists activity_actor on public.activity (actor_id, created_at desc);

-- Bell alert to admins for each new activity row. Sign-ins alert at most once per person every 6 hours.
create or replace function public.on_activity_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.kind = 'signin' and exists (
    select 1 from public.activity a where a.actor_id = new.actor_id and a.kind = 'signin' and a.id <> new.id and a.created_at > now() - interval '6 hours'
  ) then return new; end if;
  select coalesce(nullif(full_name, ''), 'Someone') into who from public.profiles where id = new.actor_id;
  insert into public.notifications (user_id, item_id, kind, message)
  select p.id, new.item_id, 'team', left(coalesce(who, case when new.via = 'claude' then 'Claude' else 'Someone' end) || ' ' || new.message, 300)
  from public.profiles p
  join public.role_permissions rp on rp.role = p.role and rp.permission = 'team.manage'
  where p.active and p.id is distinct from new.actor_id;
  return new;
end $$;
drop trigger if exists activity_notify on public.activity;
create trigger activity_notify after insert on public.activity for each row execute function public.on_activity_notify();

-- New sign-up: log it (which also alerts the admins).
create or replace function public.on_profile_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (actor_id, via, kind, message)
  values (new.id, 'system', 'signup', case when new.active
    then format('signed up and joined as %s', replace(initcap(replace(new.role::text, '_', ' ')), 'Of', 'of'))
    else 'signed up and is waiting for approval (Admin Panel → Team)' end);
  return new;
end $$;
drop trigger if exists profiles_signup_log on public.profiles;
create trigger profiles_signup_log after insert on public.profiles for each row execute function public.on_profile_created();

-- Called by the app right after a successful sign-in. Repeated calls within 10 minutes are ignored.
create or replace function public.log_sign_in() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and active) then return; end if;
  if exists (select 1 from public.activity where actor_id = auth.uid() and kind = 'signin' and created_at > now() - interval '10 minutes') then return; end if;
  insert into public.activity (actor_id, via, kind, message) values (auth.uid(), 'app', 'signin', 'signed in');
end $$;
revoke all on function public.log_sign_in() from public, anon;
grant execute on function public.log_sign_in() to authenticated;
revoke all on function public.on_activity_notify(), public.on_profile_created() from public, anon, authenticated;
