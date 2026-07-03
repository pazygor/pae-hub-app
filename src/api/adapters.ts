// ─────────────────────────────────────────────────────────────────────────────
// Adapters: traduzem DTOs da API para os tipos do front (src/lib/types.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { AppUser, UserRole, AccessLevel } from '@/lib/types';
import { INITIAL_DATA } from '@/lib/data';
import { ApiAuthUser } from './auth';

/**
 * PONTE TEMPORÁRIA (strangler) — remover conforme as Fases 2/4/5 migrarem os
 * dados para a API.
 *
 * Contexto: a partir da Fase 1.C o USUÁRIO é real (vem do back, com UUIDs),
 * mas os DADOS das telas ainda são o mock (INITIAL_DATA, com ids 't1', 'u5'…).
 * Sem esta ponte, o linkId/tacticalManagerId reais (UUIDs) não casariam com o
 * mock e as telas filtradas por terminal/hierarquia ficariam vazias.
 *
 * Como os e-mails demo do seed são os MESMOS do mock (ambos seguem a spec
 * oficial), reaproveitamos os ids do mock para o usuário logado quando houver
 * correspondência por e-mail. Identidade (nome/role/nível) prevalece da API.
 */
function findMockTwin(email: string): AppUser | undefined {
  return INITIAL_DATA.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/** Converte o usuário autenticado da API para o tipo do front. */
export function adaptAuthUser(api: ApiAuthUser): AppUser {
  const twin = findMockTwin(api.email);
  return {
    // Verdade da API (identidade e autorização)
    name: api.name,
    email: api.email,
    role: api.role as UserRole,
    accessLevel: (api.accessLevel as AccessLevel | null) ?? undefined,
    // Ponte com o mock enquanto os dados das telas não vêm da API
    id: twin?.id ?? api.id,
    linkId: twin?.linkId ?? api.linkId ?? null,
    tacticalManagerId: twin?.tacticalManagerId,
    allowedModules: twin?.allowedModules,
    allowedTerminals: twin?.allowedTerminals,
    allowedOccurrenceTypes: twin?.allowedOccurrenceTypes,
    // Nunca exposto pela API (o campo existe no tipo do front por herança do mock)
    password: '',
  };
}
