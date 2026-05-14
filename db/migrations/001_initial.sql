create extension if not exists pgcrypto;

create table if not exists visitors (
  visitor_id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_client_id text,
  latest_client_id text,
  first_landing_page text,
  first_referrer text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  raw_first_payload jsonb
);

create table if not exists sessions (
  session_id text primary key,
  visitor_id text not null references visitors(visitor_id),
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  landing_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  device text,
  country text
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_name text not null,
  event_time timestamptz not null,
  shop_domain text,
  client_id text,
  visitor_id text not null references visitors(visitor_id),
  session_id text not null references sessions(session_id),
  page_url text,
  page_title text,
  landing_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  ttclid text,
  device text,
  country text,
  product_id text,
  variant_id text,
  product_title text,
  cart_value numeric(12, 2),
  currency text,
  checkout_token text,
  order_id text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(event_id, event_name)
);

create index if not exists events_visitor_time_idx on events(visitor_id, event_time);
create index if not exists events_session_time_idx on events(session_id, event_time);
create index if not exists events_event_name_time_idx on events(event_name, event_time desc);
create index if not exists events_checkout_token_idx on events(checkout_token) where checkout_token is not null;
create index if not exists events_order_id_idx on events(order_id) where order_id is not null;

create table if not exists touchpoints (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null references visitors(visitor_id),
  session_id text not null references sessions(session_id),
  event_id uuid references events(id),
  touched_at timestamptz not null,
  channel text not null,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  landing_page text,
  referrer text,
  click_id text,
  created_at timestamptz not null default now()
);

create index if not exists touchpoints_visitor_time_idx on touchpoints(visitor_id, touched_at);
create index if not exists touchpoints_channel_time_idx on touchpoints(channel, touched_at desc);

create table if not exists orders (
  shopify_order_id text primary key,
  order_name text,
  checkout_token text,
  cart_token text,
  email_hash text,
  customer_id text,
  financial_status text,
  fulfillment_status text,
  cancelled_at timestamptz,
  paid_at timestamptz,
  processed_at timestamptz,
  currency text,
  subtotal_price numeric(12, 2),
  total_tax numeric(12, 2),
  total_shipping numeric(12, 2),
  total_price numeric(12, 2),
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_checkout_token_idx on orders(checkout_token) where checkout_token is not null;
create index if not exists orders_processed_at_idx on orders(processed_at desc);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null references orders(shopify_order_id) on delete cascade,
  line_item_id text,
  product_id text,
  variant_id text,
  sku text,
  title text,
  quantity integer,
  price numeric(12, 2),
  raw_payload jsonb not null
);

create table if not exists refunds (
  shopify_refund_id text primary key,
  shopify_order_id text,
  processed_at timestamptz,
  total_refunded numeric(12, 2),
  currency text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists refunds_order_id_idx on refunds(shopify_order_id);

create table if not exists attribution_results (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null references orders(shopify_order_id) on delete cascade,
  model text not null,
  channel text not null,
  source text,
  medium text,
  campaign text,
  revenue_credit numeric(12, 2) not null,
  order_credit numeric(8, 4) not null,
  computed_at timestamptz not null default now(),
  unique(shopify_order_id, model, channel, source, medium, campaign)
);

create table if not exists funnel_diagnostics (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references sessions(session_id),
  visitor_id text not null references visitors(visitor_id),
  diagnostic_key text not null,
  diagnostic_label text not null,
  priority text not null,
  evidence jsonb not null,
  recommendation text not null,
  computed_at timestamptz not null default now(),
  unique(session_id, diagnostic_key)
);
