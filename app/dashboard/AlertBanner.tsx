import type { Alerta } from "@/lib/dashboard/queries";

export function AlertBanner({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;

  const critico = alertas.some((a) => a.nivel === "critical");

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-4 text-sm ${
        critico
          ? "border-[color:var(--status-critical)]/30 bg-[color:var(--status-critical)]/10"
          : "border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10"
      }`}
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
    </div>
  );
}
