-- Update 3 tests: categories, style visibility and approval, production jobs.
\set ON_ERROR_STOP 0
create table pg_temp.r4 (name text, ok boolean);
grant all on pg_temp.r4 to authenticated, anon;
create or replace function pg_temp.c4(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r4 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;
create or replace function pg_temp.u(id text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', id, false); perform set_config('request.jwt.claims', json_build_object('sub', id, 'aal', 'aal2')::text, false); execute 'set role authenticated'; end $$;

select pg_temp.c4('old presets archived', $q$ do $d$ begin if exists (select 1 from public.styles where not archived and not is_custom and content_type is null) then raise exception 'visible'; end if; end $d$ $q$, false);
select pg_temp.c4('removed formats rejected', $q$ insert into public.content_items (title,type,owner_id,created_by) values ('x','motion','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001') $q$, true);

-- lead (super admin) creates a draft style, then approves it
select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c4('admin creates draft style', $q$ insert into public.styles (id, category, name, content_type, status, active) values ('30000000-0000-0000-0000-000000000001','video','ABET Clean Reel','reel','draft',true) $q$, false);
select pg_temp.c4('draft style cannot be active', $q$ do $d$ begin if (select active from public.styles where id='30000000-0000-0000-0000-000000000001') then raise exception 'active'; end if; end $d$ $q$, false);
reset role;

-- writer (scriptwriter, no styles.manage) cannot see the draft
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c4('team cannot see draft style', $q$ do $d$ begin if exists (select 1 from public.styles where id='30000000-0000-0000-0000-000000000001') then raise exception 'visible'; end if; end $d$ $q$, false);
reset role;

-- a video editor (styles.manage, no approve) cannot approve
select pg_temp.u('00000000-0000-0000-0000-000000000001');
update public.profiles set role = 'video_editor' where id = '00000000-0000-0000-0000-000000000004';
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000004');
select pg_temp.c4('editor cannot approve style', $q$ update public.styles set status='approved' where id='30000000-0000-0000-0000-000000000001' $q$, true);
reset role;

select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c4('admin approves and activates', $q$ update public.styles set status='approved', active=true where id='30000000-0000-0000-0000-000000000001' $q$, false);
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c4('team sees approved style', $q$ do $d$ begin if not exists (select 1 from public.styles where id='30000000-0000-0000-0000-000000000001') then raise exception 'hidden'; end if; end $d$ $q$, false);
select pg_temp.c4('writer starts a job', $q$ insert into public.production_jobs (id,item_id,style_id,created_by) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') $q$, false);
select pg_temp.c4('writer updates own job', $q$ update public.production_jobs set status='succeeded', progress=100 where id='40000000-0000-0000-0000-000000000001' $q$, false);
reset role;
select pg_temp.c4('job completion notifies starter', $q$ do $d$ begin if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and message like '%is ready') then raise exception 'none'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r4;
