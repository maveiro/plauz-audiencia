"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RankingItem } from "@/lib/dashboard/queries";
import { HorizontalBarChart } from "./HorizontalBarChart";

export function RankingChart({ ranking }: { ranking: RankingItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const eventoAtivo = searchParams.get("evento_id");

  function handleClick(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === eventoAtivo) params.delete("evento_id");
    else params.set("evento_id", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <HorizontalBarChart
      data={ranking.map((r) => ({ id: r.eventoId, label: r.label, total: r.total }))}
      activeId={eventoAtivo}
      onBarClick={handleClick}
      emptyMessage="Nenhum interessado no período selecionado."
    />
  );
}
