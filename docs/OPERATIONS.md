# Operação

## Ambientes
| Ambiente | Config | Telegram | IA | Dados |
|---|---|---|---|---|
| local | `wrangler.jsonc` (topo) | mock (respostas no terminal) | sem binding | D1/R2 locais (Miniflare, `.wrangler/`) |
| staging | `--env staging` | bot de **teste** | desligada até aprovação | D1/R2 próprios |
| production | `--env production` | bot oficial | desligada até aprovação | D1/R2 próprios |

## Rotina
- **Cron a cada 15 min:** entrega do outbox (retry com backoff, até 6 tentativas), resumo diário (hora `DAILY_SUMMARY_HOUR`, idempotente por dia), retenção de mídia, varredura de duplicidades às 3h.
- **Falhas de webhook:** `SELECT * FROM telegram_updates WHERE status='failed'`. **Outbox falho:** `SELECT * FROM outbox_events WHERE status='FALHOU'`.
- **Observabilidade:** `observability.enabled` no wrangler; logs JSON sem PII (`wrangler tail --env production`).

## Backup e restauração
- D1 tem Time Travel (restauração para um ponto no tempo) — confira o período atual na documentação.
- Exportação periódica: `pnpm exec wrangler d1 export adripatina --remote --output backup-AAAAMMDD.sql --env production` (guardar fora do repositório, com acesso restrito).
- Inventário do R2: `pnpm exec wrangler r2 object list adripatina-files` (ou painel). A tabela `attachments`/`quote_documents` relaciona cada objeto.
- Restauração: criar D1 novo, `wrangler d1 execute <db> --file backup.sql`, apontar `database_id` e validar em staging primeiro.

## Calibração (antes do uso real)
1. Painel → Materiais: cadastrar preço atual de cada embalagem, rendimento e perda; marcar calibrado.
2. Métodos e técnicas: revisar velocidades, perdas, horas por m² e receitas; marcar revisado.
3. Configurações: confirmar metas, horas, custos fixos, reserva, tributos (com contador), validade, condições.
4. Comparar com **cinco serviços históricos** (criar pelo painel, calcular e comparar com o valor real cobrado); ajustar.
5. Manter "revisão administrativa obrigatória" ligada no início.

## Variáveis e segredos
Ver `.env.example`. Segredos: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
