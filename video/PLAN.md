# Scene plan format

Claude writes one JSON plan per request; `node video/render.mjs plan.json <out>` turns it into the file.

```json
{
  "title": "How ABET Global works",
  "template": "abet-motion",
  "output": "video",
  "aspect": "16:9",
  "theme": "light",
  "captions": true,
  "scenes": [ { "type": "title", "duration": 4.5, "headline": "How **ABET Global** works", "caption": "Here is how ABET Global works." } ]
}
```

| Field | Values |
|---|---|
| `output` | `video` (MP4), `slides` (one PNG per scene), `pdf` (A4, one page per scene) |
| `aspect` | `16:9`, `9:16`, `1:1`, `4:5` (ignored for `pdf`, always A4) |
| `theme` | `light`, `dark`, `bold`: take it from the style's `execution_config.theme` |
| `template` | `abet-motion` (the starter template; new reference styles add their own) |
| `captions` | on-screen captions from each scene's `caption` (video only), default `true` |
| `end_card` | `false` to skip the automatic logo + risk-warning end card (only for single static ads) |
| `footer_risk` | `true` puts the short risk warning on every slide (use for static ads) |
| `logo` | `false` hides the small corner logo |
| `audio` | `{ "music": "file.mp3", "voiceover": "file.mp3" }`, optional, files next to the plan |

Wrap a word in `**double stars**` to highlight it in ABET red.

## Scene types

Every scene takes `duration` (seconds, video only) and optional `caption` (what the voiceover would say; shown as captions).

| `type` | Fields | Use for |
|---|---|---|
| `title` | `kicker`, `headline`, `sub` | Opening, chapter titles, cover slide |
| `statement` | `text`, `sub` | One strong idea, a warning, a quote |
| `points` | `heading`, `points` (2–4 short strings) | Lists, benefits, features |
| `stat` | `heading`, `value`, `label`, `note` | One key number or definition (`0.0001`, `24/5`) |
| `steps` | `heading`, `steps` [{`title`, `text`}] (2–6) | Processes, how-to |
| `compare` | `heading`, `left`/`right` {`title`, `points`} | A vs B |
| `chart` | `heading`, `trend` (`up`/`down`/`range`), `label`, `seed` | Market ideas. Always labelled "Illustrative example" |
| `image` | `heading`, `src` (path next to the plan), `caption_text` | A provided screenshot or brand image |
| `cta` | `headline`, `action`, `url` | Call to action |

The end card (logo, abetglobal.com, @abet.global, risk warning, registration line) is added automatically and lasts 4 seconds.

## Timing guide

- Short Form: 2–4 s per scene, 4–10 scenes. "15 seconds" ≈ 3 scenes + end card.
- Explainers: 4–8 s per scene. Read-time rule: about 2.5 words per second of caption text.
- Long Form: 5–9 s per scene, group into chapters with `title` scenes.
- Slides/PDF: `duration` is ignored; one idea per slide/page. Requested slide/page count includes the cover and the automatic end slide.

## Text limits (keep it readable)

Headline ≤ 8 words · points ≤ 7 words each · step title ≤ 4 words, text ≤ 8 words · caption ≤ 25 words per scene.
Render `--preview` first and look at every still: if text crowds or overflows, shorten it.
