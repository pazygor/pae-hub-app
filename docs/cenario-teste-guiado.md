# Cenário de Teste Guiado — "Princípio de incêndio no Terminal Granéis Santos Sul"

> Roteiro manual de ponta a ponta pela UI, logado como **admin**, cobrindo a
> **aplicação como um todo (v1)**: cadastros → permissão → regra → ocorrência →
> **acionamento automático** → condução multi-perfil → isolamento → resolução →
> PDF → contato rápido → **Documentos** → **Segurança Operacional** (Treinamentos,
> EPIs, Conformidade) → **Pendências & Meu Painel**.
>
> Espelha o "roteiro E2E consolidado" do
> [plano-de-testes-e2e.md](plano-de-testes-e2e.md). Versão para planilha:
> [cenario-teste-checklist.csv](cenario-teste-checklist.csv).

## Pré-requisitos

- Back-end (`pae-hub-api`) no ar em `http://localhost:3001/api` (migrado + seed).
- Front-end (`pae-hub-app`) no ar (`npm run dev`).
- Login inicial: **admin@paehub.com / admin123**.

> **Ordem obrigatória:** siga as Fases A→G na sequência. Permissão (A4) e Regra de
> Acionamento (A5) **precisam existir antes** da ocorrência (B), senão nenhuma
> entidade é acionada automaticamente. As Fases E–G (Documentos, Segurança
> Operacional, Pendências) reutilizam o mesmo terminal e usuários das Fases A–D.

---

## 1. Dados de exemplo (copiar e colar)

### 1.1 Terminal — tela `/terminais`
| Campo | Valor |
|-------|-------|
| Nome | `Terminal Granéis Santos Sul` |
| CEP | `11030-350` |
| Logradouro | `Av. Bartolomeu de Gusmão` |
| Número | `771` |
| Bairro | `Ponta da Praia` |
| Cidade | `Santos` |
| UF | `SP` |
| Responsável | `Marina Costa` |
| Contato | `(13) 3221-4500` |
| Lat / Lng (se manual) | `-23.9855` / `-46.3070` |
| Status | `Ativo` |

### 1.2 Entidade — tela `/entidades`
| Campo | Valor |
|-------|-------|
| Nome | `Corpo de Bombeiros – 15º GB` |
| Tipo | `Bombeiros` |
| Contato | `(13) 3226-1933` |
| Status | `Ativo` |

### 1.3 Usuários — tela `/usuarios`
> Use a mesma senha nos três para facilitar: **`Teste@123`** (ajuste se o formulário
> exigir outra complexidade).

| Nome | Email | Papel | Nível | Vínculo | Gestor Tático | Telefone |
|------|-------|-------|-------|---------|---------------|----------|
| `Marina Costa` | `marina.costa@granelsantos.com.br` | Terminal | **Tático** | Terminal Granéis Santos Sul | — | `(13) 98811-4500` |
| `Roberto Alves` | `roberto.alves@granelsantos.com.br` | Terminal | **Operacional** | Terminal Granéis Santos Sul | Marina Costa | `(13) 98822-7788` |
| `Sgt. Ricardo` | `ricardo.sgt@bombeiros.sp.gov.br` | Entidade | — | Corpo de Bombeiros – 15º GB | — | `(13) 98833-1515` |

### 1.4 Permissão — tela `/permissoes`
- Entidade **Corpo de Bombeiros – 15º GB** → marcar o terminal **Terminal Granéis Santos Sul** → salvar.

### 1.5 Regra de Acionamento — tela `/acionamento-entidades`
| Campo | Valor |
|-------|-------|
| Tipo de ocorrência | `Princípio de incêndio` |
| Entidade | `Corpo de Bombeiros – 15º GB` |
| Obrigatória | **Sim** |

### 1.6 Ocorrência — tela `/ocorrencias`
| Campo | Valor |
|-------|-------|
| Terminal | `Terminal Granéis Santos Sul` |
| Tipo | `Princípio de incêndio` |
| Criticidade | `Alta` |
| Responsável | `Marina Costa` |
| Descrição | `Princípio de incêndio detectado na moega de granel sólido do berço 3. Fumaça visível; brigada acionada para combate inicial.` |

