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

## Concorrência do webhook (22/11/2026)
- Configure o webhook com `max_connections=1` (ver README): o Telegram entrega uma atualização por vez, em ordem, e duas mensagens rápidas do mesmo usuário não disputam a sessão.
- Se mesmo assim houver disputa, o Worker registra `session_conflict` no log e `session.conflict` em `audit_events` (a mensagem atual é gravada; a anterior pode ter o contexto sobrescrito). Consulta: `SELECT * FROM audit_events WHERE action='session.conflict' ORDER BY created_at DESC`.
- Acima de 120 atualizações/minuto o webhook responde **429** e o Telegram reenvia depois (antes respondia 200 e a mensagem se perdia).

## Coleta proativa

- Começa **desligada**. Ligar em *Coleta proativa → Ligar coleta* no painel (ou pausar por 7 dias, ajustar horário, limites e tipos).
- *Simular agora* mostra o que seria perguntado, para quem, com a pontuação e o motivo — nada é enviado nem gravado.
- Variável `PROACTIVE_MODE`: `dry_run` (local/staging: nunca envia sozinho), `live` (produção: envia só se ligada no painel), `off`.
- Cada solicitação tem linha do tempo (enviada, resposta, confirmação, dado salvo, orçamento retomado). O administrador pode adiar, cancelar, reabrir, fixar prioridade e impedir novas perguntas sobre um item.
- Logs estruturados: `proactive_run`, `proactive_sent`, `proactive_send_failed`, `proactive_failed` (com `correlationId`).

## IA de texto com Claude (23/11/2026)

- Sem `ANTHROPIC_API_KEY`: tudo como antes (texto e áudio no Workers AI).
- Com a chave: interpretação e reescrita de mensagens vão para o Claude (`AI_CLAUDE_MODEL`, padrão `claude-haiku-5-5`); o áudio continua no Whisper do Workers AI. Se o Claude falhar (rede, chave, recusa, tempo), o Workers AI responde no lugar, sem o artesão perceber.
- Ativar: `wrangler secret put ANTHROPIC_API_KEY --config wrangler.jsonc` (a chave é digitada no terminal, nunca no código). Desativar: `wrangler secret delete ANTHROPIC_API_KEY --config wrangler.jsonc`.
- Defina um limite de gasto mensal no Console da Anthropic. A tabela `ai_usage` registra `provider = anthropic` e o custo estimado por chamada (`estimated_cost_usd_micros`).
- Privacidade: com a chave, o texto das mensagens (inclui nomes de clientes) é enviado à Anthropic.

## Orçamento decidido pelo artesão (23/11/2026, D-070)

- Aplicar a migration antes do deploy: `node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config wrangler.jsonc` (0007 só acrescenta a coluna `quotes.price_adjustment_json`).
- O administrador recebe "Fulano fechou o orçamento S-000X por R$ ..." no Telegram, com desconto/acréscimo e aviso quando ficou abaixo do mínimo. A nota de aprovação do orçamento guarda o mesmo resumo.
- Materiais que o Adriano disse não usar ficam em `pricingOverrides.excludedMaterials` do serviço (o painel preserva) e viram `learning_observations` (`MATERIAL_USAGE`, status `COLETADO`) para revisar a receita da técnica.
