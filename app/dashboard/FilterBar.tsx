"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, PERIODO_LABELS, type Periodo } from "@/lib/dashboard/dateRange";

interface FilterBarProps {
  periodo: Periodo;
  artistaId: string | null;
  artistas: { id: string; nome: string }[];
  /** Rótulo pronto pra exibir do evento/cidade selecionados via clique nos gráficos (não são dropdown, então não dá pra derivar só do id). */
  eventoLabel?: string | null;
  cidadeLabel?: string | null;
}

export function FilterBar({ periodo, artistaId, artistas, eventoLabel, cidadeLabel }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearParams(keys: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of keys) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => updateParam("periodo", p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                p === periodo
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>

        <select
          value={artistaId ?? ""}
          onChange={(e) => updateParam("artista_id", e.target.value || null)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          <option value="">Todos os artistas</option>
          {artistas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      {(eventoLabel || cidadeLabel) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Filtrado por clique no gráfico:</span>
          {eventoLabel && (
            <button
              type="button"
              onClick={() => clearParams(["evento_id"])}
              className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {eventoLabel} <span aria-hidden>×</span>
            </button>
          )}
          {cidadeLabel && (
            <button
              type="button"
              onClick={() => clearParams(["cidade", "estado"])}
              className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {cidadeLabel} <span aria-hidden>×</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
