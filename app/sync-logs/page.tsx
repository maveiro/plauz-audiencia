import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

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

  // Contagem exata separada do limit acima — sem isso, uma fonte com erro
  // recorrente fora da janela das últimas LIMIT execuções não teria nenhum
  // sinal de que existe histórico mais antigo não visível aqui.
  const { count: totalLogs, error: countError } = await supabase
    .from("sync_logs")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Falha ao contar sync_logs: ${countError.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sincronizações</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Histórico de execuções, sucesso ou erro, por fonte.{" "}
          {totalLogs !== null && totalLogs > LIMIT
            ? `${totalLogs.toLocaleString("pt-BR")} no total — mostrando as ${LIMIT} mais recentes.`
            : `${(totalLogs ?? 0).toLocaleString("pt-BR")} no total.`}
        </p>
      </div>

      {!logs || logs.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma sincronização registrada ainda.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
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
        </Card>
      )}
    </div>
  );
}
