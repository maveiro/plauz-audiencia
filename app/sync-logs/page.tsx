import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export default async function SyncLogsPage() {
  const supabase = createServiceRoleClient();

  const { data: logs, error } = await supabase
    .from("sync_logs")
    .select("id, started_at, finished_at, rows_found, rows_inserted, status, error_message, sources(name)")
    .order("started_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    throw new Error(`Falha ao carregar sync_logs: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sincronizações</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Histórico de execuções, sucesso ou erro, por fonte (últimas {LIMIT}).
        </p>
      </div>

      {!logs || logs.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma sincronização registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">Fonte</th>
                <th className="px-4 py-2">Início</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Encontradas</th>
                <th className="px-4 py-2">Inseridas</th>
                <th className="px-4 py-2">Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">{log.sources?.name ?? "(fonte excluída)"}</td>
                  <td className="px-4 py-2">
                    {new Date(log.started_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        log.status === "error"
                          ? "text-red-600 dark:text-red-400"
                          : log.status === "running"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{log.rows_found ?? "—"}</td>
                  <td className="px-4 py-2">{log.rows_inserted ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-red-600 dark:text-red-400">
                    {log.error_message ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
