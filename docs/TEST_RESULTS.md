# Resultados de testes

## 23/11/2026 — IA conversacional e catálogo mestre (sobre a validação profunda de 22/11)

`pnpm check` (lint → typecheck → test → build): **sucesso (exit 0)**.

| Pacote | Testes |
|---|---|
| packages/shared | 24 ✅ |
| packages/domain | 7 ✅ |
| packages/pricing | 30 ✅ |
| packages/pdf | 7 ✅ |
| packages/conversations | 127 ✅ (inclui 17 do catálogo: carga, apelidos, diminutivos, ambiguidade, contexto, presets, ordem das medidas, perguntas por tipo, referência de lugar não é peça) |
| apps/worker | 155 ✅, 2 pulados (inclui 20 do catálogo/IA: carga idempotente, edição auditada, tipo inativo, "armário"/"cama grande" pedem esclarecimento, portas/gavetas/estofado/exposição, diâmetro, medida aberta, móvel não identificado, hipótese nominal × medida real, "é o padrão", só cabeceira, validador de mensagens, fallback de IA, JSON inválido sem efeito) |

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

## 23/11/2026 — Ajustes 1 (preço durante o orçamento) e 2 (objetivos conversacionais)

`pnpm check`: **sucesso**. Testes: shared 18 · domain 7 · pricing 23 · pdf 7 · conversations **71** · worker **97** (+1 exploratório pulado) = **223**.

Novos arquivos de teste: `packages/conversations/test/multi.test.ts`, `apps/worker/test/router.test.ts`, `apps/worker/test/quote-request.test.ts` (caso real de produção reproduzido literalmente), `apps/worker/test/quote-pricing.test.ts` (25 cenários do Ajuste 1).

Migration `0004_conversation_goals_pricing.sql` aplicada com sucesso no D1 local (Miniflare), incluindo recriação de `learning_observations` com cópia dos dados e índice único parcial. **Pendente em produção** (somente 0004).

## 22/11/2026 — Conversa mais intuitiva (feedback do teste com a cama queen)

Novos testes: `apps/worker/test/intuitive.test.ts` (12 cenários do diálogo real: cama queen sem "por dentro", pergunta ao bot explicada, "quanto fica?", "Mas e o valor?" não gravado, repetição confirmada, logística parcial, respostas fora de hora, pagamento ≠ prazo, aprendizado só do material citado, IA validada para respostas e reescrita), `packages/conversations/test/intuitive.test.ts` (tamanhos de cama, perfis, validadores de IA, casal × dois clientes, nomes seguidos de verbo), `packages/pricing/test/bed.test.ts` (geometria da cama), 4 cenários de casal em `quote-request.test.ts` e 1 no roteador (intenção só da IA não interrompe).

Diálogos reproduzidos localmente do início ao fim (cama queen da Dona Licele; Seu Roberto e Dona Jo como casal até o orçamento final) sem becos sem saída.

## 22/11/2026 — Rodada de validação profunda (simulação do uso real)

Detalhes, matriz de cenários e causas-raiz: [`VALIDATION_2026-11-22.md`](VALIDATION_2026-11-22.md).

- Linha de base (commit `b1ddb35`): 253 ✅ e 1 ❌ (teste instável por texto sorteado).
- Final: lint ✅ · typecheck ✅ · testes **313** ✅ (shared 24 · domain 7 · pricing 30 · pdf 7 · conversations 110 · worker 135; +2 exploratórios pulados) · build ✅ (painel 287,6 kB; Worker 1.569 KiB / 394 KiB gzip, dry-run).
- Novos testes: `validation.test.ts` em shared, pricing, conversations e worker (cálculos comparados a fórmulas independentes); simulador `explore-validation.test.ts` (`EXPLORE=1`).
- Migrations novas: nenhuma.
- Não executado: Telegram/Workers AI/D1/R2 reais, painel em navegador, coleta proativa (não existe).

## 23/11/2026 — Coleta proativa

`pnpm check` (lint, typecheck, testes, build): **sucesso**. Testes: shared 18 · domain 7 · pricing 26 · pdf 7 · conversations **111** · worker **133** (+1 exploratório pulado) = **302**.

Novos: `packages/conversations/test/proactive.test.ts` (29 — detectores, prioridade, horários/fuso/limites, mensagens, interpretação) e `apps/worker/test/proactive.test.ts` (19 — os três cenários obrigatórios ponta a ponta, idempotência e lock, destinatário pelo vínculo Telegram, pausa e tipos desativados, pergunta aguardando, falha do Telegram com nova tentativa, falha isolada do cron, botões idempotentes e humanizados, "não uso mais", resolução por outra conversa, demãos sem calibrar, horas reais, mudança de assunto, IA com fallback, simulação sem efeitos, painel com datas DD/MM/AAAA).

Migration `0005_proactive_collection.sql` aplicada nos testes (D1 shim) sobre 0001–0004, incluindo a recriação de `learning_observations` com cópia dos dados. **Pendente em produção.**