### 1.7 Textos para timeline e chat
- Evento "equipe acionada": `Brigada de incêndio do terminal acionada para o berço 3.`
- Evento "ação executada": `Combate com extintores e linha de mangueira iniciado; área isolada.`
- Chat (Terminal): `Bombeiros, fumaça parcialmente controlada. Solicitamos apoio no berço 3.`
- Chat (Entidade): `Viatura a caminho, ETA 8 minutos. Mantenham a área isolada.`

### 1.8 Documento — tela `/documentos`
| Campo | Valor |
|-------|-------|
| Título | `Plano de Ação de Emergência — Granéis Santos Sul` |
| Tipo | `Plano de Ação de Emergência` |
| Terminal | `Terminal Granéis Santos Sul` |
| Descrição | `PAE consolidado do terminal: rotas de evacuação, brigada e contatos.` |
| Nome do arquivo | `pae-granel-santos-sul.pdf` |

### 1.9 Treinamento — tela `/seguranca/treinamentos`
| Campo | Valor |
|-------|-------|
| Nome | `Brigada de Incêndio — NR-23` |
| Descrição | `Combate a princípio de incêndio e uso de extintores.` |
| Obrigatório | **Sim** |
| Terminal | `Terminal Granéis Santos Sul` |
| Vídeo (opcional) | `https://exemplo.com/treinamento-nr23` |

**Atribuição:** atribua **somente à Marina Costa** (conclusão = hoje, validade = +1 ano).
**Não atribua ao Roberto** — é isso que gera a pendência testada na Fase G.

### 1.10 EPI — tela `/seguranca/epis`
| Campo | Valor |
|-------|-------|
| Nome | `Capacete de Segurança Classe B` |
| Tipo | `Proteção da Cabeça` |
| Validade | uma data futura (ex.: +1 ano) |
| Terminal | `Terminal Granéis Santos Sul` |
| Descrição | `Capacete para circulação na área operacional.` |

**Entrega (botão "Entregar EPI"):** entregar ao **Roberto Alves** — data de entrega = hoje,
validade = **próxima (ex.: +20 dias)** para gerar alerta de vencimento, responsável = `Marina Costa`.

### 1.11 Conformidade — tela `/seguranca/conformidade`
| Campo | Valor |
|-------|-------|
| Descrição do item | `Inspeção dos extintores do berço 3` |
| Responsável | `Marina Costa` |
| Status | `Não conforme` |
| Área | `Berço 3` |
| Terminal | `Terminal Granéis Santos Sul` |
| Data de verificação | hoje |
| Validade | data futura |
| Notas | `Recarga vencida em 2 extintores; substituição solicitada.` |

---

## 2. Roteiro passo a passo (checklist)

Marque `[x]` conforme concluir. A coluna **Caso** referencia o plano E2E.

### Fase A — Montar o cenário (logado como **admin**)

- [ ] **A1** `/terminais` → **Novo** → dados de 1.1 → **Localizar** (CEP autofill) → salvar.
  _Esperado:_ terminal na lista, **Ativo**, com lat/lng preenchidas. **(S2.1)**
- [ ] **A2** `/entidades` → **Nova** → dados de 1.2 → salvar.
  _Esperado:_ entidade na lista, status **Ativo**. **(S2.4)**
- [ ] **A3** `/usuarios` → criar os 3 usuários de 1.3.
  _Esperado:_ 3 usuários listados; vínculos e níveis corretos. **(S2.5)**
- [ ] **A4** `/permissoes` → Bombeiros 15º GB → marcar o terminal → salvar.
  _Esperado:_ vínculo salvo (Bombeiros passa a "ver" o terminal). **(S2.7)**
- [ ] **A5** `/acionamento-entidades` → **Nova regra** → dados de 1.5 (Obrigatória).
  _Esperado:_ regra listada, agrupada por "Princípio de incêndio". **(S2.9)**

