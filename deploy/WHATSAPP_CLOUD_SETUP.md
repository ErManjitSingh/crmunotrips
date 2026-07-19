# WhatsApp Cloud API → CRM Inbox

## What you get
- Customer WhatsApp messages appear in CRM **WhatsApp** inbox
- Chats without a lead show **Create Lead**
- Created leads use source **WhatsApp** (same CRM lead system)
- Reply from CRM sends via Cloud API (when tokens set)

## Callback URL
https://testing.unotrips.com/api/webhooks/whatsapp

## Verify token
`WHATSAPP_VERIFY_TOKEN=unotrips-wa-verify-2026`

## Status
https://testing.unotrips.com/api/webhooks/whatsapp/status

## Backend `.env`
```
WHATSAPP_VERIFY_TOKEN=unotrips-wa-verify-2026
WHATSAPP_ACCESS_TOKEN=<permanent system user / whatsapp token>
WHATSAPP_PHONE_NUMBER_ID=<phone number id from Meta>
WHATSAPP_APP_SECRET=<app secret>
WHATSAPP_DEFAULT_DESTINATION=Not specified
```

## Meta setup
1. developers.facebook.com → App → **WhatsApp** → API Setup
2. Add phone number / use test number first
3. Configuration → Webhook:
   - Callback: `https://testing.unotrips.com/api/webhooks/whatsapp`
   - Verify token: `unotrips-wa-verify-2026`
   - Subscribe field: **messages**
4. Copy **Phone number ID** + **permanent token** into `.env`
5. Restart PM2
6. Send a WhatsApp message to the business number → CRM inbox

## Create lead
Inbox → open chat → **Create Lead** → CRM lead with source WhatsApp.
