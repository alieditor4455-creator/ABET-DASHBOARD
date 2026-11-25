---
name: abet-video-worker
description: Make the videos, carousels, PDFs and ads waiting in the ABET Content OS video queue. Use when asked to "make the queued videos", "process the ABET video queue", or when a scheduled run starts. Needs the ABET Content OS connector and this repository.
---

# ABET video worker

The ABET dashboard (abet-dashboard.netlify.app) does not render anything. Team members request a video, carousel, PDF or ad there; **you make it** with the templates in `video/` and deliver it back through the ABET Content OS connector. Work fully on your own: nobody is watching a scheduled run.

## 1. Check the queue

Call `get_video_queue`. If `count` is 0, reply "The video queue is empty." and stop.

Process requests oldest first, at most **3 per run** (the rest wait for the next hourly run).

## 2. For each request

1. **Claim it:** `claim_video_job` with `job_id` and `worker: "Claude Code (scheduled)"` (or "Claude Code" when a person started you). If the claim fails, someone else took it: skip it.
2. **Read the brand kit once per run:** `get_brand_kit`. Follow its voice, compliance rules and legal lines.
3. **Write the script** for the topic, format, audience, objective and `item.note`, in the style's spirit (`style.description`, `style.spec`). Save it with `save_script` (sections = scenes/slides/pages, `voiceover` = the caption text). Then `report_video_progress` stage "Designing the scenes", progress 35.
4. **Write the scene plan** as JSON in a fresh temp folder (e.g. `/tmp/abet-<job_id>/plan.json`), following `video/PLAN.md`:
   - `template` = `style.execution_config.template` (`cinema` for videos and ads, `abet-motion` for carousels and PDFs), `theme` = `style.execution_config.theme`.
   - For `cinema`, follow the rhythm and scene types in `video/PLAN.md` (logo → hook → phone/bigstat → orbit → cards → chat → sequence statement → cta), with `accent` colours per idea and `**keywords**` in headlines and captions. Write a `caption` for every scene: it's what the viewer reads.
   - `request.output`: `video` → `"output": "video"`; `slides` → `"output": "slides"`; `pdf` → `"output": "pdf"`; `image` (static ad) → `"output": "slides"`, one scene, `"end_card": false`, `"footer_risk": true`.
   - `aspect` = `request.aspect`. Fit the total duration (video) or count (slides/pages) to `request.length`, including the 4-second end card.
5. **Preview:** `node video/render.mjs plan.json /tmp/abet-<job_id>/preview --preview`, then look at every PNG. Fix crowded or overflowing text by shortening it, and re-preview until every frame is clean.
6. **Render:** `report_video_progress` stage "Rendering", progress 60, then:
   - video: `node video/render.mjs plan.json /tmp/abet-<job_id>/<slug>-<aspect>.mp4` (about 2 s of render per second of video; renders in parallel)
   - slides/image: `node video/render.mjs plan.json /tmp/abet-<job_id>/slides`
   - pdf: `node video/render.mjs plan.json /tmp/abet-<job_id>/<slug>.pdf`
   For a video, check 3–4 frames with ffmpeg (`ffmpeg -ss <t> -i file.mp4 -frames:v 1 f.png`) before uploading.
7. **Upload:** `report_video_progress` stage "Uploading", progress 90. For each file, `get_upload_url` (file name with extension; aspect in the name, `:` replaced by `x`), then run the `curl -X PUT ... --data-binary @file` it returns. Files must be under 50 MB.
8. **Deliver:** `complete_video_job` with every uploaded `path`, a display `name` (with extension), `kind` (`Video` / `Graphic` / `PDF`) and a short `note` (shape, length, anything the reviewer should check).

If anything blocks you (missing facts, render error you can't fix, upload failure after 2 retries), call `fail_video_job` with a plain-language reason and what the requester can do, then continue with the next request.

## Content rules (non-negotiable)

- ABET Global is a registered trading services provider in Anguilla (A000000977). Trading CFDs/forex is high risk.
- Never promise or imply profit, guaranteed returns, "risk-free", "easy money", or specific earnings. No invented statistics, prices, spreads, leverage figures or awards: use only facts in the brand kit, the request and the note.
- Charts are illustrative only (the template labels them). Never present them as real market data.
- Don't show other brands' logos, people's faces or copyrighted music. No music unless a licensed file is provided.
- English unless the note asks for another language.
- The end card with the risk warning is automatic for videos, slides and PDFs; static ads use `footer_risk`.

## Finish

Reply with one line per request: title, result (delivered / failed + reason) and the dashboard link.
