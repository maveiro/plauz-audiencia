"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReenviarArquivoForm({ sourceId }: { sourceId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/sources/${sourceId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          `Arquivo reenviado. ${data.sync?.rowsInserted ?? 0} novo(s) de ${data.sync?.rowsFound ?? 0} encontrado(s).`,
        );
        formRef.current?.reset();
      } else {
        setMessage(`Erro: ${data.error ?? "falha desconhecida"}`);
      }
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".csv,.xls,.xlsx"
          required
          className="text-xs"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {isPending ? "Enviando..." : "Reenviar arquivo"}
        </button>
      </div>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </form>
  );
}
