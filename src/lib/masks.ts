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

/**
 * Máscara "inteligente" de contato institucional (Entidades): reconhece
 * números curtos de emergência (193, 199...) e 0800/0300/0500, que NÃO devem
 * levar a máscara de telefone padrão; nos demais casos, aplica formatPhoneBR.
 */
export function formatContactBR(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length <= 4) return d; // número curto de emergência (193, 199, 190...)
  if (/^(0800|0300|0500)/.test(d)) {
    const prefix = d.slice(0, 4);
    const rest = d.slice(4, 11);
    if (rest.length <= 3) return `${prefix}-${rest}`;
    if (rest.length <= 6) return `${prefix}-${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `${prefix}-${rest.slice(0, 3)}-${rest.slice(3, 7)}`;
  }
  return formatPhoneBR(value);
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
