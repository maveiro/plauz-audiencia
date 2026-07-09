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

export function parseSubmittedAt(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
