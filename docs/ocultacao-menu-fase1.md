# Ocultação de itens — histórico e estado atual

> **Atualização (2026-07-11):** por exigência dos acionistas, **todos os itens de
> menu e o modal de pendências voltaram** para a entrega v1. A ocultação abaixo era
> temporária e **foi revertida**. O único item que **permanece oculto** é o
> "Acessar demonstração" da tela de login (pedido do gestor — ver seção final).

---

## 1. Estado atual (o que está visível/oculto)

### ✅ Restaurados para o v1 (exigência dos acionistas)

| Item | id do NavItem | Rota | Situação |
| ---- | ------------- | ---- | -------- |
| Meu Painel | `my-panel` | `/meu-painel` | **Visível** |
| Documentos | `documents` | `/documentos` | **Visível** |
| Segurança Operacional → Visão Geral | `safety` | `/seguranca` | **Visível** |
| Segurança Operacional → Treinamentos | `trainings` | `/seguranca/treinamentos` | **Visível** |
| Segurança Operacional → EPIs | `epis` | `/seguranca/epis` | **Visível** |
| Segurança Operacional → Conformidade | `compliance` | `/seguranca/conformidade` | **Visível** |
| Modal "Pendências Operacionais" (pós-login) | `PendencyAlertModal` | — | **Ativo** |

### ❌ Ainda oculto

| Elemento | Onde | Motivo |
| -------- | ---- | ------ |
| "Acessar demonstração" + painel de acesso rápido (credenciais de demo) | `LoginPage` | Pedido do gestor (não faz parte do escopo de features dos acionistas) |

---

## 2. Como a restauração foi feita

A navegação deriva toda da lista `NAV_CONFIG` em
[`src/lib/nav-config.ts`](../src/lib/nav-config.ts) — descomentar os itens já os traz
de volta ao menu, à busca global e aos títulos de página. As rotas em
[`src/app/router.tsx`](../src/app/router.tsx) nunca foram removidas.

Alterações revertidas:

1. **`nav-config.ts`** — descomentados os itens `my-panel`, `documents`, `safety`,
   `trainings`, `epis`, `compliance` no array `NAV_CONFIG`; ícones (`UserCircle`,
   `FolderOpen`, `GraduationCap`, `HardHat`, `ClipboardCheck`) reintegrados ao
   `import` do `lucide-react`.
2. **`src/app/layout/AppShell.tsx`** — reativados o `import` do `PendencyAlertModal`
   e a renderização `<PendencyAlertModal />` dentro do `return`.

> A seção "Segurança Operacional" no menu é gerada dinamicamente pelo `AppSidebar`
> a partir do campo `section` dos itens — com os 4 itens de volta, o cabeçalho da
> seção reaparece automaticamente.

---

## 3. "Acessar demonstração" na tela de login (segue oculto)

A tela de login ([`src/modules/auth/pages/LoginPage.tsx`](../src/modules/auth/pages/LoginPage.tsx))
tinha um botão **"Acessar demonstração"** que revelava um painel de **acesso rápido**
com as credenciais de demonstração. O **gestor pediu para removê-lo**, e essa remoção
**permanece** (não é escopo dos acionistas).

Continua oculto no `LoginPage.tsx` (marcado com `[OCULTO FASE 1 ...]`):

1. O estado `const [showDemo, setShowDemo] = useState(false);` — comentado.
2. A função `quickLogin(...)` — comentada.
3. O bloco JSX do botão/painel de demonstração — comentado (`{/* ... */}`).

O formulário de login normal (email + senha + "Entrar") permanece intacto.

### Se o gestor pedir para reativar o "Acessar demonstração"
No `LoginPage.tsx`, descomente os três trechos marcados com `[OCULTO FASE 1 ...]`:
- o estado `showDemo`;
- a função `quickLogin(...)`;
- o bloco JSX (remover o `{/*` e `*/}`).

---

_© M1 — Documento mantido como histórico da ocultação da Fase 1 e do estado atual._
