import fs from "node:fs/promises";
import path from "node:path";
import {Pool} from "pg";

async function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");

  try {
    const content = await fs.readFile(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1);

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

await loadDotEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Set it in your environment before running migrations.");
  process.exit(1);
}

const pool = new Pool({connectionString: databaseUrl});
const migrationsDir = path.join(process.cwd(), "db", "migrations");
const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

try {
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Running ${file}`);
    await pool.query(sql);
  }

  console.log("Migrations complete.");
} finally {
  await pool.end();
}
