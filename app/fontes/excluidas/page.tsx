import { createServiceRoleClient } from "@/lib/supabase/server";
import { restoreSource } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
            <Card key={source.id} className="flex flex-row items-center justify-between p-4">
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-muted-foreground">
                  {source.eventos?.artistas?.nome} — {source.eventos?.nome}
                </p>
                <p className="text-xs text-zinc-400">
                  Excluída em{" "}
                  {source.deleted_at &&
                    new Date(source.deleted_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <form action={restoreSource.bind(null, source.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Restaurar
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
