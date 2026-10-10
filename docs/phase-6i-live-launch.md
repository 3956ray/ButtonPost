# Phase 6I — Live launch

Status: **ButtonPost is publicly launched at https://buttonpost.app.**

Production product state:
- Public domain: `buttonpost.app`
- Authentication: Google/GitHub via Supabase
- Publishing: X + DEV cloud publishing; optional Local Runner for browser destinations
- Plans: Free / Starter / Pro / Advanced with server-enforced monthly cloud allowances
- Paddle Live catalog: created and verified on the approved production domain
- Paddle Live client token and price IDs: configured in Vercel
- Paddle Live webhook handler: available at `/api/paddle/live-webhook`
- Support: `support@buttonpost.app`
- Legal: `/terms`, `/privacy`, `/refund`

## Billing cutover rule

The product is live, but Paddle billing must not switch the public `/pricing`
page from Sandbox to Live until the Paddle **Default payment link** is set to:

```
https://buttonpost.app/pricing
```

Paddle requires this account-level dashboard setting before it can create
transactions or open Live Checkout. Once confirmed, set:

```
PADDLE_ENV=production
```

and redeploy production.

## Developer Live indicator

`/internal/live-pricing` remains owner-only and uses Paddle Live regardless of
the public billing environment. It intentionally keeps only a subtle
`Paddle: LIVE` chip for maintainers; the previous verification-only warning
has been removed.

## Webhook

The Live notification destination should point to:

```
https://buttonpost.app/api/paddle/live-webhook
```

The handler validates Paddle's dynamic Live IP allowlist and
`Paddle-Signature` before processing events.
