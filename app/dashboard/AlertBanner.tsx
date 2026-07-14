import type { Alerta } from "@/lib/dashboard/queries";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AlertBanner({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;

  const critico = alertas.some((a) => a.nivel === "critical");

  return (
    <Card
      className={cn(
        "flex flex-col gap-2 p-4 text-sm ring-1",
        critico
          ? "bg-[color:var(--status-critical)]/10 ring-[color:var(--status-critical)]/30"
          : "bg-[color:var(--status-warning)]/10 ring-[color:var(--status-warning)]/30",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span aria-hidden>{critico ? "⛔" : "⚠️"}</span>
        <span>
          {alertas.length === 1
            ? "1 fonte precisa de atenção"
            : `${alertas.length} fontes precisam de atenção`}
        </span>
      </div>
      <ul className="flex flex-col gap-1 pl-6 text-zinc-600 dark:text-zinc-400">
        {alertas.map((a) => (
          <li key={a.sourceId} className="list-disc">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{a.sourceName}</span>
            {" — "}
            {a.motivo}
          </li>
        ))}
      </ul>
    </Card>
  );
}
