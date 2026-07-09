import type { RankingItem } from "@/lib/dashboard/queries";
import { HorizontalBarChart } from "./HorizontalBarChart";

export function RankingChart({ ranking }: { ranking: RankingItem[] }) {
  return (
    <HorizontalBarChart
      data={ranking.map((r) => ({ label: r.label, total: r.total }))}
      emptyMessage="Nenhum interessado no período selecionado."
    />
  );
}
