// ─────────────────────────────────────────────────────────────────────────────
// Adapters: traduzem DTOs da API para os tipos do front (src/lib/types.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { AppUser, UserRole, AccessLevel } from '@/lib/types';
import { ApiAuthUser } from './auth';

/**
 * Converte o usuário autenticado da API para o tipo do front.
 *
 * A "ponte temporária" com o mock (INITIAL_DATA, casado por e-mail) foi removida
 * em 2026-07-07: com as Fases 2–5b concluídas, todos os dados das telas vêm da
 * API (UUIDs reais), então identidade, vínculo E autorização fina (`allowed*`)
 * passam a vir 100% do back. É isso que faz a tela "Níveis de Acesso" valer de
 * verdade na sessão (antes, `allowed*` vinha do mock, que não definia esses
 * campos → o filtro do menu nunca rodava).
 */
export function adaptAuthUser(api: ApiAuthUser): AppUser {
  return {
    id: api.id,
    name: api.name,
    email: api.email,
    role: api.role as UserRole,
    accessLevel: (api.accessLevel as AccessLevel | null) ?? undefined,
    linkId: api.linkId ?? null,
    tacticalManagerId: api.tacticalManagerId ?? undefined,
    // Autorização fina (Níveis de Acesso) — agora da API, não mais do mock
    allowedModules: api.allowedModules,
    allowedTerminals: api.allowedTerminals,
    allowedOccurrenceTypes: api.allowedOccurrenceTypes,
    // Nunca exposto pela API (campo existe no tipo por herança histórica)
    password: '',
  };
}
