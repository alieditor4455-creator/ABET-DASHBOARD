-- Permission and workflow tests. Run with: bash supabase/tests/run_local.sh
\set ON_ERROR_STOP 0
\pset footer off

-- First sign-up becomes the super admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001','lead@abet.test','{"full_name":"Marketing Lead"}');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;
create table pg_temp.results (name text, ok boolean);
grant all on pg_temp.results to authenticated, anon;

-- check(name, sql, expect_error)
create or replace function pg_temp.check(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.results values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;

select pg_temp.check('first user is super_admin',
  $q$ do $d$ begin if (select role from public.profiles where id='00000000-0000-0000-0000-000000000001') <> 'super_admin' then raise exception 'not super'; end if; end $d$ $q$, false);

-- Lead (super admin) invites two people, then they sign up. A third person signs up uninvited.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check('admin invites writer', $q$ insert into public.invitations (email, role) values ('writer@abet.test','scriptwriter') $q$, false);
select pg_temp.check('admin invites compliance', $q$ insert into public.invitations (email, role) values ('compliance@abet.test','compliance_reviewer') $q$, false);
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000002','Writer@abet.test','{"full_name":"Hira K."}'),
  ('00000000-0000-0000-0000-000000000003','compliance@abet.test','{"full_name":"Mariam Q."}'),
  ('00000000-0000-0000-0000-000000000004','stranger@example.com','{"full_name":"Stranger"}');
select pg_temp.check('invited writer is active scriptwriter',
  $q$ do $d$ begin if (select role::text||active::text from public.profiles where id='00000000-0000-0000-0000-000000000002') <> 'scriptwritertrue' then raise exception 'wrong'; end if; end $d$ $q$, false);
select pg_temp.check('uninvited sign-up is inactive',
  $q$ do $d$ begin if (select active from public.profiles where id='00000000-0000-0000-0000-000000000004') then raise exception 'active'; end if; end $d$ $q$, false);

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check('inactive user sees no content or team', $q$ do $d$ begin if (select count(*) from public.profiles) + (select count(*) from public.styles) <> 0 then raise exception 'leak'; end if; end $d$ $q$, false);
select pg_temp.check('inactive user cannot invite', $q$ insert into public.invitations (email, role) values ('x@y.z','admin') $q$, true);
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check('admin cannot change own role', $q$ update public.profiles set role='viewer' where id='00000000-0000-0000-0000-000000000001' $q$, true);

-- Writer creates and drafts content.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check('writer creates item', $q$ insert into public.content_items (id,title,type,owner_id) values ('10000000-0000-0000-0000-000000000001','What is a pip?','reel','00000000-0000-0000-0000-000000000002') $q$, false);
select pg_temp.check('writer saves script', $q$ insert into public.scripts (item_id,version,title,units) values ('10000000-0000-0000-0000-000000000001',1,'What is a pip?','[]') $q$, false);
select pg_temp.check('writer cannot promote self', $q$ update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000002' $q$, true);
select pg_temp.check('writer cannot skip to approved', $q$ update public.content_items set status='approved' where id='10000000-0000-0000-0000-000000000001' $q$, true);
select pg_temp.check('writer sends for review', $q$ update public.content_items set status='in_review' where id='10000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.check('writer cannot approve', $q$ update public.content_items set status='approved' where id='10000000-0000-0000-0000-000000000001' $q$, true);

-- Compliance reviewer adds a note, which blocks approval until resolved.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check('compliance adds note', $q$ update public.content_items set compliance_note='Risk warning missing' where id='10000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.check('approval blocked by note', $q$ update public.content_items set status='approved' where id='10000000-0000-0000-0000-000000000001' $q$, true);
select pg_temp.check('compliance resolves note', $q$ update public.content_items set compliance_note=null where id='10000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.check('compliance approves', $q$ update public.content_items set status='approved' where id='10000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.check('compliance cannot publish', $q$ update public.content_items set scheduled_at=now()+interval '1 day' where id='10000000-0000-0000-0000-000000000001' $q$, true);

-- Lead schedules approved content.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check('lead schedules approved item', $q$ update public.content_items set scheduled_at=now()+interval '1 day', status='completed' where id='10000000-0000-0000-0000-000000000001' $q$, false);

-- Lead activates the stranger as a viewer: they can read but not write.
select pg_temp.check('admin activates pending user', $q$ update public.profiles set active=true where id='00000000-0000-0000-0000-000000000004' $q$, false);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check('viewer cannot create', $q$ insert into public.content_items (title,type,owner_id) values ('x','reel','00000000-0000-0000-0000-000000000004') $q$, true);
select pg_temp.check('viewer reads items', $q$ do $d$ begin if (select count(*) from public.content_items) <> 1 then raise exception 'cannot read'; end if; end $d$ $q$, false);

-- Anonymous visitors see nothing.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('anon sees no content', $q$ do $d$ begin if (select count(*) from public.content_items) <> 0 then raise exception 'leak'; end if; end $d$ $q$, false);
reset role;

select pg_temp.check('activity logged status changes', $q$ do $d$ begin if (select count(*) from public.activity where item_id='10000000-0000-0000-0000-000000000001') < 3 then raise exception 'missing'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.results;
