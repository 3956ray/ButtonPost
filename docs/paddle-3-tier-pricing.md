# Paddle 3-tier pricing setup

ButtonPost's `/pricing` page uses Paddle.js directly for localized totals and checkout.

## Catalog

Create three Paddle Sandbox products:

- ButtonPost Starter
- ButtonPost Pro
- ButtonPost Advanced

Create two recurring prices for each product:

- monthly
- yearly

ButtonPost does not calculate yearly discounts or convert currencies in the browser. Whatever values you configure in Paddle are the values shown by `Paddle.PricePreview()` and charged by Checkout.

Add the six Paddle price IDs to Vercel:

```env
NEXT_PUBLIC_PADDLE_STARTER_MONTH_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_STARTER_YEAR_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_PRO_MONTH_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_PRO_YEAR_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_ADVANCED_MONTH_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_ADVANCED_YEAR_PRICE_ID=pri_...
```

## Localization

The Next.js server reads `x-vercel-ip-country`.

If it contains a valid two-letter country code, ButtonPost passes it to:

```ts
Paddle.PricePreview({
  items,
  address: { countryCode }
})
```

If the header is absent or invalid, ButtonPost omits `address` entirely and lets Paddle.js detect the visitor location from IP.

The UI renders `lineItem.formattedTotals.total` exactly as Paddle returns it. It does not use `Intl.NumberFormat`, divide yearly prices, round values, or otherwise reformat the price.

## Checkout

Each Subscribe button opens the exact active price ID using:

```ts
Paddle.Checkout.open({
  items: [{ priceId, quantity: 1 }],
  settings: {
    displayMode: 'overlay',
    variant: 'one-page',
    successUrl: '<origin>/welcome'
  }
})
```

Signed-in email is prefilled and `buttonpost_user_id` is attached as Paddle custom data.

## Default payment link

This setting must be configured manually in Paddle Dashboard.

In Paddle Sandbox go to:

```text
Checkout → Checkout settings → Default payment link
```

Set it to your sandbox checkout page.

For sandbox testing, localhost is allowed. For live, use a real approved ButtonPost domain; localhost is not valid for live checkout.

## Environment safety

`PADDLE_ENV` is required. ButtonPost throws if it is missing or not exactly `sandbox` or `production`.

The browser client also rejects a non-`test_` client token in sandbox and rejects a sandbox token in production.
