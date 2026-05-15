import {NextRequest, NextResponse} from "next/server";
import {getOptionalEnv} from "@/lib/env";
import {getPool} from "@/lib/db";

export const runtime = "nodejs";

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function listenerStatus(ageSeconds: number | null) {
  if (ageSeconds === null) {
    return "waiting";
  }

  if (ageSeconds <= 120) {
    return "active";
  }

  if (ageSeconds <= 1800) {
    return "idle";
  }

  return "stale";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const windowMinutes = numberParam(searchParams.get("windowMinutes"), 120, 5, 10080);
  const limit = numberParam(searchParams.get("limit"), 50, 10, 200);
  const pool = getPool();

  try {
    const [summaryResult, eventCountsResult, recentEventsResult] = await Promise.all([
      pool.query(
        `
          select
            now() as database_time,
            count(*)::int as total_events,
            count(*) filter (where created_at >= now() - ($1::int * interval '1 minute'))::int as window_events,
            count(distinct visitor_id) filter (where created_at >= now() - ($1::int * interval '1 minute'))::int as window_visitors,
            count(distinct session_id) filter (where created_at >= now() - ($1::int * interval '1 minute'))::int as window_sessions,
            max(created_at) as latest_received_at,
            max(event_time) as latest_event_time,
            extract(epoch from now() - max(created_at))::int as latest_received_age_seconds
          from events
        `,
        [windowMinutes]
      ),
      pool.query(
        `
          select
            event_name,
            count(*)::int as count
          from events
          where created_at >= now() - ($1::int * interval '1 minute')
          group by event_name
          order by count desc, event_name
        `,
        [windowMinutes]
      ),
      pool.query(
        `
          select
            event_id,
            event_name,
            event_time,
            created_at as received_at,
            visitor_id,
            session_id,
            page_url,
            utm_source,
            utm_medium,
            utm_campaign,
            referrer,
            product_title,
            product_handle,
            cart_value,
            currency,
            checkout_token,
            order_id
          from events
          order by created_at desc
          limit $1
        `,
        [limit]
      )
    ]);

    const summary = summaryResult.rows[0];
    const ageSeconds = summary.latest_received_age_seconds === null ? null : Number(summary.latest_received_age_seconds);

    return NextResponse.json({
      ok: true,
      status: listenerStatus(ageSeconds),
      appUrl: getOptionalEnv("NEXT_PUBLIC_APP_URL") || null,
      collectUrl: getOptionalEnv("NEXT_PUBLIC_APP_URL")
        ? `${getOptionalEnv("NEXT_PUBLIC_APP_URL")}/api/events/collect`
        : null,
      collectSecretConfigured: Boolean(getOptionalEnv("EVENT_COLLECT_SECRET")),
      windowMinutes,
      databaseTime: summary.database_time,
      latestReceivedAt: summary.latest_received_at,
      latestEventTime: summary.latest_event_time,
      latestReceivedAgeSeconds: ageSeconds,
      totalEvents: summary.total_events,
      windowEvents: summary.window_events,
      windowVisitors: summary.window_visitors,
      windowSessions: summary.window_sessions,
      eventCounts: eventCountsResult.rows,
      recentEvents: recentEventsResult.rows
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "offline",
        error: error instanceof Error ? error.message : "Unknown monitor error"
      },
      {status: 500}
    );
  }
}
