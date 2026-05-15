import Link from "next/link";
import {getVisitorDetail, getVisitorSummaries, resolveVisitorId} from "@/lib/visitors";

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

function isInternalReferrer(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return hostname === "lightsin.co.uk" || hostname.endsWith(".myshopify.com");
  } catch (_error) {
    return false;
  }
}

function sourceLabel(source: {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  first_utm_source?: string | null;
  first_utm_medium?: string | null;
  first_utm_campaign?: string | null;
  referrer?: string | null;
  first_referrer?: string | null;
}) {
  const parts = [
    source.source || source.utm_source || source.first_utm_source,
    source.medium || source.utm_medium || source.first_utm_medium,
    source.campaign || source.utm_campaign || source.first_utm_campaign
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" / ");
  }

  const referrer = source.referrer || source.first_referrer;

  if (referrer && !isInternalReferrer(referrer)) {
    return shortUrl(referrer);
  }

  return "direct or unknown";
}

export default async function VisitorsPage({searchParams}: {searchParams: SearchParams}) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim();
  const [summaries, resolvedVisitorId] = await Promise.all([getVisitorSummaries(), resolveVisitorId(query)]);
  const detail = resolvedVisitorId ? await getVisitorDetail(resolvedVisitorId) : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Visitor Attribution</p>
          <h1>Visitor 归因分析</h1>
        </div>
        <Link className="buttonLink" href="/">
          返回概览
        </Link>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <h2>查找 Visitor</h2>
          <span className="mutedText">支持 visitor_id / session_id / checkout_token / order_id</span>
        </div>
        <form className="searchForm" action="/visitors">
          <input name="q" defaultValue={query || ""} placeholder="粘贴 ID 后回车查询" />
          <button type="submit">查询</button>
        </form>
      </section>

      {detail ? (
        <>
          <section className="journeyGrid">
            <div className="panel">
              <div className="panelHeader">
                <h2>Visitor 概览</h2>
                <span className="status ok">{detail.sessions.length} sessions</span>
              </div>
              <div className="kvGrid">
                <span>Visitor</span>
                <strong>{detail.visitor.visitor_id}</strong>
                <span>First source</span>
                <strong>{sourceLabel(detail.visitor)}</strong>
                <span>First landing</span>
                <strong>{shortUrl(detail.visitor.first_landing_page)}</strong>
                <span>First seen</span>
                <strong>{formatDate(detail.visitor.first_seen_at)}</strong>
                <span>Last seen</span>
                <strong>{formatDate(detail.visitor.last_seen_at)}</strong>
              </div>
            </div>

            <div className="panel">
              <div className="panelHeader">
                <h2>订单关联</h2>
                <span className={detail.orders.length > 0 ? "status ok" : "status"}>{detail.orders.length} orders</span>
              </div>
              <div className="funnelList">
                {detail.orders.length === 0 && <p className="empty">当前 visitor 还没有匹配到 webhook 订单。</p>}
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

          <section className="panel">
            <div className="panelHeader">
              <h2>Touchpoints</h2>
              <span className="mutedText">{detail.touchpoints.length} sources</span>
            </div>
            <div className="sessionTable">
              <div className="visitorTouchpointRow tableHead">
                <span>Time</span>
                <span>Channel</span>
                <span>Source</span>
                <span>Landing</span>
              </div>
              {detail.touchpoints.map((touchpoint) => (
                <Link
                  className="visitorTouchpointRow"
                  href={`/journeys?q=${encodeURIComponent(touchpoint.session_id)}`}
                  key={`${touchpoint.session_id}-${touchpoint.touched_at}`}
                >
                  <span>{formatDate(touchpoint.touched_at)}</span>
                  <span>{touchpoint.channel}</span>
                  <span>{sourceLabel(touchpoint)}</span>
                  <span>{shortUrl(touchpoint.landing_page)}</span>
                </Link>
              ))}
              {detail.touchpoints.length === 0 && <p className="empty">还没有记录到可归因来源。</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Sessions</h2>
              <span className="mutedText">{detail.sessions.length} sessions</span>
            </div>
            <div className="sessionTable">
              <div className="visitorSessionRow tableHead">
                <span>Session</span>
                <span>Source</span>
                <span>Events</span>
                <span>Last step</span>
                <span>Time</span>
              </div>
              {detail.sessions.map((session) => (
                <Link className="visitorSessionRow" href={`/journeys?q=${encodeURIComponent(session.session_id)}`} key={session.session_id}>
                  <span>{session.session_id}</span>
                  <span>{sourceLabel(session)}</span>
                  <span>{session.event_count}</span>
                  <span>{session.last_event_name || "N/A"}</span>
                  <span>
                    {formatDate(session.started_at)} - {formatDate(session.last_seen_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Visitor 事件时间线</h2>
              <span className="mutedText">{detail.events.length} latest events</span>
            </div>
            <div className="timeline">
              {detail.events.map((event) => (
                <article className="timelineItem" key={event.id}>
                  <time>{formatDate(event.event_time)}</time>
                  <div>
                    <strong>{event.event_name}</strong>
                    <p>{event.product_title || event.product_handle || shortUrl(event.page_url)}</p>
                    <small>
                      {sourceLabel(event)} · {event.session_id}
                      {event.cart_value ? ` · Cart ${event.currency || ""} ${event.cart_value}` : ""}
                      {event.checkout_token ? ` · checkout ${event.checkout_token}` : ""}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="notice">
          <h2>还没有可展示的 Visitor</h2>
          <p>{query ? "没有找到匹配这个 ID 的 visitor。" : "采集到第一条 visitor 后，这里会自动显示最新访问者。"}</p>
        </section>
      )}

      <section className="panel">
        <div className="panelHeader">
          <h2>最近 Visitors</h2>
          <span className="mutedText">{summaries.length} latest</span>
        </div>
        <div className="sessionTable">
          <div className="visitorRow tableHead">
            <span>Visitor</span>
            <span>First source</span>
            <span>Sessions</span>
            <span>Events</span>
            <span>Last step</span>
          </div>
          {summaries.map((visitor) => (
            <Link className="visitorRow" href={`/visitors?q=${encodeURIComponent(visitor.visitor_id)}`} key={visitor.visitor_id}>
              <span>{visitor.visitor_id}</span>
              <span>{sourceLabel(visitor)}</span>
              <span>{visitor.session_count}</span>
              <span>{visitor.event_count}</span>
              <span>{visitor.last_event_name || "N/A"}</span>
            </Link>
          ))}
          {summaries.length === 0 && <p className="empty">还没有 visitor。</p>}
        </div>
      </section>
    </main>
  );
}
