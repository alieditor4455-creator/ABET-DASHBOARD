-- Claude video worker: the dashboard queues video/carousel/PDF requests; Claude (Claude Code, through the
-- ABET connector) claims a request, builds the file with the templates in this repository, uploads it and
-- completes the job. The dashboard has no render engine of its own.

-- ---------------------------------------------------------------- jobs: kind, request, claim
alter table public.production_jobs add column if not exists kind text not null default 'script';
alter table public.production_jobs drop constraint if exists production_jobs_kind;
alter table public.production_jobs add constraint production_jobs_kind check (kind in ('script', 'full', 'video'));
alter table public.production_jobs add column if not exists request jsonb not null default '{}'::jsonb;   -- {output, aspect, length}
alter table public.production_jobs add column if not exists claimed_by uuid references public.profiles(id);
alter table public.production_jobs add column if not exists claimed_at timestamptz;
alter table public.production_jobs add column if not exists worker text;                                  -- e.g. "Claude Code (scheduled)"
create index if not exists production_jobs_queue on public.production_jobs (kind, status, created_at);

-- Saving a script only completes *script* jobs. Video jobs finish when Claude uploads the file.
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
  update public.production_jobs
     set status = 'succeeded', progress = 100, stage = 'Script ready',
         steps = steps || jsonb_build_array(jsonb_build_object('name', 'Script written by Claude', 'status', 'done', 'at', now()))
   where item_id = it.id and status = 'waiting_for_claude' and kind <> 'video';
  return new;
end $$;

-- ---------------------------------------------------------------- worker functions (called through the connector)
create or replace function public.video_job_brief(j public.production_jobs) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'job_id', j.id, 'status', j.status, 'requested_at', j.created_at, 'request', j.request,
    'requested_by', (select full_name from public.profiles where id = j.created_by),
    'item', (select jsonb_build_object('id', i.id, 'title', i.title, 'topic', i.topic, 'type', i.type, 'audience', i.audience,
                                       'objective', i.objective, 'note', i.request_note) from public.content_items i where i.id = j.item_id),
    'style', (select jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'spec', s.spec, 'template', s.template_kind,
                                        'execution_config', s.execution_config, 'output_formats', s.output_formats, 'required_assets', s.required_assets)
              from public.styles s where s.id = j.style_id))
$$;

create or replace function public.video_queue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('content.create') then raise exception 'Your ABET role can’t work on the video queue'; end if;
  return coalesce((select jsonb_agg(public.video_job_brief(j) order by j.created_at) from public.production_jobs j
    where j.kind = 'video' and (j.status = 'waiting_for_claude' or (j.status = 'running' and j.claimed_at < now() - interval '90 minutes'))), '[]'::jsonb);
end $$;

