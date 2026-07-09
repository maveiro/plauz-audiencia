import { applyTransform } from "@/lib/transforms";
import type { Database } from "@/lib/database.types";
import type { RawRow } from "@/lib/readers/types";

type FieldMappingRow = Database["public"]["Tables"]["field_mappings"]["Row"];

export interface CanonicalRow {
  nome_completo: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  submitted_at: string;
  extra: Record<string, string>;
}

/**
 * Traduz uma linha bruta para os campos canônicos usando os field_mappings
 * da fonte — nenhuma lógica específica de fonte aqui (CLAUDE.md, princípio 3).
 * Colunas da linha que não têm mapeamento configurado vão para `extra`.
 */
export function mapRowToCanonical(
  row: RawRow,
  fieldMappings: FieldMappingRow[],
): CanonicalRow {
  const canonical: CanonicalRow = {
    nome_completo: "",
    telefone: "",
    email: "",
    cidade: "",
    estado: "",
    submitted_at: "",
    extra: {},
  };

  const mappedSourceFields = new Set(fieldMappings.map((fm) => fm.source_field));

  for (const fm of fieldMappings) {
    const rawValue = row[fm.source_field] ?? "";
    canonical[fm.canonical_field] = applyTransform(fm.transform, rawValue);
  }

  for (const [sourceField, value] of Object.entries(row)) {
    if (!mappedSourceFields.has(sourceField)) {
      canonical.extra[sourceField] = value;
    }
  }

  return canonical;
}

/**
 * Datas "DD/MM/YYYY" ou "MM/DD/YYYY" são ambíguas pra new Date() nativo do
 * JS (assume MM/DD/YYYY, invertendo dia/mês em silêncio quando o dia é <=
 * 12). Um field_mapping de submitted_at precisa passar por um transform
 * explícito (parse_date_dmy / parse_date_mdy) que já resolve essa ambiguidade
 * antes de chegar aqui — se um valor nesse formato ainda chegar cru, é sinal
 * de mapeamento mal configurado. Preferível falhar visível (submitted_at
 * nulo, perceptível no dashboard) a inverter a data em silêncio.
 */
const AMBIGUOUS_SLASH_DATE = /^\d{1,2}\/\d{1,2}\/\d{2,4}/;

export function parseSubmittedAt(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (AMBIGUOUS_SLASH_DATE.test(trimmed)) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
