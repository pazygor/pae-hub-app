# M1 PAE Hub — Fluxo de Funcionamento Esperado do Sistema

> Documento funcional de referência para a **primeira entrega (Fase 1)**.
> Descreve, de ponta a ponta, como o sistema deve se comportar quando o
> front-end (`pae-hub-app`) está integrado ao back-end real (`pae-hub-api`).
>
> Base: `docs-manus/M1_PAE_Hub_Documentacao_Funcional (1).pdf` e
> `docs-manus/M1_PAE_Hub_Documentacao_Completa_DER (1).pdf`.
> Escopo de entrega alinhado com a definição de telas da Fase 1 (ver seção 2).

---

## 1. Visão geral

O M1 PAE Hub é uma plataforma corporativa **multi-tenant** de gestão de emergências
para ambientes portuários e industriais. Centraliza a operação do Plano de Auxílio
Emergencial (PAE) com três pilares:

- **Comando (Command):** Centro de Operações (COP) e Orquestração de Emergência.
- **Resposta (Response):** Ocorrências, Mapa, Riscos, Planos de Ação, Crachá do PAE.
- **Segurança (Safety):** Treinamentos, EPIs, Conformidade — **toda a Fase 2**.

**Princípios de produto (guiam todo o comportamento esperado):**

1. **Apoio, não substituição** — toda ação automatizada exige confirmação humana.
2. **Isolamento estrito** — nenhum usuário enxerga dados de terminal alheio.
3. **Rastreabilidade total** — cada ação relevante gera evento na timeline imutável.
4. **Leitura rápida sob estresse** — criticidade sinalizada por cor (verde/amarelo/vermelho).

### Arquitetura de integração

| Camada | Projeto | Stack | Porta |
|--------|---------|-------|-------|
| Front-end | `pae-hub-app` | React 18 + Vite + TypeScript + React Query | 5173 (dev) |
| Back-end | `pae-hub-api` | NestJS 10 + Prisma + PostgreSQL + Socket.IO + JWT | 3001 (`/api`) |

O front consome a API via `VITE_API_URL=http://localhost:3001/api`
([client.ts](../src/api/client.ts)). Toda resposta vem no envelope `{ data, meta }`,
desembrulhado automaticamente pelo cliente HTTP. Autenticação por **JWT com refresh**
automático no `401`.

---

## 2. Escopo da Fase 1 (esta entrega)

### Telas que DEVEM funcionar integradas front + back

**Núcleo / Administração**
- Usuários
- Permissões
- Níveis de Acesso
- Terminais
- Entidades
- Acionamento de Entidades (regras de notificação)
- Dashboard (parcial — conforme dados disponíveis das demais entregas)
- **Centro de Operações (COP)** — coração operacional do sistema

**PAE**
- Orquestração de Emergência
- Riscos
- Planos de Ação (Plano de Emergência)
- **Ocorrências** — **PRIORIDADE MÁXIMA**
- Mapa de Emergência (Mapa de Ocorrências)
- Crachá do PAE — listagem de usuários para comunicação rápida; **botão de contato
  direciona para o WhatsApp** (`wa.me`)

### Fora do escopo desta entrega (Fase 2 — ocultos)

| Item | Situação |
|------|----------|
| Meu Painel | Oculto do menu — ver [ocultacao-menu-fase1.md](ocultacao-menu-fase1.md) |
| Documentos | Oculto do menu |
| AI Command | Existe no código, **não é foco** da entrega |
| Segurança Operacional (Treinamentos, EPIs, Conformidade) | **Toda a seção oculta** |
| Modal "Pendências Operacionais" (pós-login) | Desativado |

> As rotas de Fase 2 ainda existem no `router.tsx` (acesso por URL direta continua
> funcionando), mas os itens não aparecem no menu. Ver documento de ocultação.

---

## 3. Perfis de acesso e isolamento

Hierarquia de 4 níveis. Cada perfil vê apenas o que lhe compete.

| Papel (`role`) | Nível (`accessLevel`) | Escopo |
|----------------|-----------------------|--------|
| `admin` | — | Acesso total: todos os terminais, entidades, usuários, módulos e configurações. |
| `terminal` | `estratégico` | Visão executiva do próprio terminal: KPIs, dashboards, relatórios. |
| `terminal` | `tático` | Operação diária do terminal: ocorrências, planos, equipes, mapa. |
| `terminal` | `operacional` | "Meu Painel" (Fase 2): tarefas, EPIs e treinamentos pessoais. |
| `entity` | — | Entidade externa (Bombeiros, IBAMA…): só vê terminais autorizados via Permission. |

