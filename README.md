# CUPED team planner

A simple classroom presentation planner for Coral Reef CCU CUPED interns representing EdFed.

Run `npm start` from this directory, then open port 3000 in a browser. No dependency installation is required. The editable planner requires the verified Supabase owner sign-in; intern viewers enter the shared access code without an account. Live sync uses the same owner session. Run `npm test` for scheduling-rule tests.

The calendar opens October 26–30, 2026. October 29 is confirmed B-Day and October 30 is confirmed A-Day. Three draft visits per day use the proposed four-person day teams, 15-minute presentations at 9:40, 10:10, and 10:40, with 15-minute breaks. Teacher assignments and exact times are proposals, not confirmed bookings. Existing plans on either date are preserved by a one-time migration; the migration does not re-add deleted draft visits. Choose each visit’s actual A/B school day; the app does not infer the school calendar. Presentations are restricted to the project lead’s corrected 9:40 a.m.–noon window on both A and B days. First-lunch classes have lunch 10:35–11:15; second-lunch classes have lunch 11:35–12:15. CCU interns have second lunch. Known teacher-lunch overlaps are blocked; intern-lunch overlaps require acknowledgment. Unknown teacher lunches show warnings on saved visits and in the visit editor. The supplied school lunch PDF maps departments and rooms to lunch groups for both A and B days. Unknown partner lunch groups are filled from department rules; existing manual assignments are retained. Room-specific rules take priority over department assignments, with a warning when they differ. Individual A/B class exceptions can be edited. The untouched Gornail draft on October 29 moves from 10:40 to 11:15 to avoid first lunch; edited visits are retained and flagged if conflicting. Department and room rules are in lunch.js. Dates, teachers, presenters, rooms, notes, and confirmation statuses can be edited. Overlapping teachers or presenters are blocked. Email drafts open in the user's email client; emails are not sent automatically or at a scheduled time.

The 22-person roster includes Valerie Gutierrez as project lead. October 19–30, 2026 assignments come from the supplied announcement, with full student names from the spreadsheet. Ava Cardona is confirmed B-Day by the project lead, overriding the spreadsheet. Create the next rotation and edit roles without replacing the previous rotation. Proposed presenters are a separate current shortlist.

Student IDs, phone numbers, and student email addresses are not included. Partner teachers are enriched with unambiguous faculty-directory matches, retaining existing emails. The project lead confirmed Tracey Riley (Science) and Richard Gornail (Engineering); their directory emails are filled in. Previously saved Gornell visits migrate to Gornail without changing dates or assignments. The supplied staff directory is in faculty.js; only the 12 approved partners are shown as scheduling options. The source workbook is not copied into the repository.

Plans save in this browser's local storage. Export/import JSON backups to transfer the current plan. Print the displayed week for Ms. Mirabal. Without a configured Supabase connection, sharing produces snapshots and changes stay in this browser. Optional live sync uses a shared database with owner authentication, described below.

The interface optionally loads Google Fonts; system fonts work offline. Local planning, printouts, and snapshot sharing run without external services; live sync needs the configured Supabase project.

## View-only sharing

Click **Share view-only link** and copy the generated URL. It embeds the current plan and displayed week in the URL fragment; the recipient does not need a backup file. Schedule editing controls and browser storage writes are disabled in viewer mode; email drafts are available only in the editable planner. The login screen’s view-only link, `view.html`, and `?view=1` open the current live calendar configured in sync-config.json. The known older live-calendar ID is mapped to this same calendar; no database rows are moved or deleted. Snapshot copies do not sync: generate a new link after updates, or connect Live sync for an automatically updating link. This is a read-only interface, not authentication or a tamper-proof record. Recipients can make their own independent copies; they cannot change the original browser-saved plan. Anyone with a snapshot link can read its contents.

Email drafts: choose **Email drafts** in the navigation, then **View email draft**, or click an existing calendar visit and choose **Prepare email**. Review the recipient/message and choose **Open email app**. Drafts are available only in the editable planner, with a Copy draft option, and are never sent automatically. View-only pages keep the Email drafts tab visible. Opening it shows an authorization-required notice directing requests to Valerie Gutierrez at 0643122@students.dadeschools.net. Its Request authorization link opens an email request; it does not grant access. Draft cards and the visit email action stay blocked, as do draft opening, copying, and email launching in viewer handlers.

Branding uses a recreated CUPED program logo based on the supplied reference, stored locally in assets/cuped-logo.png. The EdFed logo is no longer displayed. Both planner pages display “Created by Valerie Gutierrez.”

