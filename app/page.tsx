import {getPool} from "@/lib/db";

export const dynamic = "force-dynamic";

async function getOverview() {
  try {
    const pool = getPool();
    const [events, sessions, orders, funnel] = await Promise.all([
      pool.query("select count(*)::int as count from events"),
      pool.query("select count(*)::int as count from sessions"),
      pool.query("select count(*)::int as count from orders"),
      pool.query(
        `
          select event_name, count(*)::int as count
          from events
          group by event_name
          order by count desc, event_name
        `
      )
    ]);

    return {
      connected: true,
      eventCount: events.rows[0].count as number,
      sessionCount: sessions.rows[0].count as number,
      orderCount: orders.rows[0].count as number,
      funnel: funnel.rows as {event_name: string; count: number}[]
    };
  } catch (error) {
    return {
      connected: false,
      eventCount: 0,
      sessionCount: 0,
      orderCount: 0,
      funnel: [],
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  }
}

export default async function Home() {
  const overview = await getOverview();

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Shopify Attribution MVP</p>
          <h1>归因分析工作台</h1>
        </div>
        <span className={overview.connected ? "status ok" : "status bad"}>
          {overview.connected ? "Database connected" : "Database offline"}
        </span>
      </header>

      {!overview.connected && (
        <section className="notice">
          <h2>数据库还没有连上</h2>
          <p>{overview.error}</p>
          <p>复制 `.env.example` 为 `.env`，设置 `DATABASE_URL`，然后执行 `db/migrations/001_initial.sql`。</p>
        </section>
      )}

      <section className="metricGrid">
        <div className="metric">
          <span>Raw events</span>
          <strong>{overview.eventCount}</strong>
        </div>
        <div className="metric">
          <span>Sessions</span>
          <strong>{overview.sessionCount}</strong>
        </div>
        <div className="metric">
          <span>Orders</span>
          <strong>{overview.orderCount}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>事件漏斗计数</h2>
          <div className="linkGroup">
            <a href="/journeys">查看用户路径</a>
            <a href="/visitors">查看 Visitor 归因</a>
            <a href="/api/events/recent">最近事件 JSON</a>
          </div>
        </div>
        <div className="funnelList">
          {overview.funnel.length === 0 && <p className="empty">还没有采集到事件。</p>}
          {overview.funnel.map((item) => (
            <div className="funnelRow" key={item.event_name}>
              <span>{item.event_name}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