### Regras de isolamento (multi-tenant)

- Cada terminal tem dados estanques — nenhum usuário enxerga registros de outro terminal.
- Usuário Operacional é vinculado a um Tático via `tacticalManagerId`.
- Entidade externa só vê terminais autorizados via tabela **Permission**.
- Admin liga Entidades a Terminais (Permission) para habilitar notificações cruzadas.
- **Toda consulta de domínio filtra por `terminalId` do usuário corrente.**

### Credenciais de demonstração (seed do back-end)

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@paehub.com | admin123 | Admin |
| diretor@tecon.com | estrategico123 | Estratégico |
| carlos@tecon.com | terminal123 | Tático (nativo) |
| joao@tecon.com | tatico123 | Tático |
| pedro@tecon.com | operacional123 | Operacional |
| bombeiro@gov.br | entity123 | Entidade Externa |

---

## 4. Fluxo de inicialização e sessão

1. **Subir back-end:** `pae-hub-api` → migrations + seed + `npm run start:dev` (porta 3001).
2. **Subir front-end:** `pae-hub-app` → `npm run dev` (porta 5173).
3. **Login** (`/login`): usuário informa email + senha → `POST /auth/login` →
   recebe `accessToken` + `refreshToken` (guardados no `localStorage`).
4. **Redirecionamento por perfil** ([defaultPathForUser](../src/lib/nav-config.ts)):
   - Operacional → `/meu-painel` (Fase 2; na prática, foco desta entrega é admin/tático).
   - Demais → `/dashboard`.
5. **Sessão ativa:** o `AppShell` monta sidebar + header + footer. O menu lateral é
   filtrado por papel/nível ([access-control](../src/lib/access-control.ts)) e por
   licenciamento do terminal ([modules](../src/lib/modules.ts)).
6. **Renovação de token:** qualquer `401` dispara `POST /auth/refresh` transparente e
   repete a requisição uma vez. Falha no refresh → logout.
7. **Logout:** limpa tokens e volta ao `/login`.

---

## 5. Fluxo dos cadastros base (a cadeia que habilita a operação)

A operação de emergência só funciona corretamente se os cadastros estiverem
encadeados. **Ordem lógica de configuração (feita pelo Admin):**

```
Terminais ──▶ Entidades ──▶ Usuários ──▶ Permissões ──▶ Níveis de Acesso ──▶ Acionamento de Entidades
 (tenant)     (externas)    (linkId)     (Entity↔Term)   (visibilidade)       (NotificationRule)
```

### 5.1 Terminais (`/terminais`)
- CRUD de unidades operacionais (tenant). Campos: nome, responsável, contato,
  endereço (CEP/rua/número/bairro/cidade/UF), lat/lng, status (Ativo/Inativo/Revisão).
- Geocodificação do endereço para coordenadas (usadas no COP e no Mapa).
- Endpoints: `GET/POST/PUT/DELETE /terminals`.

### 5.2 Entidades (`/entidades`)
- CRUD de órgãos externos (Bombeiros, IBAMA, Defesa Civil…). Campos: nome, tipo,
  contato, status.
- Endpoints: `GET/POST/PUT/DELETE /entities`.

### 5.3 Usuários (`/usuarios`)
- CRUD de usuários do sistema, com papel (`admin`/`terminal`/`entity`), vínculo
  (`linkId` → Terminal ou Entity), nível de acesso, gestor tático, telefone e
  listas de permissão granular (`allowedModules`, `allowedTerminals`, `allowedOccurrenceTypes`).
- Ativar/inativar/suspender e exclusão.
- Endpoints: `GET/POST/PUT /users`, `PATCH /users/:id/status`, `DELETE /users/:id`.

### 5.4 Permissões (`/permissoes`)
- Define quais **Terminais** cada **Entidade** enxerga (bridge N:N Entity↔Terminal).
- Endpoints: `GET /permissions`, `PUT /permissions/:entityId`.

### 5.5 Níveis de Acesso (`/niveis-de-acesso`)
- Autoridade dos toggles que controlam qual papel/nível vê cada item de menu
  (`isMenuAllowedForUser`). É o que rege a visibilidade do menu no `AppSidebar`.

