/**
 * Limpeza definitiva (PLANO.md, Fase 6): hard delete de fontes com
 * deleted_at preenchido há mais de N dias. Aciona o `on delete cascade` do
 * schema (remove raw_responses/interessados/sync_logs relacionados) e
 * remove o arquivo do Storage, se houver.
 *
 * Deliberadamente um script manual, não uma rota de API — exclusão
 * definitiva nunca deve acontecer no fluxo automático normal (CLAUDE.md,
 * princípio 10).
 *
 * Uso: npm run hard-delete-expired -- --dias=30 [--confirmar]
 * Sem --confirmar, roda em modo "dry run" (só lista o que seria apagado).
 */
import "./load-env";
import { createAdminClient } from "../lib/supabase/createAdminClient";
import { getStorageBucket } from "../lib/storage/uploadArquivoFonte";

const DEFAULT_DIAS = 30;

function parseArgs() {
  const args = process.argv.slice(2);
  const diasArg = args.find((a) => a.startsWith("--dias="));
  const dias = diasArg ? Number(diasArg.split("=")[1]) : DEFAULT_DIAS;
  const confirmar = args.includes("--confirmar");
  return { dias, confirmar };
}

async function main() {
  const { dias, confirmar } = parseArgs();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas.");
  }
  const supabase = createAdminClient(url, serviceRoleKey);

  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiredSources, error } = await supabase
    .from("sources")
    .select("id, name, tipo, arquivo_path, deleted_at")
    .not("deleted_at", "is", null)
    .lt("deleted_at", limite);

  if (error) throw new Error(`Falha ao buscar fontes expiradas: ${error.message}`);

  if (!expiredSources || expiredSources.length === 0) {
    console.log(`Nenhuma fonte excluída há mais de ${dias} dias.`);
    return;
  }

  console.log(
    `${expiredSources.length} fonte(s) excluída(s) há mais de ${dias} dias:`,
  );
  for (const source of expiredSources) {
    console.log(`  - ${source.name} (${source.tipo}), excluída em ${source.deleted_at}`);
  }

  if (!confirmar) {
    console.log("\nModo dry-run (nada foi apagado). Rode com --confirmar para aplicar.");
    return;
  }

  for (const source of expiredSources) {
    if (source.tipo === "arquivo_upload" && source.arquivo_path) {
      await supabase.storage.from(getStorageBucket()).remove([source.arquivo_path]);
    }
    const { error: deleteError } = await supabase
      .from("sources")
      .delete()
      .eq("id", source.id);
    if (deleteError) {
      console.error(`  Falha ao apagar ${source.name}: ${deleteError.message}`);
      continue;
    }
    console.log(`  Apagada definitivamente: ${source.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
