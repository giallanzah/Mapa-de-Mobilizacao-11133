# Mapa de Mobilização — 11.133

Mapa público de mobilização da campanha do Pastor Daniel de Castro (candidato 11.133, Distrito Federal): encontra igrejas evangélicas no DF, conecta voluntários aos grupos de WhatsApp de cada uma, e permite registrar e aprovar distribuição de flyers por região.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — roda a API (requer `PORT` definido, ex. `PORT=5000`)
- `pnpm run typecheck` — typecheck completo de todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks/schemas Zod a partir do OpenAPI spec (`lib/api-spec/openapi.yaml`)
- `pnpm --filter @workspace/db run push` — aplica mudanças de schema no banco (dev only)
- `bash scripts/post-merge.sh` — reinstala deps e aplica schema do banco; rode depois de um `git pull`/merge que trouxe mudanças de dependências ou schema

Env obrigatórias:
- `DATABASE_URL` — string de conexão Postgres (obrigatória, o processo derruba se faltar)
- `PORT` — porta da API (obrigatória, o processo derruba se faltar)
- `MAPBOX_PUBLIC_TOKEN` — servido ao frontend via `GET /api/map-config`; sem ele o mapa cai no modo fallback (grid estático em vez de Mapbox)
- `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` — autenticação da área de coordenação (Clerk); se ausente, a coordenação fica sem login (modo aberto) e a UI mostra um aviso de "Clerk não conectado"
- `VITE_CLERK_PROXY_URL` — proxy do Clerk (o backend expõe `clerkProxyMiddleware` para isso)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, autenticação via Clerk (`@clerk/express`), logs via Pino
- DB: PostgreSQL + Drizzle ORM (`drizzle-zod` para schemas derivados)
- Validação: Zod (`zod/v4`)
- API codegen: Orval (OpenAPI → Zod schemas + hooks React Query)
- Frontend: React 19, Vite 7, Tailwind CSS 4, wouter (roteamento), TanStack Query, Mapbox GL JS, shadcn/ui, Clerk (`@clerk/react`)
- Build: esbuild (bundle CJS da API)

## Where things live

- `artifacts/mobilizacao-11133/` — frontend (SPA React). Toda a UI está em `src/App.tsx` (single-file, sem separação por rota); componentes shadcn/ui em `src/components/ui/`
- `artifacts/api-server/` — API Express
  - `src/routes/mobilization.ts` — todas as rotas de negócio (igrejas, relatórios de flyer, sinalização de problemas, fila de coordenação)
  - `src/data/igrejas-evangelicas-df.md` — fonte de dados: markdown tabulado por Região Administrativa (RA), usado para popular o banco na primeira request (`ensureSeeded`)
  - `src/middlewares/clerkProxyMiddleware.ts` — proxy que permite Clerk funcionar atrás de múltiplos domínios/publishable keys
- `artifacts/mockup-sandbox/` — sandbox de protótipo/mockup, não faz parte do app publicado
- `lib/db/` — schema Drizzle (`src/schema/mobilization.ts`: tabelas `churches`, `flyer_reports`, `issue_reports`) e client (`src/index.ts`)
- `lib/api-spec/openapi.yaml` — contrato fonte-da-verdade da API; roda o Orval (`orval.config.ts`) para gerar:
  - `lib/api-zod/` — tipos e schemas Zod gerados
  - `lib/api-client-react/` — hooks React Query gerados, consumidos pelo frontend
- `scripts/post-merge.sh` — hook de pós-merge (install + db push)

## Architecture decisions