## Calendar work assignments

Use **Assign work** above the calendar, or **Assign work** on an empty day. Choose a date, role, one or more students, and a description. Optionally mark the work Planned, In progress, or Done. Click the calendar card to edit or delete it. Work can involve both A/B groups and does not consume a classroom visit time slot. Work descriptions appear in shared copies, the live viewer, and printouts. No example assignments are preloaded. Older browser plans and JSON backups migrate to an empty assignments list without altering visits or rotations.

## Connect live updates (one-time Supabase setup)

Live sync is implemented but requires your own Supabase project. Until the shared calendar is connected, changes stay on the current device and shared links are snapshots. The owner sign-in protects editor access independently of live-sync setup.

1. Create a free Supabase organization and project. Keep the database password private.
2. Open SQL Editor → New query. Copy all of `supabase-setup.sql` into it and run it. This creates a public-read `plans` table with row-level security; only a plan's signed-in creator can insert/update that plan.
3. In Authentication → Users → Add user, create and confirm your owner account with an email and password. This is separate from your database password. Disable public sign-ups if you do not need them.
4. Find your Project URL and public **publishable** key (or legacy **anon** key) in the Connect dialog / API settings. Never enter a secret/service-role key in the app.
5. Open the regular planner and sign in with your owner email/password. In **Live sync**, the canonical project settings and owner session are already filled in. Leave Calendar ID blank only for your first calendar, choose **Connect calendar**, and confirm public sharing. Use the existing Calendar ID on other devices instead of creating duplicates.
6. Open **Share view-only link**. A connected plan always generates a **live** URL, with an explicit warning while edits are still unsynced; it never silently creates a snapshot because saving is in progress. The read-only page checks for updates every 15 seconds and on return to the tab. It requires the shared intern code, without an owner sign-in. Owner edits save automatically after a short delay. Wait for “Shared calendar saved” before sharing. Older snapshot links remain fixed copies.

The public URL/key/calendar ID can optionally be placed in `sync-config.json` to make the simple `view.html` address use the live schedule automatically. This file must contain only `{ "url": "https://PROJECT.supabase.co", "key": "PUBLIC_PUBLISHABLE_KEY", "planId": "CALENDAR_UUID" }`. It is configured for the current shared calendar, whose public contents were checked against the project lead’s Social Media and Field trip entries. `legacyPlanIds` maps the previous calendar’s live links to the current calendar. Fixed snapshot links remain fixed and include a link to the current live schedule. Never put owner passwords, access/refresh tokens, secret keys, or database passwords in it. The Live sync panel displays the connected Calendar ID.

Owner sessions are stored only in that browser. Unsent edits are kept in an IndexedDB recovery journal scoped to the calendar and editor page, with localStorage fallback where IndexedDB is unavailable. Reopening the planner replays pending work before reporting a confirmed save. Saves and refreshes run sequentially, reject older revisions, retry transient failures with a bounded delay and on reconnect/focus, and use conditional revision writes. Requests time out after 20 seconds. A three-way merge combines changes to different tasks or fields and preserves explicit deletions. Changes to the same detail pause for owner review in Live sync; conflicts and their recovery copies survive a restart. **Keep my edits for these details** preserves the local choice and unrelated shared changes. **Use shared version** explicitly replaces unsent local edits after confirmation and backup. Closing with an unsent edit shows a browser warning. The previous local state is also stored under `cuped-before-cloud-reload` when replacement is requested. Public viewers never write data or use the owner session. Copying the editable URL does not grant database edit permission.

A custom domain can serve the same app and connect to the same Supabase calendar. Before switching domains, export a backup because browser storage belongs to each domain. Use the existing project and Calendar ID at the new address instead of creating a second calendar. The app cannot guarantee that a school's network will permit either hosting or database requests.

Validation: unit tests cover assignment migration, content validation, public cloud requests, owner sessions, token refresh, conditional revision saves, and share snapshots. Browser integration checks exercise the UI against a simulated Supabase API; a real project still needs the setup steps above before end-to-end cloud readiness can be claimed.

## Owner sign-in

The editable root page starts hidden and inert. `owner-auth.js` waits for Supabase to verify the fixed owner user ID before app state is loaded, rendered, or connected to sync. The username is the email for the existing user in Supabase Authentication → Users; its password is never stored in source, browser storage, or exported backups. There is no public sign-up or offline unlock. A valid account belonging to someone else is denied.

