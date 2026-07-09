/**
 * Normalização de nome de município: remove acentos, minúsculas, espaços
 * únicos. Usada tanto para popular municipios_ref.nome_normalizado quanto
 * para normalizar cidade_informada antes da comparação por similaridade
 * (pg_trgm) durante o sync.
 */
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeMunicipioName(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
