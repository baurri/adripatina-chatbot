# Resultados de testes

## 22/11/2026 — Windows 11, Node 24.14.1, pnpm 9.15.9, Wrangler 4.x

`pnpm check` (lint → typecheck → test → build): **sucesso (exit 0)**.

| Pacote | Arquivos | Testes |
|---|---|---|
| packages/shared | 1 | 18 ✅ |
| packages/domain | 1 | 7 ✅ |
| packages/pricing | 1 | 23 ✅ |
| packages/pdf | 1 | 7 ✅ |
| packages/conversations | 1 | 22 ✅ |
| apps/worker (integração, SQLite real + migrations) | 4 | 45 ✅ (1 exploratório pulado) |
| **Total** | | **122 ✅** |

- ESLint: 0 problemas. TypeScript estrito (`noUncheckedIndexedAccess`): 0 erros em todos os pacotes.
- Build: painel Vite (≈277 kB JS, 84 kB gzip) e bundle do Worker via `wrangler deploy --dry-run` (sem deploy).

## Verificação manual com `wrangler dev` (Miniflare, local, gratuito)
- `wrangler d1 migrations apply DB --local` ✅ e seeds ✅
- `GET /api/v1/health` → 200 sem segredos ✅
- Webhook sem header secreto → 401 ✅
- Webhook com secret: mensagem "Peguei uma cristaleira da dona Maria…" → `ok`; mesmo `update_id` reenviado → `duplicate` ✅
- Respostas do bot (mock) no terminal: "Anotei: móvel: cristaleira; trabalho: pátina; cliente: Dona Maria." → "Como está o estado do móvel?" ✅
- `GET /api/v1/admin/jobs` (bypass local) retornou S-0001 com pendências ✅
- Painel servido por Workers Static Assets, página Serviços renderizada no navegador ✅

## `pnpm demo`
Fluxo completo com dados fictícios: conversa → resumo → cálculo (piso R$ 590,61 / recomendado R$ 728,00 com preços de teste) → revisão → aprovação → PDF `out/Proposta-AP-2026-0001-v1.pdf` → aceite → pagamento R$ 200 → saldo R$ 528. PDF inspecionado visualmente: marca, escopo, investimento, prazo, condições e aceite; sem custos internos.

## Não executado (exige aprovação/recursos externos)
- Telegram real, Workers AI real (áudio brasileiro), Cloudflare Access real, D1/R2 remotos, deploy.
