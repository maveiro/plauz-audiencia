import { createServiceRoleClient } from "@/lib/supabase/server";
import { RevisaoRow } from "./RevisaoRow";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function RevisaoPage() {
  const supabase = createServiceRoleClient();

  const { data: interessados, error } = await supabase
    .from("interessados_ativos")
    .select("id, nome_completo, cidade_informada, estado_informada")
    .eq("local_revisao_pendente", true)
    .order("synced_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    throw new Error(`Falha ao carregar revisões pendentes: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Revisão de local</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Interessados cuja cidade/estado a normalização automática não
          conseguiu resolver com confiança suficiente
          (mostrando até {LIMIT} mais recentes).
        </p>
      </div>

      {!interessados || interessados.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma revisão pendente.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {interessados.map((interessado) => (
            <RevisaoRow
              key={interessado.id}
              interessadoId={interessado.id}
              nomeCompleto={interessado.nome_completo}
              cidadeInformada={interessado.cidade_informada}
              estadoInformada={interessado.estado_informada}
            />
          ))}
        </div>
      )}
    </div>
  );
}
