/**
 * Parâmetros de campanha capturados da URL da página pública e enviados
 * junto com o submit — prefixo `_` reservado para nunca colidir com a
 * `chave` de uma pergunta extra (que vem de texto livre do usuário).
 * Entram no `row_hash` deliberadamente (ver PRD, "Especificação crítica"):
 * a mesma resposta vinda de campanha diferente é sinal novo legítimo.
 */
export const UTM_ROW_KEYS = [
  "_utm_source",
  "_utm_medium",
  "_utm_campaign",
  "_utm_content",
  "_fbclid",
] as const;

export const CAMPO_TEXTO_MAX_LENGTH = 500;
export const CAMPO_TEXTO_LONGO_MAX_LENGTH = 5000;

export const TIPOS_PERGUNTA = [
  "texto_curto",
  "texto_longo",
  "multipla_escolha",
  "caixa_selecao",
] as const;

export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export const CAIXA_SELECAO_SEPARADOR = "; ";
