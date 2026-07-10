# M1 PAE Hub — Plano de Testes de Ponta a Ponta (E2E)

> Plano de testes do **core central** da plataforma para a **primeira entrega (Fase 1)**,
> validando a integração real **front-end (`pae-hub-app`) ↔ back-end (`pae-hub-api`)**.
>
> Referência funcional: [fluxo-de-funcionamento.md](fluxo-de-funcionamento.md).
> Escopo alinhado à definição de telas da Fase 1.

---

## 1. Objetivo

Garantir que o núcleo do sistema funciona de ponta a ponta com dados reais persistidos:
autenticação/RBAC, cadastros base encadeados, e o ciclo operacional de emergência
(COP → Ocorrência → Orquestração → Sala de Situação → Resolução), respeitando o
**isolamento multi-tenant** e a **rastreabilidade** (timeline imutável).

## 2. Escopo

### Dentro do escopo (Fase 1)
Autenticação · Usuários · Permissões · Níveis de Acesso · Terminais · Entidades ·
Acionamento de Entidades · Dashboard (parcial) · **COP** · Orquestração · Riscos ·
Planos de Ação · **Ocorrências (prioridade)** · Mapa de Emergência · Crachá do PAE
(WhatsApp) · recursos transversais (Global Search, Presentation Mode, isolamento).

### Fora do escopo (Fase 2 — não testar como entrega)
Meu Painel · AI Command · Documentos · Segurança Operacional (Treinamentos, EPIs,
Conformidade) · modal de Pendências Operacionais. Para estes, o único teste é de
**regressão de ocultação** (suíte S9): confirmar que **não aparecem** no menu.

---

## 3. Pré-condições e ambiente

| Item | Configuração |
|------|--------------|
| Back-end | `pae-hub-api` no ar (`npm run start:dev`) em `http://localhost:3001/api` |
| Banco | PostgreSQL migrado (`prisma migrate`) e semeado (`npm run prisma:seed`) |
| Front-end | `pae-hub-app` (`npm run dev`), `VITE_API_URL=http://localhost:3001/api` |
| Swagger | `http://localhost:3001/api/docs` (apoio à verificação de endpoints) |
| Navegador | Chrome/Edge atualizado; testar também viewport mobile (≤780px) |

**Credenciais (seed):**

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@paehub.com | admin123 | Admin |
| diretor@tecon.com | estrategico123 | Estratégico |
| carlos@tecon.com | terminal123 | Tático |
| joao@tecon.com | tatico123 | Tático |
| pedro@tecon.com | operacional123 | Operacional |
| bombeiro@gov.br | entity123 | Entidade Externa |

**Convenções de resultado:** cada caso define _pré-condição → passos → resultado
esperado_. "Integração" indica o endpoint exercitado; "Persistência" quando o dado
deve sobreviver a um refresh (F5). Prioridades: **P0** (bloqueia entrega), **P1**
(importante), **P2** (desejável).

---

## 4. Matriz de cobertura por perfil

| Área | Admin | Tático (terminal) | Estratégico | Entidade |
|------|:---:|:---:|:---:|:---:|
| Login / logout | ✓ | ✓ | ✓ | ✓ |
| Cadastros base (CRUD) | ✓ | — (leitura) | — | — |
| COP | ✓ | ✓ | ✓ (leitura) | parcial |
| Ocorrências / Orquestração | ✓ | ✓ | leitura | leitura do que lhe compete |
| Mapa / Riscos / Planos | ✓ | ✓ | leitura | — |
| Crachá do PAE | ✓ | ✓ | ✓ | ✓ |
| Isolamento multi-tenant | valida | valida | valida | valida |

---

## 5. Suítes de teste

### S1 — Autenticação, sessão e RBAC (P0)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S1.1 | Login válido | Informar admin@paehub.com / admin123 → Entrar | Redireciona para `/dashboard`; tokens no `localStorage` (`pae.accessToken`/`pae.refreshToken`) | `POST /auth/login` |
| S1.2 | Login inválido | Senha errada | Mensagem de erro clara; permanece no `/login`; sem token | `POST /auth/login` → 401 |
| S1.3 | Rota protegida sem sessão | Acessar `/ocorrencias` sem login | Redireciona para `/login` | `RequireAuth` |
| S1.4 | Refresh automático | Expirar/adulterar access token e navegar | Requisição repetida após `POST /auth/refresh`; sessão continua | `POST /auth/refresh` |
| S1.5 | Refresh inválido | Invalidar refresh token e navegar | Logout automático → `/login` | — |
| S1.6 | Menu por perfil | Logar como cada perfil | Sidebar mostra só itens permitidos ao papel/nível | `access-control` |
| S1.7 | Guard de acesso por rota | Como tático, abrir URL só-admin (ex.: `/usuarios`) | Bloqueio/redirect coerente (`RequireAccess`) | `RequireAccess` |
| S1.8 | Logout | Clicar em "Sair do Sistema" | Tokens limpos; volta ao `/login`; back não navegável | — |

