# Google Maps planning setup

The map integration is opt-in. Suburb planning keeps working before setup. Google API calls are made by the authenticated Netlify function; credentials never go into browser code or workspace backups.

## 1. Google Cloud

1. Create/select a project in [Google Cloud Console](https://console.cloud.google.com/) and enable billing.
2. Enable **Geocoding API** and **Route Optimization API** in that project.
3. Create an API key for this app. Under **API restrictions**, restrict it to **Geocoding API**. This is a server key, so browser HTTP-referrer restrictions will not work. Netlify does not provide a fixed outbound IP by default. Restrict the key to fixed server IPs if you later provision that infrastructure.
4. Create a dedicated service account under **IAM & Admin → Service Accounts**. Grant **Route Optimization Viewer** (`roles/routeoptimization.viewer`), which includes `routeoptimization.locations.use` for synchronous optimisation. If service consumption permission is required by your project, grant **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) as well. Do not grant project Owner/Editor or service-agent roles. This app does not need long-running/batch permissions.
5. Open the service account → **Keys → Add key → Create new key → JSON**. Keep this file private. Copy its contents directly into the Netlify secret below; never commit or upload it to this public repository or send it in chat. Rotate/delete the key if exposed.
6. Set Google API quotas and billing alerts before enabling the app integration. Billing alerts notify you; they are not a spending cap. Review the [current prices](https://developers.google.com/maps/billing-and-pricing/pricing). A weekly multi-day request contains several vehicle-day entries and uses **Fleet Routing** pricing, even for one physical vehicle.

References: [Google setup](https://developers.google.com/maps/documentation/route-optimization/cloud-setup), [IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/routeoptimization), [routing billing](https://developers.google.com/maps/documentation/route-optimization/usage-and-billing).

## 2. Netlify secrets

In your Netlify project → **Project configuration → Environment variables**, add these for **Production**, with **Functions** scope (or all scopes). Mark the credential values secret.

| Variable | Value |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | The Geocoding API key |
| `GOOGLE_ROUTES_SERVICE_ACCOUNT` | The entire service-account JSON file contents, including the private key |
| `GARDENER_MAPS_ENABLED` | `true` |
| `GARDENER_MAP_LOOKUPS_PER_DAY` | Optional; defaults to `100` address lookups per UTC day |
| `GARDENER_ROUTE_VISITS_PER_DAY` | Optional; defaults to `200` submitted visits per UTC day |

Redeploy the latest `main` commit. Confirm `routing`, `auth` and `state` functions deploy. Existing `GARDENER_PASSWORD` remains required. Leave map variables absent in previews to keep billable integrations disabled there.

Usage counters are durable, use conditional writes, and reserve capacity before contacting Google. Failed attempts can consume the reservation. The visit cap counts **all fixed and proposed visits each time you optimise**; four attempts with 50 visits each consume the default 200/day. A separate function rule limits routing requests to 6 per IP/domain per minute. Verify Netlify accepts that rule. Limits in this app do not cap usage from other apps sharing your Google project or credentials.

Set `GARDENER_MAPS_ENABLED=false` and redeploy to disable new Google calls.

## 3. Configure the app

1. Sign in → **Settings → Maps & routes → Review map locations**. Find each real site, open its Google Maps pin and confirm the property. Approximate/partial matches are flagged for manual review. Fix the site address when needed; an address change makes its previous pin ineligible automatically. Sample locations are excluded.
2. Open **Route settings**. Choose one assignment per vehicle. If you and your boss travel together, make a crew containing both and assign that vehicle's visits to the crew. Separate vehicles need separate assignments. A person cannot appear in multiple routes in the same weekly request.
3. Enter and look up each vehicle's starting/finishing address, confirm the pins, then save departure time, return deadline and break length. Leave the finish address blank to return to the starting point. Times use the workspace's time zone.
4. Open **Schedule → Plan this week** for the desired week. Adjust daily limits and select the visits you want considered. Choose assignments for any unassigned visits. Tick **Lock day for map planning** on draft visits that must stay on that day.
5. Click **Optimise travel**. It proposes future days and stop order using Google road travel times. Existing future bookings keep their assignment, date and explicit appointment time; flexible visits can be reordered. Today and past days are excluded because the app does not know a vehicle's current position.
6. Review driving minutes, total day length, numbered stops and map links. Unallocated visits stay unallocated. Click **Save weekly plan** to save dates and order in one revision-checked write. Dates/order are the only route results saved; arrival and travel estimates stay in the current draft. Editing the draft clears the previous route calculation.

The daily hours limit includes service duration, per-visit setup allowance, actual estimated driving, waiting and breaks. In the suburb-only planner, the same per-visit allowance serves as a rough travel buffer. Routing currently keeps each visit with its selected assignment; it does not choose a new employee or evaluate equipment compatibility.

## Recorded history

Optional **Use recorded visit durations** takes the median of up to 10 recent completed visit days with finished timer entries, requiring at least 3 days. It sums same-day entries, excludes active/overnight/over-8-hour entries, ignores days with multiple completed jobs at the same site, and excludes sample sites. It does not infer duration from completion dates, change saved site estimates, train an AI model or send notes/photos to Google. Review your time records before relying on this option. Site estimates are used when history is insufficient.

## Data and verification

Google receives the address for each lookup. Optimisation receives confirmed place IDs, numeric durations, working windows, limits and anonymous visit/vehicle labels. Names, phone numbers, completion notes and photos are not sent. Only place IDs and your own entered addresses are retained for map locations; returned formatted addresses and route estimates are not cached in persistent storage. Pins and route sections open Google Maps in a separate tab/app.

Before relying on real routes, test a small week with known addresses and a fixed appointment, compare the proposed journey with Google Maps, check mobile map links, then save/reload and confirm order. Repeat a save from two devices to verify stale-write handling. Test an invalid/revoked credential to confirm a clear error and no schedule changes. Live Google calls require the owner's credentials and have not been exercised by the automated tests; those use representative provider responses, including failure cases.
