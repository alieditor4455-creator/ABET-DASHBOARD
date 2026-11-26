-- Update 4 tests: Claude video worker queue, claiming, completing, starter styles.
\set ON_ERROR_STOP 0
create table pg_temp.r5 (name text, ok boolean);
grant all on pg_temp.r5 to authenticated, anon;
create or replace function pg_temp.c5(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r5 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;
create or replace function pg_temp.u(id text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', id, false); perform set_config('request.jwt.claims', json_build_object('sub', id, 'aal', 'aal2')::text, false); execute 'set role authenticated'; end $$;

select pg_temp.c5('starter styles approved and active (8 video + 17 poster)', $q$ do $d$ begin if (select count(*) from public.styles where template_kind like 'claude:%' and status='approved' and active) <> 25 then raise exception 'count %', (select count(*) from public.styles where template_kind like 'claude:%' and status='approved' and active); end if; end $d$ $q$, false);
insert into public.content_items (id,title,topic,type,owner_id,created_by,status) values ('20000000-0000-0000-0000-000000000009','How ABET works','How ABET works','explainer','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','draft');

select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c5('writer requests a video', $q$ insert into public.production_jobs (id,item_id,style_id,created_by,kind,status,request) values ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000009',(select id from public.styles where name='Cinematic Dark Explainer'),'00000000-0000-0000-0000-000000000002','video','waiting_for_claude','{"output":"video","aspect":"16:9","length":"30 seconds"}') $q$, false);
select pg_temp.c5('writer sees the video queue', $q$ do $d$ begin if jsonb_array_length(public.video_queue()) <> 1 then raise exception 'len'; end if; end $d$ $q$, false);
reset role;

select pg_temp.u('00000000-0000-0000-0000-000000000003');
select pg_temp.c5('role without create cannot read queue', $q$ select public.video_queue() $q$, true);
select pg_temp.c5('role without create cannot claim', $q$ select public.claim_video_job('50000000-0000-0000-0000-000000000001','x') $q$, true);
reset role;

select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c5('worker claims job with brief', $q$ do $d$ declare b jsonb; begin b := public.claim_video_job('50000000-0000-0000-0000-000000000001','Claude Code'); if b->'style'->>'name' <> 'Cinematic Dark Explainer' or b->'request'->>'aspect' <> '16:9' then raise exception 'brief %', b; end if; end $d$ $q$, false);
select pg_temp.c5('second claim fails', $q$ select public.claim_video_job('50000000-0000-0000-0000-000000000001','Other') $q$, true);
select pg_temp.c5('claimer reports progress', $q$ select public.video_job_progress('50000000-0000-0000-0000-000000000001','Rendering',60,'Script saved') $q$, false);
select pg_temp.c5('complete fails before upload', $q$ select public.complete_video_job('50000000-0000-0000-0000-000000000001','[{"path":"jobs/50000000-0000-0000-0000-000000000001/v.mp4","name":"v.mp4","kind":"Video"}]') $q$, true);
select pg_temp.c5('complete rejects foreign path', $q$ select public.complete_video_job('50000000-0000-0000-0000-000000000001','[{"path":"other/v.mp4","kind":"Video"}]') $q$, true);
reset role;
select pg_temp.u('00000000-0000-0000-0000-000000000002');
select pg_temp.c5('non-claimer cannot report progress', $q$ select public.video_job_progress('50000000-0000-0000-0000-000000000001','x',70) $q$, true);
reset role;
insert into storage.objects (bucket_id, name, metadata) values ('content','jobs/50000000-0000-0000-0000-000000000001/v.mp4','{"size":2704284}');
select pg_temp.u('00000000-0000-0000-0000-000000000001');
select pg_temp.c5('claimer completes job', $q$ select public.complete_video_job('50000000-0000-0000-0000-000000000001','[{"path":"jobs/50000000-0000-0000-0000-000000000001/v.mp4","name":"How ABET works.mp4","kind":"Video"}]','16:9, 39 s') $q$, false);
reset role;
select pg_temp.c5('asset saved, job done, item in review, requester notified', $q$ do $d$ begin
  if (select status from public.production_jobs where id='50000000-0000-0000-0000-000000000001') <> 'succeeded' then raise exception 'job'; end if;
  if not exists (select 1 from public.assets a join public.production_jobs j on j.result_asset_id=a.id where j.id='50000000-0000-0000-0000-000000000001' and a.size_bytes=2704284) then raise exception 'asset'; end if;
  if (select status from public.content_items where id='20000000-0000-0000-0000-000000000009') <> 'in_review' then raise exception 'item'; end if;
  if not exists (select 1 from public.notifications where user_id='00000000-0000-0000-0000-000000000002' and message like '%How ABET works%ready') then raise exception 'notify'; end if; end $d$ $q$, false);

-- a script saved for an item does not finish its waiting video job
select pg_temp.u('00000000-0000-0000-0000-000000000002');
insert into public.production_jobs (id,item_id,created_by,kind,status) values ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','video','waiting_for_claude');
insert into public.scripts (item_id,version,title,units,source,created_by) values ('20000000-0000-0000-0000-000000000009',1,'How ABET works','[]','claude','00000000-0000-0000-0000-000000000002');
reset role;
select pg_temp.c5('script save leaves video job waiting', $q$ do $d$ begin if (select status from public.production_jobs where id='50000000-0000-0000-0000-000000000002') <> 'waiting_for_claude' then raise exception 'changed'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r5;
