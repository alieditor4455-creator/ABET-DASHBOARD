# ABET Content OS

ABET Global's content workspace: plan, write (with Claude), produce, review, schedule and publish content as a team.

- **Live:** https://abet-dashboard.netlify.app (Netlify, deployed from this branch)
- **App:** `app/`, a React + Vite + TypeScript SPA, with Netlify Functions in `app/netlify/`
- **Database, auth and storage:** Supabase. The schema is in `supabase/migrations/`. `supabase/setup-database.sql` is a full install, and `supabase/update-0N-*.sql` are the incremental updates.
- **Claude:**
  - An MCP connector at `/mcp`, for Claude chat.
  - Optional Claude API generation through `/api/generate`, used when `ANTHROPIC_API_KEY` is set in Netlify.

## Content Studio

There are six categories: Short Form, Long Form, Explainer Videos, PDFs, Carousels and Ads. The flow is Category → Topic → Style → Generate. Creative styles are created by ABET admins from their own references; see `docs/STYLE-DEVELOPMENT.md`.

## Docs

- `docs/SETUP.md`: accounts, keys and deployment
- `docs/ARCHITECTURE.md`: how the pieces fit
- `docs/STYLE-DEVELOPMENT.md`: reference → production template → approval
- `brand/README.md`: official ABET brand assets

## Tests

- `supabase/tests/run_local.sh`: database permission and RLS checks against a local Postgres
- `cd app && npm run build`: type-check and build
- `?demo` on any page runs the app on sample data with no backend