`auth-config.json` contains only public connection settings (project URL, owner UUID, publishable key). The project and owner identity are pinned in the auth module. The publishable key was checked against the actual Supabase project; owner credentials remain private. The server must confirm the owner session on load, return to the tab, and periodic verification. Signing out immediately locks the planner, clears the browser session, cancels sync activity, and signs out this session without logging out other devices. Pending responses cannot restore a signed-out session. Sync and the login gate reuse one verified client to avoid refresh-token races.

The shared view-only page has an intern access screen and retains the email-draft authorization notice. Backend row-level security enforces owner writes to the shared plan; the static HTML/JavaScript and intentionally public calendar contents remain publicly downloadable on GitHub Pages. The screen gate does not make those static files private.

Use the HTTPS site. The editor upgrades HTTP URLs to HTTPS before showing the login; also enable **Enforce HTTPS** in GitHub Pages settings for server redirects. The connected GitHub app cannot modify that Pages setting through its API.

After the deployment, sign in on the actual site using the owner account you previously created. Automated tests use a simulated auth service for correct-owner, wrong-owner, bad-password, expired/revoked sessions, session restoration, logout races, and public-viewer checks; a real owner password is never needed in this workspace.

## Team photo

In the editable planner, open **Team & rotations → Add team photo** and select the original JPG, PNG, or WebP from your device (up to 2 MB). The photo appears beside “Work together. Teach one another.” and is kept in its original bytes without cropping, resizing, or rewriting. Use Change team photo or Remove photo to update it. The heading/photo stack vertically on phones.

The photo is stored as a validated image data URL in the plan's optional `teamPhoto` field, so JSON backups and the active shared calendar carry it. Only the signed-in owner can upload/remove photos. Public viewers display the active calendar's photo and have no upload controls. Wait for **Shared calendar saved**, then use the generated live viewer link to share it. A different calendar or the unconfigured bare viewer does not pick up another calendar's photo automatically.

Photos can exceed practical snapshot URL limits. Snapshot links above 12,000 characters are rejected with guidance to connect Live sync or export a backup, rather than returning a broken URL. Cloud viewers check revision metadata before fetching a changed plan, so unchanged polling does not repeatedly download the photo. Large original photos may fill browser storage; warnings remain visible and failed local backups abort reload/reconnect instead of overwriting the current plan. Export a file backup or confirm cloud saving before closing the page.

## Sync verification

Regression tests cover delayed reads versus newer saves, recovery before the save delay expires, unchanged cloud revisions at restart, offline retry, concurrent additions and deletions, simultaneous save callers, large recovery drafts, storage failures, and same-field conflicts across restarts. Browser checks use a simulated Supabase service for edits and confirm exact task descriptions reach a read-only viewer. The login link and bare live viewer are also checked with read-only requests against the current public calendar. Production tasks are not edited by automated tests.

## Shared intern access

`view.html`, live and snapshot links, and `?view=1` ask for the shared code **cuped2627** before rendering the schedule or starting live sync. The code is requested on each page load and is not stored in browser storage. Change `INTERN_ACCESS_CODE` in `intern-access.js` to rotate it. The top-right **Owner login** button opens the existing protected editor at `index.html?owner=1`; the intern code never grants editor access.

This is a static-site entry screen, not server-enforced confidentiality: source files and the existing public-read Supabase calendar remain publicly accessible. Existing plan storage, calendar IDs, sync polling, and owner write permissions are unchanged.

The root address `https://ccu.madebyvale.com/` opens intern access first. **Owner login** opens `index.html?owner=1`, which retains the verified Supabase owner gate. No calendar data or browser storage keys are changed.

## School calendar and expanded planning

The supplied Coral Reef 2026–27 A/B calendar is represented in `school-calendar.js`. All 180 instructional dates were checked against the PDF. Each day shows A-Day, B-Day, or a no-school reason, including planning days, holidays, recess, and weekends. Dates outside the supplied year are marked unconfirmed. New classroom visits must match the published A/B day and cannot be scheduled on no-school days. Existing visits are preserved and flagged when they conflict. General work assignments can still be planned on non-school dates.

Choose **Week** or **Month**, use **Go to date**, and choose **Expand calendar** for a larger scrollable view of visits, names, work descriptions, and visit notes. **Collapse calendar** or Escape returns to the normal view. These controls are available to interns and the owner. No recurring presentations are added.

**Mobile Branch Help** and **Tabling with Rory** are available in rotation roles and calendar work assignments. Existing Mobile Branch Promotion and Field trip assignments are retained. Calendar storage keys, the canonical live calendar ID, access-code flow, and sync operations are unchanged.

