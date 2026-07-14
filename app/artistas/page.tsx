import { createServiceRoleClient } from "@/lib/supabase/server";
import { createArtista } from "./actions";
import { NovoEventoForm } from "./NovoEventoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

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

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-medium">Novo artista</h2>
        <form action={createArtista} className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="artista_nome">Nome do artista</Label>
            <Input id="artista_nome" name="nome" required placeholder="Nome do artista" />
          </div>
          <Button type="submit">Criar</Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-medium">Novo evento</h2>
        {artistas && artistas.length > 0 ? (
          <NovoEventoForm artistas={artistas} />
        ) : (
          <p className="text-sm text-zinc-500">Cadastre um artista primeiro.</p>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Artistas e eventos</h2>
        {!artistas || artistas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum artista cadastrado ainda.</p>
        ) : (
          artistas.map((artista) => (
            <Card key={artista.id} className="p-4">
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
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
