# Netlify deployment — public login, private business records

Build command: `npm test && npm run build`. Publish: `dist/client`. Node 22.
The Next.js runtime is skipped because this is a static app with Netlify Functions.

## Required owner setup

1. In Netlify environment variables, add `GARDENER_PASSWORD`: a unique randomly generated password of at least 16 characters. Mark it secret, with Functions scope (or all scopes). Set the value for production. Use a DIFFERENT value for previews, or leave previews unconfigured to deny access to their data.
2. Deploy the latest GitHub main commit. Confirm both `auth` and `state` functions deploy.
3. Set Netlify site/deploy access to Public so visitors can reach the app login page. Application authentication still protects business records. `GARDENER_ALLOWED_EMAILS` and Netlify team login are no longer used.
4. Open the deployed URL in a private browser window. The login page should appear. Set up password only in Netlify, never in GitHub or chat.
5. Confirm the deploy post-processing log accepts the auth function rate-limit rule (10 requests per IP/domain per minute). Test throttling on both `/api/auth` and `/.netlify/functions/auth`; invalid rules do not necessarily fail deployment.

## Acceptance checks before real data

- Anonymous GET/PUT `/api/state` and `/.netlify/functions/state` must return 401 (503 if login not configured), never records.
- Incorrect password fails. Correct password opens dashboard. Mobile and desktop login, navigation, and sign-out work.
- Create a test site, reload, confirm it persists on another signed-in device. Export/restore a backup. Delete test data.
- Sign out, then reload/back: records must require login. Sessions expire after eight hours. Rotating the environment password and redeploying invalidates old sessions.
- Confirm previews cannot read production records. Production uses site-wide Blobs; previews use deploy-specific Blobs.

## Limits

Shared password grants full manager access to one workspace; no individual employee accounts, MFA, tenant isolation or audit attribution. This is an internal prototype, not a commercial multi-tenant release. No automatic backups; export JSON backups regularly. Workspace payload limit is 4 MiB including photos.

Sessions use opaque random tokens in Secure, HttpOnly, SameSite=Strict cookies. Hashed tokens, password fingerprints and expiry live in a separate strong-consistency Blobs store. Sign-out deletes the session; expired session records are denied but not automatically purged. The password itself exists only in the server environment. Same-origin checks protect login, logout and writes. Provider failure denies access.

The legacy `private-access` edge source remains for old platform tests but is NOT declared or deployed as a route. The old Sites/worker build is retained separately; this guide applies to Netlify only.
