import { createHash } from "node:crypto";
import type { RawRow } from "@/lib/readers/types";

/**
 * Hash de conteúdo da linha, chaves ordenadas alfabeticamente antes de
 * serializar (CLAUDE.md, princípio 2) — reordenar colunas na fonte não gera
 * um falso "registro novo". Editar uma resposta já existente na fonte, por
 * outro lado, muda o hash e gera um novo registro: limitação conhecida e
 * aceita, não uma regressão deste cálculo.
 */
export function computeRowHash(row: RawRow): string {
  const ordered: RawRow = {};
  for (const key of Object.keys(row).sort()) {
    ordered[key] = row[key];
  }
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}
