# Shopify Attribution MVP

Internal attribution analysis tool for a single Shopify store.

## What is included

- Shopify Custom Pixel template in `shopify/custom-pixel.js`
- Event collection API at `POST /api/events/collect`
- Shopify order webhook endpoint at `POST /api/webhooks/shopify/orders`
- Postgres schema for events, visitors, sessions, touchpoints, orders, attribution, and funnel diagnostics
- Minimal dashboard shell with health and recent event views

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL`.

3. Run the initial database schema:

   ```bash
   npm run db:migrate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. In Shopify Admin, go to Customer events, create a Custom Pixel, paste `shopify/custom-pixel.js`, and replace:

   ```js
   const COLLECT_URL = "https://your-domain.com/api/events/collect";
   const COLLECT_SECRET = "replace_with_optional_shared_secret";
   ```

## Shopify webhook

Create order webhooks for:

- `orders/create`
- `orders/paid`
- `orders/cancelled`
- `refunds/create`

Point them at:

```txt
https://your-domain.com/api/webhooks/shopify/orders
```

Set `SHOPIFY_WEBHOOK_SECRET` to the webhook signing secret.
