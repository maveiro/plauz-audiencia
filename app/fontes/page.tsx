import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StatusPill } from "@/app/_components/StatusPill";
import { SyncButton } from "./SyncButton";
import { ReenviarArquivoForm } from "./ReenviarArquivoForm";
import { DeleteSourceButton } from "./DeleteSourceButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
          <Button variant="outline" asChild>
            <Link href="/fontes/excluidas">Excluídas</Link>
          </Button>
          <Button asChild>
            <Link href="/fontes/nova">Nova fonte</Link>
          </Button>
        </div>
      </div>

      {!sources || sources.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma fonte cadastrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <Card
              key={source.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <Badge variant="secondary">
                    {source.tipo === "google_sheets" ? "Google Sheets" : "Arquivo"}
                  </Badge>
                  <StatusPill status={source.status} />
                </div>
                <p className="text-sm text-muted-foreground">
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
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/fontes/${source.id}/mapeamento`}>Mapeamento</Link>
                </Button>
                {source.tipo === "google_sheets" ? (
                  <SyncButton sourceId={source.id} />
                ) : (
                  <ReenviarArquivoForm sourceId={source.id} />
                )}
                <DeleteSourceButton sourceId={source.id} sourceName={source.name} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
