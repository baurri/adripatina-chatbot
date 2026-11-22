# Plano de implementação e checklist

Legenda: ✅ implementado e testado · 🟡 implementado, depende de ativação/validação externa · ⬜ pendente

## P0 — Fundação e segurança financeira
- ✅ Monorepo pnpm (shared, domain, pricing, conversations, pdf, worker, admin-web)
- ✅ Schema D1 com migrations versionadas (`db/migrations/0001_init.sql`), índices, FKs, triggers de imutabilidade
- ✅ Decimal exato / centavos inteiros (`packages/shared`)
- ✅ Motor determinístico (`packages/pricing`): taxa horária, geometria, receitas deduplicadas, métodos, materiais, terceiros, despesas, risco, markup, tributos, piso/recomendado, prazo, entrada
- ✅ FIN-ESTOQUE-001 com testes obrigatórios (exemplo da meia lata e aceites 1–4)
- ✅ Catálogo/seed de demonstração rotulado `demo_only`/NÃO CALIBRADO, sem preços
- ✅ Script de demonstração (`pnpm demo`)

## P1 — Telegram texto + domínio + memória
- ✅ Webhook seguro (secret, allowlist por ID, dedupe por `update_id`, rate limit)
- ✅ Máquina de estados: uma pergunta por vez, "não sei", voltar, corrigir, cancelar, continuar depois, autosave
- ✅ Memória persistente: fatos com histórico, resumo, pendências, retomada após semanas
- ✅ Deduplicação semântica com confirmação ("é essa mesma?"), "outra cristaleira", vários candidatos, pergunta diferenciadora
- ✅ Contradições pedem esclarecimento; repetição gera "já anotei"
- ✅ Gastos/compras/pagamentos com confirmação e idempotência; saldo
- ✅ Andamento (início, conclusão, entrega), consultas, lista e agenda
- ✅ Comandos admin: /admin, /pendentes, /servicos, /caixa, /alertas, /custos, /aprovar, /ajuda_admin

## P2 — Painel web
- ✅ API `/api/v1/admin` com Zod, paginação, idempotência, CSRF, auditoria
- ✅ Autenticação Cloudflare Access (JWT verificado) + allowlist
- ✅ React/Vite: painel, orçamentos (revisão, exceções, documentos), serviços (memória, histórico, financeiro, ajustes, terceiros), clientes, materiais/estoque/técnicas/métodos, duplicidades (mesclar/desfazer), relatórios + CSV, configurações versionadas, usuários, aprovações, auditoria, uso de IA
- 🟡 Testes Playwright do painel: não implementados (painel verificado manualmente no navegador com `wrangler dev`)

## P3 — PDF adripatina
- ✅ PDF comercial A4 (pdf-lib), marca, número AP-AAAA-NNNN, versão, validade, escopo, preço, condições, fotos opcionais, aceite
- ✅ Estimativa preliminar rotulada NÃO DEFINITIVA
- ✅ Snapshot imutável + hash; R2 privado; revisão = nova versão
- ✅ PDF interno (somente admin); testes de privacidade inclusive metadados
- ✅ Envio apenas ao chat do artesão; nenhum envio automático a clientes

## P4 — Áudio, fotos e Workers AI
- ✅ Adaptadores STT/extração/visão com modelos configuráveis (conferidos na documentação em 22/11/2026) e mocks separados
- ✅ Limites de áudio/imagem, validação de MIME por bytes, dedupe por `file_unique_id` e SHA-256
- ✅ Teto operacional, timeout, retry, circuit breaker, fallback para regras, telemetria `ai_usage`
- 🟡 Testes com **áudio brasileiro informal real**: exigem ligar Workers AI (custo) e consentimento — aguardando sua aprovação
- 🟡 Português do modelo de extração não declarado na documentação — validar em staging

## P5 — Agenda e operação
- ✅ Cron: outbox com retry, resumo diário idempotente, retenção LGPD, varredura de duplicidades
- ✅ CI (GitHub Actions), script de setup Windows, documentação
- 🟡 Staging/produção: configuração pronta em `wrangler.jsonc`, **nada criado** (aguarda aprovação)
- ⬜ Comparação com cinco serviços históricos (requer dados reais do artesão)
- ⬜ Lembretes por prazo de entrega por serviço (há `due_date` e alerta de atraso; lembrete individual ainda não)

## Riscos e dependências externas
| Item | Dependência | Situação |
|---|---|---|
| Bot Telegram | Token do BotFather | você cria; setar via `wrangler secret put` |
| Painel | Cloudflare Access (Zero Trust) | configurar aplicação e AUD |
| D1/R2 de staging/produção | `wrangler d1 create`, `wrangler r2 bucket create` | não executado |
| Workers AI | ligar `AI_ENABLED` | não executado (custo) |
| Preços e coeficientes reais | administrador | catálogo vazio de preços de propósito |
| Tributos | contador / enquadramento | desligado; preço sem impostos com alerta |

## Próximo passo exato
1. Você aprova a criação dos recursos de **staging** (D1, R2, Access, bot de teste).
2. Cadastrar preços reais e calibrar técnicas no painel de staging.
3. Ligar Workers AI em staging e testar áudios reais (com consentimento).
4. Rodar os cinco serviços históricos e ajustar parâmetros.