## Program learning and mobile branch opportunities

`learning-schedule.js` displays all 73 dates from the supplied Coral Reef CUPED Tabling/Mobile Branch/FinEd PDF (revised September 17, 2026), linked in each event's details. These published sessions are a shared calendar overlay, not seeded work assignments or classroom visits; no stored plan or live database rows are rewritten. They appear in owner and intern views, week/month views, expansion, and print. Click a session for its activities, source, and notes.

Classroom presentations and tabling are with Rory. FinEd modules and the Reality Fair are with Emory. Classroom presentation times follow this program document (9:35–11:35 a.m.), separate from intern visits' existing scheduling rules. Tabling and mobile branch times are 10:30 a.m.–12:44 p.m. FinEd and orientation times are unspecified rather than inferred from tabling times. Students are not automatically assigned to staff these opportunities.

The 17 mobile branch visits are highlighted, generally one A-Day and one B-Day per month. December has only December 9 (B-Day) in the source; no second date is invented. November 17, 2026 and February 3, 2027 are printed B-Day in the program PDF but A-Day in the school calendar. Their cards and details flag the discrepancy; A/B filters follow the school calendar while preserving the PDF's original day label. Confirm these two dates with the program team.

## Pending visits and October 29 correction

Visits can have status Pending with blank date and times, shown in a separate Pending section rather than on a calendar date. Choose Planned and a confirmed school date/time to reschedule. Pending visits do not generate dated email drafts.

`pending-visits.js` applies the requested October 29 Gornail correction to the original planned/confirmed visit only: clears its date/time, keeps its B-Day presenters and notes, records its previous date, and adds the lunch explanation. Completed, cancelled, deleted, renamed or already rescheduled records are untouched. Vazquez and Cordova's Completed entries remain intact. Live viewers display the correction; the next authenticated owner load saves it through the usual recovery-aware sync. No anonymous database writes or credentials are introduced. Historical snapshot payloads remain unchanged.

## Dashboard progress, weekly teams and calendar notices

Confirmed Teachers and Completed Teachers count distinct teachers in each exact visit status, with total visits beneath each number. Completed visits are not counted as upcoming confirmations.

The October 30 presenter update applies the requested four A-Day and four B-Day students once, tracked by `presenterTeamRevision`. It changes only the current shortlist and adds an announcement. Existing visit teams, dates, completion statuses, student day groups, and rotation assignments are untouched. Subsequent owner presenter changes remain editable. Like the pending correction, the next authenticated owner load persists the migration through the existing sync; live viewers show the updated shortlist immediately.

Future owner edits create timestamped shared notices for visit status/date/time changes, additions/deletions, work assignments, presentation teams, roster details, teacher details, and rotations. Recent changes retain up to 30 entries in `calendarUpdates`, a map that merges independent device updates without array conflicts. Notices travel with live sync and backups. They start with this release; earlier edits are not given invented historical timestamps. Students get an in-page alert, recent-change history, and unread count while the calendar is open or on their next visit. Read/dismiss controls are local to each browser. These are in-page notifications, not background push, email, or SMS. Normal live polling still controls how soon updates appear.

Notification summaries now group related edits by school-local day, showing only the latest meaningful change per visit or assignment. Status changes and rescheduling use plain language; notes-only, description-only, and contact-detail changes stay quiet. Older detailed notices are condensed for display too. Raw change entries remain separate for safe sync merging, while unread badges and the history show daily summaries.

## Blank new rotations and previous-role hints

New rotations start with an explicit empty role for every student and an Unassigned option in the role selector. Existing rotations are not cleared or changed. In the authenticated owner editor, each selector includes the student's role and date range from the closest earlier rotation. The hint follows the selected rotation's dates, including when reviewing history; the first rotation shows that no earlier rotation exists. Intern views do not render these hints, and printouts omit them. Prior role history remains in the existing rotation records.

Student Team & rotations opens the most recent rotation by start date, including after the initial live calendar arrives. Opening the tab again resets to the newest rotation. Students can still deliberately browse older rotations; background refreshes preserve that choice until they reopen the tab. Owner selections and all saved assignments are preserved.

## Automatic calendar week

The live calendar and editor default to the current Monday–Friday in America/New_York time. On Saturday and Sunday they show the upcoming school week instead (October 31/November 1 opens November 2–6). An open page still following the default week rolls forward on focus, return to the tab, or a minute timer. Manually browsed dates/months stay where the visitor chose them, and fixed snapshot links retain their saved displayed week. This changes only the viewing default, never stored visits or assignments.
