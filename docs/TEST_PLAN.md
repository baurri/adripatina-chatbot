# Plano de testes — rastreabilidade dos critérios de aceite

Execução: `pnpm test` (unitários + integração com SQLite real e as migrations de produção).

| # | Critério | Onde |
|---|---|---|
| 1 | Estoque suficiente ⇒ compra 0, consumo > 0 | `packages/pricing/test/pricing.test.ts` "aceite 1" + exemplo obrigatório |
| 2 | Estoque parcial | idem "aceite 2" |
| 3 | Comprado anos atrás ⇒ reposição; histórico separado | idem "aceite 3"; integração em `apps/worker/test/e2e.test.ts` |
| 4 | Preço ausente ⇒ bloqueio, nunca zero | idem "aceite 4"; e2e (1ª tentativa bloqueada) |
| 5 | Compra não duplica consumo | `access-finance.test.ts` "5." |
| 6 | Reserva/custos fixos não duplicados | pricing "aceite 6" |
| 7 | Técnicas compostas sem duplicar preparo | pricing "aceite 7" |
| 8 | Secagem não é hora ativa | pricing "aceite 8" |
| 9 | Terceiro sem cotação bloqueia | pricing "aceite 9" + `access-finance` "9 (integração)" |
| 10 | Abaixo do piso exige aprovação auditável | pricing "aceite 10" + `access-finance` "10." |
| 11 | Pagamentos parciais, estorno, saldo exato | `access-finance` "11." |
| 12 | Recalcular não altera snapshots/PDFs | `access-finance` "12." (inclui triggers) |
| 13 | Áudio segue o fluxo do texto | `memory.test.ts` "13." |
| 14 | Falha de transcrição preserva sessão | `memory.test.ts` "14." e "14b." |
| 15 | Mensagem ambígua ⇒ pergunta, sem registro financeiro | `memory.test.ts` "15." e "15b." |
| 16 | "Não sei" fica pendente | `memory.test.ts` "16." + pricing "área desconhecida" |
| 17 | Sessão retomada | `memory.test.ts` "5." |
| 18 | Update duplicado não duplica | `memory.test.ts` "2b." |
| 19 | PDF comercial sem dados internos (inclusive metadados) | `packages/pdf/test/pdf.test.ts` "aceite 19"; e2e (PDF real) |
| 20 | PDF com número, versão, validade, escopo, preço, condições, marca | pdf "aceite 20" |
| 21 | PDF imutável; revisão = nova versão | `access-finance` "12." |
| 22 | Sem autorização não baixa documento | `access-finance` "22/24." |
| 23 | Admin Telegram por ID; username não vale | `access-finance` "23." e comandos admin |
| 24 | Sem envio automático a clientes | e2e (documento só para o chat do artesão) e "22/24." |
| 25 | API admin exige JWT Access | `access-finance` "25." |
| 26 | Falha da IA não bloqueia | `access-finance` "26." |
| 27 | install/lint/typecheck/test/build/migrations | `pnpm check`, CI, `TEST_RESULTS.md` |
| 28 | Fluxo ponta a ponta | `e2e.test.ts` + `pnpm demo` |
| 29–30 | Documentação; sem segredos/integrações pagas | `docs/`, README, revisão |

## Memória e duplicidade (requisito crítico)
| Teste | Onde (`memory.test.ts`) |
|---|---|
| Mesmo projeto 10× com palavras diferentes ⇒ 1 projeto | "1." |
| Reenvio de áudio (mesmo arquivo, regravado, reentrega) | "2.", "2b." |
| Palavras diferentes ⇒ pergunta de correspondência | "3." |
| Dois móveis parecidos do mesmo cliente | "4." |
| Retomar após 30 dias | "5." |
| Informação repetida sem pergunta redundante | "6." |
| Correção preserva histórico | "7." e "voltar…" |
| Contradição pede esclarecimento | "8." |
| Baixa confiança não associa/mescla | "9." e duplicidades ("IA/varredura nunca mescla") |
| Confirmar existente continua sem reiniciar | "10." |
| Mesclar/desfazer preserva pagamentos | `access-finance` "mesclar preserva…" |

## Fora da suíte automática (manual / requer aprovação)
- `wrangler dev` (Miniflare) — verificado manualmente, ver TEST_RESULTS.
- Áudio real com Workers AI e Telegram real — aguardando staging.
- Playwright do painel — evolução.
