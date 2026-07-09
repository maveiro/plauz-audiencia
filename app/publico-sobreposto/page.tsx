import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicoSobrepostoPage() {
  const supabase = createServiceRoleClient();

  const { data: artistas } = await supabase.from("artistas").select("id, nome");
  const artistaNomeById = new Map((artistas ?? []).map((a) => [a.id, a.nome]));

  const { data: sobreposicoes, error } = await supabase
    .from("publico_sobreposto")
    .select("*")
    .order("artistas_distintos", { ascending: false });

  if (error) {
    throw new Error(`Falha ao carregar sobreposição de público: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sobreposição de público</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          E-mails que aparecem como interessados de mais de um artista.
        </p>
      </div>

      {!sobreposicoes || sobreposicoes.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma sobreposição encontrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Artistas</th>
                <th className="px-4 py-2">Total de registros</th>
              </tr>
            </thead>
            <tbody>
              {sobreposicoes.map((row) => (
                <tr key={row.email} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2">
                    {row.artista_ids
                      .map((id) => artistaNomeById.get(id) ?? id)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2">{row.total_registros}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
