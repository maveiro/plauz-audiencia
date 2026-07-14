import type { Database } from "@/lib/database.types";

type FieldMappingInsert = Database["public"]["Tables"]["field_mappings"]["Insert"];

/**
 * Chaves fixas dos campos padrão no `RawRow` submetido pela página pública
 * do formulário (`app/f/[slug]/FormularioPublico.tsx`) — diferente de
 * planilha externa, aqui é o próprio produto que define o nome da coluna,
 * então o mapeamento padrão pode ser gerado sem exigir configuração manual
 * do usuário (CLAUDE.md, princípio 3).
 */
export const CAMPOS_PADRAO_KEYS = {
  nome: "nome",
  telefone: "telefone",
  email: "email",
  cidade: "cidade",
  estado: "estado",
} as const;

/**
 * field_mappings gerados automaticamente na criação de um formulário nativo
 * — o usuário nunca configura isso manualmente para este tipo de fonte.
 */
export function buildFieldMappingsPadrao(sourceId: string): FieldMappingInsert[] {
  return [
    { source_id: sourceId, source_field: CAMPOS_PADRAO_KEYS.nome, canonical_field: "nome_completo", transform: "trim" },
    { source_id: sourceId, source_field: CAMPOS_PADRAO_KEYS.telefone, canonical_field: "telefone", transform: "only_digits" },
    { source_id: sourceId, source_field: CAMPOS_PADRAO_KEYS.email, canonical_field: "email", transform: "trim_lowercase" },
    { source_id: sourceId, source_field: CAMPOS_PADRAO_KEYS.cidade, canonical_field: "cidade", transform: "trim" },
    { source_id: sourceId, source_field: CAMPOS_PADRAO_KEYS.estado, canonical_field: "estado", transform: "trim_uppercase" },
  ];
}

export const TEXTO_CONSENTIMENTO_PADRAO =
  "Concordo em fornecer meus dados para receber novidades e comunicações sobre este evento. " +
  "Seus dados podem ser usados para mensurar a performance de campanhas de anúncio (Meta/Instagram/Facebook), " +
  "de forma anonimizada, e nunca são compartilhados com terceiros para outra finalidade.";

export const TEXTO_CONFIRMACAO_PADRAO =
  "Recebemos seu interesse! Fique de olho no seu e-mail e WhatsApp para novidades sobre o evento.";
