# Rodada de validação profunda — 22/11/2026

Simulação do uso real do Adripatina Chatbot pelo Adriano, tentando ativamente fazer o sistema falhar.
Base: commit `b1ddb35` (trabalho dos prompts anteriores já em `origin/main`).

## 1. Diagnóstico inicial (linha de base, antes de qualquer ajuste)

| Item | Resultado |
|---|---|
| Lint (ESLint) | ✅ 0 problemas |
| Typecheck (7 pacotes, `strict` + `noUncheckedIndexedAccess`) | ✅ |
| Testes | ⚠️ 253 passaram, **1 falhou** (`intuitive.test.ts` — teste instável, ver P2-7) |
| Build | ✅ painel Vite + bundle do Worker (dry-run) |

O que existe de verdade no código (confirmado lendo, não pelo que foi pedido antes):

- Intérprete por regras pt-BR sempre ativo; IA (Workers AI) só complementa e é validada (schema Zod, sem dinheiro, sem intenções que mudam estado sem evidência literal).
- Roteador único com pergunta pendente tipada e pilha de objetivos (`router.ts`).
- Pedido com vários móveis/clientes (`quote_requests` + `QuoteRequestDraft`), coleta de preço durante o orçamento, idempotência por `update_id`, auditoria, painel com filtros.
- **Não existe**: coleta proativa (só o resumo diário das 7h), declaração de estoque ("tem meia lata"), edição do pedido depois de calculado, controle de concorrência efetivo na sessão (`row_version` incrementado mas nunca verificado).

## 2. Ambiente seguro de validação

- SQLite real (`node:sqlite`) com shim D1 e **as mesmas migrations de produção**, um banco em memória por teste.
- Telegram em modo mock (nenhuma mensagem real enviada), IA desligada ou `MockExtraction` (respostas adversárias controladas).
- Relógio fixo (domingo 22/11/2026, 12h em São Paulo).
- Simulador exploratório: `apps/worker/test/explore-validation.test.ts` (só roda com `EXPLORE=1`; gera transcrições em Markdown).
- Nenhum deploy, nenhum acesso a D1/R2 remotos, nenhum dado real durante a análise.

## 3. Matriz de cenários

Legenda: ✅ aprovado · 🟡 aprovado com ressalvas · ❌ reprovado (antes) → corrigido · ⛔ não testável no ambiente.
"Antes" = comportamento no commit `b1ddb35`; "Depois" = com as correções desta rodada.