### S2 — Cadastros base (P0) — a cadeia que habilita a operação

Ordem recomendada: **Terminais → Entidades → Usuários → Permissões → Níveis de Acesso → Acionamento**.

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S2.1 | Criar Terminal | `/terminais` → Novo → preencher nome/responsável/contato/endereço → salvar | Terminal listado; endereço geocodificado (lat/lng); persiste após F5 | `POST /terminals` |
| S2.2 | Editar Terminal | Editar um campo → salvar | Alteração refletida na lista e após F5 | `PUT /terminals/:id` |
| S2.3 | Inativar/Excluir Terminal | Alterar status / excluir | Some ou muda status; registros satélites perdem visibilidade | `DELETE /terminals/:id` |
| S2.4 | Criar Entidade | `/entidades` → Nova (ex.: "Corpo de Bombeiros", tipo, contato, Ativo) | Entidade listada; persiste após F5 | `POST /entities` |
| S2.5 | Criar Usuário tático | `/usuarios` → Novo → papel `terminal`, nível `tático`, vínculo ao terminal, telefone | Usuário listado; login possível com a senha definida | `POST /users` |
| S2.6 | Editar / status Usuário | Editar dados; ativar/inativar/suspender | Estado refletido; usuário suspenso não loga | `PUT /users/:id`, `PATCH /users/:id/status` |
| S2.7 | Definir Permission | `/permissoes` → escolher Entidade → marcar Terminais autorizados → salvar | Vínculo salvo; entidade passa a "ver" só esses terminais | `PUT /permissions/:entityId` |
| S2.8 | Níveis de Acesso | `/niveis-de-acesso` → alternar visibilidade de um item para um nível | Menu do perfil afetado reflete a mudança | `access-control` |
| S2.9 | Acionamento de Entidades | `/acionamento-entidades` → nova regra: tipo "Emergência" ⇒ Bombeiros, **obrigatória** | Regra listada; marca obrigatória/opcional | `POST /notification-rules`, `PATCH .../mandatory` |
| S2.10 | Validação de formulário | Salvar cadastro com campo obrigatório vazio | Bloqueio com mensagem; nada é enviado | — |

### S3 — Centro de Operações — COP (P0) — coração do sistema

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S3.1 | Abrir COP | `/centro-de-operacoes` | Carrega mapa Leaflet + grid de 6 indicadores + lista de emergências ativas | `GET /dashboard/cop` |
| S3.2 | Indicadores | Observar os 6 cards | Números coerentes com os dados reais; sem dados → zeros, sem quebra | `GET /dashboard/cop` |
| S3.3 | Atualização quase-real | Criar/mudar ocorrência em outra aba | COP reflete em até ~30s (refetch) ou via Socket.IO | polling 30s / realtime |
| S3.4 | Mapa no COP | Verificar terminais/elementos plotados | Marcadores nas coordenadas corretas | `GET /map-elements` |

### S4 — Ocorrências (P0 — PRIORIDADE)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S4.1 | Listar ocorrências | `/ocorrencias` | Lista com INC-####, criticidade e status; filtra por terminal do usuário | `GET /occurrences` |
| S4.2 | Criar ocorrência | Nova → tipo/descrição/criticidade → salvar | INC-#### sequencial gerado pelo back; status inicial coerente | `POST /occurrences` |
| S4.3 | Detalhe + timeline | Abrir uma ocorrência | Timeline imutável exibida em ordem; eventos tipados com autor e data/hora | `GET /occurrences/:id` |
| S4.4 | Mudar status | Alterar aberto → em atendimento → resolvido | Cada transição gera evento na timeline; badges atualizam | `PATCH /occurrences/:id/status` |
| S4.5 | Adicionar evento/ação | Registrar ação executada | Novo evento imutável na timeline (não editável/removível) | `POST .../timeline` |
| S4.6 | Checklist da ocorrência | Adicionar item / marcar concluído | Estado do checklist persistido | checklist endpoints |
| S4.7 | Chat da ocorrência | Enviar mensagem | Mensagem aparece com autor/horário; visível às partes | `GET/POST /chat` |
| S4.8 | Relatório PDF | Gerar relatório do incidente | PDF baixado com identidade M1 e dados corretos | jsPDF (client) |
| S4.9 | Criticidade correta | Criar com criticidade "baixa" | Badge exibe "baixa" (não fixa "alta") — regressão do bug 07/07 | — |

