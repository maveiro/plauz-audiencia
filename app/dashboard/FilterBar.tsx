"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, PERIODO_LABELS, type Periodo } from "@/lib/dashboard/dateRange";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CIDADE_SEP = "|";

// Radix Select não aceita SelectItem com value="" — sentinelas traduzidas
// pra `null` (sem filtro) na borda do estado/URL.
const TODOS_ARTISTAS = "__todos_artistas__";
const TODAS_FONTES = "__todas_fontes__";
const TODAS_CIDADES = "__todas_cidades__";

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
            <Button
              key={p}
              type="button"
              variant={p === periodo ? "default" : "ghost"}
              size="sm"
              onClick={() => updateParam("periodo", p)}
              className="h-auto rounded-full px-3 py-1 text-xs"
            >
              {PERIODO_LABELS[p]}
            </Button>
          ))}
        </div>

        <Select
          value={artistaId ?? TODOS_ARTISTAS}
          onValueChange={(value) => updateParam("artista_id", value === TODOS_ARTISTAS ? null : value)}
        >
          <SelectTrigger aria-label="Filtrar por artista">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_ARTISTAS}>Todos os artistas</SelectItem>
            {artistas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={fonteId ?? TODAS_FONTES}
          onValueChange={(value) => updateParam("fonte_id", value === TODAS_FONTES ? null : value)}
        >
          <SelectTrigger aria-label="Filtrar por fonte">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_FONTES}>Todas as fontes</SelectItem>
            {fontes.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={cidadeValue || TODAS_CIDADES}
          onValueChange={(value) => updateCidade(value === TODAS_CIDADES ? "" : value)}
        >
          <SelectTrigger aria-label="Filtrar por cidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_CIDADES}>Todas as cidades</SelectItem>
            {cidades.map((c) => (
              <SelectItem
                key={`${c.cidade}${CIDADE_SEP}${c.estado ?? ""}`}
                value={`${c.cidade}${CIDADE_SEP}${c.estado ?? ""}`}
              >
                {c.estado ? `${c.cidade} — ${c.estado}` : c.cidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {eventoLabel && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrado por clique no gráfico:</span>
          <Badge asChild variant="secondary">
            <button type="button" onClick={() => clearParams(["evento_id"])} className="gap-1">
              {eventoLabel} <span aria-hidden>×</span>
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
