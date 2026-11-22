# Arquitetura

```
Telegram ──webhook (secret + update_id)──▶ Worker (Hono)
                                            ├─ telegram/webhook.ts   autoriza por telegram_user_id, dedupe, mídia
                                            ├─ conversation/engine   máquina de estados (uma pergunta por vez)
                                            │     ├─ @adripatina/conversations  regras pt-BR, matcher, perguntas
                                            │     └─ ai/service       Workers AI opcional (STT, extração, visão) + fallback
                                            ├─ services/quotes       motor @adripatina/pricing → snapshot → PDF → R2
                                            ├─ services/duplicates   suspeitas, mescla e desfazer
                                            ├─ admin/routes          API /api/v1/admin (Cloudflare Access JWT)
                                            └─ cron.ts               outbox, resumo diário, retenção, varredura
Painel React (Workers Static Assets) ──▶ /api/v1/admin/*
D1 (SQLite): dados, memória, auditoria     R2 privado: fotos, áudios, PDFs
```

## Pacotes
| Pacote | Responsabilidade | Depende de IA? |
|---|---|---|
| `shared` | Decimal exato, dinheiro, números em português falado, texto, hash | Não |
| `domain` | Status e transições, campos do projeto, papéis/permissões | Não |
| `pricing` | Motor determinístico, geometria, catálogo demo NÃO CALIBRADO | **Nunca** |
| `conversations` | Intérprete por regras, schema/sanitização da IA, matcher de duplicidade, perguntas | Contrato apenas |
| `pdf` | PDF comercial e interno (pdf-lib), lista de termos confidenciais | Não |

## Fluxo de mensagem
`update → valida secret → INSERT telegram_updates (PK) → autoriza ID → mídia (R2) → STT/visão (opcional) → interpretar (regras + IA) → sessão D1 → fatos do projeto (com histórico) → resposta (uma pergunta) → motor quando completo`.

## Memória e deduplicação
- **Camada A (idempotência):** `telegram_updates.update_id` (PK); `file_unique_id` de áudio; chaves de idempotência financeiras.
- **Camada B (semântica):** `loadCandidates` + `decideMatch` (tipo de móvel, cliente/apelidos, técnica, características, foto por SHA-256, recência, estado). Suspeita ≥ 0,40 → confirmação com botões "Sim, é essa / Não, é outro serviço / Não tenho certeza". "Não tenho certeza" → uma pergunta diferenciadora (cliente ou data).
- Fatos: `setFact` devolve `set | same | conflict | corrected`. `same` gera "Isso, já anotei…"; `conflict` gera pergunta de esclarecimento; correção explícita ("na verdade…", "voltar") grava histórico e evento `correcao`.

## Ciclo de vida
Orçamento: `RASCUNHO → ESTIMATIVA → AGUARDANDO_REVISAO → APROVADO → ENVIADO → ACEITO` (+ `RECUSADO`, `CANCELADO`, `EXPIRADO`).
Serviço: `ORCAMENTO → AGUARDANDO_INICIO → EM_EXECUCAO → CONCLUIDO → ENTREGUE` (+ `CANCELADO`, `MESCLADO`).
Financeiro: derivado. Transições validadas no backend com auditoria (quem, quando, motivo).

## Banco
Schema em `db/migrations/0001_init.sql`. Destaques: `job_facts` (histórico), `duplicate_suspicions`, `job_merges` (reversível), `quote_snapshots`/`quote_documents` (imutáveis por trigger), `outbox_events`, `ai_usage`, `audit_events` (dados sensíveis redigidos).
