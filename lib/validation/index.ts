/**
 * Validação leve de formato (CLAUDE.md, princípio 5): nunca descarta a
 * linha, só marca _valido. Deliverability real de e-mail e verificação de
 * telefone via API externa ficam para a Fase 6, sob demanda.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Espera dígitos apenas (aplicar only_digits no field_mapping antes).
 * Válido: 10 ou 11 dígitos (DDD + número), com ou sem o "55" do Brasil na frente.
 */
export function isValidTelefone(digits: string): boolean {
  if (!digits) return false;
  const semDDI = digits.length > 11 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
  return semDDI.length === 10 || semDDI.length === 11;
}
