import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";


const { Pool } = pg;


const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL;


if(!migrationDatabaseUrl) {

  throw new Error(
    "MIGRATION_DATABASE_URL is required",
  );

}


const pool = new Pool({
  connectionString:migrationDatabaseUrl,
});


async function migrate() {

  const client =
    await pool.connect();


  try {

    await client.query(
      "SET ROLE llg_owner",
    );


    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);


    const migrationsDir =
      path.resolve("server/sql");


    const files =
      (await fs.readdir(migrationsDir))
        .filter(
          (file)=>file.endsWith(".sql"),
        )
        .sort();


    for(const file of files) {

      const exists =
        await client.query(
          `
            SELECT 1
            FROM _migrations
            WHERE filename = $1
          `,
          [file],
        );


      if(exists.rowCount) {
        continue;
      }


      const sql =
        await fs.readFile(
          path.join(
            migrationsDir,
            file,
          ),
          "utf8",
        );


      await client.query("BEGIN");


      try {

        await client.query(sql);

        await client.query(
          `
            INSERT INTO _migrations(filename)
            VALUES($1)
          `,
          [file],
        );

        await client.query("COMMIT");

        console.log(
          `Applied ${file}`,
        );


      } catch(error) {

        await client.query("ROLLBACK");

        throw error;

      }

    }


    await client.query(
      "RESET ROLE",
    );


  } finally {

    client.release();

    await pool.end();

  }

}


migrate().catch(
  (error)=>{

    console.error(error);

    process.exitCode = 1;

  },
);
