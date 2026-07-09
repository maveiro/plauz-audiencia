import { createServiceRoleClient } from "@/lib/supabase/server";
import { restoreSource } from "../actions";

export const dynamic = "force-dynamic";

export default async function FontesExcluidasPage() {
  const supabase = createServiceRoleClient();

  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, name, tipo, deleted_at, eventos(nome, artistas(nome))")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar fontes excluídas: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fontes excluídas</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Soft delete: dados preservados, restauráveis a qualquer momento
          (ver CLAUDE.md, princípio 10).
        </p>
      </div>

      {!sources || sources.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma fonte excluída.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-zinc-500">
                  {source.eventos?.artistas?.nome} — {source.eventos?.nome}
                </p>
                <p className="text-xs text-zinc-400">
                  Excluída em{" "}
                  {source.deleted_at &&
                    new Date(source.deleted_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <form action={restoreSource.bind(null, source.id)}>
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Restaurar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