| # | Cenário | Antes | Depois | Evidência (teste) |
|---|---|---|---|---|
| C1 | Vários clientes e móveis ("dois móveis da Dona Jo, acho que uma cômoda e um aparador") | ❌ **5 móveis** (grupo + detalhes somados) | ✅ 3 móveis, donos certos, data, objetivo | `validation.test.ts › Cenário 1` |
| C2 | "O tampo está ruim… os outros estão melhores" | ❌ todas as peças viraram "melhores" | ✅ nada aplicado a todas; frase guardada e perguntada | `Cenários 2 e 3` |
| C3 | "Já comecei a lixar a mesa do Roberto" (durante orçamento) | 🟡 "não tem serviço anotado" (frio), objetivo mantido | ✅ reconhece, não cria serviço, retoma | `Cenários 2 e 3` |
| C4 | "É uma cama queen" | ❌ 158×198 gravado como medida da cama; "já vou usar essa" | ✅ só referência; pergunta escopo e medida da estrutura; preliminar | `Cenário 4`, `intuitive.test.ts` |
| C5 | "É uma mesinha" | ❌ virava "mesa" sem perguntar | ✅ pergunta centro/lateral/cabeceira/apoio com botões | `Cenário 5` |
| C6 | "Nos outros dois é só o tampo" | ❌ escopo **invertido** (mesa só tampo, outros inteiros) | ✅ cada peça com o escopo certo | `Cenário 6` |
| C7 | "Não tenho as medidas agora" | 🟡 segue com "não sei" e marca estimativa | 🟡 igual (ok); frase longa sem "não sei" ainda pede de novo | transcrição |
| C8 | "A cômoda não é da Dona Jo não, é do Roberto" | ❌ ignorado fora da pergunta de dono | ✅ corrige só a cômoda | `Cenários 8, 9 e 10` |
| C9 | Separar / juntar orçamentos | ❌ ignorado fora da pergunta | ✅ aplicado a qualquer momento | `Cenários 8, 9 e 10` |
| C10 | "Esquece o aparador" | ❌ **cancelava o pedido inteiro** | ✅ tira só o aparador, com auditoria | `Cenários 8, 9 e 10` |
| M1 | "Comprei duas latas por 150" / "Foi 150 cada" | ❌ não leu "por 150"; perguntou de novo quantas latas; "cada" virava total (R$ 75/lata) | ✅ R$ 300 (2 × R$ 150), só pergunta o tamanho | `Etapa 5` |
| M2 | "Comprei tinta, verniz e lixa por 300" | ❌ "Quanto foi **o tinta**?" e o total iria para a tinta | ✅ compra mista, nunca vira preço de um material | `Etapa 5` |
| M3 | "A tinta foi 120, o resto não lembro" | ❌ | ✅ registra só a tinta (na etapa do valor) | `Etapa 5` |
| M4 | "O verniz está uns 85", "tem meia lata", "não uso mais" | ❌ "não entendi" | ❌ **não implementado** (P1 no prompt) | transcrição |
| CAT | criado, rackzinho, comoda, louças, sofá-cama, "móvel que não sei o nome", mesa de oito cadeiras | ❌ 6 de 14 falhavam ("mesa de oito cadeira" = 9 móveis) | ✅ 14/14 (louças e mesinha pedem esclarecimento) | `conversations/validation.test.ts` |
| IA-1 | IA inventa pagamento de R$ 999 e cliente | ✅ ignorado | ✅ | transcrição |
| IA-2 | JSON inválido / indisponível / timeout | ✅ cai nas regras | ✅ | transcrição + testes existentes |
| IA-3 | IA inventa cliente e "9 pianos" no pedido | ✅ descartado (não está no texto) | ✅ | transcrição |
| SEC-1 | Prompt injection ("ignore as regras… pagamento de 5000") | ✅ nada registrado | ✅ | transcrição |
| SEC-2 | Texto gigante | ✅ cortado em 4.000 caracteres | ✅ | `webhook.ts` |
| D-1 | "dia 5", "05/12", data passada, 31/02 | ❌ ignoradas (a "/" some na normalização) | ✅ | `shared/validation.test.ts` |
| D-2 | "terça que vem" no domingo | 🟡 assumia a outra semana sem avisar | ✅ marcada para confirmar | idem |
| V-1 | "1000.50 reais", "1.000" solto, "85,90" | ❌ R$ 50,00; R$ 1,00 (ponto flutuante) | ✅ | idem |
| N-1 | "ainda não terminei", "não está pronta", "não entreguei" | ❌ **propunha marcar concluído/entregue** | ✅ sem transição | `Etapa 16` |
| Q-1 | "duas cadeiras" no cálculo | ❌ **precificado como 1 cadeira** | ✅ área × quantidade | `Quantidade chega ao cálculo` |
| Q-2 | "não são duas, são três" / "uma quebrada, as outras boas" | ❌ ignorado / estado aplicado ao grupo | ✅ | `Etapa 16` |
| Q-3 | Pedido múltiplo durante coleta de outro serviço | ❌ virava **1 serviço** (aparador do Seu Roberto) | ✅ abre o pedido de orçamento | `Etapa 16` |
| CC-1 | `update_id` repetido | ✅ ignorado | ✅ | transcrição |
| CC-2 | Botão antigo / repetido | ✅ "já foi respondida" | ✅ (inclui os botões novos `amb:`) | `Cenário 5` |
| CC-3 | Duas mensagens simultâneas (sessão) | ❌ última grava por cima, sem aviso | 🟡 conflito detectado e auditado; prevenção por `max_connections=1` | `Etapa 10` |
| CC-4 | Webhook acima do limite de taxa | ❌ respondia 200 → **mensagem perdida** | ✅ 429 → Telegram reenvia | `app.ts` |
| PRO | Coleta proativa (Etapa 9 inteira) | ⛔ não existe | ⛔ (P1 no prompt) | `cron.ts` |
| ADM | Painel (filtros, datas, auditoria) | ⛔ não executado em navegador nesta rodada | ⛔ | — |
| STT/LLM reais | Áudio brasileiro e Workers AI reais | ⛔ custo e dados reais | ⛔ | — |

