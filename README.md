# CUPED team planner

A simple classroom presentation planner for Coral Reef CCU CUPED interns representing EdFed.

Run `npm start` from this directory, then open port 3000 in a browser. No dependency installation is required. Local planning and snapshot sharing need no account; optional live sync uses Supabase and an owner sign-in. Run `npm test` for scheduling-rule tests.

The calendar opens October 26–30, 2026. October 29 is confirmed B-Day and October 30 is confirmed A-Day. Three draft visits per day use the proposed four-person day teams, 15-minute presentations at 9:40, 10:10, and 10:40, with 15-minute breaks. Teacher assignments and exact times are proposals, not confirmed bookings. Existing plans on either date are preserved by a one-time migration; the migration does not re-add deleted draft visits. Choose each visit’s actual A/B school day; the app does not infer the school calendar. Presentations are restricted to the project lead’s corrected 9:40 a.m.–noon window on both A and B days. First-lunch classes have lunch 10:35–11:15; second-lunch classes have lunch 11:35–12:15. CCU interns have second lunch. Known teacher-lunch overlaps are blocked; intern-lunch overlaps require acknowledgment. Unknown teacher lunches show warnings on saved visits and in the visit editor. The supplied school lunch PDF maps departments and rooms to lunch groups for both A and B days. Unknown partner lunch groups are filled from department rules; existing manual assignments are retained. Room-specific rules take priority over department assignments, with a warning when they differ. Individual A/B class exceptions can be edited. The untouched Gornail draft on October 29 moves from 10:40 to 11:15 to avoid first lunch; edited visits are retained and flagged if conflicting. Department and room rules are in lunch.js. Dates, teachers, presenters, rooms, notes, and confirmation statuses can be edited. Overlapping teachers or presenters are blocked. Email drafts open in the user's email client; emails are not sent automatically or at a scheduled time.

The 22-person roster includes Valerie Gutierrez as project lead. October 19–30, 2026 assignments come from the supplied announcement, with full student names from the spreadsheet. Ava Cardona is confirmed B-Day by the project lead, overriding the spreadsheet. Create the next rotation and edit roles without replacing the previous rotation. Proposed presenters are a separate current shortlist.

Student IDs, phone numbers, and student email addresses are not included. Partner teachers are enriched with unambiguous faculty-directory matches, retaining existing emails. The project lead confirmed Tracey Riley (Science) and Richard Gornail (Engineering); their directory emails are filled in. Previously saved Gornell visits migrate to Gornail without changing dates or assignments. The supplied staff directory is in faculty.js; only the 12 approved partners are shown as scheduling options. The source workbook is not copied into the repository.

Plans save in this browser's local storage. Export/import JSON backups to transfer the current plan. Print the displayed week for Ms. Mirabal. Without a configured Supabase connection, sharing produces snapshots and changes stay in this browser. Optional live sync uses a shared database with owner authentication, described below.

The interface optionally loads Google Fonts; system fonts work offline. Local planning, printouts, and snapshot sharing run without external services; live sync needs the configured Supabase project.

## View-only sharing

Click **Share view-only link** and copy the generated URL. It embeds the current plan and displayed week in the URL fragment; the recipient does not need a backup file. Schedule editing controls and browser storage writes are disabled in viewer mode; email drafts remain available. Visiting `view.html` or `?view=1` without a snapshot displays the original proposed schedule unless a shared calendar is configured in sync-config.json. Snapshot copies do not sync: generate a new link after updates, or connect Live sync for an automatically updating link. This is a read-only interface, not authentication or a tamper-proof record. Recipients can make their own independent copies; they cannot change the original browser-saved plan. Anyone with a snapshot link can read its contents.

Email drafts: choose **Email drafts** in the navigation, then **View email draft**, or click an existing calendar visit and choose **Prepare email**. Review the recipient/message and choose **Open email app**. Drafts are available in both modes, with a Copy draft option, and are never sent automatically.

Branding uses the EdFed logo downloaded from the official EdFed website, stored locally in assets/edfed-logo.png. Both planner pages display “Created by Valerie Gutierrez.”

## Calendar work assignments

Use **Assign work** above the calendar, or **Assign work** on an empty day. Choose a date, role, one or more students, and a description. Optionally mark the work Planned, In progress, or Done. Click the calendar card to edit or delete it. Work can involve both A/B groups and does not consume a classroom visit time slot. Work descriptions appear in shared copies, the live viewer, and printouts. No example assignments are preloaded. Older browser plans and JSON backups migrate to an empty assignments list without altering visits or rotations.

## Connect live updates (one-time Supabase setup)

Live sync is implemented but requires your own Supabase project. Until it is connected, the app clearly shows that changes stay on the current device, and shared links are snapshots.

1. Create a free Supabase organization and project. Keep the database password private.
2. Open SQL Editor → New query. Copy all of `supabase-setup.sql` into it and run it. This creates a public-read `plans` table with row-level security; only a plan's signed-in creator can insert/update that plan.
3. In Authentication → Users → Add user, create and confirm your owner account with an email and password. This is separate from your database password. Disable public sign-ups if you do not need them.
4. Find your Project URL and public **publishable** key (or legacy **anon** key) in the Connect dialog / API settings. Never enter a secret/service-role key in the app.
5. Open the regular planner → **Live sync**. Enter the project URL, public key, owner email/password, and leave Calendar ID blank the first time. Choose **Sign in & connect**, then confirm public sharing of your current plan.
6. Open **Share view-only link**. A connected, fully saved plan generates a **live** URL; the read-only page checks for updates every 15 seconds and on return to the tab. It does not require sign-in. Owner edits save automatically after a short delay. Wait for “Shared calendar saved” before sharing. Older snapshot links remain fixed copies.

The public URL/key/calendar ID can optionally be placed in `sync-config.json` to make the simple `view.html` address use the live schedule automatically. This file must contain only `{ "url": "https://PROJECT.supabase.co", "key": "PUBLIC_PUBLISHABLE_KEY", "planId": "CALENDAR_UUID" }`. It is currently `{}` and no live project is assumed. Never put owner passwords, access/refresh tokens, secret keys, or database passwords in it. The Live sync panel displays the connected Calendar ID.

Owner sessions are stored only in that browser. Signed-out edits remain local until sign-in. Failed/offline saves are kept locally and shown as unsynced; use **Retry saving** after reconnecting. If a second editor changed the cloud revision, autosave pauses rather than overwriting it. Export your local backup and use **Reload shared plan** to resolve the conflict; the previous local state is also stored under `cuped-before-cloud-reload`. Public viewers never write data or use the owner session. Copying the editable URL does not grant database edit permission.

A custom domain can serve the same app and connect to the same Supabase calendar. Before switching domains, export a backup because browser storage belongs to each domain. Use the existing project and Calendar ID at the new address instead of creating a second calendar. The app cannot guarantee that a school's network will permit either hosting or database requests.

Validation: unit tests cover assignment migration, content validation, public cloud requests, owner sessions, token refresh, conditional revision saves, and share snapshots. Browser integration checks exercise the UI against a simulated Supabase API; a real project still needs the setup steps above before end-to-end cloud readiness can be claimed.
