import type { FormularioPublico } from "./getFormularioPorSlug";
import {
  CAMPO_TEXTO_MAX_LENGTH,
  CAMPO_TEXTO_LONGO_MAX_LENGTH,
  CAIXA_SELECAO_SEPARADOR,
} from "./constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RespostasSubmitidas {
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  [chave: string]: string;
}

/**
 * Validação server-side estrita da submissão pública (nunca confiar no
 * client): só aceita chaves conhecidas do formulário publicado, impõe
 * obrigatoriedade, valida opções de múltipla escolha/caixa de seleção
 * contra o que está cadastrado, e limita tamanho de texto livre. Sem isso
 * a rota pública vira vetor de poluição de `interessados` (PRD, seção
 * "Segurança, anti-spam e LGPD").
 */
export function validarResposta(
  formulario: FormularioPublico,
  respostas: unknown,
): { ok: true; row: Record<string, string> } | { ok: false; error: string } {
  if (typeof respostas !== "object" || respostas === null) {
    return { ok: false, error: "Respostas em formato inválido." };
  }
  const input = respostas as Record<string, unknown>;

  const nome = String(input.nome ?? "").trim();
  const telefone = String(input.telefone ?? "").trim();
  const email = String(input.email ?? "").trim();
  const cidade = String(input.cidade ?? "").trim();
  const estado = String(input.estado ?? "").trim();

  if (!nome) return { ok: false, error: "Nome é obrigatório." };
  if (nome.length > CAMPO_TEXTO_MAX_LENGTH) return { ok: false, error: "Nome muito longo." };
  if (!email) return { ok: false, error: "E-mail é obrigatório." };
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: "E-mail inválido." };
  if (telefone.length > CAMPO_TEXTO_MAX_LENGTH) return { ok: false, error: "Telefone inválido." };
  if (cidade.length > CAMPO_TEXTO_MAX_LENGTH) return { ok: false, error: "Cidade inválida." };
  if (estado.length > CAMPO_TEXTO_MAX_LENGTH) return { ok: false, error: "Estado inválido." };

  const row: Record<string, string> = { nome, telefone, email, cidade, estado };

  const chavesConhecidas = new Set(formulario.perguntas.map((p) => p.chave));
  for (const key of Object.keys(input)) {
    if (["nome", "telefone", "email", "cidade", "estado"].includes(key)) continue;
    if (!chavesConhecidas.has(key)) {
      return { ok: false, error: `Campo desconhecido: ${key}.` };
    }
  }

  for (const pergunta of formulario.perguntas) {
    const raw = input[pergunta.chave];

    if (pergunta.tipo === "caixa_selecao") {
      const valores = Array.isArray(raw) ? raw.map((v) => String(v)) : [];
      if (pergunta.obrigatorio && valores.length === 0) {
        return { ok: false, error: `"${pergunta.rotulo}" é obrigatório.` };
      }
      if (valores.some((v) => !pergunta.opcoes?.includes(v))) {
        return { ok: false, error: `Opção inválida em "${pergunta.rotulo}".` };
      }
      row[pergunta.chave] = valores.join(CAIXA_SELECAO_SEPARADOR);
      continue;
    }

    const valor = raw == null ? "" : String(raw).trim();

    if (pergunta.obrigatorio && !valor) {
      return { ok: false, error: `"${pergunta.rotulo}" é obrigatório.` };
    }

    if (pergunta.tipo === "multipla_escolha") {
      if (valor && !pergunta.opcoes?.includes(valor)) {
        return { ok: false, error: `Opção inválida em "${pergunta.rotulo}".` };
      }
    } else {
      const maxLength =
        pergunta.tipo === "texto_longo" ? CAMPO_TEXTO_LONGO_MAX_LENGTH : CAMPO_TEXTO_MAX_LENGTH;
      if (valor.length > maxLength) {
        return { ok: false, error: `"${pergunta.rotulo}" excede o tamanho máximo.` };
      }
    }

    row[pergunta.chave] = valor;
  }

  return { ok: true, row };
}
