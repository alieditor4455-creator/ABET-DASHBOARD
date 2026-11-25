-- Update 5 tests: references library and styles built from references.
\set ON_ERROR_STOP 0
create table pg_temp.r6 (name text, ok boolean);
grant all on pg_temp.r6 to authenticated, anon;
create or replace function pg_temp.c6(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r6 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;
create or replace function pg_temp.u(id text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', id, false); perform set_config('request.jwt.claims', json_build_object('sub', id, 'aal', 'aal2')::text, false); execute 'set role authenticated'; end $$;

select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c6('writer adds a link reference', $q$ insert into public.style_references (id, content_type, title, notes, url, created_by) values ('60000000-0000-0000-0000-000000000001','explainer','Academy film','Love the orbit','https://example.com/v','00000000-0000-0000-0000-000000000002') $q$, false);
select pg_temp.c6('reference needs a file or link', $q$ insert into public.style_references (content_type, title, created_by) values ('explainer','Nothing','00000000-0000-0000-0000-000000000002') $q$, true);
select pg_temp.c6('writer cannot request a style', $q$ insert into public.styles (category, name, content_type, status, source_reference_ids, claude_requested_at) values ('video','Writer style','explainer','in_development','{60000000-0000-0000-0000-000000000001}',now()) $q$, true);
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000003');
select pg_temp.c6('compliance (no create) cannot add references', $q$ insert into public.style_references (content_type, title, url, created_by) values ('pdf','x','https://example.com','00000000-0000-0000-0000-000000000003') $q$, true);
select pg_temp.c6('compliance can read references', $q$ do $d$ begin if not exists (select 1 from public.style_references) then raise exception 'none'; end if; end $d$ $q$, false);
reset role;

select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c6('admin requests a style from references', $q$ insert into public.styles (id, category, name, content_type, status, source_reference_ids, claude_requested_at, claude_requested_by, claude_note) values ('31000000-0000-0000-0000-000000000001','video','Academy Orbit','explainer','in_development','{60000000-0000-0000-0000-000000000001}',now(),'00000000-0000-0000-0000-000000000001','Match the orbit scene') $q$, false);
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c6('worker lists style requests with references', $q$ do $d$ declare r jsonb := public.style_requests(); begin if jsonb_array_length(r) <> 1 or r->0->'references'->0->>'url' <> 'https://example.com/v' then raise exception '%', r; end if; end $d$ $q$, false);
select pg_temp.c6('preview must be uploaded first', $q$ select public.save_style_draft('31000000-0000-0000-0000-000000000001','Orbit look','[["Look","Dark"]]','{"template":"cinema","theme":"dark"}','styles/31000000-0000-0000-0000-000000000001/p.png') $q$, true);
reset role;
insert into storage.objects (bucket_id, name, metadata) values ('content','styles/31000000-0000-0000-0000-000000000001/p.png','{"size":1234}');
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c6('worker saves the style draft', $q$ select public.save_style_draft('31000000-0000-0000-0000-000000000001','Orbit look','[["Look","Dark"]]','{"template":"cinema","theme":"dark"}','styles/31000000-0000-0000-0000-000000000001/p.png') $q$, false);
select pg_temp.c6('draft cannot be saved twice', $q$ select public.save_style_draft('31000000-0000-0000-0000-000000000001','x','[]','{}',null) $q$, true);
reset role;
select pg_temp.c6('style pending approval, inactive, with preview and template', $q$ do $d$ declare s public.styles; begin select * into s from public.styles where id='31000000-0000-0000-0000-000000000001';
  if s.status <> 'pending_approval' or s.active or s.preview_asset_id is null or s.template_kind <> 'claude:cinema' or s.execution_config->>'engine' <> 'claude' then raise exception '%', row_to_json(s); end if;
  if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000001' and kind='style') then raise exception 'no notify'; end if; end $d$ $q$, false);
select pg_temp.c6('video brief carries request references', $q$ do $d$ declare j public.production_jobs; begin
  insert into public.production_jobs (item_id, created_by, kind, status, request) values ('20000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','video','succeeded','{"reference_ids":["60000000-0000-0000-0000-000000000001"]}') returning * into j;
  if public.video_job_brief(j)->'references'->0->>'title' <> 'Academy film' then raise exception 'missing'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r6;
