"use client";

import {useEffect, useMemo, useState} from "react";

type MonitorEvent = {
  event_id: string;
  event_name: string;
  event_time: string;
  received_at: string;
  visitor_id: string;
  session_id: string;
  page_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  product_title: string | null;
  product_handle: string | null;
  cart_value: string | null;
  currency: string | null;
  checkout_token: string | null;
  order_id: string | null;
};

type MonitorPayload = {
  ok: boolean;
  status: "active" | "idle" | "stale" | "waiting" | "offline";
  appUrl: string | null;
  collectUrl: string | null;
  publicEndpoint?: {
    checked: boolean;
    ok: boolean;
    url: string | null;
    statusCode: number | null;
    error: string | null;
  };
  collectSecretConfigured: boolean;
  windowMinutes: number;
  databaseTime: string;
  latestReceivedAt: string | null;
  latestEventTime: string | null;
  latestReceivedAgeSeconds: number | null;
  totalEvents: number;
  windowEvents: number;
  windowVisitors: number;
  windowSessions: number;
  eventCounts: {event_name: string; count: number}[];
  recentEvents: MonitorEvent[];
  error?: string;
};

const statusCopy = {
  active: {
    label: "Listening",
    detail: "最近 2 分钟内收到过事件",
    className: "ok"
  },
  idle: {
    label: "Idle",
    detail: "30 分钟内收到过事件，但当前没有新事件",
    className: "warn"
  },
  stale: {
    label: "Stale",
    detail: "超过 30 分钟没有收到新事件",
    className: "bad"
  },
  waiting: {
    label: "Waiting",
    detail: "数据库正常，但还没有收到事件",
    className: "warn"
  },
  offline: {
    label: "Offline",
    detail: "状态接口或数据库不可用",
    className: "bad"
  }
};

function formatDate(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatAge(seconds: number | null) {
  if (seconds === null) {
    return "N/A";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
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

function sourceLabel(event: MonitorEvent) {
  const parts = [event.utm_source, event.utm_medium, event.utm_campaign].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" / ");
  }

  if (event.referrer) {
    return shortUrl(event.referrer);
  }

  return "direct or unknown";
}

export function EventMonitor() {
  const [windowMinutes, setWindowMinutes] = useState(120);
  const [data, setData] = useState<MonitorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/events/monitor?windowMinutes=${windowMinutes}&limit=80`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as MonitorPayload;

        if (!cancelled) {
          setData(payload);
          setError(response.ok ? null : payload.error || "Monitor request failed");
          setLastCheckedAt(new Date());
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Monitor request failed");
          setLastCheckedAt(new Date());
        }
      }
    }

    load();
    const interval = window.setInterval(load, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [windowMinutes]);

  const currentStatus = useMemo(() => {
    if (error && !data?.ok) {
      return statusCopy.offline;
    }

    return statusCopy[data?.status || "waiting"];
  }, [data?.ok, data?.status, error]);

  return (
    <>
      <section className="monitorHero">
        <div>
          <p className="eyebrow">Event Monitor</p>
          <h1>监听状态面板</h1>
          <p className="monitorSubText">页面每 5 秒自动刷新，用于测试 Pixel 是否持续打到本地后端。</p>
        </div>
        <div className={`monitorStatus ${currentStatus.className}`}>
          <strong>{currentStatus.label}</strong>
          <span>{currentStatus.detail}</span>
        </div>
      </section>

      {error && (
        <section className="notice">
          <h2>监听状态读取失败</h2>
          <p>{error}</p>
        </section>
      )}

      <section className="monitorControls">
        <label>
          测试窗口
          <select value={windowMinutes} onChange={(event) => setWindowMinutes(Number(event.target.value))}>
            <option value={30}>最近 30 分钟</option>
            <option value={120}>最近 2 小时</option>
            <option value={720}>最近 12 小时</option>
            <option value={1440}>最近 24 小时</option>
            <option value={10080}>最近 7 天</option>
          </select>
        </label>
        <span>上次刷新：{lastCheckedAt ? formatDate(lastCheckedAt.toISOString()) : "N/A"}</span>
      </section>

      <section className="metricGrid">
        <div className="metric">
          <span>Window events</span>
          <strong>{data?.windowEvents ?? 0}</strong>
        </div>
        <div className="metric">
          <span>Window visitors</span>
          <strong>{data?.windowVisitors ?? 0}</strong>
        </div>
        <div className="metric">
          <span>Last received</span>
          <strong className="metricSmall">{formatAge(data?.latestReceivedAgeSeconds ?? null)}</strong>
        </div>
      </section>

      <section className="journeyGrid">
        <div className="panel">
          <div className="panelHeader">
            <h2>采集入口</h2>
            <span className={data?.collectSecretConfigured ? "status ok" : "status bad"}>
              {data?.collectSecretConfigured ? "Secret set" : "Secret missing"}
            </span>
          </div>
          <div className="kvGrid">
            <span>Collect URL</span>
            <strong>{data?.collectUrl || "NEXT_PUBLIC_APP_URL 未配置"}</strong>
            <span>Public tunnel</span>
            <strong className={data?.publicEndpoint?.ok ? "textOk" : "textBad"}>
              {data?.publicEndpoint?.ok ? "reachable" : data?.publicEndpoint?.error || "not checked"}
            </strong>
            <span>Latest receive</span>
            <strong>{formatDate(data?.latestReceivedAt)}</strong>
            <span>Latest event</span>
            <strong>{formatDate(data?.latestEventTime)}</strong>
            <span>Total stored</span>
            <strong>{data?.totalEvents ?? 0}</strong>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>窗口事件类型</h2>
            <span className="mutedText">{data?.windowMinutes ?? windowMinutes} min</span>
          </div>
          <div className="funnelList">
            {data?.eventCounts.length ? (
              data.eventCounts.map((item) => (
                <div className="funnelRow" key={item.event_name}>
                  <span>{item.event_name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))
            ) : (
              <p className="empty">当前测试窗口内没有事件。</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>实时接收记录</h2>
          <span className="mutedText">按后端接收时间排序</span>
        </div>
        <div className="monitorEventTable">
          <div className="monitorEventRow tableHead">
            <span>Received</span>
            <span>Event</span>
            <span>Source</span>
            <span>Visitor / Session</span>
            <span>Page or Product</span>
          </div>
          {data?.recentEvents.map((event) => (
            <div className="monitorEventRow" key={`${event.event_id}-${event.event_name}`}>
              <span>{formatDate(event.received_at)}</span>
              <span>{event.event_name}</span>
              <span>{sourceLabel(event)}</span>
              <span>
                {event.visitor_id}
                <br />
                <small>{event.session_id}</small>
              </span>
              <span>
                {event.product_title || event.product_handle || shortUrl(event.page_url)}
                {event.cart_value && (
                  <>
                    <br />
                    <small>
                      Cart {event.currency || ""} {event.cart_value}
                    </small>
                  </>
                )}
              </span>
            </div>
          ))}
          {!data?.recentEvents.length && <p className="empty">还没有收到事件。</p>}
        </div>
      </section>
    </>
  );
}
