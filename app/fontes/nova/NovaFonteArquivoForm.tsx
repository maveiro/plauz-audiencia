"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function NovaFonteArquivoForm({
  eventos,
}: {
  eventos: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Falha ao enviar arquivo.");
        return;
      }
      router.push(`/fontes/${data.source.id}/mapeamento`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <select
        name="evento_id"
        required
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Selecione um evento</option>
        {eventos.map((evento) => (
          <option key={evento.id} value={evento.id}>
            {evento.label}
          </option>
        ))}
      </select>
      <input
        name="name"
        required
        placeholder="Nome da fonte (ex: Formulário site oficial)"
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="file"
        name="file"
        accept=".csv,.xls,.xlsx"
        required
        className="text-sm"
      />
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {isPending ? "Enviando..." : "Criar fonte"}
      </button>
    </form>
  );
}
