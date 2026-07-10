import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { type Periodo, resolveDateRange } from "./dateRange";

const FONTE_ATRASO_DIAS = 3;
const MAX_SERIES = 8;
const TOP_EVENTOS = 10;
const TOP_CIDADES = 10;

// O PostgREST hospedado pelo Supabase limita cada resposta a 1000 linhas
// (db-max-rows), mesmo pedindo mais — sem paginar, views com mais linhas
// que isso são truncadas silenciosamente (sem erro, só dado faltando).
const PAGE_SIZE = 1000;

// Sem ORDER BY explícito, o Postgres não garante a mesma ordem de linhas
// entre execuções separadas da mesma query — paginar com .range() em cima
// disso pode pular ou duplicar linhas entre páginas. Por isso buildPage
// sempre precisa incluir um .order() determinístico (ver chamadas abaixo).
async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Falha ao carregar ${label}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export interface TrendSeries {
  key: string;
  label: string;
  colorVar: string;
}

export interface TrendPoint {
  dia: string;
  [seriesKey: string]: string | number;
}

export interface RankingItem {
  eventoId: string;
  label: string;
  total: number;
}

export interface GeografiaItem {
  cidade: string;
  estado: string | null;
  total: number;
}

export interface FonteQualidade {
  sourceId: string;
  sourceName: string;
  tipo: "google_sheets" | "arquivo_upload";
  status: "active" | "paused" | "error";
  lastSyncedAt: string | null;
  eventoNome: string;
  artistaNome: string;
  total: number;
  emailValidosPct: number | null;
  telefoneValidosPct: number | null;
  localPendentesPct: number | null;
}

export interface Alerta {
  sourceId: string;
  sourceName: string;
  motivo: string;
  nivel: "critical" | "warning";
}

export interface DashboardData {
  artistas: { id: string; nome: string }[];
  kpis: {
    totalPeriodo: number;
    deltaPercentual: number | null;
    novosHoje: number;
    contatoUtilizavelPercentual: number | null;
    fontesComProblema: number;
    fontesTotal: number;
  };
  tendencia: { data: TrendPoint[]; series: TrendSeries[] };
  ranking: RankingItem[];
  geografia: GeografiaItem[];
  qualidadePorFonte: FonteQualidade[];
  alertas: Alerta[];
  sobreposicao: { pessoas: number; totalInteressados: number };
}

interface DailyRow {
  dia: string;
  eventoId: string;
  eventoNome: string;
  artistaId: string;
  artistaNome: string;
  total: number;
  emailValidos: number;
  telefoneValidos: number;
}

function buildTrend(rows: DailyRow[], groupBy: "artista" | "evento"): DashboardData["tendencia"] {
  const idKey = groupBy === "artista" ? "artistaId" : "eventoId";
  const nameKey = groupBy === "artista" ? "artistaNome" : "eventoNome";

  const totals = new Map<string, { id: string; nome: string; total: number }>();
  for (const row of rows) {
    const id = row[idKey];
    const atual = totals.get(id) ?? { id, nome: row[nameKey], total: 0 };
    atual.total += row.total;
    totals.set(id, atual);
  }

  const ordenado = [...totals.values()].sort((a, b) => b.total - a.total);
  const top = ordenado.slice(0, MAX_SERIES);
  const topIds = new Set(top.map((t) => t.id));
  const temOutros = ordenado.length > MAX_SERIES;

  const series: TrendSeries[] = top.map((t, i) => ({
    key: t.id,
    label: t.nome,
    colorVar: `--series-${i + 1}`,
  }));
  if (temOutros) {
    series.push({ key: "outros", label: "Outros", colorVar: "--series-outros" });
  }

  const dias = [...new Set(rows.map((r) => r.dia))].sort();
  const porDia = new Map<string, TrendPoint>();
  for (const dia of dias) {
    const ponto: TrendPoint = { dia };
    for (const s of series) ponto[s.key] = 0;
    porDia.set(dia, ponto);
  }
  for (const row of rows) {
    const ponto = porDia.get(row.dia);
    if (!ponto) continue;
    const key = topIds.has(row[idKey]) ? row[idKey] : "outros";
    ponto[key] = (ponto[key] as number) + row.total;
  }

  return { data: dias.map((d) => porDia.get(d)!), series };
}

