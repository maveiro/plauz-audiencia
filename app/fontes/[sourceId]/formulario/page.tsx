import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { EditFormularioForm } from "./EditFormularioForm";
import { EditSourceForm } from "../mapeamento/EditSourceForm";

export const dynamic = "force-dynamic";

export default async function FormularioAdminPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const supabase = createServiceRoleClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .eq("tipo", "formulario_nativo")
    .is("deleted_at", null)
    .single();

  if (sourceError || !source) {
    notFound();
  }

  const { data: formulario, error: formularioError } = await supabase
    .from("formularios")
    .select("*")
    .eq("source_id", sourceId)
    .single();

  if (formularioError || !formulario) {
    throw new Error("Formulário não encontrado para esta fonte.");
  }

  const { data: perguntas, error: perguntasError } = await supabase
    .from("formulario_perguntas")
    .select("*")
    .eq("formulario_id", formulario.id)
    .order("ordem", { ascending: true });

  if (perguntasError) {
    throw new Error(`Falha ao carregar perguntas: ${perguntasError.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Formulário — {source.name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Configure o formulário público de captação para este evento.
        </p>
      </div>

      <EditSourceForm
        sourceId={sourceId}
        tipo={source.tipo}
        name={source.name}
        sheetUrl={source.sheet_url}
        tabName={source.tab_name}
      />

      <EditFormularioForm
        formulario={formulario}
        perguntas={perguntas ?? []}
      />
    </div>
  );
}
