# Current Netlify access

The website has a public login page. Business data requires a shared workspace password configured as `GARDENER_PASSWORD` in Netlify. See [DEPLOYMENT.md](DEPLOYMENT.md) for current setup; this replaces earlier platform-private/allowlist instructions below.

# Gardener Pro — Netlify deployment

This branch is prepared for a **private, single-workspace Netlify deployment**. It is the current internal prototype, not the future multi-business employee system. All approved visitors have full access to this workspace. Crew entries are not login accounts.

## Deploy from GitHub

1. In Netlify, set your team's default project visibility to **Private**, for **production and previews**, before importing this repository. Keep the resulting project's visibility Private too. A public GitHub repository does not require a public website.
2. Import `mshadhir/Gardener_Pro`, branch `main`. The root `netlify.toml` supplies the build command, functions, edge guard, redirects and publish directory. Do not use Netlify Drop or publish only the `public` directory: those omit backend deployment.
3. In Netlify's environment variables, add `GARDENER_ALLOWED_EMAILS` with the email used by your Netlify login. Use a comma-separated list for additional explicitly approved owners/managers. Make it available to **Functions** (or all scopes) and every intended deploy context. Do not put personal emails or secrets in this public repository.
4. Deploy/redeploy. Build command: `npm test && npm run build`; publish directory: `dist/client`; Node: 22. Netlify Blobs uses platform-provided credentials, so no database token is needed.
5. Sign in with your approved Netlify account. New storage begins empty. Your existing Sites/Lovable data is not migrated automatically.
6. Run the checks in [DEPLOYMENT.md](DEPLOYMENT.md) before entering real records.

**Access:** both the edge guard and API require Netlify's verified `context.user` plus the email allowlist. Missing configuration returns 503; anonymous, expired or nonapproved users are denied. A shared-password-only Netlify project does not provide this identity and will not work with this build. Current Free/Personal private projects support the team owner; Netlify Pro is required for additional private-project users. Confirm current plan details before buying. Do not make the app public to fix a login problem.

**Storage:** live production deploys use one site-wide Netlify Blobs store with strong reads and conditional writes. Preview/branch deploys use deploy-specific stores; preview data can disappear with redeployment. Conflicting edits return 409 instead of overwriting another save. This is durable prototype storage, not the normalized multi-tenant database planned for later phases.

**Limits:** 4 MiB maximum total workspace request including inline photos (reduced from the Sites prototype's 8 MB to fit Netlify request limits). Export a JSON backup regularly; automated backup and tested disaster recovery are not implemented. Use a separate private Netlify staging project for ongoing synthetic testing. Every allowed account can edit/export/restore all workspace records.

## Local checks

Use Node 22.13+ (Node 22 configured for Netlify): `npm ci`, `npm test`, `npm run build`. No secrets are needed for tests. Netlify's verified user context is unavailable in local CLI development, so the deployed handlers intentionally deny local anonymous use; tests inject synthetic contexts instead. There is no production authentication bypass switch.

`npm run build:sites` retains the original Worker build for reference. The legacy `dev.mjs` requires Miniflare separately and is not the supported Netlify development entry point. The existing Sites deployment has not been changed.

## Original prototype details

Small standalone gardening operations app. The original implementation uses plain HTML/CSS/JavaScript plus an ES-module Cloudflare Worker and D1 database. The Netlify adapter in this branch replaces that runtime connection with Netlify Functions, Blobs and private account identity. No Lovable/Supabase integration is active.

## Included
Dashboard; site search and filters; site CRUD, notes, access details and task checklists; day/week schedule; manual and automatic recurring scheduling; assignment to members or crews; job start/completion, notes and up to six resized photos; completed history; persistent timers and editable time entries; CSV exports; profile/time-zone settings; full JSON backup and restore. Database writes use revision checks to reject stale updates from another tab/device.

## Legacy Worker
`worker.js` and `wrangler.jsonc` are retained for compatibility and validation tests, but Netlify does not deploy the Worker. Never expose that original Worker without an external authentication boundary.

## Migration differences
The public original at https://gardenerpro.lovable.app exposes an email/password authentication screen. Its delivered app bundle and CSS were inspected to recover navigation, forms, behaviours and design tokens. Protected business data was not fetched or modified. This workspace begins empty; existing users, records and photos require an authorised export and schema conversion.

Original multi-user account registration, organisation roles/invitations, separate crew sign-in, GPS geofencing, background push/email notifications and job adjustment approval queues are not connected. Crew entries here are assignment/contact records only. Excel export is replaced with standard CSV. Standard system fonts substitute for externally hosted Inter/DM Sans. Styling follows the green card layout with desktop sidebar and responsive mobile navigation; it is not a pixel-identical reproduction of authenticated pages.

New job photos are resized JPEGs, stored with records (6 per job, 4 MiB total request limit on Netlify); download regular backups. No customer-facing contact messages or notifications are sent.