### 5.6 Acionamento de Entidades (`/acionamento-entidades`)
- Regras de notificação (**NotificationRule**): por **tipo de ocorrência**, define
  qual **Entidade** é acionada e se o acionamento é **obrigatório** ou opcional.
- É o que determina, no momento da emergência, quais entidades recebem
  `EntityNotification` automaticamente.
- Endpoints: `GET/POST/DELETE /notification-rules`, `PATCH .../mandatory`.

> **Regra de negócio central:** `NotificationRule` + `Permission` juntas determinam
> quais entidades são acionadas ao abrir uma ocorrência.

---

## 6. Fluxo operacional — o coração do sistema

### 6.1 Centro de Operações — COP (`/centro-de-operacoes`)
Porta de entrada do operador na crise. Em uma tela:
- **Mapa Leaflet** com camadas operacionais sobrepostas.
- **Grid de 6 indicadores** (linha única no desktop) — `GET /dashboard/cop`,
  atualizado a cada 30s (até o Socket.IO assumir).
- **Lista de emergências ativas** (ocorrências com status `emergência ativa`).
- **Banner global pulsante** + **badge na sidebar** enquanto houver emergência ativa
  (itens `cop`, `occurrences`, `map`, `dashboard`).

### 6.2 Ocorrências (`/ocorrencias`) — PRIORIDADE
Registro estruturado de incidentes.
- Numeração sequencial **INC-####** (gerada pelo back).
- **Criticidade:** baixa / média / alta / crítica.
- **Status:** aberto → em atendimento → emergência ativa → resolvido.
- **Timeline imutável** com eventos tipados: ocorrência registrada, equipe acionada,
  plano ativado, entidade notificada, ação executada, atualização de status, resolvida.
- Chat por ocorrência entre Terminal e Entidades.
- Geração de **relatório PDF** do incidente com identidade M1.
- Endpoints: `GET/POST/PUT/DELETE /occurrences`, `PATCH .../status`,
  timeline / checklist / evidências.

### 6.3 Orquestração / Despacho de Emergência
Fluxo guiado de acionamento (Funcional §4.1), disparável pelo **botão vermelho no
header** ("Disparar Emergência") — visível para `admin` e `terminal`.

**Passo a passo esperado** ([EmergencyDispatchProvider](../src/app/layout/EmergencyDispatchProvider.tsx)):

1. Operador clica em **Disparar Emergência**.
2. Preenche **descrição** e escolhe **grau de severidade** (baixa/média/alta — obrigatório).
   Admin com >1 terminal escolhe também o terminal.
3. Sistema cria a ocorrência real via `POST /occurrences` com:
   - `status = 'emergência ativa'`
   - `criticality = severity` (a criticidade **segue** o grau escolhido — corrigido em 07/07).
   - `type = 'Emergência'`, INC-#### sequencial do back.
4. **Acionamento automático** no back: `NotificationRule × Permission` gera
   `EntityNotification` + eventos de timeline. O front recebe via Socket.IO.
5. **Banner global pulsa** e **badge da sidebar acende** para todos do terminal.
6. Abre-se a **Sala de Situação** (`/ocorrencias/:id/sala-de-situacao`) com checklist
   de 8 passos e timeline interativa.
7. Toast de confirmação `Emergência INC-#### disparada` + evento
   "plano de emergência ativado" na timeline.

### 6.4 Sala de Situação (Situation Room)
- Checklist de **8 passos** de condução da emergência.
- Timeline interativa (eventos imutáveis, com autor e data/hora).
- Chat Terminal ↔ Entidades.
- Acompanhamento das notificações de entidade: Notificada → Em Atendimento → Confirmada.
- Integração Google Maps/Waze para roteamento até as coordenadas do terminal.

### 6.5 Atendimento e resolução
1. Cada ação executada gera evento na timeline (autor, data/hora, descrição).
2. Entidades atualizam status: Notificada → Em Atendimento → Confirmada.
3. Chat conecta Terminal e Entidades.
4. Ao concluir, status muda para **resolvido** → banner/badge apagam → relatório PDF gerado.

### 6.6 Mapa de Emergência (`/mapa-de-emergencia`)
- Camadas: equipamentos de combate a incêndio, hidrantes, rotas de evacuação,
  áreas de risco, pontos de encontro (`MapElement`).
