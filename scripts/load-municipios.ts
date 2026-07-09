/**
 * Popula municipios_ref a partir do seed estático scripts/data/municipios-ibge.json
 * (dados públicos do IBGE, ~5570 municípios). Rodar uma vez, após aplicar
 * supabase/migrations/0001_init.sql. Seguro para rodar de novo: o script
 * limpa a tabela antes de reinserir, então o resultado final é sempre
 * consistente com o seed, sem duplicar linhas.
 *
 * Uso: npm run load-municipios
 */
import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createAdminClient } from "../lib/supabase/createAdminClient";
import { normalizeMunicipioName } from "../lib/geo/normalize";

const BATCH_SIZE = 500;

interface MunicipioSeed {
  nome: string;
  uf: string;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas em .env.local.",
    );
  }
  const supabase = createAdminClient(url, serviceRoleKey);

  const seedPath = path.join(__dirname, "data", "municipios-ibge.json");
  const seed: MunicipioSeed[] = JSON.parse(readFileSync(seedPath, "utf-8"));

  const rows = seed.map((m) => ({
    nome: m.nome,
    uf: m.uf,
    nome_normalizado: normalizeMunicipioName(m.nome),
  }));

  console.log(`Carregando ${rows.length} municípios a partir do seed do IBGE...`);

  const { error: deleteError } = await supabase
    .from("municipios_ref")
    .delete()
    .not("id", "is", null);
  if (deleteError) {
    throw new Error(`Falha ao limpar municipios_ref: ${deleteError.message}`);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("municipios_ref").insert(batch);
    if (error) {
      throw new Error(
        `Falha ao inserir lote ${i}-${i + batch.length}: ${error.message}`,
      );
    }
    inserted += batch.length;
    console.log(`  ${inserted}/${rows.length} inseridos`);
  }

  console.log("municipios_ref carregada com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
