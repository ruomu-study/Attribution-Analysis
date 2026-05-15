import {getPool} from "@/lib/db";

export type JourneySummary = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  last_seen_at: string;
  landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  event_count: number;
  product_views: number;
  add_to_carts: number;
  checkouts_started: number;
  purchases: number;
  last_event_name: string | null;
};

export type JourneyEvent = {
  id: string;
  event_id: string;
  event_name: string;
  event_time: string;
  page_url: string | null;
  product_title: string | null;
  cart_value: string | null;
  currency: string | null;
  checkout_token: string | null;
  order_id: string | null;
};

export type JourneySession = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  last_seen_at: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  device: string | null;
  country: string | null;
};

export type JourneyOrder = {
  shopify_order_id: string;
  order_name: string | null;
  checkout_token: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string | null;
  total_price: string | null;
  processed_at: string | null;
};

export type JourneyDetail = {
  session: JourneySession;
  events: JourneyEvent[];
  orders: JourneyOrder[];
  dropOff: string;
};

function computeDropOff(events: JourneyEvent[]): string {
  const names = new Set(events.map((event) => event.event_name));

  if (names.has("checkout_completed")) {
    return "Purchase completed";
  }

  if (names.has("payment_info_submitted")) {
    return "Payment submitted, no completed purchase yet";
  }

  if (names.has("checkout_shipping_info_submitted")) {
    return "Shipping submitted, stopped before payment";
  }

  if (names.has("checkout_contact_info_submitted")) {
    return "Contact info submitted, stopped before shipping";
  }

  if (names.has("checkout_started")) {
    return "Checkout started, no completed purchase yet";
  }

  if (names.has("product_added_to_cart")) {
    return "Added to cart, checkout not started";
  }

  if (names.has("product_viewed")) {
    return "Product viewed, not added to cart";
  }

  return "Landing page viewed only";
}

export async function getJourneySummaries(limit = 20): Promise<JourneySummary[]> {
  const pool = getPool();
  const result = await pool.query(
    `
      with ranked_events as (
        select
          e.*,
          row_number() over (partition by e.session_id order by e.event_time desc) as event_rank
        from events e
      )
      select
        s.session_id,
        s.visitor_id,
        s.started_at,
        s.last_seen_at,
        s.landing_page,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        count(e.id)::int as event_count,
        count(*) filter (where e.event_name = 'product_viewed')::int as product_views,
        count(*) filter (where e.event_name = 'product_added_to_cart')::int as add_to_carts,
        count(*) filter (where e.event_name = 'checkout_started')::int as checkouts_started,
        count(*) filter (where e.event_name = 'checkout_completed')::int as purchases,
        max(re.event_name) filter (where re.event_rank = 1) as last_event_name
      from sessions s
      left join events e on e.session_id = s.session_id
      left join ranked_events re on re.session_id = s.session_id and re.event_rank = 1
      group by
        s.session_id,
        s.visitor_id,
        s.started_at,
        s.last_seen_at,
        s.landing_page,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign
      order by s.last_seen_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

export async function resolveSessionId(query?: string): Promise<string | null> {
  const pool = getPool();

  if (!query) {
    const latest = await pool.query<{session_id: string}>(
      "select session_id from sessions order by last_seen_at desc limit 1"
    );

    return latest.rows[0]?.session_id || null;
  }

  const result = await pool.query<{session_id: string}>(
    `
      select session_id
      from events
      where session_id = $1
        or visitor_id = $1
        or checkout_token = $1
        or order_id = $1
      order by event_time desc
      limit 1
    `,
    [query]
  );

  return result.rows[0]?.session_id || null;
}

export async function getJourneyDetail(sessionId: string): Promise<JourneyDetail | null> {
  const pool = getPool();
  const sessionResult = await pool.query<JourneySession>("select * from sessions where session_id = $1", [sessionId]);

  if (!sessionResult.rows[0]) {
    return null;
  }

  const eventsResult = await pool.query<JourneyEvent>(
    `
      select
        id,
        event_id,
        event_name,
        event_time,
        page_url,
        product_title,
        cart_value,
        currency,
        checkout_token,
        order_id
      from events
      where session_id = $1
      order by event_time asc
    `,
    [sessionId]
  );

  const checkoutTokens = eventsResult.rows.map((event) => event.checkout_token).filter(Boolean);
  const orderIds = eventsResult.rows.map((event) => event.order_id).filter(Boolean);
  const ordersResult = await pool.query<JourneyOrder>(
    `
      select
        shopify_order_id,
        order_name,
        checkout_token,
        financial_status,
        fulfillment_status,
        currency,
        total_price,
        processed_at
      from orders
      where checkout_token = any($1::text[])
         or shopify_order_id = any($2::text[])
      order by processed_at desc nulls last
    `,
    [checkoutTokens, orderIds]
  );

  return {
    session: sessionResult.rows[0],
    events: eventsResult.rows,
    orders: ordersResult.rows,
    dropOff: computeDropOff(eventsResult.rows)
  };
}
