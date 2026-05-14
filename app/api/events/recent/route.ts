import {NextResponse} from "next/server";
import {getPool} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const pool = getPool();
  const result = await pool.query(
    `
      select
        event_id,
        event_name,
        event_time,
        visitor_id,
        session_id,
        page_url,
        utm_source,
        utm_medium,
        utm_campaign,
        product_title,
        cart_value,
        order_id
      from events
      order by event_time desc
      limit 50
    `
  );

  return NextResponse.json({events: result.rows});
}
