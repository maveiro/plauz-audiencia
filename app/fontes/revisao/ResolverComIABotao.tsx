"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverComIA } from "./actions";
import { Button } from "@/components/ui/button";

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
      <Button type="button" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? "Resolvendo com IA..." : "Resolver com IA"}
      </Button>
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
