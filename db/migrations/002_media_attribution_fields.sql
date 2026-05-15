alter table events
  add column if not exists surface text,
  add column if not exists list_name text,
  add column if not exists card_position integer,
  add column if not exists media_id text,
  add column if not exists media_url text,
  add column if not exists media_position integer,
  add column if not exists media_alt text,
  add column if not exists product_handle text,
  add column if not exists interaction_target text;

create index if not exists events_media_url_idx on events(media_url) where media_url is not null;
create index if not exists events_product_handle_idx on events(product_handle) where product_handle is not null;
create index if not exists events_surface_time_idx on events(surface, event_time desc) where surface is not null;
