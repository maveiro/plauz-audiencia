import Link from "next/link";
import { loadDashboardData } from "@/lib/dashboard/queries";
import { isPeriodo, type Periodo } from "@/lib/dashboard/dateRange";
import { FilterBar } from "./FilterBar";
import { AlertBanner } from "./AlertBanner";
import { StatTile } from "./StatTile";
import { TrendChart } from "./TrendChart";
import { RankingChart } from "./RankingChart";
import { GeoChart } from "./GeoChart";
import { QualityTable } from "./QualityTable";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ periodo?: string; artista_id?: string }>;
}

function formatDelta(deltaPercentual: number | null) {
  if (deltaPercentual === null) return null;
  const direction = deltaPercentual > 0 ? "up" : deltaPercentual < 0 ? "down" : "flat";
  return { direction, value: `${Math.abs(deltaPercentual).toFixed(0)}% vs período anterior` } as const;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const periodo: Periodo = isPeriodo(params.periodo) ? params.periodo : "30d";
  const artistaId = params.artista_id || null;

  const dados = await loadDashboardData(periodo, artistaId);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Acompanhamento diário de interessados, por evento e artista.
          </p>
        </div>
        <FilterBar periodo={periodo} artistaId={artistaId} artistas={dados.artistas} />
      </div>

      <AlertBanner alertas={dados.alertas} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Interessados no período"
          value={dados.kpis.totalPeriodo.toLocaleString("pt-BR")}
          delta={formatDelta(dados.kpis.deltaPercentual)}
        />
        <StatTile label="Novos hoje" value={dados.kpis.novosHoje.toLocaleString("pt-BR")} />
        <StatTile
          label="Contato utilizável"
          value={
            dados.kpis.contatoUtilizavelPercentual === null
              ? "—"
              : `${dados.kpis.contatoUtilizavelPercentual.toFixed(0)}%`
          }
          hint="E-mail ou telefone válido"
        />
        <StatTile
          label="Fontes com problema"
          value={`${dados.kpis.fontesComProblema} de ${dados.kpis.fontesTotal}`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Tendência diária</h2>
        <TrendChart data={dados.tendencia.data} series={dados.tendencia.series} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Ranking de eventos</h2>
          <RankingChart ranking={dados.ranking} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Top cidades</h2>
          <GeoChart geografia={dados.geografia} />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Qualidade por fonte</h2>
        <QualityTable fontes={dados.qualidadePorFonte} />
      </section>

      <section className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <p className="font-medium">
            {dados.sobreposicao.pessoas.toLocaleString("pt-BR")} pessoas interessadas em mais de um
            artista
          </p>
          <p className="text-sm text-zinc-500">
            de {dados.sobreposicao.totalInteressados.toLocaleString("pt-BR")} interessados no total
          </p>
        </div>
        <Link
          href="/publico-sobreposto"
          className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Ver detalhes
        </Link>
      </section>
    </div>
  );
}
