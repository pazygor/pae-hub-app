// ─────────────────────────────────────────────────────────────────────────────
// Máscaras de formatação de input (pt-BR). Formatam o VALOR conforme digitado.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Máscara de telefone brasileira que se adapta a fixo e celular:
 * - até 10 dígitos → (XX) XXXX-XXXX   (fixo)
 * - 11 dígitos     → (XX) XXXXX-XXXX  (celular)
 * Aceita colar/apagar; ignora não-dígitos e limita a 11 dígitos.
 */
export function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de CEP: XXXXX-XXX. */
export function formatCEP(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Só os dígitos (para enviar à API / comparar). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}
