/**
 * Dicionário de funções de transformação, referenciadas por nome em
 * field_mappings.transform. Adicionar um novo transform = adicionar uma
 * função aqui, nunca lógica condicional espalhada pelo motor de sync
 * (ver CLAUDE.md, convenções de nomenclatura).
 */
export type Transform = (value: string) => string;

export const transforms: Record<string, Transform> = {
  trim: (value) => value.trim(),

  only_digits: (value) => value.replace(/\D/g, ""),

  trim_lowercase: (value) => value.trim().toLowerCase(),

  trim_uppercase: (value) => value.trim().toUpperCase(),

  /**
   * "São Paulo - SP" ou "São Paulo/SP" -> mantém só a cidade (o estado é
   * extraído separadamente por split_cidade_estado_uf). Usado quando o
   * campo canonical é `cidade` mas a fonte manda cidade e estado juntos.
   */
  split_cidade_estado_cidade: (value) => splitCidadeEstado(value).cidade,

  split_cidade_estado_uf: (value) => splitCidadeEstado(value).estado,

  /**
   * Carimbo de data/hora do Google Forms em locale pt-BR: "DD/MM/YYYY
   * HH:mm:ss". new Date(value) nativo do JS assume MM/DD/YYYY — com dia > 12
   * isso vira Invalid Date (submitted_at some), e com dia <= 12 inverte
   * dia/mês em silêncio, sem erro. Formulário é preenchido por público
   * brasileiro, então o horário é local de Brasília (UTC-3, sem horário de
   * verão) — convertido para UTC aqui antes de virar ISO.
   */
  parse_date_dmy: (value) => parseLocalDateTime(value, "dmy"),

  /**
   * Mesma carimbo de data/hora, mas de planilhas com locale en-US:
   * "MM/DD/YYYY HH:mm:ss". O dia/mês já vem na ordem que new Date() espera,
   * mas sem esta conversão o horário é tratado como UTC em vez de
   * Brasília (UTC-3), ficando ~3h adiantado.
   */
  parse_date_mdy: (value) => parseLocalDateTime(value, "mdy"),
};

function splitCidadeEstado(value: string): { cidade: string; estado: string } {
  const match = value.trim().match(/^(.+?)\s*[/-]\s*([A-Za-z]{2})$/);
  if (!match) return { cidade: value.trim(), estado: "" };
  return { cidade: match[1].trim(), estado: match[2].toUpperCase() };
}

const BRASILIA_OFFSET = "-03:00";

function parseLocalDateTime(value: string, order: "dmy" | "mdy"): string {
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";

  const [, first, second, year, hour, minute, seconds = "0"] = match;
  const day = order === "dmy" ? first : second;
  const month = order === "dmy" ? second : first;

  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${seconds.padStart(2, "0")}${BRASILIA_OFFSET}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export const TRANSFORM_NAMES = Object.keys(transforms);

export function applyTransform(
  transformName: string | null,
  value: string,
): string {
  if (!transformName) return value;
  const fn = transforms[transformName];
  if (!fn) {
    throw new Error(`Transform desconhecido: "${transformName}".`);
  }
  return fn(value);
}