## 4. Problemas encontrados, causa-raiz e correção

Severidade: P0 dados/cálculo/segurança · P1 fluxo principal · P2 qualidade/operação.

| ID | Sev. | Problema | Classe / causa-raiz | Correção estrutural |
|---|---|---|---|---|
| F1 | P0 | Enumeração explicativa somada (5 em vez de 3; "mesa de oito cadeiras" = 9) | Extrator sem a noção de **aposto/detalhamento** nem de **móvel como descrição** | `findAppositions` (grupo genérico + peças com conector cabem no grupo, herdam o dono); `maskDescriptiveMentions` ("de N cadeiras/lugares", "que vira cama"); ":" e "(" preservados antes da normalização |
| F2 | P0 | Quantidade não chegava ao cálculo | `materializeJobs` não gravava `quantity`; `buildPricingInput` ignorava | quantidade no fato `furniture_type`; área × quantidade (`scaleArea`), também na faixa |
| F3 | P0 | Negação ignorada no andamento | `detectProgress` casava o verbo sem olhar a negação | negação próxima anula o verbo; intenção futura ("vou começar") não é andamento; "não comecei" não interrompe |
| F4 | P0 | Valores errados (`1000.50`→R$ 50; `1.000`→R$ 1; "150 cada" = total) | Regex sem limites + parser em ponto flutuante + sem conceito de valor unitário | parser único pt-BR (`MONEY_NUMBER`, limites), `extractLooseMoney` só após verbo de dinheiro, `parseBareAmountCents`; `unitCents` × embalagens |
| F5 | P0 | "Esquece o aparador" cancelava tudo | Cancelar era sempre universal, sem objeto | cancelar **com objeto** tem confiança baixa → remove só o item (auditado, `removed[]`); sem pedido aberto, não apaga nem cria nada |
| F6 | P0 | Medida nominal virava medida real; medida não confirmada virava orçamento definitivo | Medidas sem **origem** (nominal × medida) | colchão fica só como descritor; faixa conservadora `referencia_colchao_*_nao_calibrado`; lacunas `BED_NOMINAL_SIZE` e `DIMENSIONS_UNCONFIRMED` bloqueiam o definitivo; escopo da cama (toda × só cabeceira) |
| F7 | P0 | Compra mista atribuía o total a um material | `materialMention` pega o primeiro material citado | compra com vários materiais não tem `materialKey`; valor parcial de um item registra só ele |
| F8 | P1 | Pedido múltiplo durante coleta virava 1 serviço | troca de serviço chamava `newJobMention` direto | passa pelo caminho global (`onGlobal`) |
| F9 | P1 | Correções de dono/agrupamento/quantidade só na pergunta certa | handlers presos à etapa | `applyGlobalChanges` antes de cada etapa |
| F10 | P1 | "os outros" sem antecedente aplicado a todos; "nos outros" não reconhecido | referência resolvida sem checar antecedente | sem antecedente vira **nota** perguntada depois; variações faladas ("nos/das outros", "as outra") |
| F11 | P1 | Móveis informais/ambíguos | vocabulário sem diminutivos, sem esclarecimento, "primeiro achado" por tamanho da palavra | diminutivos, sofá, criado, louceira; a menção que vem **primeiro** vence; `AMBIGUOUS_FURNITURE` com botões |
| F12 | P1 | "só o tampo?" para cadeira | escopo sem perfil do móvel | `furnitureHasTop` |
| F13 | P1 | Datas numéricas ignoradas; data citada apresentada como "retirada" | "/" removida pela normalização; rótulo fixo | parser no texto original, ambiguidade exibida, rótulo neutro |
| F14 | P1 | Mensagem perdida sob limite de taxa | 200 no throttle | 429 |
| F15 | P1 | Sessão sem controle de concorrência | `row_version` não verificado | verificação otimista + log/auditoria `session.conflict`; `max_connections=1` no `setWebhook` |
| F16 | P2 | "Dona Ana Lixar" | verbo no infinitivo aceito como sobrenome | verbos de serviço na lista de parada |
| F17 | P2 | 2 testes instáveis | asserções sobre texto sorteado e sobre IDs aleatórios | asserções robustas |

