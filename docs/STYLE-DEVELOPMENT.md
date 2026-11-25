# Developing a creative style

ABET's creative styles are built from ABET's own references. The app ships with **no styles**. Each of the six categories (Short Form, Long Form, Explainer Videos, PDFs, Carousels and Ads) starts empty until an admin adds styles.

## The process

1. **Create a draft.** In Creative Styles, open the category, click **Add a style**, name it and upload the reference videos, images or designs. Set the status to **In development**.
2. **Analyse.** Ask Claude (in Claude Code, on this repository) to study the references. It extracts typography, composition, pacing, transitions, easing, captions and sound, and adapts them to the ABET brand (see `brand/README.md`). It fills in the style's **Creative specifications**.
3. **Build the production template.** Claude Code writes a renderer in two places:
   - `app/src/lib/renderers.ts`: add an entry to `RENDERERS` (`id`, `label`, `contentTypes`, `outputs`, `engine`). This is what the style editor lists under **Production template**.
   - `app/netlify/lib/render.ts`: add the matching function to `SERVER_RENDERERS` under the same `id`. It receives the item, the style (including `execution_config`) and the script written by Claude. It uploads the finished file to the `content` storage bucket, creates an `assets` row and returns `{ assetId }`. Call `progress(stage, percent)` to report progress.
   Deploy once. After that, the template shows up in the style editor.
4. **Preview.** Upload a preview render or image. It becomes the style's thumbnail.
5. **Approve.** Select the template, set the output formats and required assets, then click **Approve and activate**. Only people with both *Approve content* and *Manage styles* can approve. Styles that aren't approved are always inactive and hidden from the team.
6. **Save.** The style is now live in Content Studio for its category.

## Changing a style without a redeploy

Name, description, references, preview, specifications, output formats, required assets, active or inactive, and **Execution settings** (JSON passed to the renderer, for example colours, durations and font sizes) are stored in the database. Editing them takes effect at once. Only a new or changed *renderer code* needs a deploy.

## Claude-made styles (the video worker)

Styles whose template starts with `claude:` (the six starter styles use `claude:abet-motion`) are made by **Claude**, not by the dashboard:

1. In Content Studio someone picks a category, types a topic, picks the style, shape and length, and clicks **Generate video** (or carousel, PDF, image). The request goes into the **video queue** (`production_jobs`, kind `video`).
2. A scheduled Claude Code session (hourly, 9am–9pm Pakistan time) runs the `abet-video-worker` skill (`.claude/skills/abet-video-worker/SKILL.md`). Through the ABET Content OS connector it claims the request, writes and saves the script, writes a scene plan (`video/PLAN.md`), renders it with `node video/render.mjs`, uploads the file and completes the request.
3. The file appears on the item page and in the Asset Library, the item moves to **In review**, and the requester is notified. **Request changes** sends it back to Claude with the reviewer's notes.

A new reference-based style can reuse `abet-motion` with different `execution_config` (theme, shapes, lengths), or get its own template file in `video/templates/` and its own template id.

## How generation runs

Content Studio: **Category → Topic → Style → Generate**.

- `POST /api/generate` (`app/netlify/functions/api-generate.ts`) checks permissions and creates a `production_jobs` row.
- With `ANTHROPIC_API_KEY` set in Netlify, the background function `generate-background` writes the script and captions with the Claude API (`app/netlify/lib/generator.ts`), runs the compliance check, and, for **Generate content**, calls the style's renderer and saves the file to the Asset Library. The item then moves to *In review*.
- Without the key, the job waits in the **Claude queue**. Someone with the ABET Content OS connector asks Claude to write scripts for the queue, and the job completes when Claude saves the script.
- **Generate content** is enabled only for approved, active styles whose renderer exists on the server (`/api/capabilities`). **Write script only** always works.
- Compliance review and publishing approvals are unchanged.
