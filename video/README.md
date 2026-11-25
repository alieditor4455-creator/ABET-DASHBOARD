# ABET video templates

Claude (Claude Code) makes the videos, carousels, PDFs and ads requested in the dashboard with these templates. The dashboard renders nothing itself. See `.claude/skills/abet-video-worker/SKILL.md` for the worker steps and `PLAN.md` for the scene plan format.

```
node video/render.mjs video/examples/how-abet-works.json out.mp4             # MP4
node video/render.mjs plan.json out-folder --preview                         # one still per scene
```

- `render.mjs`: plan → HTML with CSS animations → Chromium (Playwright) frame by frame → ffmpeg (H.264, 30 fps). Deterministic.
- `templates/abet-motion.css`: the starter template (themes `light`, `dark`, `bold`; shapes 16:9, 9:16, 1:1, 4:5, A4).
- `fonts/`: Poppins and Space Grotesk (SIL Open Font License, from Google Fonts).
- Needs Node 18+, Playwright with Chromium, and ffmpeg (all present in Claude Code cloud sessions).
