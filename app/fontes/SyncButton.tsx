"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncButton({ sourceId }: { sourceId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/sync/${sourceId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.rowsInserted} novo(s) de ${data.rowsFound} encontrado(s).`);
      } else {
        setMessage(`Erro: ${data.errorMessage ?? data.error ?? "falha desconhecida"}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isPending ? "Sincronizando..." : "Sincronizar agora"}
      </button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </div>
  );
}