### Fase B — Criar a ocorrência e disparar o acionamento (**admin**)

- [ ] **B1** `/ocorrencias` → **Nova** → dados de 1.6 → registrar.
  _Esperado:_ ocorrência **INC-####** criada; timeline nasce com "ocorrência
  registrada". **(S4.2)**
- [ ] **B2** Abrir a ocorrência criada.
  _Esperado:_ **Bombeiros acionados automaticamente** — evento **"entidade
  notificada"** na timeline; notificação da entidade com status **Notificada**. **(S5.4)**
- [ ] **B3** Conferir criticidade.
  _Esperado:_ badge exibe **Alta** (não fixa "alta" indevida). **(S4.9)**

> **Alternativa (emergência):** em vez de B1, use o botão vermelho **Disparar
> Emergência** no header (descrição + severidade). Cria status **"emergência ativa"**,
> abre a **Sala de Situação**, e faz **banner + badge** acenderem **(S5.3/S5.5/S5.6)**.
> Obs.: o despacho grava tipo `Emergência` — para acionar por regra, crie também uma
> regra `Emergência → Bombeiros`.

### Fase C — Conduzir e responder (troca de perfil)

- [ ] **C1** Sair e entrar como **Marina Costa** (tático).
  _Esperado:_ vê `/centro-de-operacoes` (COP) com a ocorrência; menu de tático. **(S3.1)**
- [ ] **C2** Abrir a ocorrência / Sala de Situação → marcar itens do **checklist de 8
  passos**; adicionar eventos "equipe acionada" e "ação executada" (textos de 1.7).
  _Esperado:_ progresso salvo; timeline registra as ações (imutável). **(S6.1/S4.5)**
- [ ] **C3** Enviar a mensagem do Terminal no **chat** (1.7).
  _Esperado:_ mensagem com autor/horário. **(S4.7)**
- [ ] **C4** Sair e entrar como **Sgt. Ricardo** (entidade).
  _Esperado (isolamento):_ vê **apenas** a ocorrência do terminal autorizado. **(S10.2)**
- [ ] **C5** Atualizar o status da notificação **Notificada → Em Atendimento →
  Confirmada**; responder no chat (1.7).
  _Esperado:_ status evolui; resposta aparece no chat. **(S6.2/S6.3)**

### Fase D — Encerrar e verificar (**tático** ou **admin**)

- [ ] **D1** Mudar o status da ocorrência para **resolvido** (comentário opcional).
  _Esperado:_ evento "ocorrência resolvida" na timeline; banner/badge apagam. **(S6.5)**
- [ ] **D2** Gerar o **relatório PDF** do incidente.
  _Esperado:_ PDF com identidade M1 e dados corretos. **(S4.8)**
- [ ] **D3** `/cracha-do-pae` → achar Marina/Sgt. Ricardo → botão **WhatsApp**.
  _Esperado:_ abre `https://wa.me/55...` com o número do contato. **(S8.2)**
- [ ] **D4** `/dashboard` e `/centro-de-operacoes`.
  _Esperado:_ agregados/indicadores refletem a ocorrência registrada/resolvida. **(S3.2)**

### Fase E — Documentos (**admin**)

- [ ] **E1** `/documentos` → **Novo Documento** → dados de 1.8 → salvar.
  _Esperado:_ documento listado com o tipo "Plano de Ação de Emergência"; filtrável
  por tipo; persiste após F5. **(S12.1)**

### Fase F — Segurança Operacional (**admin**)

- [ ] **F1** `/seguranca/treinamentos` → **Novo** → dados de 1.9 (Obrigatório = Sim) →
  salvar → **Atribuir** o treinamento à **Marina Costa** (conclusão + validade).
  _Esperado:_ treinamento criado e marcado obrigatório; Marina com atribuição
  **válida**; Roberto **sem** atribuição (fica pendente). **(S11.1)**
