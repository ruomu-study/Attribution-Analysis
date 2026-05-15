import Link from "next/link";
import {getJourneyDetail, getJourneySummaries, resolveSessionId} from "@/lib/journeys";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{q?: string | string[]}>;

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function shortUrl(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}${url.search}`;
  } catch (_error) {
    return value;
  }
}

function sourceLabel(session: {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}) {
  const parts = [session.utm_source, session.utm_medium, session.utm_campaign].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "direct or unknown";
}

export default async function JourneysPage({searchParams}: {searchParams: SearchParams}) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim();
  const [summaries, resolvedSessionId] = await Promise.all([getJourneySummaries(), resolveSessionId(query)]);
  const detail = resolvedSessionId ? await getJourneyDetail(resolvedSessionId) : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Customer Journey</p>
          <h1>用户路径分析</h1>
        </div>
        <Link className="buttonLink" href="/">
          返回概览
        </Link>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <h2>查找路径</h2>
          <span className="mutedText">支持 session_id / visitor_id / checkout_token / order_id</span>
        </div>
        <form className="searchForm" action="/journeys">
          <input name="q" defaultValue={query || ""} placeholder="粘贴 ID 后回车查询" />
          <button type="submit">查询</button>
        </form>
      </section>

      {detail ? (
        <section className="journeyGrid">
          <div className="panel">
            <div className="panelHeader">
              <h2>Session 概览</h2>
              <span className="status ok">{detail.dropOff}</span>
            </div>
            <div className="kvGrid">
              <span>Session</span>
              <strong>{detail.session.session_id}</strong>
              <span>Visitor</span>
              <strong>{detail.session.visitor_id}</strong>
              <span>First source</span>
              <strong>{sourceLabel(detail.session)}</strong>
              <span>Landing page</span>
              <strong>{shortUrl(detail.session.landing_page)}</strong>
              <span>Device</span>
              <strong>{detail.session.device || "unknown"}</strong>
              <span>Time range</span>
              <strong>
                {formatDate(detail.session.started_at)} - {formatDate(detail.session.last_seen_at)}
              </strong>
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <h2>订单校验</h2>
              <span className={detail.orders.length > 0 ? "status ok" : "status"}>{detail.orders.length} orders</span>
            </div>
            <div className="funnelList">
              {detail.orders.length === 0 && <p className="empty">当前 session 还没有匹配到 webhook 订单。</p>}
              {detail.orders.map((order) => (
                <div className="funnelRow" key={order.shopify_order_id}>
                  <span>{order.order_name || order.shopify_order_id}</span>
                  <strong>
                    {order.currency} {order.total_price} · {order.financial_status || "unknown"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="notice">
          <h2>还没有可展示的路径</h2>
          <p>{query ? "没有找到匹配这个 ID 的事件。" : "采集到第一条 session 后，这里会自动显示最新路径。"}</p>
        </section>
      )}

      {detail && (
        <section className="panel">
          <div className="panelHeader">
            <h2>事件时间线</h2>
            <span className="mutedText">{detail.events.length} events</span>
          </div>
          <div className="timeline">
            {detail.events.map((event) => (
              <article className="timelineItem" key={event.id}>
                <time>{formatDate(event.event_time)}</time>
                <div>
                  <strong>{event.event_name}</strong>
                  <p>{event.product_title || shortUrl(event.page_url)}</p>
                  {(event.cart_value || event.checkout_token || event.order_id) && (
                    <small>
                      {event.cart_value ? `Cart ${event.currency || ""} ${event.cart_value}` : ""}
                      {event.checkout_token ? ` · checkout ${event.checkout_token}` : ""}
                      {event.order_id ? ` · order ${event.order_id}` : ""}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panelHeader">
          <h2>最近 Sessions</h2>
          <span className="mutedText">{summaries.length} latest</span>
        </div>
        <div className="sessionTable">
          <div className="sessionRow tableHead">
            <span>Session</span>
            <span>Source</span>
            <span>Events</span>
            <span>Last step</span>
          </div>
          {summaries.map((session) => (
            <Link className="sessionRow" href={`/journeys?q=${encodeURIComponent(session.session_id)}`} key={session.session_id}>
              <span>{session.session_id}</span>
              <span>{sourceLabel(session)}</span>
              <span>{session.event_count}</span>
              <span>{session.last_event_name || "N/A"}</span>
            </Link>
          ))}
          {summaries.length === 0 && <p className="empty">还没有 session。</p>}
        </div>
      </section>
    </main>
  );
}
