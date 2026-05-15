import {getPool} from "@/lib/db";

export type VisitorSummary = {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  first_landing_page: string | null;
  first_referrer: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  latest_client_id: string | null;
  session_count: number;
  event_count: number;
  order_count: number;
  last_event_name: string | null;
};

export type VisitorRecord = {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  first_landing_page: string | null;
  first_referrer: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_client_id: string | null;
  latest_client_id: string | null;
};

export type VisitorSession = {
  session_id: string;
  started_at: string;
  last_seen_at: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device: string | null;
  country: string | null;
  event_count: number;
  product_views: number;
  add_to_carts: number;
  checkouts_started: number;
  purchases: number;
  last_event_name: string | null;
};

export type VisitorEvent = {
  id: string;
  event_name: string;
  event_time: string;
  session_id: string;
  page_url: string | null;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  product_title: string | null;
  product_handle: string | null;
  cart_value: string | null;
  currency: string | null;
  checkout_token: string | null;
  order_id: string | null;
};

export type VisitorTouchpoint = {
  touched_at: string;
  session_id: string;
  channel: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landing_page: string | null;
  referrer: string | null;
};

export type VisitorOrder = {
  shopify_order_id: string;
  order_name: string | null;
  checkout_token: string | null;
  financial_status: string | null;
  currency: string | null;
  total_price: string | null;
  processed_at: string | null;
};

export type VisitorDetail = {
  visitor: VisitorRecord;
  sessions: VisitorSession[];
  events: VisitorEvent[];
  touchpoints: VisitorTouchpoint[];
  orders: VisitorOrder[];
};

export async function getVisitorSummaries(limit = 20): Promise<VisitorSummary[]> {
  const pool = getPool();
  const result = await pool.query<VisitorSummary>(
    `
      with latest_events as (
        select
          e.*,
          row_number() over (partition by e.visitor_id order by e.event_time desc) as event_rank
        from events e
      ),
      matched_orders as (
        select distinct
          e.visitor_id,
          o.shopify_order_id
        from events e
        join orders o
          on (o.checkout_token is not null and o.checkout_token = e.checkout_token)
          or o.shopify_order_id = e.order_id
      )
      select
        v.visitor_id,
        v.first_seen_at,
        v.last_seen_at,
        v.first_landing_page,
        v.first_referrer,
        v.first_utm_source,
        v.first_utm_medium,
        v.first_utm_campaign,
        v.latest_client_id,
        count(distinct s.session_id)::int as session_count,
        count(distinct e.id)::int as event_count,
        count(distinct mo.shopify_order_id)::int as order_count,
        max(le.event_name) filter (where le.event_rank = 1) as last_event_name
      from visitors v
      left join sessions s on s.visitor_id = v.visitor_id
      left join events e on e.visitor_id = v.visitor_id
      left join latest_events le on le.visitor_id = v.visitor_id and le.event_rank = 1
      left join matched_orders mo on mo.visitor_id = v.visitor_id
      group by
        v.visitor_id,
        v.first_seen_at,
        v.last_seen_at,
        v.first_landing_page,
        v.first_referrer,
        v.first_utm_source,
        v.first_utm_medium,
        v.first_utm_campaign,
        v.latest_client_id
      order by v.last_seen_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

export async function resolveVisitorId(query?: string): Promise<string | null> {
  const pool = getPool();

  if (!query) {
    const latest = await pool.query<{visitor_id: string}>("select visitor_id from visitors order by last_seen_at desc limit 1");
    return latest.rows[0]?.visitor_id || null;
  }

  const direct = await pool.query<{visitor_id: string}>("select visitor_id from visitors where visitor_id = $1 limit 1", [query]);

  if (direct.rows[0]) {
    return direct.rows[0].visitor_id;
  }

  const fromEvents = await pool.query<{visitor_id: string}>(
    `
      select visitor_id
      from events
      where session_id = $1
        or checkout_token = $1
        or order_id = $1
      order by event_time desc
      limit 1
    `,
    [query]
  );

  return fromEvents.rows[0]?.visitor_id || null;
}

export async function getVisitorDetail(visitorId: string): Promise<VisitorDetail | null> {
  const pool = getPool();
  const visitorResult = await pool.query<VisitorRecord>("select * from visitors where visitor_id = $1", [visitorId]);

  if (!visitorResult.rows[0]) {
    return null;
  }

  const [sessionsResult, eventsResult, touchpointsResult, ordersResult] = await Promise.all([
    pool.query<VisitorSession>(
      `
        with ranked_events as (
          select
            e.*,
            row_number() over (partition by e.session_id order by e.event_time desc) as event_rank
          from events e
          where e.visitor_id = $1
        )
        select
          s.session_id,
          s.started_at,
          s.last_seen_at,
          s.landing_page,
          s.referrer,
          s.utm_source,
          s.utm_medium,
          s.utm_campaign,
          s.device,
          s.country,
          count(e.id)::int as event_count,
          count(*) filter (where e.event_name = 'product_viewed')::int as product_views,
          count(*) filter (where e.event_name = 'product_added_to_cart')::int as add_to_carts,
          count(*) filter (where e.event_name = 'checkout_started')::int as checkouts_started,
          count(*) filter (where e.event_name = 'checkout_completed')::int as purchases,
          max(re.event_name) filter (where re.event_rank = 1) as last_event_name
        from sessions s
        left join events e on e.session_id = s.session_id
        left join ranked_events re on re.session_id = s.session_id and re.event_rank = 1
        where s.visitor_id = $1
        group by
          s.session_id,
          s.started_at,
          s.last_seen_at,
          s.landing_page,
          s.referrer,
          s.utm_source,
          s.utm_medium,
          s.utm_campaign,
          s.device,
          s.country
        order by s.started_at desc
      `,
      [visitorId]
    ),
    pool.query<VisitorEvent>(
      `
        select
          id,
          event_name,
          event_time,
          session_id,
          page_url,
          landing_page,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          product_title,
          product_handle,
          cart_value,
          currency,
          checkout_token,
          order_id
        from events
        where visitor_id = $1
        order by event_time desc
        limit 200
      `,
      [visitorId]
    ),
    pool.query<VisitorTouchpoint>(
      `
        select
          touched_at,
          session_id,
          channel,
          source,
          medium,
          campaign,
          landing_page,
          referrer
        from touchpoints
        where visitor_id = $1
        order by touched_at desc
      `,
      [visitorId]
    ),
    pool.query<VisitorOrder>(
      `
        select distinct
          o.shopify_order_id,
          o.order_name,
          o.checkout_token,
          o.financial_status,
          o.currency,
          o.total_price,
          o.processed_at
        from orders o
        join events e
          on e.visitor_id = $1
          and (
            (o.checkout_token is not null and o.checkout_token = e.checkout_token)
            or o.shopify_order_id = e.order_id
          )
        order by o.processed_at desc nulls last
      `,
      [visitorId]
    )
  ]);

  return {
    visitor: visitorResult.rows[0],
    sessions: sessionsResult.rows,
    events: eventsResult.rows,
    touchpoints: touchpointsResult.rows,
    orders: ordersResult.rows
  };
}
