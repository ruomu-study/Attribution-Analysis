import {z} from "zod";
import {classifyChannel} from "@/lib/channel";
import {getPool} from "@/lib/db";

const moneySchema = z.union([z.string(), z.number()]).nullable().optional();

const collectEventSchema = z
  .object({
    event_id: z.string().min(1),
    event_name: z.string().min(1),
    event_time: z.string().datetime().optional(),
    shop_domain: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    visitor_id: z.string().min(1),
    session_id: z.string().min(1),
    page_url: z.string().optional().nullable(),
    page_title: z.string().optional().nullable(),
    landing_page: z.string().optional().nullable(),
    referrer: z.string().optional().nullable(),
    utm_source: z.string().optional().nullable(),
    utm_medium: z.string().optional().nullable(),
    utm_campaign: z.string().optional().nullable(),
    utm_content: z.string().optional().nullable(),
    utm_term: z.string().optional().nullable(),
    gclid: z.string().optional().nullable(),
    fbclid: z.string().optional().nullable(),
    ttclid: z.string().optional().nullable(),
    device: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    product_id: z.string().optional().nullable(),
    variant_id: z.string().optional().nullable(),
    product_title: z.string().optional().nullable(),
    cart_value: moneySchema,
    currency: z.string().optional().nullable(),
    checkout_token: z.string().optional().nullable(),
    order_id: z.string().optional().nullable(),
    surface: z.string().optional().nullable(),
    list_name: z.string().optional().nullable(),
    card_position: z.number().int().optional().nullable(),
    media_id: z.string().optional().nullable(),
    media_url: z.string().optional().nullable(),
    media_position: z.number().int().optional().nullable(),
    media_alt: z.string().optional().nullable(),
    product_handle: z.string().optional().nullable(),
    interaction_target: z.string().optional().nullable()
  })
  .passthrough();

export type CollectEventInput = z.infer<typeof collectEventSchema>;

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch (_error) {
    return value;
  }
}

function isLandingPageEvent(event: CollectEventInput): boolean {
  return event.event_name === "page_viewed" && normalizedUrl(event.page_url) === normalizedUrl(event.landing_page);
}

