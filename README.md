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

## Visitor and source validation

Use `/visitors` to validate whether the same browser keeps the same `visitor_id` across repeat visits.

Recommended same-device test:

1. Open the store with a test URL such as `https://lightsin.co.uk/?utm_source=codex_test&utm_medium=debug&utm_campaign=visitor_repeat`.
2. View a product and add it to cart.
3. Wait a few minutes, then open the same browser profile again and repeat the add-to-cart flow.
4. Open `/visitors` and confirm the same `visitor_id` has multiple sessions or additional events.

Expected behavior:

- Same browser profile with cookies preserved: the `visitor_id` should stay stable.
- Incognito, another browser, another device, or cleared cookies: Shopify/pixel storage can create a new `visitor_id`.
- A new `session_id` is expected after 30 minutes of inactivity.

Source attribution is inherited from the session onto later events, so product views, add-to-cart, and checkout events can still be analyzed by the entry source even when their own URLs do not contain UTM parameters.

## Persistent collection

Local quick tunnels are useful for testing, but they are not persistent. If the tunnel or `npm run dev` process stops, Shopify can no longer send events to `/api/events/collect`.

Use `/monitor` during testing. It refreshes every 5 seconds and shows:

- whether the backend has received a Pixel event in the last 2 minutes
- the latest server receive time
- event counts for the selected test window
- recent events ordered by backend `created_at`
- the configured collect URL and whether the collect secret is set
- whether the public tunnel/domain can reach `/api/health`

Events that reach `/api/events/collect` are stored in Postgres and remain available for later analysis. The monitor page only changes the display window; it does not delete old records.

For continuous collection:

1. Deploy this app to a stable HTTPS domain.
2. Update the Custom Pixel `COLLECT_URL` to `https://your-stable-domain.com/api/events/collect`.
3. Update Shopify order webhooks to `https://your-stable-domain.com/api/webhooks/shopify/orders`.
4. Keep Postgres on a persistent database service or a server with backups enabled.

## Theme image-level tracking

To analyze which product-card and product-page images influence clicks and add-to-cart behavior, install the tracker snippet documented in:

```txt
docs/theme-tracking.md
```
