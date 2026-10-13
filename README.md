# Gardener Pro independent

Small standalone gardening operations app. No Lovable, Supabase or third-party runtime calls. Source is portable: plain HTML/CSS/JavaScript plus an ES-module Cloudflare Worker and D1 database. Sites provides owner-only authentication.

## Included
Dashboard; site search and filters; site CRUD, notes, access details and task checklists; day/week schedule; manual and automatic recurring scheduling; assignment to members or crews; job start/completion, notes and up to six resized photos; completed history; persistent timers and editable time entries; CSV exports; profile/time-zone settings; full JSON backup and restore. Database writes use revision checks to reject stale updates from another tab/device.

## Run
`npm ci` then `npm run dev`. For Sites preview use `sites-preview start .`. Build with `npm run build`. Deploy the generated Worker with an ASSETS binding for `dist/client` and a D1 binding named DB. The schema is created lazily on the first API request. Outside Sites, add an owner authentication gate before exposing the API; do not expose this single-owner database publicly.

## Migration differences
The public original at https://gardenerpro.lovable.app exposes an email/password authentication screen. Its delivered app bundle and CSS were inspected to recover navigation, forms, behaviours and design tokens. Protected business data was not fetched or modified. This workspace begins empty; existing users, records and photos require an authorised export and schema conversion.

Original multi-user account registration, organisation roles/invitations, separate crew sign-in, GPS geofencing, background push/email notifications and job adjustment approval queues are not connected. Crew entries here are assignment/contact records only. Excel export is replaced with standard CSV. Standard system fonts substitute for externally hosted Inter/DM Sans. Styling follows the green card layout with desktop sidebar and responsive mobile navigation; it is not a pixel-identical reproduction of authenticated pages.

New job photos are resized JPEGs, stored with records (6 per job, 8 MB total workspace payload limit); download regular backups. No customer-facing contact messages or notifications are sent.