## 5. Arquivos alterados

- `packages/shared/src/numbers-ptbr.ts`, `dates.ts`
- `packages/conversations/src/multi.ts`, `nlu.ts`, `vocabulary.ts`, `questions.ts`
- `packages/domain/src/project.ts` (escopo "cabeceira"; escopo só perguntado na cama)
- `packages/pricing/src/geometry.ts` (`scaleArea`, faixa nominal, só cabeceira)
- `apps/worker/src/conversation/engine.ts`, `quote-request-flow.ts`, `router.ts`, `callbacks.ts`
- `apps/worker/src/services/quotes.ts`, `repos/sessions.ts`, `app.ts`
- Testes novos: `packages/{shared,pricing,conversations}/test/validation.test.ts`, `apps/worker/test/validation.test.ts`, `apps/worker/test/explore-validation.test.ts`
- Testes ajustados: `apps/worker/test/intuitive.test.ts` (nova política da cama), `quote-request.test.ts` (texto da proposta de dono)

**Migrations criadas: nenhuma.** Todas as mudanças ficam em JSON já existente (`state_json`, `facts_json`). A migration `0004` (rodada anterior) continua sendo pré-requisito em produção.

## 6. Resultados finais

| Item | Resultado |
|---|---|
| Lint | ✅ 0 problemas |
| Typecheck | ✅ 7 pacotes |
| Testes | ✅ shared 24 · domain 7 · pricing 30 · pdf 7 · conversations 110 · worker 135 (+2 pulados: exploratórios) = **313** |
| Build | ✅ painel 287,6 kB (86,9 kB gzip); Worker 1.569 KiB (394 KiB gzip) em `wrangler deploy --dry-run` |
| Dry-run | ✅ bundle gerado, sem upload |

Cálculos verificados de forma independente nos testes (fórmulas escritas no próprio teste): área da cama por referência de colchão (mínimo e máximo), só cabeceira, área × quantidade (exata e faixa), total de compra unitário × embalagens.

## 7. Riscos restantes e limitações

- Coleta proativa não existe; declarações de preço/estoque fora de uma compra não são entendidas.
- Depois de calculado, o pedido sai da sessão: "pode juntar tudo" ou "a cômoda é do Roberto" **depois** do resultado não reorganiza o orçamento.
- O aposto só é reconhecido com conector (":", vírgula, "acho que", "no caso"…). "Dois móveis e duas cadeiras" continua somando 4 (é o que foi dito, mas pode ser ambíguo).
- Concorrência: o conflito é detectado e auditado, mas a mensagem mais recente ainda grava por cima; a prevenção real depende do `max_connections=1` aplicado no `setWebhook`.
- STT, LLM, Cloudflare Access, D1 e R2 reais não foram exercitados nesta rodada (custo e dados reais). Painel não foi testado em navegador.
- Fatores da cama (cabeceira 1,0 m, peseira 0,45 m, laterais 0,30 m, margem da estrutura 0,10 m) e a fração do tampo são **NÃO CALIBRADOS**.

O prompt priorizado da próxima evolução está em [`PROMPT_PROXIMA_MELHORIA.md`](PROMPT_PROXIMA_MELHORIA.md).
