# Ocultação de itens do menu — Fase 1

> **Status:** itens ocultos temporariamente para a **primeira entrega** do sistema.
> **Objetivo:** focar a entrega inicial no conjunto de telas priorizadas (integração
> front-end + back-end). Os itens abaixo voltam na **Fase 2** para refinamento e
> desenvolvimento completo.

## O que foi ocultado

Nesta primeira entrega **não devem aparecer** no menu lateral:

| Item          | id do NavItem | Rota                      | Motivo                                  |
| ------------- | ------------- | ------------------------- | --------------------------------------- |
| Meu Painel    | `my-panel`    | `/meu-painel`             | Fase 2                                  |
| Documentos    | `documents`   | `/documentos`             | Fase 2                                  |
| **Segurança Operacional (seção inteira)** | | | Toda a seção é Fase 2 |
| → Visão Geral | `safety`      | `/seguranca`              | Fase 2                                  |
| → Treinamentos| `trainings`   | `/seguranca/treinamentos` | Fase 2                                  |
| → EPIs        | `epis`        | `/seguranca/epis`         | Fase 2                                  |
| → Conformidade| `compliance`  | `/seguranca/conformidade` | Fase 2                                  |

Além dos itens de menu, também foi ocultado:

| Elemento | Onde | Motivo |
| -------- | ---- | ------ |
| **Modal "Pendências Operacionais"** (exibido após o login) | `PendencyAlertModal` | Mostra pendências de Treinamentos/EPIs/Conformidade — todos de Segurança Operacional (Fase 2) |

## Como está sendo ocultado

A ocultação é feita **na fonte única de navegação**, o arquivo
[`src/lib/nav-config.ts`](../src/lib/nav-config.ts).

O menu lateral (`AppSidebar`), as rotas, os guards de acesso, a busca global e os
títulos de página derivam todos da lista `NAV_CONFIG`. Portanto, **comentar o item
nessa lista remove-o do menu automaticamente** — não é preciso mexer no
`AppSidebar.tsx`.

> Observação: a seção "Segurança Operacional" no menu não tem um bloco próprio de
> código — ela é gerada dinamicamente pelo `AppSidebar` a partir do campo
> `section` dos itens. Ao comentar os 4 itens da seção, o cabeçalho "Segurança
> Operacional" também deixa de ser renderizado (não sobra título vazio).

### Alterações aplicadas em `nav-config.ts`

1. **Itens comentados** dentro do array `NAV_CONFIG` (cada um marcado com
   `// [OCULTO FASE 1 — ver docs/ocultacao-menu-fase1.md]`):
   - `my-panel`
   - `documents`
   - `safety`, `trainings`, `epis`, `compliance`

2. **Ícones movidos para comentário** no `import` do `lucide-react`, para não
   deixar imports sem uso (o eslint quebraria o build):
   - `UserCircle` (era usado por `my-panel`)
   - `FolderOpen` (era usado por `documents`)
   - `GraduationCap` (era usado por `trainings`)
   - `HardHat` (era usado por `epis`)
   - `ClipboardCheck` (era usado por `compliance`)
   - `ShieldCheck` **não** foi removido: ainda é usado pelo item `access-levels`.

> As **rotas** correspondentes em [`src/app/router.tsx`](../src/app/router.tsx) **não
> foram alteradas**. Elas continuam existindo, então acessar a URL diretamente ainda
> funciona — apenas o item deixa de aparecer no menu. Se o desejo for bloquear
> também o acesso por URL, veja a seção "Bloqueio total (opcional)" abaixo.

### Modal "Pendências Operacionais" (pós-login)

O componente [`src/app/layout/PendencyAlertModal.tsx`](../src/app/layout/PendencyAlertModal.tsx)
exibe, logo após o login, um alerta com pendências de **Treinamentos, EPIs e
Conformidade** — todos pertencentes à Segurança Operacional. Como essa seção é Fase 2,
o modal foi desativado.

Ocultação feita em [`src/app/layout/AppShell.tsx`](../src/app/layout/AppShell.tsx):

1. O **import** `import { PendencyAlertModal } from './PendencyAlertModal';` foi
   comentado.
2. A **renderização** `<PendencyAlertModal />` (dentro do `return` do `AppShell`) foi
   comentada.

O componente `PendencyAlertModal.tsx` **em si não foi alterado** — continua completo
para a Fase 2.

## Como reverter (Fase 2)

Para trazer os itens de volta, no arquivo
[`src/lib/nav-config.ts`](../src/lib/nav-config.ts):

1. **Descomente os itens** no array `NAV_CONFIG` (remova o `//` das linhas marcadas
   com `[OCULTO FASE 1 ...]`):
   - `my-panel`
   - `documents`
   - os 4 itens da seção `Segurança Operacional` (`safety`, `trainings`, `epis`,
     `compliance`)

2. **Restaure os ícones no `import`** do `lucide-react`. Descomente a linha:
   ```ts
   // UserCircle, FolderOpen, GraduationCap, HardHat, ClipboardCheck,
   ```
   e integre esses nomes de volta à lista de imports (ou simplesmente remova o `//`).

3. Rode o lint/type-check para confirmar que não há imports sobrando nem faltando:
   ```bash
   npm run lint
   ```

Não é necessário alterar `AppSidebar.tsx`, `router.tsx` nem `access-control` — ao
descomentar os itens, o menu, a seção e a navegação voltam a funcionar
automaticamente.

**Para reativar o modal "Pendências Operacionais"**, em
[`src/app/layout/AppShell.tsx`](../src/app/layout/AppShell.tsx) descomente:

- o import `import { PendencyAlertModal } from './PendencyAlertModal';`
- a linha `<PendencyAlertModal />` dentro do `return`.

## Bloqueio total (opcional)

Se em algum momento for preciso impedir também o **acesso direto por URL** (e não só
esconder do menu), comente as `<Route>` correspondentes em
[`src/app/router.tsx`](../src/app/router.tsx). Isso **não** é necessário para a
ocultação do menu e **não** foi feito nesta Fase 1.

---

### Telas em foco na primeira entrega (referência)

Núcleo:
Usuários · Permissões · Níveis de Acesso · Terminais · Entidades ·
Acionamento de Entidades · Dashboard (parcial) · Centro de Operações
_(Meu Painel = Fase 2)_

PAE:
Orquestração · Riscos · Plano de Ação · **Ocorrências (prioridade)** ·
Mapa de Emergência · Crachá do PAE
_(AI Command = Fase 2 · Documentos = Fase 2)_

Segurança Operacional: **tudo é Fase 2.**
