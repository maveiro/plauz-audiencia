"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, PERIODO_LABELS, type Periodo } from "@/lib/dashboard/dateRange";

const CIDADE_SEP = "|";

interface FilterBarProps {
  periodo: Periodo;
  artistaId: string | null;
  artistas: { id: string; nome: string }[];
  fonteId: string | null;
  fontes: { id: string; label: string }[];
  cidade: string | null;
  estado: string | null;
  cidades: { cidade: string; estado: string | null }[];
  /** Rótulo pronto pra exibir do evento selecionado via clique no gráfico de ranking (não é dropdown, então não dá pra derivar só do id). */
  eventoLabel?: string | null;
}

export function FilterBar({
  periodo,
  artistaId,
  artistas,
  fonteId,
  fontes,
  cidade,
  estado,
  cidades,
  eventoLabel,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateCidade(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("cidade");
      params.delete("estado");
    } else {
      const [cidadeSelecionada, estadoSelecionado] = value.split(CIDADE_SEP);
      params.set("cidade", cidadeSelecionada);
      if (estadoSelecionado) params.set("estado", estadoSelecionado);
      else params.delete("estado");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearParams(keys: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of keys) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const cidadeValue = cidade ? `${cidade}${CIDADE_SEP}${estado ?? ""}` : "";

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

        <select
          value={fonteId ?? ""}
          onChange={(e) => updateParam("fonte_id", e.target.value || null)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          <option value="">Todas as fontes</option>
          {fontes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={cidadeValue}
          onChange={(e) => updateCidade(e.target.value)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          <option value="">Todas as cidades</option>
          {cidades.map((c) => (
            <option key={`${c.cidade}${CIDADE_SEP}${c.estado ?? ""}`} value={`${c.cidade}${CIDADE_SEP}${c.estado ?? ""}`}>
              {c.estado ? `${c.cidade} — ${c.estado}` : c.cidade}
            </option>
          ))}
        </select>
      </div>

      {eventoLabel && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Filtrado por clique no gráfico:</span>
          <button
            type="button"
            onClick={() => clearParams(["evento_id"])}
            className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {eventoLabel} <span aria-hidden>×</span>
          </button>
        </div>
      )}
    </div>
  );
}
