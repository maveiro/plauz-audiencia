"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeleteSource } from "./actions";

export function DeleteSourceButton({
  sourceId,
  sourceName,
}: {
  sourceId: string;
  sourceName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const confirmado = confirm(
      `Excluir "${sourceName}"? Os dados continuam guardados e a fonte pode ser restaurada em Fontes › Excluídas.`,
    );
    if (!confirmado) return;

    startTransition(async () => {
      await softDeleteSource(sourceId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      {isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
