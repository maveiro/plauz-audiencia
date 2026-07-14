import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormularioPorSlug } from "@/lib/formularios/getFormularioPorSlug";
import { createClient } from "@/lib/supabase/serverClient";
import { FormularioPublico } from "./FormularioPublico";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const formulario = await getFormularioPorSlug(slug);
  if (!formulario) return { title: "Formulário não encontrado" };

  return {
    title: formulario.titulo,
    description: formulario.descricao ?? undefined,
    openGraph: {
      title: formulario.titulo,
      description: formulario.descricao ?? undefined,
      images: formulario.logoUrl ? [formulario.logoUrl] : undefined,
    },
  };
}

export default async function FormularioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const formulario = await getFormularioPorSlug(slug);

  if (!formulario) {
    notFound();
  }

  if (formulario.status === "rascunho") {
    // Pré-visualização: só pra quem já está logado no domínio (o
    // middleware isenta /f do gate de auth, então essa checagem é da
    // própria página — sem ela, qualquer um com o slug veria rascunhos).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Pré-visualização — este formulário ainda está em rascunho e não é
          visível ao público.
        </div>
        <FormularioPublico slug={slug} formulario={formulario} preview />
      </div>
    );
  }

  if (formulario.status === "pausado") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8 text-center">
        <h1 className="text-xl font-semibold">Captação encerrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este formulário não está mais recebendo respostas no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <FormularioPublico slug={slug} formulario={formulario} preview={false} />
    </div>
  );
}
