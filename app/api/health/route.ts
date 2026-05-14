import {NextResponse} from "next/server";
import {getPool} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const pool = getPool();
  const result = await pool.query("select now() as database_time");

  return NextResponse.json({
    ok: true,
    databaseTime: result.rows[0].database_time
  });
}
