-- Update 6 tests: team activity notifications for admins.
\set ON_ERROR_STOP 0
create table pg_temp.r7 (name text, ok boolean);
grant all on pg_temp.r7 to authenticated, anon;
create or replace function pg_temp.c7(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r7 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;
create or replace function pg_temp.u(id text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', id, false); perform set_config('request.jwt.claims', json_build_object('sub', id, 'aal', 'aal2')::text, false); execute 'set role authenticated'; end $$;

delete from public.notifications;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000077','newbie@example.com','{"full_name":"New Person"}');
select pg_temp.c7('sign-up logged and admin notified', $q$ do $d$ begin
  if not exists (select 1 from public.activity where actor_id='00000000-0000-0000-0000-000000000077' and kind='signup') then raise exception 'no activity'; end if;
  if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000001' and kind='team' and message like 'New Person signed up%') then raise exception 'admin not notified'; end if;
  if exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and kind='team') then raise exception 'non-admin notified'; end if; end $d$ $q$, false);

select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c7('writer sign-in logged', $q$ select public.log_sign_in() $q$, false);
select pg_temp.c7('second sign-in within 10 min ignored', $q$ select public.log_sign_in() $q$, false);
select pg_temp.c7('writer cannot read notifications of admin', $q$ do $d$ begin if exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'leak'; end if; end $d$ $q$, false);
reset role;
select pg_temp.c7('one sign-in row and one admin alert', $q$ do $d$ begin
  if (select count(*) from public.activity where actor_id='00000000-0000-0000-0000-000000000002' and kind='signin') <> 1 then raise exception 'count'; end if;
  if (select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000001' and message like '%signed in') <> 1 then raise exception 'alerts'; end if; end $d$ $q$, false);

select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c7('admin action does not alert themselves', $q$ do $d$ begin
  insert into public.activity (actor_id, message) values ('00000000-0000-0000-0000-000000000001','approved “Test”');
  if exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000001' and message like '%approved “Test”') then raise exception 'self alert'; end if; end $d$ $q$, false);
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c7('writer content action alerts admin', $q$ insert into public.activity (actor_id, message) values ('00000000-0000-0000-0000-000000000002','requested a video for “How ABET works”') $q$, false);
reset role;
select pg_temp.c7('admin got the content alert', $q$ do $d$ begin if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000001' and message like '%requested a video%') then raise exception 'missing'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r7;