- Heatmap de incidentes (Canvas) para análise histórica.
- Modais críticos elevados a `z-[9999]` sobre o Leaflet.

### 6.7 Riscos (`/riscos`)
- Inventário de riscos por terminal e área: nível (baixo/médio/alto), descrição,
  área afetada, data de avaliação. Base para planos e indicadores do COP.

### 6.8 Planos de Ação — Plano de Emergência (`/planos-de-acao`)
- Templates de procedimentos por terminal, com checklist executável passo a passo,
  responsável, status (ativo/inativo/em revisão) e histórico.

### 6.9 Crachá do PAE (`/cracha-do-pae`)
Ponto de partida do PAE — **listagem de usuários e contatos para comunicação rápida**.
- Cards de contato de usuários reais (`GET /users/contacts`), responsáveis de
  terminais e entidades externas ativas.
- Atalhos fixos de emergência (193, 199, IBAMA 0800).
- **Contato direto via WhatsApp**: o botão gera link `https://wa.me/55...`
  ([BadgePage](../src/modules/emergency/pages/BadgePage.tsx)) — **o "ligar" direciona
  para o WhatsApp**, conforme requisito da Fase 1.
- Botões auxiliares: e-mail (`mailto:`) e copiar contato.
- Respeita o **Modo Apresentação** (mascara nome/telefone/e-mail e desativa os links).

### 6.10 Dashboard (`/dashboard`) — parcial
- Visão executiva consolidada (KPIs, win rates, agregados) via `GET /dashboard/kpis`.
- **Entrega parcial:** os números aparecem conforme os dados forem sendo produzidos
  pelas demais telas (ocorrências, riscos, etc.). Sem dados → zeros/estado vazio
  coerente (não deve quebrar).

---

## 7. Recursos transversais (Fase 1)

- **Global Search (Ctrl+K):** paleta de comandos para navegação rápida entre telas.
- **Presentation Mode:** mascara dados sensíveis (nomes, e-mails, telefones) para
  demonstrações públicas; desativa ações externas (WhatsApp/e-mail) enquanto ativo.
- **Banner + badge de emergência ativa:** refletem em tempo (quase) real o estado das
  ocorrências.
- **Scrollbars personalizados:** identidade visual M1 (destaque vermelho no hover),
  na área principal e na sidebar.

---

## 8. Identidade visual e sinalização

- Paleta oficial: **vermelho M1 `#C8102E`**, preto `#111`, branco — sem cores secundárias.
- Rounding de 12px em cards, modais e botões.
- Sinalização de criticidade: **verde** (informativo) · **amarelo** (atenção) ·
  **vermelho** (crítico, ação imediata).
- Mobile: botões 44–48px; emergência com hold-to-confirm de 2s.

---

## 9. Jornada crítica ponta a ponta (resumo)

O caminho que valida o sistema como um todo:

```
Login (admin)
  └─▶ Cadastra Terminal ──▶ Cadastra Entidade (Bombeiros) ──▶ Cadastra Usuário tático
        └─▶ Define Permission (Entidade ↔ Terminal)
              └─▶ Cria NotificationRule (tipo "Emergência" ⇒ Bombeiros, obrigatória)
                    │
Login (tático do terminal)
  └─▶ Abre COP (vê mapa + indicadores + emergências)
        └─▶ Dispara Emergência (descrição + severidade)
              └─▶ Ocorrência INC-#### criada, status "emergência ativa"
                    ├─▶ Bombeiros acionados automaticamente (EntityNotification)
                    ├─▶ Banner global pulsa + badge acende
                    └─▶ Sala de Situação abre (checklist 8 passos + timeline)
                          └─▶ Ações registradas na timeline
                                └─▶ Entidade: Notificada → Em Atendimento → Confirmada
                                      └─▶ Status "resolvido" ──▶ PDF do incidente
Login (entidade Bombeiros)
  └─▶ Vê apenas a ocorrência do terminal autorizado (isolamento)
Crachá do PAE
  └─▶ Contato rápido dos envolvidos via WhatsApp
Dashboard
  └─▶ Agregados refletem a ocorrência registrada
```

Esta jornada é a espinha dorsal do **Plano de Testes E2E** — ver
[plano-de-testes-e2e.md](plano-de-testes-e2e.md).

---

_© M1 — Documento de referência funcional. Versão Fase 1 (2026)._
