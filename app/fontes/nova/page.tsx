import { createServiceRoleClient } from "@/lib/supabase/server";
import { NovaFonteTabs } from "./NovaFonteTabs";

export const dynamic = "force-dynamic";

export default async function NovaFontePage() {
  const supabase = createServiceRoleClient();

  const { data: eventos, error } = await supabase
    .from("eventos")
    .select("id, nome, artistas(nome)")
    .order("nome");

  if (error) {
    throw new Error(`Falha ao carregar eventos: ${error.message}`);
  }

  const eventoOptions = (eventos ?? []).map((evento) => ({
    id: evento.id,
    label: `${evento.artistas?.nome} — ${evento.nome}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova fonte</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Escolha o tipo de fonte e o evento ao qual ela pertence.
        </p>
      </div>

      {eventoOptions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Cadastre um artista e um evento antes de criar uma fonte — ver{" "}
          <a href="/artistas" className="underline">
            Artistas
          </a>
          .
        </p>
      ) : (
        <NovaFonteTabs eventos={eventoOptions} />
      )}
    </div>
  );
}
