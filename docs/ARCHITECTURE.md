# Architecture (free-tier build)

```
Team browsers ──► Cloudflare Pages: React app (the dashboard)
                        │  Supabase JS client, using the signed-in user's session
                        ▼
                  Supabase: Postgres + Auth + Storage
                  · row-level security enforces every permission
                  · triggers enforce the workflow (review → approve → publish)
                        ▲
claude.ai (Pro) ──► Cloudflare Worker: MCP connector (OAuth sign-in)
  custom connector      calls Supabase as the signed-in user, so the same rules apply
```

## Decisions

| Decision | Why |
|---|---|
| AI runs in your Claude Pro chat through a custom MCP connector, not the API | The API costs extra; Pro already includes Claude. The connector saves Claude's work into the app. |
| Cloudflare Pages for hosting, not Vercel | Vercel's free plan doesn't allow commercial use. |
| Supabase for the database, login and files | One free service covers all three, and row-level security puts permissions in the database. |
| Permissions live in Postgres (RLS and triggers) | The app, the Claude connector and any future API all get the same rules. They can't be bypassed from the browser. |
| No automatic video rendering yet | Free options are either too limited or need a paid licence (Remotion is free only for companies of up to 3 people). Editors render the video and upload it. |
| The "Generating" column becomes "In production" | With editors rendering, this is the stage where the editor is making the video. |

## Workflow rules (enforced in the database)

- Draft or In production → In review → Approved → Completed.
- Only roles with approval permission can approve. An open compliance note blocks approval.
- Only approved content can be scheduled or published, and only by roles with publish permission.
- Only compliance reviewers can resolve compliance notes.
- Nobody can change their own role. Only a super admin can create another super admin.
- The first account created becomes the super admin. Everyone after that starts as a viewer.
- Every status change is written to the activity log.
- Nothing except drafts can be deleted. Assets are archived, not deleted.

## Tests

`bash supabase/tests/run_local.sh` builds a throwaway local Postgres, applies the migrations and runs 20 permission and workflow checks.

## Build phases

1. **Done:** design preview, brand kit, database schema and permissions, tested.
2. **Next:** the React app on the database (login, dashboard, Studio, Production, Calendar, Styles, Assets, Brand Kit, Admin).
3. Claude connector (MCP worker with OAuth), with tools to save ideas and scripts, list styles, update status and read the calendar.
4. Deploy to Cloudflare and Supabase, then connect Claude Pro.
5. Social publishing, one platform at a time as each developer app is approved. YouTube comes first.
