import { createServiceRoleClient } from "@/lib/supabase/server";
import { RevisaoRow } from "./RevisaoRow";
import { ResolverComIABotao } from "./ResolverComIABotao";
import { FontesTabs } from "../FontesTabs";

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

  // Contagem exata separada do limit acima — sem isso, uma fila maior que
  // LIMIT não teria nenhum sinal de que existe mais coisa pendente além do
  // que está na tela (mesma classe de bug já corrigida no dashboard).
  const { count: totalPendentes, error: countError } = await supabase
    .from("interessados_ativos")
    .select("id", { count: "exact", head: true })
    .eq("local_revisao_pendente", true);

  if (countError) {
    throw new Error(`Falha ao contar revisões pendentes: ${countError.message}`);
  }

  const ids = interessados?.map((i) => i.id) ?? [];

  // Última sugestão de IA (não aplicada automaticamente) por interessado,
  // para pré-preencher os campos e poupar digitação também nos casos que
  // ficaram pendentes — a confirmação continua sendo manual.
  const sugestaoPorInteressado = new Map<
    string,
    { cidade: string | null; estado: string | null; motivo: string | null }
  >();

  if (ids.length > 0) {
    const { data: sugestoesIA, error: sugestoesError } = await supabase
      .from("geo_ia_logs")
      .select("interessado_id, cidade_sugerida, estado_sugerido, motivo, created_at")
      .in("interessado_id", ids)
      .eq("aplicado", false)
      .order("created_at", { ascending: false });

    if (sugestoesError) {
      throw new Error(`Falha ao carregar sugestões de IA: ${sugestoesError.message}`);
    }

    for (const s of sugestoesIA ?? []) {
      if (!sugestaoPorInteressado.has(s.interessado_id)) {
        sugestaoPorInteressado.set(s.interessado_id, {
          cidade: s.cidade_sugerida,
          estado: s.estado_sugerido,
          motivo: s.motivo,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FontesTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Revisão de local</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Interessados cuja cidade/estado a normalização automática não
            conseguiu resolver com confiança suficiente.{" "}
            {totalPendentes !== null && totalPendentes > LIMIT
              ? `${totalPendentes.toLocaleString("pt-BR")} pendentes no total — mostrando os ${LIMIT} mais recentes.`
              : `${(totalPendentes ?? 0).toLocaleString("pt-BR")} pendente(s).`}
          </p>
        </div>
        {interessados && interessados.length > 0 && <ResolverComIABotao />}
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
              sugestaoIA={sugestaoPorInteressado.get(interessado.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
