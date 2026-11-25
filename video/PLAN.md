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
| `theme` | from the style's `execution_config.theme`: `dark` / `light` for `cinema`; `light` / `dark` / `bold` for `abet-motion` |
| `template` | from the style's `execution_config.template`: `cinema` (Cinematic Dark / Light Glass) or `abet-motion` (carousels, PDFs) |
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

## Cinema template (`"template": "cinema"`)

The house look for videos, inspired by ABET's Forex Trading Academy film: ambient light, blur-to-focus motion, word-by-word headlines and captions, soft dissolves between scenes. Every scene can take `accent`: `red` (default), `green`, `blue`, `gold`, `white`; it colours highlighted words, captions keywords and cards. Use one accent per idea or chapter (e.g. levels in green, blue, red).

It supports all the scene types above plus:

| `type` | Fields | Notes |
|---|---|---|
| `logo` | `tagline` | Big glowing ABET logo. Use as the first scene (3 s). The end card is automatic. |
| `statement` | `text` or `lines` [..], `sub`, `sequence: true` | With `sequence`, each line replaces the previous one ("Learn first." → "Practise **without risk.**" → "Trade with a **plan.**") |
| `bigstat` | `kicker`, `value` or `count` {`from`, `to`, `prefix`, `suffix`, `decimals`}, `label`, `note`, optional `phone` | Huge glowing number; `count` animates it. Only real, sourced figures. |
| `phone` | `kicker`, `headline`, `sub`, `phone` {`screen`: `watchlist` / `notifications` / `list`, `title`, `badge`, `balance`, `highlight` (row index), `rows` [{`sym`, `glyph`, `color`, `price`, `up`}], `items` [{`title`, `text`, `icon`, `color`, `done`}]} | 3D phone next to the text. Watchlist prices are placeholders like `1.08xx` and marked illustrative. |
| `orbit` | `center` [lines], `orbs` [{`icon` or `text` (≤3 chars), `color`}] (4–10) | Glossy icon spheres orbiting a central message |
| `card` | `number` or `icon`, `kicker`, `title`, `accent`, `progress` (0–1), `progress_label` [left, right], `bullets` [..], optional `chart` {`label`, `trend`} or `phone` {...} | Glowing glass card (levels, steps, features) with an optional chart panel or phone beside it |
| `chat` | `messages` [{`from`: `user` / `coach`, `name`, `text`}] (2–4) | Chat between a learner and "ABET Coach" |

Icons: `trend`, `shield`, `book`, `target`, `globe`, `bulb`, `candles`, `clock`, `user`, `chat`, `lock`, `check`, `wallet`, `layers`, `phone`, `star`, `play`, `graduation`, `calendar`, `bolt`.

A good explainer rhythm: `logo` → hook `statement` → `phone` or `bigstat` → `orbit` (what's included) → 2–4 `card`s (steps/levels) → `chat` (common question) → `statement` with `sequence` → `cta`. Mark keywords with `**` in headlines and captions. See `examples/how-abet-works-cinema.json`.

### Style settings (`"tokens"`, cinema only)

Styles built from references store their look in `execution_config.tokens`; copy them into the plan as `"tokens"`. All optional:

| Token | Example | Effect |
|---|---|---|
| `bg`, `text`, `muted`, `panel`, `glass`, `line` | `"#0A0A1F"`, `"rgba(255,255,255,.06)"` | Canvas, text and surface colours (hex or rgb/rgba only) |
| `accents` | `{"red": ["#FF6A4D", "#E0383B"], "blue": ["#5B9BFF", "#2F6BEB"]}` | Accent gradients per accent name; `red` (or `primary`) is the default accent |
| `glows` | `["rgba(190,40,30,.55)", "rgba(10,120,100,.38)"]` | Up to 4 ambient light colours |
| `heading_font` | `"Poppins"` or `"Space Grotesk"` | Headline font (ABET fonts only) |
| `radius` | `1.2` (0–6) | Corner roundness of cards and panels |
| `background` | `"aurora"` (default), `"plain"`, `"grid"` | Background treatment |
| `motion` | `"smooth"` (default), `"snappy"`, `"slow"` | Entrance speed |
| `captions` | `"none"` | Hide captions |
