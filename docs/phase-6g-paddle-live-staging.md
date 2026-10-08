# Phase 6G — Paddle Live staging

ButtonPost keeps the public production site on Paddle Sandbox until the Paddle
Live account has completed verification and checkout-domain approval.

## Hosts

- `buttonpost.app` follows `PADDLE_ENV` (currently `sandbox`).
- `staging.buttonpost.app` always uses Paddle Live when
  `PADDLE_LIVE_STAGING_HOST=staging.buttonpost.app`.

The staging hostname is bound to the `phase-6g-paddle-live-staging` Vercel
branch and is not linked from the public product.

## Live-only credentials

Store these in Vercel; never commit them:

```env
PADDLE_LIVE_API_KEY=
PADDLE_LIVE_CLIENT_TOKEN=live_...
PADDLE_LIVE_WEBHOOK_SECRET=
PADDLE_LIVE_STARTER_MONTH_PRICE_ID=pri_...
PADDLE_LIVE_STARTER_YEAR_PRICE_ID=pri_...
PADDLE_LIVE_PRO_MONTH_PRICE_ID=pri_...
PADDLE_LIVE_PRO_YEAR_PRICE_ID=pri_...
PADDLE_LIVE_ADVANCED_MONTH_PRICE_ID=pri_...
PADDLE_LIVE_ADVANCED_YEAR_PRICE_ID=pri_...
```

## Dataset isolation

Sandbox and live subscriptions are stored separately using
`subscriptions.environment`. The same ButtonPost user can have one sandbox
subscription and one live subscription without either overwriting the other.

Cloud publish usage is also environment-scoped.

## Webhook security

Live webhook requests must pass both controls:

1. Source IP must match Paddle's current `https://api.paddle.com/ips`
   `data.ipv4_cidrs` list. ButtonPost fetches this list dynamically and caches
   it briefly; the addresses are not hard-coded.
2. Paddle-Signature must validate using the live notification destination's
   endpoint secret.

Sandbox keeps signature verification but does not apply the live IP allowlist.

## Cutover

Do not set the public `PADDLE_ENV=production` until:

- live catalog IDs are configured;
- live client token is configured;
- live webhook destination is configured and validated;
- `buttonpost.app` is approved under Paddle Website approval;
- the live account onboarding verification is complete;
- the default payment link is `https://buttonpost.app/pricing`;
- checkout opens correctly with live localized prices without taking a real
  payment yet.
