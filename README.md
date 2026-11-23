# adripatina

Assistente de gestão, precificação e organização de uma oficina artesanal de pintura e restauração de móveis.
O artesão conversa pelo **Telegram** (texto, áudio, fotos e botões); o administrador usa um **painel web**; os orçamentos são calculados por um **motor financeiro determinístico** (a IA nunca define valores) e viram **propostas PDF** com a marca adripatina.

> Estado: todas as fases implementadas e testadas **localmente** (122 testes). Nada foi publicado nem criado na Cloudflare. Veja [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Sumário
1. [Instalação no Windows 11](#1-instalação-no-windows-11)
2. [Execução local](#2-execução-local)
3. [Testes e verificações](#3-testes-e-verificações)
4. [Configurar Telegram (BotFather)](#4-configurar-telegram-botfather)
5. [Configurar Cloudflare (D1, R2, Access, Workers AI)](#5-configurar-cloudflare)
6. [Deploy manual](#6-deploy-manual)
7. [Primeiro uso real](#7-antes-do-primeiro-uso-real)
8. [Estrutura e documentação](#8-estrutura-e-documentação)

## Regras que o sistema garante
- **Material em estoque nunca é gratuito**: o consumo entra no orçamento pelo preço atual de reposição; "já tenho" só reduz a compra (FIN-ESTOQUE-001).
- **IA nunca calcula preço**: interpreta áudio/texto/foto; o código calcula horas, materiais, piso e recomendado.
- **Proteção contra prejuízo**: piso de preço, bloqueio de orçamento incompleto ou não calibrado, aprovação justificada para exceções, auditoria.
- **Memória e anti-duplicidade**: o bot reconhece o mesmo projeto descrito de jeitos diferentes, pergunta antes de cadastrar, não repete perguntas e pede esclarecimento em contradições.
- **PDF comercial sem custos internos**, enviado só ao artesão para ele encaminhar.
- **Nada pago ou de produção sem sua autorização.**

---

## 1. Instalação no Windows 11

Pré-requisitos: **Node.js 22.13+** (testado com 24.14), Git. O PowerShell já vem no Windows.

```bash
git clone https://github.com/baurri/adripatina-chatbot.git
```
```bash
cd adripatina-chatbot
```
Setup automático (instala pnpm se faltar, dependências, banco local, roda todas as verificações):
```bash
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

Manual, passo a passo:
```bash
npm install -g pnpm@9.15.9
```
```bash
pnpm install
```
```bash
copy .dev.vars.example .dev.vars
```
```bash
copy db\seeds\0002_local_dev_users.sql.example db\seeds\0002_local_dev_users.sql
```
Edite `db\seeds\0002_local_dev_users.sql` com os **IDs numéricos** do Telegram (descubra com o bot `@userinfobot`). Depois:
```bash
pnpm db:migrate:local
```
```bash
pnpm db:seed:local
```
```bash
pnpm exec wrangler d1 execute DB --local --file db/seeds/0002_local_dev_users.sql
```

## 2. Execução local

**Demonstração completa no terminal** (dados fictícios, sem internet, gera o PDF em `out/`):
```bash
pnpm demo
```

**Servidor local** (API + webhook + painel; Telegram simulado — as respostas do bot aparecem no terminal):
```bash
pnpm build
```
```bash
pnpm dev
```
- Painel: http://127.0.0.1:8787 (localmente entra como `admin@exemplo.local`, definido em `ADMIN_DEV_BYPASS_EMAIL`; esse atalho **não funciona** em staging/produção).
- Painel com recarga automática: em outro terminal, `pnpm dev:admin` → http://localhost:5173.
- Simular uma mensagem do Telegram (PowerShell; use o segredo do seu `.dev.vars` e o ID cadastrado):
```bash
curl.exe -X POST http://127.0.0.1:8787/api/v1/telegram/webhook -H "content-type: application/json" -H "X-Telegram-Bot-Api-Secret-Token: SEU_SEGREDO" -d "{\"update_id\":1,\"message\":{\"message_id\":1,\"from\":{\"id\":1001},\"chat\":{\"id\":1001,\"type\":\"private\"},\"date\":0,\"text\":\"Peguei uma cristaleira da dona Maria para fazer patina\"}}"
```

Para testar com o **Telegram de verdade localmente**, crie um bot de teste, coloque `TELEGRAM_BOT_TOKEN` no `.dev.vars`, mude `TELEGRAM_MODE` para `live` no topo do `wrangler.jsonc` e exponha a porta 8787 com um túnel (ex.: `cloudflared tunnel --url http://127.0.0.1:8787`), registrando o webhook como na seção 4.

## 3. Testes e verificações

```bash
pnpm check
```
Roda lint, typecheck, todos os testes (motor financeiro, memória/duplicidade, PDF, segurança, ponta a ponta com SQLite real e as migrations de produção) e build. Comandos separados: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Mapa dos critérios de aceite → testes: [docs/TEST_PLAN.md](docs/TEST_PLAN.md). Últimos resultados: [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md). A CI (GitHub Actions) roda o mesmo `check` em cada push/PR.

## 4. Configurar Telegram (BotFather)

1. No Telegram, abra **@BotFather** → `/newbot` → escolha nome e usuário. Guarde o **token** (é um segredo; não cole em chats nem no repositório).
2. Recomendado: `/setprivacy` → Enable; `/setjoingroups` → Disable (o bot só atende conversas privadas).
3. Descubra os **IDs numéricos** do artesão e do administrador (`@userinfobot`) e cadastre-os no painel (Usuários) ou via SQL. O acesso é **somente por ID**.
4. Gere um segredo longo para o webhook (ex.: `[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")` no PowerShell).
5. Após o deploy (seção 6), registre o webhook (substitua TOKEN, URL e SEGREDO):
```bash
curl.exe -X POST "https://api.telegram.org/botTOKEN/setWebhook" -d "url=https://adripatina-chatbot.baurri.workers.dev/api/v1/telegram/webhook" -d "secret_token=SEGREDO" -d "allowed_updates=[\"message\",\"callback_query\"]" -d "drop_pending_updates=true" -d "max_connections=1"
```
6. Confira: `https://api.telegram.org/botTOKEN/getWebhookInfo`.

## 5. Configurar Cloudflare

> Os comandos abaixo **criam recursos na sua conta**. Execute somente quando decidir publicar. Faça primeiro em **staging**.

Login:
```bash
pnpm exec wrangler login
```
**D1** (anote o `database_id` e coloque em `wrangler.jsonc` → `env.staging.d1_databases`):
```bash
pnpm exec wrangler d1 create adripatina-staging
```
**R2** (bucket privado):
```bash
pnpm exec wrangler r2 bucket create adripatina-files-staging
```
**Migrations e catálogo inicial** no D1 remoto:
```bash
pnpm exec wrangler d1 migrations apply DB --remote --env staging
```
```bash
pnpm exec wrangler d1 execute DB --remote --env staging --file db/seeds/0001_demo_catalog.sql
```
Cadastre o primeiro administrador (troque os valores; depois os demais usuários podem ser criados pelo painel):
```bash
pnpm exec wrangler d1 execute DB --remote --env staging --command "INSERT INTO users (id, role, display_name, telegram_user_id, admin_email, active, created_at, updated_at) VALUES (lower(hex(randomblob(16))), 'ADMIN', 'Nome', 'ID_TELEGRAM', 'email@dominio', 1, datetime('now'), datetime('now'))"
```
**Segredos**:
```bash
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN --env staging
```
```bash
pnpm exec wrangler secret put TELEGRAM_WEBHOOK_SECRET --env staging
```
**Cloudflare Access (painel)** — Zero Trust → Access → Applications → *Self-hosted*:
- Domínio: o host do Worker (ou domínio próprio). Proteja o caminho `/*` **exceto** `/api/v1/telegram/*` e `/api/v1/health` (crie uma aplicação com política *Bypass* para esses dois caminhos — o webhook tem segredo próprio).
- Política *Allow* apenas para os e-mails dos administradores.
- Copie o **Application Audience (AUD) tag** para `ACCESS_AUD` e o domínio do time (`https://<time>.cloudflareaccess.com`) para `ACCESS_TEAM_DOMAIN` em `wrangler.jsonc` (`env.staging.vars`).
- O Worker valida a assinatura do JWT; sem Access configurado a API administrativa responde 401.

**Workers AI** (opcional, gera custo conforme uso — ver [docs/AI_COSTS.md](docs/AI_COSTS.md)): em `env.staging.vars` coloque `AI_ENABLED` = `"true"`. Os modelos sugeridos já estão preenchidos (conferidos em 22/11/2026). O teto `AI_DAILY_REQUEST_LIMIT` é interno e **não limita a fatura**; configure também alertas de faturamento na Cloudflare.

## 6. Deploy manual

```bash
pnpm check
```
```bash
pnpm --filter @adripatina/admin-web build
```
```bash
pnpm exec wrangler deploy --env staging
```
Registre o webhook do bot de teste (seção 4) com a URL de staging, teste o fluxo completo, depois repita com `--env production` (nome do Worker `adripatina-chatbot`, URL `https://adripatina-chatbot.baurri.workers.dev`). Acompanhe logs com `pnpm exec wrangler tail --env production`. Backup e restauração: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## 7. Antes do primeiro uso real
- Cadastrar preços atuais, rendimentos e perdas no painel (o catálogo inicial **não tem preços** de propósito) e revisar técnicas/métodos (todos começam **NÃO CALIBRADOS**, o que bloqueia propostas definitivas).
- Revisar metas de renda, horas, custos fixos e tributos (com um contador).
- Comparar com **cinco serviços históricos** e ajustar.
- Validar transcrição com áudios reais do artesão (com consentimento).
- Preencher identidade comercial (telefone, cidade etc. só aparecem no PDF se preenchidos).
- Manter "revisão administrativa obrigatória" ligada no início.

## 8. Estrutura e documentação
```
apps/worker        API Hono, webhook Telegram, conversa, cron, serviços (D1/R2/IA)
apps/admin-web     painel React + Vite
packages/pricing   motor financeiro puro (sem IA)
packages/conversations  intérprete pt-BR, matcher de duplicidade, perguntas, contrato da IA
packages/pdf       PDF comercial e interno (pdf-lib)
packages/domain    estados, transições, campos do projeto, permissões
packages/shared    decimal exato, dinheiro, números falados em português
db/migrations      schema D1    db/seeds  catálogo de demonstração
docs/              decisões, arquitetura, regras financeiras, IA e custos, segurança, operação, testes
```
- [Decisões](docs/DECISIONS.md) · [Arquitetura](docs/ARCHITECTURE.md) · [Regras financeiras](docs/FINANCIAL_RULES.md) · [IA e custos](docs/AI_COSTS.md) · [Segurança/LGPD](docs/SECURITY.md) · [Operação](docs/OPERATIONS.md) · [Plano](docs/IMPLEMENTATION_PLAN.md) · [Plano de testes](docs/TEST_PLAN.md)
