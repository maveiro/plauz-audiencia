"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";

export function ReenviarArquivoForm({ sourceId }: { sourceId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const showToast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await fetch(`/api/sources/${sourceId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Arquivo reenviado. ${data.sync?.rowsInserted ?? 0} novo(s) de ${data.sync?.rowsFound ?? 0} encontrado(s).`,
          "success",
        );
        formRef.current?.reset();
      } else {
        showToast(`Erro ao reenviar arquivo: ${data.error ?? "falha desconhecida"}`, "error");
      }
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
      <input type="file" name="file" accept=".csv,.xls,.xlsx" required className="text-xs" />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isPending ? "Enviando..." : "Reenviar arquivo"}
      </button>
    </form>
  );
}
