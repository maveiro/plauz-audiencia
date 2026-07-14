import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StatusPill } from "@/app/_components/StatusPill";
import { SyncButton } from "./SyncButton";
import { ReenviarArquivoForm } from "./ReenviarArquivoForm";
import { DeleteSourceButton } from "./DeleteSourceButton";

export const dynamic = "force-dynamic";

export default async function FontesPage() {
  const supabase = createServiceRoleClient();

  const { data: sources, error } = await supabase
    .from("sources_ativas")
    .select("id, name, tipo, status, last_synced_at, eventos(nome, artistas(nome))")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar fontes: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fontes</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Planilhas do Google Sheets e arquivos enviados, por evento.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/fontes/excluidas"
            className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Excluídas
          </Link>
          <Link
            href="/fontes/nova"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Nova fonte
          </Link>
        </div>
      </div>

      {!sources || sources.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma fonte cadastrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {source.tipo === "google_sheets" ? "Google Sheets" : "Arquivo"}
                  </span>
                  <StatusPill status={source.status} />
                </div>
                <p className="text-sm text-zinc-500">
                  {source.eventos?.artistas?.nome} — {source.eventos?.nome}
                </p>
                <p className="text-xs text-zinc-400">
                  Última sincronização:{" "}
                  {source.last_synced_at
                    ? new Date(source.last_synced_at).toLocaleString("pt-BR")
                    : "nunca"}
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-3">
                <Link
                  href={`/fontes/${source.id}/mapeamento`}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Mapeamento
                </Link>
                {source.tipo === "google_sheets" ? (
                  <SyncButton sourceId={source.id} />
                ) : (
                  <ReenviarArquivoForm sourceId={source.id} />
                )}
                <DeleteSourceButton sourceId={source.id} sourceName={source.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
