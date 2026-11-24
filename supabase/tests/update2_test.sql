-- Update 2 tests: Claude queue, comments, notifications, two-step login. Runs after the other test files.
\set ON_ERROR_STOP 0
create table pg_temp.r3 (name text, ok boolean);
grant all on pg_temp.r3 to authenticated, anon;
create or replace function pg_temp.c3(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r3 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;
create or replace function pg_temp.u(id text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', id, false); perform set_config('request.jwt.claims', json_build_object('sub', id, 'aal', 'aal1')::text, false); execute 'set role authenticated'; end $$;

-- writer (…02) creates a draft and sends it to the Claude queue
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c3('writer creates draft', $q$ insert into public.content_items (id,title,type,owner_id) values ('20000000-0000-0000-0000-000000000001','Margin call','reel','00000000-0000-0000-0000-000000000002') $q$, false);
select pg_temp.c3('writer queues for Claude', $q$ update public.content_items set needs_script = true, request_note = 'Keep it simple', requested_by = '00000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001' $q$, false);
reset role;

-- lead (…01, has Claude) saves the script: queue flag clears and the writer is notified
select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c3('Claude user sees queue', $q$ do $d$ begin if not exists (select 1 from public.content_items where needs_script) then raise exception 'empty'; end if; end $d$ $q$, false);
select pg_temp.c3('lead saves script', $q$ insert into public.scripts (item_id,version,title,units,source,created_by) values ('20000000-0000-0000-0000-000000000001',1,'Margin call','[]','claude','00000000-0000-0000-0000-000000000001') $q$, false);
reset role;
select pg_temp.c3('queue flag cleared', $q$ do $d$ begin if (select needs_script from public.content_items where id='20000000-0000-0000-0000-000000000001') then raise exception 'still queued'; end if; end $d$ $q$, false);
select pg_temp.c3('writer notified script ready', $q$ do $d$ begin if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and kind='script') then raise exception 'none'; end if; end $d$ $q$, false);

-- writer sends for review: approvers are notified, writer is not notified about own action
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c3('writer sends for review', $q$ update public.content_items set status='in_review' where id='20000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.c3('writer comments', $q$ insert into public.comments (item_id, body) values ('20000000-0000-0000-0000-000000000001','Please check the hook') $q$, false);
select pg_temp.c3('writer reads only own notifications', $q$ do $d$ begin if exists (select 1 from public.notifications where user_id <> '00000000-0000-0000-0000-000000000002') then raise exception 'leak'; end if; end $d$ $q$, false);
select pg_temp.c3('writer cannot create notifications', $q$ insert into public.notifications (user_id, kind, message) values ('00000000-0000-0000-0000-000000000001','x','spoof') $q$, true);
reset role;
select pg_temp.c3('compliance reviewer notified of review', $q$ do $d$ begin if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000003' and kind='review') then raise exception 'none'; end if; end $d$ $q$, false);
select pg_temp.c3('owner not notified of own comment', $q$ do $d$ begin if exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and kind='comment') then raise exception 'self'; end if; end $d$ $q$, false);

-- compliance reviewer approves and marks notifications read
select pg_temp.u('00000000-0000-0000-0000-000000000003');
select pg_temp.c3('reviewer approves', $q$ update public.content_items set status='approved' where id='20000000-0000-0000-0000-000000000001' $q$, false);
select pg_temp.c3('reviewer marks read', $q$ update public.notifications set read_at = now() where user_id = auth.uid() $q$, false);
reset role;
select pg_temp.c3('owner notified of approval', $q$ do $d$ begin if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and kind='approved') then raise exception 'none'; end if; end $d$ $q$, false);

-- two-step login: once the writer turns it on, an aal1 session sees nothing until verified
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-000000000002', 'verified');
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c3('MFA user without code sees nothing', $q$ do $d$ begin if (select count(*) from public.content_items) <> 0 then raise exception 'leak'; end if; end $d$ $q$, false);
select pg_temp.c3('MFA user without code cannot create', $q$ insert into public.content_items (title,type,owner_id) values ('x','reel','00000000-0000-0000-0000-000000000002') $q$, true);
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000002','aal','aal2')::text, false);
select pg_temp.c3('MFA user with code sees content', $q$ do $d$ begin if (select count(*) from public.content_items) = 0 then raise exception 'blocked'; end if; end $d$ $q$, false);
reset role;

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r3;
