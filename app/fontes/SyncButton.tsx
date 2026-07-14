"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";

export function SyncButton({ sourceId }: { sourceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useToast();

  function handleClick() {
    startTransition(async () => {
      const res = await fetch(`/api/sync/${sourceId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.rowsInserted} novo(s) de ${data.rowsFound} encontrado(s).`, "success");
      } else {
        showToast(`Erro ao sincronizar: ${data.errorMessage ?? data.error ?? "falha desconhecida"}`, "error");
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      {isPending ? "Sincronizando..." : "Sincronizar agora"}
    </button>
  );
}