### S5 — Orquestração / Despacho de Emergência (P0)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S5.1 | Botão de despacho | Como admin/tático, ver header | Botão vermelho "Disparar Emergência" presente | — |
| S5.2 | Severidade obrigatória | Abrir modal, tentar disparar sem descrição | Botão desabilitado até descrição preenchida | — |
| S5.3 | Disparo completo | Descrição + severidade "alta" → Disparar | Ocorrência criada, `status='emergência ativa'`, `criticality=severity`; toast INC-#### | `POST /occurrences` |
| S5.4 | Acionamento automático | Após S5.3 (regra Bombeiros obrigatória de S2.9) | `EntityNotification` de Bombeiros criada; evento "entidade notificada" na timeline | back: NotificationRule × Permission |
| S5.5 | Banner + badge | Após disparo | Banner global pulsa + badge acende na sidebar (cop/ocorrências/mapa/dashboard) | `useActiveEmergencies` |
| S5.6 | Sala de Situação | Após disparo | Redireciona para `/ocorrencias/:id/sala-de-situacao` com checklist de 8 passos | — |
| S5.7 | Terminal do admin | Como admin com >1 terminal | Modal exige escolher o terminal antes de disparar | — |
| S5.8 | Severidade → criticidade | Disparar com "baixa" | Criticidade exibida "baixa" (segue a severidade) | — |

### S6 — Sala de Situação e resolução (P1)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S6.1 | Checklist 8 passos | Marcar passos | Progresso persistido; timeline registra ações | checklist/timeline |
| S6.2 | Status da entidade | Atualizar notificação | Notificada → Em Atendimento → Confirmada refletido | `PATCH /entity-notifications/:id` |
| S6.3 | Chat na sala | Trocar mensagens Terminal↔Entidade | Mensagens em tempo (quase) real | `GET/POST /chat` |
| S6.4 | Roteamento | Acionar rota | Abre Google Maps/Waze nas coordenadas do terminal | link externo |
| S6.5 | Resolver | Concluir a emergência | Status "resolvido"; banner/badge apagam; PDF disponível | `PATCH .../status` |

### S7 — Mapa, Riscos, Planos (P1)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S7.1 | Mapa de Emergência | `/mapa-de-emergencia` | Camadas (extintores, hidrantes, rotas, áreas de risco, pontos de encontro) renderizam | `GET /map-elements` |
| S7.2 | Elemento de mapa CRUD | Criar/editar/remover elemento | Marcador reflete na hora e após F5 | `POST/PUT/DELETE /map-elements` |
| S7.3 | Heatmap | Abrir camada de incidentes | Heatmap em Canvas coerente com histórico | — |
| S7.4 | Riscos CRUD | `/riscos` → criar risco (nível/área/data) | Listado; alimenta indicadores do COP | `POST/PUT/DELETE /risks` |
| S7.5 | Planos CRUD | `/planos-de-acao` → criar plano com checklist | Salvo com responsável e status | `POST/PUT/DELETE /plans` |

### S8 — Crachá do PAE e comunicação (P1)

| # | Caso | Passos | Resultado esperado | Integração |
|---|------|--------|--------------------|------------|
| S8.1 | Listagem de contatos | `/cracha-do-pae` | Cards de usuários, responsáveis de terminal e entidades ativas | `GET /users/contacts` |
| S8.2 | **WhatsApp** | Clicar em "WhatsApp" de um contato | Abre `https://wa.me/55...` com o número do contato em nova aba | link `wa.me` |
| S8.3 | Atalhos de emergência | Clicar em 193/199/IBAMA | Dispara `tel:` do número | — |
| S8.4 | E-mail / copiar | Botões auxiliares | `mailto:` abre; "Copiar" copia o contato formatado | — |
| S8.5 | Busca | Filtrar por nome/função/vínculo | Lista filtra corretamente | — |
| S8.6 | Modo Apresentação | Ativar e revisitar | Nome/telefone/e-mail mascarados; WhatsApp/e-mail desativados | `presentation-mode` |