type SessionAttribution = {
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

export async function storeCollectedEvent(raw: unknown) {
  const event = collectEventSchema.parse(raw);
  const pool = getPool();
  const eventTime = event.event_time ? new Date(event.event_time) : new Date();

  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `
        insert into visitors (
          visitor_id,
          first_seen_at,
          last_seen_at,
          first_client_id,
          latest_client_id,
          first_landing_page,
          first_referrer,
          first_utm_source,
          first_utm_medium,
          first_utm_campaign,
          raw_first_payload
        )
        values ($1, $2, $2, $3, $3, $4, $5, $6, $7, $8, $9)
        on conflict (visitor_id) do update set
          last_seen_at = greatest(visitors.last_seen_at, excluded.last_seen_at),
          latest_client_id = excluded.latest_client_id,
          first_landing_page = coalesce(visitors.first_landing_page, excluded.first_landing_page),
          first_referrer = coalesce(visitors.first_referrer, excluded.first_referrer),
          first_utm_source = coalesce(visitors.first_utm_source, excluded.first_utm_source),
          first_utm_medium = coalesce(visitors.first_utm_medium, excluded.first_utm_medium),
          first_utm_campaign = coalesce(visitors.first_utm_campaign, excluded.first_utm_campaign)
      `,
      [
        event.visitor_id,
        eventTime,
        event.client_id || null,
        event.landing_page || event.page_url || null,
        event.referrer || null,
        event.utm_source || null,
        event.utm_medium || null,
        event.utm_campaign || null,
        raw
      ]
    );

    await client.query(
      `
        insert into sessions (
          session_id,
          visitor_id,
          started_at,
          last_seen_at,
          landing_page,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          gclid,
          fbclid,
          device,
          country
        )
        values ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (session_id) do update set
          last_seen_at = greatest(sessions.last_seen_at, excluded.last_seen_at),
          landing_page = coalesce(sessions.landing_page, excluded.landing_page),
          referrer = coalesce(sessions.referrer, excluded.referrer),
          utm_source = coalesce(sessions.utm_source, excluded.utm_source),
          utm_medium = coalesce(sessions.utm_medium, excluded.utm_medium),
          utm_campaign = coalesce(sessions.utm_campaign, excluded.utm_campaign),
          utm_content = coalesce(sessions.utm_content, excluded.utm_content),
          utm_term = coalesce(sessions.utm_term, excluded.utm_term),
          gclid = coalesce(sessions.gclid, excluded.gclid),
          fbclid = coalesce(sessions.fbclid, excluded.fbclid),
          device = coalesce(sessions.device, excluded.device),
          country = coalesce(sessions.country, excluded.country)
      `,
      [
        event.session_id,
        event.visitor_id,
        eventTime,
        event.landing_page || event.page_url || null,
        event.referrer || null,
        event.utm_source || null,
        event.utm_medium || null,
        event.utm_campaign || null,
        event.utm_content || null,
        event.utm_term || null,
        event.gclid || null,
        event.fbclid || null,
        event.device || null,
        event.country || null
      ]
    );

    const attributionResult = await client.query<SessionAttribution>(
      `
        select
          landing_page,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          gclid,
          fbclid,
          device,
          country
        from sessions
        where session_id = $1
      `,
      [event.session_id]
    );
    const sessionAttribution = attributionResult.rows[0];
    const effective = {
      landing_page: event.landing_page || sessionAttribution?.landing_page || event.page_url || null,
      referrer: event.referrer || sessionAttribution?.referrer || null,
      utm_source: event.utm_source || sessionAttribution?.utm_source || null,
      utm_medium: event.utm_medium || sessionAttribution?.utm_medium || null,
      utm_campaign: event.utm_campaign || sessionAttribution?.utm_campaign || null,
      utm_content: event.utm_content || sessionAttribution?.utm_content || null,
      utm_term: event.utm_term || sessionAttribution?.utm_term || null,
      gclid: event.gclid || sessionAttribution?.gclid || null,
      fbclid: event.fbclid || sessionAttribution?.fbclid || null,
      device: event.device || sessionAttribution?.device || null,
      country: event.country || sessionAttribution?.country || null
    };
    const channel = classifyChannel({
      utmSource: effective.utm_source,
      utmMedium: effective.utm_medium,
      utmCampaign: effective.utm_campaign,
      referrer: effective.referrer,
      gclid: effective.gclid,
      fbclid: effective.fbclid
    });
    const clickId = effective.gclid || effective.fbclid || event.ttclid || null;
    const eventWithEffectiveAttribution = {
      ...event,
      landing_page: effective.landing_page
    };

    const insertedEvent = await client.query<{id: string}>(
      `
        insert into events (
          event_id,
          event_name,
          event_time,
          shop_domain,
          client_id,
          visitor_id,
          session_id,
          page_url,
          page_title,
          landing_page,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          gclid,
          fbclid,
          ttclid,
          device,
          country,
          product_id,
          variant_id,
          product_title,
          cart_value,
          currency,
          checkout_token,
          order_id,
          surface,
          list_name,
          card_position,
          media_id,
          media_url,
          media_position,
          media_alt,
          product_handle,
          interaction_target,
          raw_payload
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38
        )
        on conflict (event_id, event_name) do update set
          raw_payload = excluded.raw_payload,
          landing_page = coalesce(events.landing_page, excluded.landing_page),
          referrer = coalesce(events.referrer, excluded.referrer),
          utm_source = coalesce(events.utm_source, excluded.utm_source),
          utm_medium = coalesce(events.utm_medium, excluded.utm_medium),
          utm_campaign = coalesce(events.utm_campaign, excluded.utm_campaign),
          utm_content = coalesce(events.utm_content, excluded.utm_content),
          utm_term = coalesce(events.utm_term, excluded.utm_term),
          gclid = coalesce(events.gclid, excluded.gclid),
          fbclid = coalesce(events.fbclid, excluded.fbclid),
          device = coalesce(events.device, excluded.device),
          country = coalesce(events.country, excluded.country)
        returning id
      `,
      [
        event.event_id,
        event.event_name,
        eventTime,
        event.shop_domain || null,
        event.client_id || null,
        event.visitor_id,
        event.session_id,
        event.page_url || null,
        event.page_title || null,
        effective.landing_page,
        effective.referrer,
        effective.utm_source,
        effective.utm_medium,
        effective.utm_campaign,
        effective.utm_content,
        effective.utm_term,
        effective.gclid,
        effective.fbclid,
        event.ttclid || null,
        effective.device,
        effective.country,
        event.product_id || null,
        event.variant_id || null,
        event.product_title || null,
        toNumeric(event.cart_value),
        event.currency || null,
        event.checkout_token || null,
        event.order_id || null,
        event.surface || null,
        event.list_name || null,
        event.card_position || null,
        event.media_id || null,
        event.media_url || null,
        event.media_position || null,
        event.media_alt || null,
        event.product_handle || null,
        event.interaction_target || null,
        raw
      ]
    );

    if (isLandingPageEvent(eventWithEffectiveAttribution)) {
      await client.query(
        `
          insert into touchpoints (
            visitor_id,
            session_id,
            event_id,
            touched_at,
            channel,
            source,
            medium,
            campaign,
            content,
            term,
            landing_page,
            referrer,
            click_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          event.visitor_id,
          event.session_id,
          insertedEvent.rows[0].id,
          eventTime,
          channel,
          effective.utm_source,
          effective.utm_medium,
          effective.utm_campaign,
          effective.utm_content,
          effective.utm_term,
          effective.landing_page || event.page_url || null,
          effective.referrer,
          clickId
        ]
      );
    }

    await client.query("commit");

    return {
      ok: true,
      eventId: insertedEvent.rows[0].id
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
