"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverComIA } from "./actions";

export function ResolverComIABotao() {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    processados: number;
    resolvidosAutomaticamente: number;
    permanecemPendentes: number;
    erros: number;
  } | null>(null);
  const router = useRouter();

  function handleClick() {
    setResultado(null);
    startTransition(async () => {
      const r = await resolverComIA();
      setResultado(r);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Resolvendo com IA..." : "Resolver com IA"}
      </button>
      {resultado && (
        <p className="max-w-xs text-right text-xs text-zinc-500">
          {resultado.resolvidosAutomaticamente} de {resultado.processados}{" "}
          resolvidas automaticamente
          {resultado.permanecemPendentes > 0
            ? `, ${resultado.permanecemPendentes} continuam pendentes`
            : ""}
          {resultado.erros > 0 ? `, ${resultado.erros} com erro` : ""}.
        </p>
      )}
    </div>
  );
}
