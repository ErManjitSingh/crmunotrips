# Facebook Lead Ads → CRM (direct webhook)

## Callback URL (use this in Meta)
```
https://app.unotrips.com/api/facebook/webhook
```

Also works (legacy):
```
https://app.unotrips.com/api/webhooks/facebook
```

## Verify token (must match backend `.env`)
`FACEBOOK_VERIFY_TOKEN=unotrips-fb-verify-2026`

## Status / debug
- https://app.unotrips.com/api/facebook/webhook/status  
- https://app.unotrips.com/api/facebook/webhook/debug?token=unotrips-fb-verify-2026  

`recentEvents` empty after a Meta test lead ⇒ Meta is **not** calling your URL.
That usually means App → **Webhooks** → Page callback is not verified / `leadgen` not subscribed there.
`POST /{PAGE_ID}/subscribed_apps` alone is **not** enough.

## Backend env (VPS `/var/www/app-unotrips-crm/backend/.env`)
```
FACEBOOK_VERIFY_TOKEN=unotrips-fb-verify-2026
FACEBOOK_PAGE_ACCESS_TOKEN=<long-lived page token>
FACEBOOK_APP_SECRET=<app secret>          # recommended
FACEBOOK_DEFAULT_DESTINATION=Not specified
FACEBOOK_GRAPH_VERSION=v21.0
FACEBOOK_WEBHOOK_DEBUG=true
```

## Meta setup (one-time) — both required
1. developers.facebook.com → App (Business) **unotrips crm**
2. Add products: **Webhooks**, **Marketing API** / Lead Access
3. **Webhooks → Page → Subscribe**
   - Callback URL: `https://app.unotrips.com/api/facebook/webhook`
   - Verify Token: `unotrips-fb-verify-2026`
   - Subscribe field: **leadgen**
   - Click **Verify and Save** — must succeed
4. Generate long-lived **Page Access Token** with:
   - `leads_retrieval`
   - `pages_manage_metadata`
   - `pages_show_list`
   - `pages_read_engagement`
5. Put token in backend `.env` as `FACEBOOK_PAGE_ACCESS_TOKEN`, restart PM2
6. Install app on Page (in addition to Webhooks product):
```bash
curl -X POST "https://graph.facebook.com/v21.0/{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen&access_token={PAGE_ACCESS_TOKEN}"
```
7. Create Lead Ad Instant Form with **phone** (required). Optional: destination question.
8. Submit a test lead from Ads Manager → Lead Forms → Preview / Test.
9. Confirm delivery:
   - nginx / PM2 should show POST from Meta
   - `/api/facebook/webhook/debug?token=...` should list the inbound event
   - CRM lead source **Facebook Lead**

## Server behaviour
- GET verify → plain-text `hub.challenge` + HTTP 200
- POST leadgen → HTTP 200 immediately, then async Graph fetch + Mongo insert
- Debug logs: `[facebookWebhook:debug]` when `FACEBOOK_WEBHOOK_DEBUG=true`

## What Meta means by “URL not found” / Pending test lead
Meta does a GET to your Callback URL with `hub.mode`, `hub.verify_token`, `hub.challenge`.  
If the path is wrong (404), verification fails. Use the Callback URL above exactly.

If Test Lead stays **Pending** and nginx has **no** Meta POSTs, the Webhooks product callback is not verified — re-do step 3.
