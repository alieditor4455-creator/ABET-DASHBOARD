# ABET Content OS

The AI-powered content operating system for ABET Global, planned for `app.abetglobal.com`.

## Status: design preview (v2)

`design/abet-content-os-preview.html` is a self-contained, clickable preview. Open it in any browser, on desktop or phone. **It has no backend.** All content, people and numbers in it are sample data, and a "Preview · sample data" label says so in the top bar.

What works in the preview:

- **Main journey:** Content Studio → choose a format → enter a topic → script (template-generated, with a live compliance check) → choose a style → generate (simulated job progress, clearly labelled) → preview and approve → publish or schedule with per-platform captions and character limits.
- **Dashboard:** four status cards, recent projects, upcoming content, production activity, and renders in progress. All of it is computed from the same in-memory data.
- **Production:** a five-column Kanban (Draft, Generating, In Review, Approved, Completed) and a list view. Drag-and-drop follows the rules: you can't approve with an open compliance note, and you can't complete without approval.
- **Content Calendar:** month and week views, filters, drag to reschedule, and suggestions for approved but unscheduled content.
- **Creative Styles:** 45 styles across video, motion, graphic, ad and PDF categories. Specs open in an expandable panel. You can edit and duplicate styles, and upload references.
- **Asset Library:** tabs, a storage bar, and preview, reuse, publish and archive actions.
- **Brand Kit:** official logos, colours, fonts, legal text and social handles, each marked "verified" or "needs confirmation".
- **AI & Integrations:** "Test connection" really calls `/api/health/*`. In the preview it reports that the backend is unreachable.
- **Admin Panel:** team and roles, permissions, social connections, storage rules and automation settings.

Not real yet: Claude API calls, rendering, storage, social publishing, authentication and persistence. Changes are lost when the page reloads.

## Layout

```
brand/                  Official ABET assets from abetglobal.com (see brand/README.md)
design/src/app.html     Preview source (HTML, CSS and JS in one file)
design/build.py         Inlines brand images and writes the standalone preview
design/abet-content-os-preview.html   Built preview (open this)
```

Rebuild after editing the source:

```
python3 design/build.py
```

## Design system

- **Look:** a soft neutral canvas with white panels. The navigation active state is ink, and ABET Red is reserved for primary actions and the most important highlights.
- **Spacing:** 8 px scale (4, 8, 12, 16, 24, 32, 40, 48).
- **Corner radii:** 6, 8, 12, 16, 20 px.
- **Typography:** Space Grotesk for headings and Poppins for UI text, both taken from abetglobal.com.
- **Status colours (UI only):** Draft grey, Generating blue, In Review amber, Approved green, Completed ink.
- **Themes:** light by default, with a full dark theme, and reduced motion is respected.
