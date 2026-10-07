# Phase 6D — Paddle billing

ButtonPost billing is implemented as a standard entitlement flow:

\`\`\`text
Supabase user
  → Paddle Checkout
  → recurring price
  → customData.buttonpost_user_id
  → Paddle subscription webhook
  → public.subscriptions
  → ButtonPost Pro entitlement
\`\`\`

## Required Paddle Sandbox setup

Create:

1. Client-side token
2. Product: \`ButtonPost Pro\`
3. Monthly recurring price (MVP target: USD 9/month)
4. Webhook destination

Set these Vercel variables:

\`\`\`env
PADDLE_ENV=sandbox
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
NEXT_PUBLIC_PADDLE_PRICE_ID=pri_...
BUTTONPOST_REQUIRE_PRO=false
\`\`\`

Webhook destination:

\`\`\`text
https://buttonpost.vercel.app/api/paddle/webhook
\`\`\`

Subscribe to at least:

\`\`\`text
subscription.created
subscription.activated
subscription.trialing
subscription.updated
subscription.paused
subscription.resumed
subscription.canceled
\`\`\`

## Rollout

Keep \`BUTTONPOST_REQUIRE_PRO=false\` while validating Sandbox.

After a successful test subscription creates the expected \`subscriptions\` row and Customer Portal works, switch the flag to \`true\` to require Pro for ButtonPost cloud publishing (X / DEV). Local Runner destinations remain local-first.