- **Contrato-first via OpenAPI + Orval**: o schema `openapi.yaml` em `lib/api-spec` é a fonte da verdade; tipos Zod e hooks do frontend são gerados a partir dele, não escritos à mão — mudar a API significa editar o spec e rodar `codegen`.
- **Seed lazy do banco**: `ensureSeeded()` em `mobilization.ts` popula a tabela `churches` a partir do markdown na primeira requisição a qualquer rota (não há migration de seed) — o markdown é lido de dois caminhos possíveis porque o `cwd` do processo difere entre dev e produção.
- **Status da igreja é derivado, não persistido diretamente na resposta**: `serializeChurch` recalcula `status` (`no_group` / `group_ready` / `action_done`) a partir de `flyersConfirmed`, `whatsappUrl` **e** `coordinatorClerkId` a cada leitura, mesmo a coluna `status` existindo na tabela — uma igreja só é `group_ready` com WhatsApp **e** coordenador designados.
- **Papel de admin via `publicMetadata.role` do Clerk**: não existe tabela de usuários/papéis própria. `requireAdmin` (em `mobilization.ts`) busca o usuário no Clerk (`clerkClient.users.getUser`) e checa `publicMetadata.role === "admin"`; o frontend faz a mesma checagem client-side via `useUser()` para mostrar o painel de admin. Isso significa que o primeiro admin **precisa ser definido manualmente** no Clerk Dashboard (ver Gotchas) — não há bootstrap por código.
- **Token do Mapbox nunca vai para o bundle do frontend**: é buscado em runtime via `GET /api/map-config` (`Cache-Control: no-store`), permitindo trocar o token sem rebuild e evitando expor via env de build.
- **Fallback de mapa sem Mapbox**: se o token não estiver configurado ou o navegador não suportar WebGL, a UI cai para `FallbackMap` (grid CSS estático) em vez de quebrar.
- **Aprovação de flyers é transacional**: mover um `flyerReport` para `approved`/de volta soma ou subtrai o `flyerCount` do total da igreja dentro de uma transação (`db.transaction`), para manter `flyersConfirmed` consistente com o histórico de aprovações.
- **Clerk é opcional em runtime**: se não houver publishable key configurada, a coordenação abre sem exigir login (`ProtectedCoordination` vs `Coordination` direto) — comportamento pensado para ambientes de preview/dev sem Clerk configurado.

## Product

- **Mapa público** (`/`): lista/mapa de igrejas evangélicas no DF, com busca, filtro por região (RA) e status (sem grupo / grupo ativo / ação registrada), estatísticas agregadas e ranking por região.
- **Detalhe da igreja**: link para o grupo de WhatsApp, rota no Maps, telefone, meta/progresso de flyers, e formulário de sinalização de dado incorreto (igreja fechada, dado errado, duplicado, outro).
- **Registro de campo**: voluntário registra flyers distribuídos (data, quantidade, nome, telefone, observação) — fica pendente até aprovação.
- **Coordenação** (`/coordination`, autenticado quando Clerk está ativo): fila de aprovação/recusa de registros de flyers, e painel para editar link do WhatsApp e meta de flyers de cada igreja.
- **Administração** (dentro de `/coordination`, visível só para `publicMetadata.role === "admin"`): designar ou remover o coordenador responsável por cada igreja (por e-mail). Só quando a igreja tem coordenador designado (além do link do WhatsApp) é que o mapa público libera o CTA de "entrar no grupo" e o botão de registrar flyers para os voluntários.

## User preferences

- Toda a UI e mensagens de erro são em português (pt-BR); manter esse idioma em qualquer texto novo voltado ao usuário.

## Gotchas

- A API derruba o processo se `PORT` ou `DATABASE_URL` não estiverem definidos — sempre exporte antes de rodar `dev`.
- Depois de um `git pull`/merge que trouxe mudanças de dependências ou de schema, rode `scripts/post-merge.sh` (ou manualmente `pnpm install --frozen-lockfile` + `pnpm --filter db run push`) antes de continuar.
- Mudou algo na API? Edite `lib/api-spec/openapi.yaml` e rode `pnpm --filter @workspace/api-spec run codegen` — não edite os arquivos gerados em `lib/api-zod/src/generated` ou `lib/api-client-react/src/generated` diretamente.
- O mapa Mapbox só aparece se `MAPBOX_PUBLIC_TOKEN` estiver setado no ambiente da API — sem isso, é esperado ver o mapa fallback (grid estático), não é bug.
- Para o primeiro admin existir, alguém precisa entrar manualmente no **Clerk Dashboard → Users → \[usuário\] → Metadata** e definir `publicMetadata: { "role": "admin" }`. Sem isso, o painel de designação de coordenadores não aparece pra ninguém, mesmo logado.
- Depois que um coordenador é designado para uma igreja, ela só vira "grupo ativo" (libera CTA de WhatsApp e o botão de registrar flyers no mapa público) se **também** tiver `whatsappUrl` preenchido — as duas condições são independentes e precisam das duas telas (Ajustes das igrejas + Coordenadores por igreja) preenchidas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