- [ ] **F2** `/seguranca/epis` → **Cadastrar Novo EPI** → dados de 1.10 → salvar →
  **Entregar EPI** ao **Roberto Alves** (validade próxima).
  _Esperado:_ EPI cadastrado; entrega ao Roberto com status/validade corretos. **(S11.2)**
- [ ] **F3** `/seguranca/conformidade` → **Novo Item** → dados de 1.11 (Não conforme) →
  salvar.
  _Esperado:_ item listado como **Não conforme**, com responsável e área. **(S11.3)**
- [ ] **F4** `/seguranca` (Visão Geral — só admin).
  _Esperado:_ indicadores do **Centro de Segurança Operacional** agregam
  Treinamentos/EPIs/Conformidade recém-criados. **(S11.4)**

### Fase G — Pendências e Meu Painel (troca de perfil)

- [ ] **G1** Sair e entrar como **Roberto Alves** (operacional).
  _Esperado:_ o **modal "Pendências Operacionais"** aparece logo após o login,
  listando o **treinamento obrigatório pendente** (e o EPI a vencer). **(S13.1)**
- [ ] **G2** Roberto → **Meu Painel** (`/meu-painel`).
  _Esperado:_ vê seus **Treinamentos** (com "Concluir"), **EPIs** (com confirmar) e
  **Conformidade**; concluir o treinamento **remove a pendência**. **(S13.2)**
- [ ] **G3** _(opcional)_ Entrar como **Marina Costa**.
  _Esperado:_ o modal de pendências **não** lista o treinamento (ela já concluiu) —
  valida o cálculo de pendência **por usuário**. **(S13.3)**

### Verificações transversais (a qualquer momento)

- [ ] **T1** Menu **mostra todos os módulos do v1**, incluindo **Meu Painel**,
  **Documentos** e a seção **Segurança Operacional** (Visão Geral, Treinamentos,
  EPIs, Conformidade). **(S9.1)**
- [ ] **T2** Tela de login **não** mostra "Acessar demonstração" (segue oculto a pedido do gestor).
- [ ] **T3** Scrollbars personalizados (hover vermelho) na área principal e na sidebar. **(S10.5)**
- [ ] **T4** Ativar **Modo Apresentação** → nomes/telefones/e-mails mascarados no Crachá. **(S8.6)**

---

## 3. Critérios de sucesso do cenário

- ✅ Ocorrência criada gera **INC-####**, timeline imutável e **aciona a entidade
  automaticamente** (Fase B).
- ✅ Cada perfil vê só o que lhe compete (**isolamento** — Fase C).
- ✅ Dados **persistem** após F5 e re-login.
- ✅ Resolução gera PDF; Crachá abre WhatsApp; Dashboard reflete os números.
- ✅ **Segurança Operacional, Documentos e Meu Painel** funcionam de ponta a ponta
  (criar treinamento/EPI/conformidade/documento, gerar pendência, ver em Meu Painel).
- ✅ Todos os módulos do v1 aparecem no menu; só o "Acessar demonstração" do login
  segue oculto (pedido do gestor).

---

## Notas e possíveis achados

- **Roberto Alves (operacional)**: agora é peça central da **Fase G** — o "Meu Painel"
  entrou no v1. Logar como ele valida o modal de pendências e o painel pessoal.
- **Segurança Operacional / Documentos / Meu Painel** voltaram ao menu por exigência
  dos acionistas, mas **não passaram pela validação de integração** que o núcleo já
  teve. As Fases E–G existem justamente para essa validação — trate qualquer
  divergência do "Esperado" como **achado** a corrigir.
- Se em C5 o controle de status da notificação da entidade não estiver visível na UI,
  anote como **achado** (é comportamento a validar na sua versão).
- Se o CEP-autofill trouxer um logradouro diferente do de 1.1, é o registro oficial —
  mantenha ou ajuste; o que importa são coordenadas válidas.

---

_© M1 — Cenário de teste guiado, Fase 1 (2026). Complementa o
[plano-de-testes-e2e.md](plano-de-testes-e2e.md)._
