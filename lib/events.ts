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
    order_id: z.string().optional().nullable()
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

export async function storeCollectedEvent(raw: unknown) {
  const event = collectEventSchema.parse(raw);
  const pool = getPool();
  const eventTime = event.event_time ? new Date(event.event_time) : new Date();
  const channel = classifyChannel({
    utmSource: event.utm_source,
    utmMedium: event.utm_medium,
    referrer: event.referrer,
    gclid: event.gclid,
    fbclid: event.fbclid
  });
  const clickId = event.gclid || event.fbclid || event.ttclid || null;

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
          latest_client_id = excluded.latest_client_id
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
          last_seen_at = greatest(sessions.last_seen_at, excluded.last_seen_at)
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
          raw_payload
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
        on conflict (event_id, event_name) do update set
          raw_payload = excluded.raw_payload
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
        event.landing_page || null,
        event.referrer || null,
        event.utm_source || null,
        event.utm_medium || null,
        event.utm_campaign || null,
        event.utm_content || null,
        event.utm_term || null,
        event.gclid || null,
        event.fbclid || null,
        event.ttclid || null,
        event.device || null,
        event.country || null,
        event.product_id || null,
        event.variant_id || null,
        event.product_title || null,
        toNumeric(event.cart_value),
        event.currency || null,
        event.checkout_token || null,
        event.order_id || null,
        raw
      ]
    );

    if (event.event_name === "page_viewed" || event.utm_source || event.utm_medium || clickId || event.referrer) {
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
          event.utm_source || null,
          event.utm_medium || null,
          event.utm_campaign || null,
          event.utm_content || null,
          event.utm_term || null,
          event.landing_page || event.page_url || null,
          event.referrer || null,
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
