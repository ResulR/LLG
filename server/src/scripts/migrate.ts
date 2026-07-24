import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db/pool.js";

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.resolve("server/sql");

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const exists = await pool.query(
      "SELECT 1 FROM _migrations WHERE filename = $1",
      [file],
    );

    if (exists.rowCount) {
      continue;
    }

    const sql = await fs.readFile(
      path.join(migrationsDir, file),
      "utf8",
    );

    await pool.query("BEGIN");

    try {
      await pool.query(sql);

      await pool.query(
        "INSERT INTO _migrations(filename) VALUES($1)",
        [file],
      );

      await pool.query("COMMIT");

      console.log(`Applied ${file}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  await pool.end();
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
