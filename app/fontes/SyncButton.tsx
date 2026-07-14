"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";
import { Button } from "@/components/ui/button";

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
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? "Sincronizando..." : "Sincronizar agora"}
    </Button>
  );
}
