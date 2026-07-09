/**
 * América/São_Paulo é UTC-3 fixo (sem horário de verão desde 2019), então
 * os limites de período são calculados com um offset constante, sem
 * depender de uma biblioteca de timezone.
 */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

export const PERIODOS = ["hoje", "7d", "30d", "90d", "tudo"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  tudo: "Tudo",
};

export function isPeriodo(value: string | undefined): value is Periodo {
  return !!value && (PERIODOS as readonly string[]).includes(value);
}

/** Meia-noite de hoje em América/São_Paulo, representada como Date (instante UTC). */
function inicioDoDiaSaoPaulo(referencia: Date): Date {
  const localMs = referencia.getTime() - SAO_PAULO_OFFSET_MS;
  const localDate = new Date(localMs);
  const diaUtc = Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
  );
  return new Date(diaUtc + SAO_PAULO_OFFSET_MS);
}

export interface DateRange {
  /** Início (inclusive), formato YYYY-MM-DD, para comparar com a coluna `dia` das views. */
  inicio: string;
  /** Fim (inclusive), formato YYYY-MM-DD. */
  fim: string;
  /** Início como instante UTC — usado só para calcular o período anterior. */
  inicioInstant: Date;
  fimInstant: Date;
}

const DIAS_POR_PERIODO: Record<Exclude<Periodo, "hoje" | "tudo">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Range do período selecionado, e o range imediatamente anterior de mesma duração (para o delta). */
export function resolveDateRange(
  periodo: Periodo,
  agora: Date = new Date(),
): { atual: DateRange; anterior: DateRange | null } {
  const fimInstant = inicioDoDiaSaoPaulo(agora);

  if (periodo === "tudo") {
    const inicioInstant = new Date(0);
    return {
      atual: {
        inicio: toIsoDate(inicioInstant),
        fim: toIsoDate(fimInstant),
        inicioInstant,
        fimInstant,
      },
      anterior: null,
    };
  }

  const dias = periodo === "hoje" ? 1 : DIAS_POR_PERIODO[periodo];
  const inicioInstant = new Date(fimInstant.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);

  const anteriorFim = new Date(inicioInstant.getTime() - 24 * 60 * 60 * 1000);
  const anteriorInicio = new Date(anteriorFim.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);

  return {
    atual: {
      inicio: toIsoDate(inicioInstant),
      fim: toIsoDate(fimInstant),
      inicioInstant,
      fimInstant,
    },
    anterior: {
      inicio: toIsoDate(anteriorInicio),
      fim: toIsoDate(anteriorFim),
      inicioInstant: anteriorInicio,
      fimInstant: anteriorFim,
    },
  };
}
