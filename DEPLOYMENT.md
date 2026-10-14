# Netlify release checklist — v0.2.0

## What is ready

Static frontend build, Netlify function adapter, persistent Blobs storage, atomic revision conflict handling, separate preview data, verified-account allowlist, private edge guard, security headers and bounded payload handling. Unused framework dependencies removed; lockfile regenerated. No worker/mobile/invoicing features added by this deployment conversion.

## Required dashboard setup

| Setting | Value |
| --- | --- |
| Git repository / branch | mshadhir/Gardener_Pro / main |
| Visibility | Private; production AND previews |
| Build command | npm test && npm run build |
| Publish directory | dist/client |
| Functions directory | netlify/functions (configured automatically) |
| Environment variable | GARDENER_ALLOWED_EMAILS = your Netlify login email |
| Variable scope | Functions or all scopes, relevant deployment contexts |
| Domain | Use generated Netlify URL initially; DNS unchanged |

Netlify verifies identity before supplying `context.user`; request headers cannot substitute for it. The allowlist grants full workspace access, so include only you and approved managers. Team membership alone is not sufficient. Use MFA on those accounts. Basic/shared-password protection is not supported by this adapter. No account credentials go in the repository.

## Verify after the first private deployment

1. Check deployment logs: tests, static build, the state function and private-access edge function all succeed. A successful static build alone is insufficient.
2. Sign in as the allowlisted account. Load dashboard, sites, schedule and settings. Refresh a deep link such as `/sites` and `/schedule`. Repeat on a phone and desktop.
3. Create a synthetic property and job, start/stop a timer, complete the job, attach a small photo, reload, then open on a second signed-in device. Confirm records persist.
4. Open two tabs at the same revision. Save different edits in each: the stale tab must report a conflict and reload; it must not overwrite the first save.
5. Export a synthetic JSON backup; restore it only into the separate staging workspace; compare sites/jobs/photos/time. Retain backups securely outside the repository.
6. Open the root, `/api/state`, an asset and `/.netlify/functions/state` in an incognito session. None should reveal workspace data without authorized sign-in. Test an authenticated but nonallowlisted account if available. Check that failed requests are not cached.
7. Test a private branch/preview deployment with invented records: it must not display production records. Preview stores are disposable; never use them for important work.
8. Test a redeploy and confirm production records survive. Test signing out through Netlify/account session controls and that a fresh anonymous session cannot read the API. No application-level logout/session UI is implemented here.
9. Review Netlify usage/cost controls. Do not migrate real customer records until private access and persistence pass on the hosted service.

These hosted checks have not been performed merely by preparing this repository. Local tests use synthetic contexts and an in-memory store; they do not prove platform identity injection, routing or live storage behavior.

## Migration and recovery

Export your current Sites workspace using Settings → backup before any cutover. Keep the source app available. Netlify starts with separate empty storage. Import only a compatible version-1 export whose complete request fits 4 MiB; larger photo-heavy exports need a deliberate migration, not silent truncation. Import replaces destination records. Check record counts, dates, photos and timers before adopting it. Lovable exports require format conversion.

Rollback code through Netlify's prior deploy after backing up current data. Code rollback does not restore Blobs or undo edits. Restoring JSON overwrites records and must be intentional. There is no automated backup, tenant restore, payroll-grade audit or production recovery SLA in this prototype.

## Failure messages

- 503 private access not configured: add the allowlist to Functions scope, then redeploy.
- 401 private login required: set Private/team login for production and previews; public/shared-password-only projects cannot populate verified account identity.
- 403: signed-in email is not in the allowlist. Compare exact account email in Netlify settings; no client-side override.
- 409: another save won. Reload and reapply your change.
- 413: full workspace exceeds 4 MiB. Export first, reduce photos deliberately, retry.
- 503 storage save unconfirmed: reload before retrying. A network failure may occur after storage accepted a write; never assume the save failed or silently overwrite.

## Scope and follow-up

This is an internal manager prototype. It is not safe to invite workers with restricted permissions or unrelated businesses: full workspace access is shared by every approved account. Native apps, roles, tenant database, automated backups, location, QuickBooks, Google Sheets and subscriptions remain future work in the phased plan.

Official references checked 13 October 2026:
- https://docs.netlify.com/build/functions/api/
- https://docs.netlify.com/build/edge-functions/api/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/
- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/build/edge-functions/environment-variables/
