# M1 PAE Hub — Front-end

**Stack:** Vite + React 18 + TypeScript + shadcn/ui + Tailwind CSS

Interface web do M1 PAE Hub — plataforma de gestão de Plano de Ação de Emergência (PAE) para terminais portuários. Concentra o COP (Centro de Operações), ocorrências/emergências, salas de crise (War Room / Situation Room), orquestração de acionamentos, dashboards, segurança operacional, treinamentos, documentos e gestão de acesso.

> Atualmente a interface roda com **dados mock** (`src/lib/data.ts`). A integração
> com o back-end (`pae-api` / M1 PAE Hub API) está prevista e será feita por uma
> camada de serviços consumindo `http://localhost:3001/api/v1`.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20.x LTS |
| npm | 10.x |

---

## Instalação Rápida

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar em desenvolvimento (Vite)
npm run dev
```

A aplicação sobe em `http://localhost:8080`.

---

## Scripts

```bash
npm run dev          # Desenvolvimento com HMR
npm run build        # Build de produção
npm run build:dev    # Build em modo development
npm run preview      # Servir o build localmente
npm run lint         # ESLint
npm run test         # Testes unitários (Vitest)
npm run test:watch   # Vitest em watch
```

---

## Estrutura do Projeto

```
src/
  main.tsx                 ← Bootstrap React
  App.tsx                  ← Providers (React Query, Router, Tooltip, Toaster)
  index.css                ← Tailwind + tema
  pages/
    Index.tsx              ← Entrada da aplicação (monta o PAESystem)
    NotFound.tsx
  components/
    pae/                   ← Módulos de domínio da plataforma
      PAESystem.tsx        ← Shell principal / roteamento de views
      AppSidebar.tsx       ← Navegação lateral
      DashboardView.tsx    ← KPIs e visão geral
      COPView.tsx          ← Centro de Operações
      OccurrencesView.tsx  ← Ocorrências / emergências
      OrchestrationView.tsx← Orquestração de acionamentos
      SituationRoomView.tsx← Sala de crise
      AICommandView.tsx    ← AI Command
      ...                  ← Segurança, EPIs, Treinamentos, Documentos, Usuários, etc.
    ui/                    ← Componentes base (shadcn/ui)
  lib/
    data.ts                ← Dados mock atuais
    types.ts               ← Tipos de domínio
    auth-context.tsx       ← Contexto de autenticação
    access-control.ts      ← RBAC no cliente
    utils.ts
  hooks/                   ← Hooks reutilizáveis
  assets/                  ← Imagens e estáticos
  test/                    ← Setup e testes (Vitest)
public/                    ← favicon, robots.txt, estáticos públicos
```

---

## Integração com a API (planejada)

O back-end do projeto é o **M1 PAE Hub API** (NestJS + Prisma + PostgreSQL),
disponível em `http://localhost:3001/api/v1`. A integração substituirá os dados
mock de `src/lib/data.ts` por uma camada de serviços HTTP autenticada via JWT.

Quando ativada, a URL da API será configurada por variável de ambiente (`.env`):

```env
VITE_API_URL=http://localhost:3001
```
