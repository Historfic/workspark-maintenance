import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example).");

  // Supabase's pooler presents a certificate from its own CA, which Node does not ship.
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key, statements text[], name text
      );
    `);
    const applied = new Set(
      (
        await client.query<{ version: string }>(
          "select version from supabase_migrations.schema_migrations",
        )
      ).rows.map((row) => row.version),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const [version, ...nameParts] = file.replace(/\.sql$/, "").split("_");
      if (!version || applied.has(version)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)",
          [version, nameParts.join("_")],
        );
        await client.query("commit");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log("database is up to date");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
