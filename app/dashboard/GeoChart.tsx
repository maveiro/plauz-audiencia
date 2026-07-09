import type { GeografiaItem } from "@/lib/dashboard/queries";
import { HorizontalBarChart } from "./HorizontalBarChart";

export function GeoChart({ geografia }: { geografia: GeografiaItem[] }) {
  return (
    <HorizontalBarChart
      data={geografia.map((g) => ({
        label: g.estado ? `${g.cidade} — ${g.estado}` : g.cidade,
        total: g.total,
      }))}
      emptyMessage="Nenhuma localização normalizada ainda."
    />
  );
}
