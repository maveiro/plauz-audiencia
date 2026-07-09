/**
 * Aplica as migrações de supabase/migrations/ direto via DATABASE_URL,
 * como alternativa a `supabase db push` quando o `supabase login` (fluxo
 * interativo via navegador) não está disponível no ambiente.
 *
 * Este projeto não usa uma tabela de controle de migrações aplicadas (a
 * 0001 original, por exemplo, foi rodada manualmente no SQL editor do
 * Supabase, fora do CLI). Por isso, erros de "já existe"
 * (relação/constraint/etc — códigos 42P07/42710/42P16) são tratados como
 * "essa migração específica já foi aplicada antes" e apenas avisados, não
 * interrompem o script — seguro rodar de novo a qualquer momento.
 *
 * Uso: npm run apply-migrations
 */
import "./load-env";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL precisa estar definida em .env.local (Project Settings > Database > Connection string, no Supabase).",
    );
  }

  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("Nenhuma migração encontrada em supabase/migrations/.");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const ALREADY_EXISTS_CODES = new Set(["42P07", "42710", "42P16"]);

  try {
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`Aplicando ${file}...`);
      try {
        await client.query(sql);
        console.log(`  OK`);
      } catch (err) {
        const pgError = err as { code?: string; message: string };
        if (pgError.code && ALREADY_EXISTS_CODES.has(pgError.code)) {
          console.log(`  já aplicada antes (${pgError.message}) — ignorando`);
          continue;
        }
        throw err;
      }
    }
    console.log("\nTodas as migrações processadas com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nFalhou:", err.message);
  process.exit(1);
});
