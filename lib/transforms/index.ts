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
};

function splitCidadeEstado(value: string): { cidade: string; estado: string } {
  const match = value.trim().match(/^(.+?)\s*[/-]\s*([A-Za-z]{2})$/);
  if (!match) return { cidade: value.trim(), estado: "" };
  return { cidade: match[1].trim(), estado: match[2].toUpperCase() };
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
