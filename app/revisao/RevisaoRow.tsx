"use client";

import { useState, useTransition } from "react";
import { resolveRevisao } from "./actions";

export function RevisaoRow({
  interessadoId,
  nomeCompleto,
  cidadeInformada,
  estadoInformada,
}: {
  interessadoId: string;
  nomeCompleto: string | null;
  cidadeInformada: string | null;
  estadoInformada: string | null;
}) {
  const [cidade, setCidade] = useState(cidadeInformada ?? "");
  const [estado, setEstado] = useState(estadoInformada ?? "");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      await resolveRevisao(interessadoId, cidade, estado);
      setDone(true);
    });
  }

  if (done) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="min-w-[10rem]">
        <p className="text-sm font-medium">{nomeCompleto || "(sem nome)"}</p>
        <p className="text-xs text-zinc-500">
          informado: {cidadeInformada || "—"} / {estadoInformada || "—"}
        </p>
      </div>
      <input
        value={cidade}
        onChange={(e) => setCidade(e.target.value)}
        placeholder="cidade normalizada"
        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        placeholder="UF"
        maxLength={2}
        className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {isPending ? "Salvando..." : "Confirmar"}
      </button>
    </div>
  );
}
