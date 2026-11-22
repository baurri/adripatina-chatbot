# Workers AI — modelos, custos e limites

**Conferido na documentação oficial da Cloudflare em 22/11/2026** (páginas de modelos com data de 12/08/2026 e de preços com data de 18/11/2026). Preços mudam: confira de novo antes de ligar a IA.

## Modelos sugeridos (configuráveis, nada hardcoded)
| Uso | Variável | Modelo sugerido | Observações |
|---|---|---|---|
| Transcrição | `AI_STT_MODEL` | `@cf/openai/whisper-large-v3-turbo` | `audio` em base64, `language: "pt"`. Limite de tamanho **não documentado** — o sistema limita a 300 s / 10 MB. |
| Extração | `AI_EXTRACTION_MODEL` | `@cf/mistralai/mistral-small-3.1-24b-instruct` | Saída estruturada via `guided_json`. Suporte a português não declarado na página; validado por testes reais pendentes. |
| Visão (opcional) | `AI_VISION_MODEL` | vazio (desligado). Opção: `@cf/moondream/moondream3.1-9B-A2B` | Só sugere tipo/estado; nunca medidas ou valores. |

## Preços (página oficial)
- US$ 0,011 por 1.000 neurons acima da franquia; **10.000 neurons/dia grátis** (Free e Paid), zerando 00:00 UTC.
- Whisper large-v3-turbo: ~46,63 neurons/min de áudio (≈ US$ 0,0005/min).
- Mistral Small 3.1: 31.876 neurons/M tokens de entrada, 50.488/M de saída (≈ US$ 0,35 / 0,56 por M).

## Estimativa de operação (hipóteses)
Hipótese: 30 áudios/dia × 40 s, 40 mensagens/dia que precisam de IA (~800 tokens entrada + 120 saída cada).
- STT: 30 × 0,67 min × 46,63 ≈ **930 neurons/dia**
- Extração: 40 × (800 × 0,0319 + 120 × 0,0505) ≈ **1.260 neurons/dia**
- Total ≈ **2.200 neurons/dia**, abaixo da franquia diária de 10.000 → custo de IA **provavelmente US$ 0**. Mesmo com 5× o volume (~11.000/dia) seria ~US$ 0,01/dia.
- Regras resolvem a maioria das mensagens sem IA (só chamamos a IA quando a confiança das regras é < 0,9).

## Controles implementados
- `AI_ENABLED=false` por padrão em todos os ambientes; local não tem binding de IA.
- Teto operacional `AI_DAILY_REQUEST_LIMIT` (janela de 24 h) — **não é garantia de teto na fatura Cloudflare**.
- Timeout (8 s extração, 30 s STT), retry no STT, circuit breaker (3 falhas → pausa de 5 min), fallback para regras/texto.
- Telemetria em `ai_usage` (neurons e custo **estimados**) e tela "Uso de IA" no painel.
- Recomenda-se também configurar alertas de faturamento no painel Cloudflare.

## Outros custos (Workers Paid já contratado)
D1, R2 e Workers têm franquias generosas para o volume de uma oficina; verifique a página de preços atual antes de produção. R2 cobra armazenamento e operações (sem egress). Nada foi criado.
