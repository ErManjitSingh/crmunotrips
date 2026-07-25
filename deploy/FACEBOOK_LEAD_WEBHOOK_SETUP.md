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

## Status check
https://app.unotrips.com/api/facebook/webhook/status  
https://app.unotrips.com/api/webhooks/facebook/status

## Backend env (VPS `/var/www/app-unotrips-crm/backend/.env`)
```
FACEBOOK_VERIFY_TOKEN=unotrips-fb-verify-2026
FACEBOOK_PAGE_ACCESS_TOKEN=<long-lived page token>
FACEBOOK_APP_SECRET=<app secret>          # recommended
FACEBOOK_DEFAULT_DESTINATION=Not specified
FACEBOOK_GRAPH_VERSION=v21.0
```

## Meta setup (one-time)
1. developers.facebook.com → Create App (Business)
2. Add products: **Webhooks**, **Marketing API** (or Lead Access)
3. Webhooks → Page → Subscribe
   - Callback URL: `https://app.unotrips.com/api/facebook/webhook`
   - Verify Token: same as `FACEBOOK_VERIFY_TOKEN`
   - Subscribe field: **leadgen**
4. Generate long-lived **Page Access Token** with:
   - `leads_retrieval`
   - `pages_manage_metadata`
   - `pages_show_list`
   - `pages_read_engagement`
5. Put token in backend `.env` as `FACEBOOK_PAGE_ACCESS_TOKEN`, restart PM2
6. Install app on Page:
```bash
curl -X POST "https://graph.facebook.com/v21.0/{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen&access_token={PAGE_ACCESS_TOKEN}"
```
7. Create Lead Ad Instant Form with **phone** (required). Optional: destination question.
8. Submit a test lead from Ads Manager → Lead Forms → Preview / Test.

Leads land in CRM with source **Facebook Lead**.

## What Meta means by “URL not found”
Meta does a GET to your Callback URL with `hub.mode`, `hub.verify_token`, `hub.challenge`.  
If the path is wrong (404), verification fails. Use the Callback URL above exactly (HTTPS, no trailing slash issues).
