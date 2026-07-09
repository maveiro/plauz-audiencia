"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, PERIODO_LABELS, type Periodo } from "@/lib/dashboard/dateRange";

interface FilterBarProps {
  periodo: Periodo;
  artistaId: string | null;
  artistas: { id: string; nome: string }[];
}

export function FilterBar({ periodo, artistaId, artistas }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
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
  );
}