create or replace function public.claim_video_job(p_job uuid, p_worker text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j public.production_jobs;
begin
  if not public.has_perm('content.create') then raise exception 'Your ABET role can’t work on the video queue'; end if;
  update public.production_jobs
     set status = 'running', claimed_by = auth.uid(), claimed_at = now(), worker = coalesce(p_worker, 'Claude'),
         stage = 'Claude is writing the script', progress = 15,
         steps = steps || jsonb_build_array(jsonb_build_object('name', 'Picked up by ' || coalesce(p_worker, 'Claude'), 'status', 'done', 'at', now()))
   where id = p_job and kind = 'video'
     and (status = 'waiting_for_claude' or (status = 'running' and claimed_at < now() - interval '90 minutes'))
  returning * into j;
  if j.id is null then raise exception 'This request was already picked up or no longer exists. Call get_video_queue again.'; end if;
  return public.video_job_brief(j);
end $$;

create or replace function public.video_job_progress(p_job uuid, p_stage text, p_progress int, p_step text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.production_jobs
     set stage = left(p_stage, 120), progress = greatest(progress, least(95, greatest(0, p_progress))),
         steps = case when p_step is null then steps else steps || jsonb_build_array(jsonb_build_object('name', left(p_step, 200), 'status', 'done', 'at', now())) end
   where id = p_job and kind = 'video' and status = 'running' and claimed_by = auth.uid();
  if not found then raise exception 'You haven’t claimed this request (or it already finished).'; end if;
end $$;

-- files: [{"path": "jobs/<job>/video.mp4", "name": "How ABET works.mp4", "kind": "Video"}]
create or replace function public.complete_video_job(p_job uuid, p_files jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare j public.production_jobs; it public.content_items; f jsonb; obj record; first_asset uuid; a uuid; n int := 0;
begin
  select * into j from public.production_jobs where id = p_job for update;
  if j.id is null or j.kind <> 'video' or j.status <> 'running' or j.claimed_by is distinct from auth.uid() then
    raise exception 'You haven’t claimed this request (or it already finished).';
  end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then raise exception 'Send at least one uploaded file.'; end if;
  select * into it from public.content_items where id = j.item_id;
  for f in select * from jsonb_array_elements(p_files) loop
    if (f->>'path') not like 'jobs/' || j.id || '/%' then raise exception 'File % was not uploaded for this request.', f->>'path'; end if;
    select o.name, coalesce((o.metadata->>'size')::bigint, 0) as size into obj from storage.objects o where o.bucket_id = 'content' and o.name = f->>'path';
    if obj.name is null then raise exception 'File % is not in storage yet. Upload it first.', f->>'path'; end if;
    insert into public.assets (item_id, name, kind, storage_path, size_bytes, created_by)
    values (j.item_id, left(coalesce(f->>'name', it.title), 200),
            case when f->>'kind' in ('Video', 'Graphic', 'PDF') then f->>'kind' else 'Video' end, obj.name, obj.size, auth.uid())
    on conflict (storage_path) do update set size_bytes = excluded.size_bytes
    returning id into a;
    first_asset := coalesce(first_asset, a); n := n + 1;
  end loop;
  update public.production_jobs
     set status = 'succeeded', progress = 100, stage = 'Ready for review', result_asset_id = first_asset,
         steps = steps || jsonb_build_array(jsonb_build_object('name', format('%s file%s saved to the Asset Library', n, case when n = 1 then '' else 's' end), 'status', 'done', 'at', now(), 'detail', p_note))
   where id = j.id;
  if it.status in ('draft', 'in_production') then update public.content_items set status = 'in_review' where id = it.id; end if;
  insert into public.activity (item_id, actor_id, via, message) values (it.id, auth.uid(), 'claude', format('made the %s for “%s”', coalesce(j.request->>'output', 'video'), it.title));
  return jsonb_build_object('ok', true, 'assets', n, 'item_id', it.id);
end $$;

create or replace function public.fail_video_job(p_job uuid, p_error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.production_jobs
     set status = 'failed', stage = 'Failed', error = left(coalesce(p_error, 'Unknown error'), 500),
         steps = steps || jsonb_build_array(jsonb_build_object('name', 'Stopped', 'status', 'failed', 'at', now(), 'detail', left(p_error, 500)))
   where id = p_job and kind = 'video' and status = 'running' and claimed_by = auth.uid();
  if not found then raise exception 'You haven’t claimed this request (or it already finished).'; end if;
end $$;

revoke all on function public.video_job_brief(public.production_jobs) from public, anon, authenticated;
revoke all on function public.video_queue(), public.claim_video_job(uuid, text), public.video_job_progress(uuid, text, int, text),
  public.complete_video_job(uuid, jsonb, text), public.fail_video_job(uuid, text) from public, anon;
grant execute on function public.video_queue(), public.claim_video_job(uuid, text), public.video_job_progress(uuid, text, int, text),
  public.complete_video_job(uuid, jsonb, text), public.fail_video_job(uuid, text) to authenticated;

-- ---------------------------------------------------------------- starter styles (approved by the owner on 25 Nov 2026)
-- Approving needs an admin, except when run by the database owner (this setup script).
create or replace function public.enforce_style_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if auth.uid() is not null and not (public.has_perm('content.approve') and public.has_perm('styles.manage')) then
      raise exception 'Only an admin or marketing manager can approve a style';
    end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  if new.status <> 'approved' then new.active := false; end if;
  return new;
end $$;

insert into public.styles (name, category, content_type, description, motif, complexity, spec, is_custom, archived, status, active, template_kind, template_version, output_formats, required_assets, execution_config)
select v.name, v.category::public.style_category, v.ct::public.content_type, v.descr, v.motif, 'Medium', v.spec::jsonb, true, false, 'approved', true, 'claude:abet-motion', 1, v.formats, '[]'::jsonb, v.cfg::jsonb
from (values
  ('ABET Clean Explainer', 'video', 'explainer', 'Starter style. Light, clean motion graphics: big headings, step cards, charts and captions in ABET red and ink.', 'mg',
   '[["Look","Light canvas, ink text, ABET red accents"],["Motion","Smooth rise and fade, one idea per scene"],["Captions","On-screen captions from the script"],["End card","Logo, website and risk warning"]]',
   array['16:9 MP4','9:16 MP4','1:1 MP4'],
   '{"engine":"claude","template":"abet-motion","theme":"light","outputs":["video"],"aspects":["16:9","9:16","1:1"],"lengths":["30 seconds","60–90 seconds","2–3 minutes"]}'),
  ('ABET Clean Chapters', 'video', 'yt', 'Starter style. Light chaptered explainer for YouTube: chapter titles, step cards, charts and captions.', 'chart',
   '[["Look","Light canvas, ink text, ABET red accents"],["Structure","Intro, 3–6 chapters, recap, call to action"],["Captions","On-screen captions from the script"]]',
   array['16:9 MP4'],
   '{"engine":"claude","template":"abet-motion","theme":"light","outputs":["video"],"aspects":["16:9"],"lengths":["2–3 minutes","3–5 minutes"]}'),
  ('ABET Bold Kinetic', 'video', 'reel', 'Starter style. Bold ABET-red reels with big kinetic type and fast scenes for Reels, Shorts and TikTok.', 'typeled',
   '[["Look","ABET red background, white type, ink cards"],["Pacing","Fast: 2–4 seconds per scene"],["Captions","Large captions for watching on mute"]]',
   array['9:16 MP4','1:1 MP4','4:5 MP4'],
   '{"engine":"claude","template":"abet-motion","theme":"bold","outputs":["video"],"aspects":["9:16","1:1","4:5"],"lengths":["15 seconds","30 seconds","45–60 seconds"]}'),
  ('ABET Premium Dark Ad', 'ad', 'ad', 'Starter style. Dark premium ads with a red glow, a clear offer and a strong call to action. Video or static.', 'ad',
   '[["Look","Near-black canvas, red glow, white type"],["Structure","Hook, benefit, proof, call to action"],["Compliance","Risk warning on every ad"]]',
   array['9:16 MP4','1:1 MP4','16:9 MP4','4:5 MP4','1:1 PNG','4:5 PNG'],
   '{"engine":"claude","template":"abet-motion","theme":"dark","outputs":["video","image"],"aspects":["9:16","1:1","4:5","16:9"],"lengths":["6 seconds","15 seconds","30 seconds"]}'),
  ('ABET Clean Carousel', 'graphic', 'carousel', 'Starter style. Light step-by-step carousel slides with numbered cards and a swipe cue.', 'carousel',
   '[["Look","Light canvas, ink text, ABET red accents"],["Structure","Cover, one idea per slide, call to action, risk slide"]]',
   array['4:5 PNG slides','1:1 PNG slides'],
   '{"engine":"claude","template":"abet-motion","theme":"light","outputs":["slides"],"aspects":["4:5","1:1"],"lengths":["5 slides","7 slides","10 slides"]}'),
  ('ABET Clean Guide', 'pdf', 'pdf', 'Starter style. Light A4 guide: cover, clear sections, key numbers, steps and a closing page with the risk warning.', 'pdfdoc',
   '[["Look","Light A4 pages, ink text, ABET red accents"],["Structure","Cover, sections, checklist, closing page"]]',
   array['A4 PDF'],
   '{"engine":"claude","template":"abet-motion","theme":"light","outputs":["pdf"],"aspects":["A4"],"lengths":["4 pages","8 pages","12 pages"]}')
) as v(name, category, ct, descr, motif, spec, formats, cfg)
where not exists (select 1 from public.styles s where s.name = v.name);
