import Link from "next/link";
import {EventMonitor} from "./EventMonitor";

export const dynamic = "force-dynamic";

export default function MonitorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Testing</p>
          <h1>Pixel 监听测试</h1>
        </div>
        <Link className="buttonLink" href="/">
          返回概览
        </Link>
      </header>

      <EventMonitor />
    </main>
  );
}
