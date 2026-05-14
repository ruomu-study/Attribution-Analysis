import {Pool} from "pg";
import {getRequiredEnv} from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var attributionPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.attributionPool) {
    global.attributionPool = new Pool({
      connectionString: getRequiredEnv("DATABASE_URL"),
      max: 10
    });
  }

  return global.attributionPool;
}
