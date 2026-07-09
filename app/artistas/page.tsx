import { createServiceRoleClient } from "@/lib/supabase/server";
import { createArtista, createEvento } from "./actions";

export const dynamic = "force-dynamic";

export default async function ArtistasPage() {
  const supabase = createServiceRoleClient();

  const { data: artistas, error } = await supabase
    .from("artistas")
    .select("id, nome, eventos(id, nome, data_evento, status)")
    .order("nome");

  if (error) {
    throw new Error(`Falha ao carregar artistas: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">Artistas</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Cada evento pertence a um artista. Fontes (planilhas ou uploads)
          são cadastradas por evento em{" "}
          <a href="/fontes" className="underline">
            Fontes
          </a>
          .
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Novo artista</h2>
        <form action={createArtista} className="flex gap-3">
          <input
            name="nome"
            required
            placeholder="Nome do artista"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Criar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Novo evento</h2>
        {artistas && artistas.length > 0 ? (
          <form action={createEvento} className="flex flex-wrap gap-3">
            <select
              name="artista_id"
              required
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {artistas.map((artista) => (
                <option key={artista.id} value={artista.id}>
                  {artista.nome}
                </option>
              ))}
            </select>
            <input
              name="nome"
              required
              placeholder="Nome do evento"
              className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="date"
              name="data_evento"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Criar
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-500">Cadastre um artista primeiro.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Artistas e eventos</h2>
        {!artistas || artistas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum artista cadastrado ainda.</p>
        ) : (
          artistas.map((artista) => (
            <div
              key={artista.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <h3 className="font-semibold">{artista.nome}</h3>
              {artista.eventos.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem eventos ainda.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {artista.eventos.map((evento) => (
                    <li key={evento.id} className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                      <span>{evento.nome}</span>
                      {evento.data_evento && (
                        <span className="text-zinc-500">{evento.data_evento}</span>
                      )}
                      <span className="text-zinc-500">({evento.status})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
