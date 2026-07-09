import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { matchMunicipio } from "./matchMunicipio";
import { normalizeMunicipioName } from "./normalize";

/**
 * Confiança mínima (similaridade de trigrama) para aceitar a normalização
 * automaticamente. Abaixo disso, fica pendente de revisão manual
 * (CLAUDE.md, princípio 6). Ajustável conforme os erros reais encontrados
 * na Fase 6 do PLANO.md.
 */
export const LOCAL_CONFIANCA_MINIMA = 0.4;

const UF_REGEX = /^[A-Z]{2}$/;

export interface GeografiaResolvida {
  cidadeNormalizada: string | null;
  estadoNormalizado: string | null;
  confianca: number | null;
  revisaoPendente: boolean;
}

/**
 * Cria um resolvedor com cache em memória por (cidade, uf) normalizados,
 * válido durante uma única execução de syncSource — evita repetir a mesma
 * consulta de similaridade para cidades que se repetem entre interessados
 * (ex: várias pessoas de "São Paulo" no mesmo evento).
 */
export function createGeografiaResolver(supabase: SupabaseClient<Database>) {
  const cache = new Map<string, Promise<GeografiaResolvida>>();

  return async function resolveGeografia(
    cidadeInformada: string,
    estadoInformada: string,
  ): Promise<GeografiaResolvida> {
    const nomeNormalizado = normalizeMunicipioName(cidadeInformada);
    if (!nomeNormalizado) {
      return {
        cidadeNormalizada: null,
        estadoNormalizado: null,
        confianca: null,
        revisaoPendente: true,
      };
    }

    const ufHint = UF_REGEX.test(estadoInformada.trim().toUpperCase())
      ? estadoInformada.trim().toUpperCase()
      : null;

    const cacheKey = `${nomeNormalizado}|${ufHint ?? ""}`;
    let pending = cache.get(cacheKey);
    if (!pending) {
      pending = matchMunicipio(supabase, nomeNormalizado, ufHint).then(
        (match): GeografiaResolvida => {
          if (!match || match.similaridade < LOCAL_CONFIANCA_MINIMA) {
            return {
              cidadeNormalizada: null,
              estadoNormalizado: null,
              confianca: match?.similaridade ?? null,
              revisaoPendente: true,
            };
          }
          return {
            cidadeNormalizada: match.nome,
            estadoNormalizado: match.uf,
            confianca: match.similaridade,
            revisaoPendente: false,
          };
        },
      );
      cache.set(cacheKey, pending);
    }
    return pending;
  };
}