export async function loadDashboardData(
  periodo: Periodo,
  artistaId: string | null,
  eventoId: string | null,
  cidade: string | null,
  estado: string | null,
): Promise<DashboardData> {
  const supabase = createServiceRoleClient();
  const { atual, anterior } = resolveDateRange(periodo);
  const { atual: hojeRange } = resolveDateRange("hoje");

  const { data: artistas, error: artistasError } = await supabase
    .from("artistas")
    .select("id, nome")
    .order("nome", { ascending: true });
  if (artistasError) {
    throw new Error(`Falha ao carregar artistas: ${artistasError.message}`);
  }

  const buscaInicio = anterior?.inicio ?? atual.inicio;
  const diariosRaw = await fetchAllRows((from, to) => {
    let q = supabase
      .from("dash_interessados_diarios")
      .select("dia, evento_id, evento_nome, artista_id, artista_nome, total, email_validos, telefone_validos")
      .gte("dia", buscaInicio)
      .lte("dia", atual.fim)
      .order("dia", { ascending: true })
      .order("evento_id", { ascending: true })
      .order("cidade", { ascending: true, nullsFirst: true })
      .order("estado", { ascending: true, nullsFirst: true })
      .range(from, to);
    if (artistaId) q = q.eq("artista_id", artistaId);
    if (eventoId) q = q.eq("evento_id", eventoId);
    if (cidade) {
      q = q.eq("cidade", cidade);
      if (estado) q = q.eq("estado", estado);
    }
    return q;
  }, "dash_interessados_diarios");

  const diarios: DailyRow[] = diariosRaw.map((r) => ({
    dia: r.dia,
    eventoId: r.evento_id,
    eventoNome: r.evento_nome,
    artistaId: r.artista_id,
    artistaNome: r.artista_nome,
    total: r.total,
    emailValidos: r.email_validos,
    telefoneValidos: r.telefone_validos,
  }));

  const doPeriodoAtual = diarios.filter((r) => r.dia >= atual.inicio && r.dia <= atual.fim);
  const doPeriodoAnterior = anterior
    ? diarios.filter((r) => r.dia >= anterior.inicio && r.dia <= anterior.fim)
    : [];

  const totalPeriodo = doPeriodoAtual.reduce((acc, r) => acc + r.total, 0);
  const totalAnterior = anterior ? doPeriodoAnterior.reduce((acc, r) => acc + r.total, 0) : null;
  const deltaPercentual =
    totalAnterior !== null && totalAnterior > 0
      ? ((totalPeriodo - totalAnterior) / totalAnterior) * 100
      : null;

  const novosHoje = diarios
    .filter((r) => r.dia === hojeRange.fim)
    .reduce((acc, r) => acc + r.total, 0);

  const emailValidos = doPeriodoAtual.reduce((acc, r) => acc + r.emailValidos, 0);
  const telefoneValidos = doPeriodoAtual.reduce((acc, r) => acc + r.telefoneValidos, 0);
  const contatoUtilizavelPercentual =
    totalPeriodo > 0 ? (Math.max(emailValidos, telefoneValidos) / totalPeriodo) * 100 : null;

  const tendencia = buildTrend(doPeriodoAtual, artistaId ? "evento" : "artista");

  const rankingMap = new Map<string, RankingItem>();
  for (const r of doPeriodoAtual) {
    const label = artistaId ? r.eventoNome : `${r.artistaNome} — ${r.eventoNome}`;
    const item = rankingMap.get(r.eventoId) ?? { eventoId: r.eventoId, label, total: 0 };
    item.total += r.total;
    rankingMap.set(r.eventoId, item);
  }
  const ranking = [...rankingMap.values()].sort((a, b) => b.total - a.total).slice(0, TOP_EVENTOS);

  const geografiaRaw = await fetchAllRows((from, to) => {
    let q = supabase
      .from("dash_geografia")
      .select("cidade, estado, artista_id, evento_id, total")
      .gte("dia", atual.inicio)
      .lte("dia", atual.fim)
      .order("cidade", { ascending: true })
      .order("estado", { ascending: true, nullsFirst: true })
      .order("artista_id", { ascending: true })
      .order("evento_id", { ascending: true })
      .order("dia", { ascending: true })
      .range(from, to);
    if (artistaId) q = q.eq("artista_id", artistaId);
    if (eventoId) q = q.eq("evento_id", eventoId);
    if (cidade) {
      q = q.eq("cidade", cidade);
      if (estado) q = q.eq("estado", estado);
    }
    return q;
  }, "dash_geografia");

  const geografiaMap = new Map<string, GeografiaItem>();
  for (const r of geografiaRaw) {
    const key = `${r.cidade}|${r.estado ?? ""}`;
    const item = geografiaMap.get(key) ?? { cidade: r.cidade, estado: r.estado, total: 0 };
    item.total += r.total;
    geografiaMap.set(key, item);
  }
  const geografia = [...geografiaMap.values()].sort((a, b) => b.total - a.total).slice(0, TOP_CIDADES);

  const qualidadeRawSplit = await fetchAllRows((from, to) => {
    let q = supabase
      .from("dash_qualidade_por_fonte")
      .select(
        "source_id, source_name, tipo, status, last_synced_at, evento_id, evento_nome, artista_id, artista_nome, total, email_validos, telefone_validos, local_pendentes",
      )
      .order("source_id", { ascending: true })
      .order("cidade", { ascending: true, nullsFirst: true })
      .order("estado", { ascending: true, nullsFirst: true })
      .range(from, to);
    if (artistaId) q = q.eq("artista_id", artistaId);
    if (eventoId) q = q.eq("evento_id", eventoId);
    if (cidade) {
      q = q.eq("cidade", cidade);
      if (estado) q = q.eq("estado", estado);
    }
    return q;
  }, "dash_qualidade_por_fonte");

  // dash_qualidade_por_fonte agora tem uma linha por fonte×cidade (0008) —
  // recolapsa por source_id aqui, senão uma fonte com leads de várias
  // cidades apareceria duplicada na tabela e geraria alertas repetidos.
  const qualidadeBySource = new Map<string, (typeof qualidadeRawSplit)[number]>();
  for (const r of qualidadeRawSplit) {
    const existing = qualidadeBySource.get(r.source_id);
    if (existing) {
      existing.total += r.total;
      existing.email_validos += r.email_validos;
      existing.telefone_validos += r.telefone_validos;
      existing.local_pendentes += r.local_pendentes;
    } else {
      qualidadeBySource.set(r.source_id, { ...r });
    }
  }
  const qualidadeRaw = [...qualidadeBySource.values()];

  const agora = new Date();
  const alertas: Alerta[] = [];
  const qualidadePorFonte: FonteQualidade[] = qualidadeRaw.map((r) => {
    if (r.status === "error") {
      alertas.push({
        sourceId: r.source_id,
        sourceName: r.source_name,
        motivo: "Última sincronização terminou com erro",
        nivel: "critical",
      });
    } else if (r.tipo === "google_sheets") {
      const diasSemSync = r.last_synced_at
        ? (agora.getTime() - new Date(r.last_synced_at).getTime()) / (24 * 60 * 60 * 1000)
        : Infinity;
      if (diasSemSync > FONTE_ATRASO_DIAS) {
        alertas.push({
          sourceId: r.source_id,
          sourceName: r.source_name,
          motivo: r.last_synced_at
            ? `Sem sincronizar há mais de ${FONTE_ATRASO_DIAS} dias`
            : "Nunca sincronizada",
          nivel: "warning",
        });
      }
    }

    return {
      sourceId: r.source_id,
      sourceName: r.source_name,
      tipo: r.tipo,
      status: r.status,
      lastSyncedAt: r.last_synced_at,
      eventoNome: r.evento_nome,
      artistaNome: r.artista_nome,
      total: r.total,
      emailValidosPct: r.total > 0 ? (r.email_validos / r.total) * 100 : null,
      telefoneValidosPct: r.total > 0 ? (r.telefone_validos / r.total) * 100 : null,
      localPendentesPct: r.total > 0 ? (r.local_pendentes / r.total) * 100 : null,
    };
  });

  const { count: pessoasComOverlap, error: overlapError } = await supabase
    .from("publico_sobreposto")
    .select("email", { count: "exact", head: true });
  if (overlapError) {
    throw new Error(`Falha ao carregar publico_sobreposto: ${overlapError.message}`);
  }
  const { count: totalInteressados, error: totalError } = await supabase
    .from("interessados_ativos")
    .select("id", { count: "exact", head: true });
  if (totalError) {
    throw new Error(`Falha ao carregar total de interessados: ${totalError.message}`);
  }

  return {
    artistas: artistas ?? [],
    kpis: {
      totalPeriodo,
      deltaPercentual,
      novosHoje,
      contatoUtilizavelPercentual,
      fontesComProblema: new Set(alertas.map((a) => a.sourceId)).size,
      fontesTotal: qualidadePorFonte.length,
    },
    tendencia,
    ranking,
    geografia,
    qualidadePorFonte,
    alertas,
    sobreposicao: {
      pessoas: pessoasComOverlap ?? 0,
      totalInteressados: totalInteressados ?? 0,
    },
  };
}