### S9 — Regressão da ocultação Fase 1 (P0)

| # | Caso | Resultado esperado |
|---|------|--------------------|
| S9.1 | Menu lateral | **Não** exibe "Meu Painel", "Documentos" nem a seção "Segurança Operacional" (Visão Geral/Treinamentos/EPIs/Conformidade) |
| S9.2 | Cabeçalho de seção | O título "Segurança Operacional" **não** é renderizado (sem título órfão) |
| S9.3 | Modal pós-login | O modal "Pendências Operacionais" **não** aparece após o login |
| S9.4 | Build limpo | `tsc --noEmit` e `npm run build` sem erros (nenhum import órfão) |

### S10 — Isolamento multi-tenant e transversais (P0/P1)

| # | Caso | Passos | Resultado esperado |
|---|------|--------|--------------------|
| S10.1 | Isolamento terminal | Logar como tático do Terminal A | Vê apenas ocorrências/riscos/planos/mapa do Terminal A |
| S10.2 | Isolamento entidade | Logar como Bombeiros | Vê apenas terminais autorizados via Permission |
| S10.3 | Vínculo tático→operacional | Operacional vê seu gestor (`tacticalManagerId`) | Organograma/vínculo coerente |
| S10.4 | Global Search (Ctrl+K) | Abrir paleta e navegar | Vai à tela escolhida; só sugere telas permitidas |
| S10.5 | Scrollbars | Rolar conteúdo e menu | Scrollbar customizada (hover vermelho); sidebar com variante escura |
| S10.6 | Mobile | Viewport ≤780px | Painel mobile de ações; hold-to-confirm de 2s para emergência |

---

## 6. Fluxo E2E consolidado (caminho crítico — happy path)

Executar como um roteiro único, ponta a ponta:

1. **Admin** loga (S1.1).
2. Admin cria **Terminal** "Tecon Teste" (S2.1) → **Entidade** "Bombeiros" (S2.4) →
   **Usuário** tático vinculado ao terminal (S2.5).
3. Admin define **Permission** Bombeiros ↔ Tecon Teste (S2.7) e **NotificationRule**
   "Emergência ⇒ Bombeiros (obrigatória)" (S2.9).
4. **Tático** loga; abre o **COP** e confere indicadores/mapa (S3.1).
5. Tático **dispara emergência** (descrição + severidade) → INC-#### criada,
   "emergência ativa" (S5.3).
6. **Bombeiros acionados automaticamente**; banner pulsa + badge acende (S5.4, S5.5).
7. **Sala de Situação** abre; tático conduz checklist, registra ações na timeline e
   troca mensagens no chat (S6.1–S6.3).
8. **Entidade** loga como Bombeiros e confirma que vê **somente** a ocorrência do
   terminal autorizado (S10.2), atualizando o status da notificação (S6.2).
9. Tático **resolve** a ocorrência → banner/badge apagam → gera **PDF** (S6.5, S4.8).
10. **Crachá do PAE**: contato rápido de um envolvido via **WhatsApp** (S8.2).
11. **Dashboard/COP** refletem a ocorrência registrada nos agregados (S3.2).

**Sucesso do E2E:** todos os passos concluem sem erro, os dados **persistem após F5**,
a **timeline permanece imutável** e o **isolamento** é respeitado em cada perfil.

---

## 7. Critérios de aceite da Fase 1

- ✅ 100% dos casos **P0** aprovados (S1, S2, S3, S4, S5, S9, isolamento S10.1/S10.2).
- ✅ Fluxo E2E consolidado (seção 6) executado de ponta a ponta com sucesso.
- ✅ Dados criados via UI **persistidos** no PostgreSQL (sobrevivem a refresh e re-login).
- ✅ Nenhum item de Fase 2 visível no menu (S9).
- ✅ `npm run build` e `tsc --noEmit` sem erros; `npm run lint` sem erros novos.
- ⚠️ Casos P1/P2 pendentes registrados como known issues (não bloqueiam a entrega).

---

## 8. Registro de execução (modelo)

| Caso | Perfil | Resultado (Pass/Fail) | Evidência | Observação |
|------|--------|-----------------------|-----------|------------|
| S1.1 | Admin | | | |
| S2.1 | Admin | | | |
| S5.3 | Tático | | | |
| … | | | | |

---

_© M1 — Plano de Testes E2E, Fase 1 (2026). Complementa
[fluxo-de-funcionamento.md](fluxo-de-funcionamento.md)._
