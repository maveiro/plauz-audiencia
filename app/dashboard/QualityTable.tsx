import type { FonteQualidade } from "@/lib/dashboard/queries";

function formatPct(pct: number | null) {
  return pct === null ? "—" : `${pct.toFixed(0)}%`;
}

export function QualityTable({ fontes }: { fontes: FonteQualidade[] }) {
  if (fontes.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhuma fonte cadastrada ainda.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2">Fonte</th>
            <th className="px-4 py-2">Evento</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Última sincronização</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">E-mail válido</th>
            <th className="px-4 py-2 text-right">Telefone válido</th>
            <th className="px-4 py-2 text-right">Local pendente</th>
          </tr>
        </thead>
        <tbody>
          {fontes.map((f) => (
            <tr key={f.sourceId} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="px-4 py-2">{f.sourceName}</td>
              <td className="px-4 py-2 text-zinc-500">
                {f.artistaNome} — {f.eventoNome}
              </td>
              <td className="px-4 py-2">
                <span
                  className={
                    f.status === "error"
                      ? "text-[color:var(--status-critical)]"
                      : f.status === "paused"
                        ? "text-zinc-500"
                        : "text-[color:var(--status-good)]"
                  }
                >
                  {f.status}
                </span>
              </td>
              <td className="px-4 py-2 text-zinc-500">
                {f.lastSyncedAt ? new Date(f.lastSyncedAt).toLocaleString("pt-BR") : "nunca"}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{f.total}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatPct(f.emailValidosPct)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatPct(f.telefoneValidosPct)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatPct(f.localPendentesPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
