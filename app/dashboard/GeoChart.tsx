"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GeografiaItem } from "@/lib/dashboard/queries";
import { HorizontalBarChart } from "./HorizontalBarChart";

function cidadeId(cidade: string, estado: string | null) {
  return `${cidade}|${estado ?? ""}`;
}

export function GeoChart({ geografia }: { geografia: GeografiaItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cidadeAtiva = searchParams.get("cidade");
  const estadoAtivo = searchParams.get("estado");
  const activeId = cidadeAtiva ? cidadeId(cidadeAtiva, estadoAtivo) : null;

  function handleClick(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === activeId) {
      params.delete("cidade");
      params.delete("estado");
    } else {
      const [cidade, estado] = id.split("|");
      params.set("cidade", cidade);
      if (estado) params.set("estado", estado);
      else params.delete("estado");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <HorizontalBarChart
      data={geografia.map((g) => ({
        id: cidadeId(g.cidade, g.estado),
        label: g.estado ? `${g.cidade} — ${g.estado}` : g.cidade,
        total: g.total,
      }))}
      activeId={activeId}
      onBarClick={handleClick}
      emptyMessage="Nenhuma localização normalizada ainda."
    />
  );
}
