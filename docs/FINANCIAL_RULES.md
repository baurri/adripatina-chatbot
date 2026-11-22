# Regras financeiras

Implementação: `packages/pricing/src/engine.ts` (função pura `priceJob`). Versão do motor gravada em cada orçamento (`pricing-1.0.0`).

## 1. Taxa horária
```
horas_produtivas = horas_disponíveis × aproveitamento          (130 × 75% = 97,5 h)
hora_objetivo    = ((renda_alvo + custos_fixos) × (1 + reserva)) ÷ horas_produtivas
mínima ≈ 4010,2564 centavos/h (R$ 40,10)   ideal ≈ 5189,7436 centavos/h (R$ 51,90)
```
Valores mantidos em decimal exato; arredondamento apenas no total de mão de obra (para cima).
Reserva geral e custos fixos **só** entram aqui — nunca de novo por serviço (teste "aceite 6").

## 2. FIN-ESTOQUE-001 — material em estoque nunca é gratuito
Para cada material, separadamente:

| Campo | Significado | Entra no preço? |
|---|---|---|
| `consumptionCostCents` | quantidade consumida × (preço atual da embalagem ÷ volume) | **Sim, sempre** |
| `purchaseCashOutlayCents` | embalagens faltantes (considerando estoque) × preço | Não (caixa/entrada) |
| `historicalCostOfInventoryUsedCents` | valor pago no passado pelo estoque usado | Não (controle) |
| `inventoryAvailable/Used` | estoque estimado e quanto será usado | Não |

Exemplo obrigatório (testado): meia lata em casa, lata cheia R$ 120, consumo de meia lata ⇒ **R$ 60 de consumo, R$ 0 de compra**.
Preço desconhecido ⇒ `consumptionCostCents = null`, bloqueio `MATERIAL_PRICE_MISSING` — **nunca zero**.
Pergunta ao artesão: "Você já tem o material ou precisa comprar?" — a resposta muda só a compra.

## 3. Quantidade de material
```
coverage: litros = área × demãos ÷ rendimento ÷ (1 − perda)
per_m2:   quantidade = área × consumo_por_m² ÷ (1 − perda_material)
fixed:    quantidade fixa
```
Denominadores validados (perda < 100%, rendimento > 0, embalagem > 0).

## 4. Mão de obra
- `labor`: área × horas/m² + horas fixas.
- `coating`: área × demãos ÷ velocidade do método + preparo + limpeza.
- **Secagem/cura** é guardada à parte (prazo), nunca somada às horas ativas.
- Etapas comuns entre técnicas (`sharedKey`) contadas uma única vez.
- Horas extras de conserto entram via ajustes do administrador.

## 5. Piso e recomendado
```
piso        = (MO(hora mínima) + consumo + terceiros + despesas) × (1 + risco_específico) ÷ (1 − alíquota)
recomendado = (MO(hora ideal)  + consumo + terceiros + despesas) × (1 + risco_específico) × (1 + markup) ÷ (1 − alíquota)
```
- Terceiros = cotação confirmada + logística + taxa de coordenação (padrão 10%).
- Risco específico só com motivo concreto; nunca repete a reserva geral.
- Markup = **sobre o custo total**, só no recomendado (padrão 0%).
- Tributos só se `taxConfigured=true`, por gross-up explícito sobre o preço. Sem configuração, o sistema alerta que o preço não inclui impostos (não afirma conformidade fiscal).
- Recomendado nunca fica abaixo do piso.

## 6. Bloqueios (proposta definitiva impossível)
`AREA_UNKNOWN`, `TECHNIQUE_UNKNOWN`, `METHOD_REQUIRED`, `MATERIAL_UNKNOWN`, `MATERIAL_PRICE_MISSING`, `MATERIAL_YIELD_MISSING`, `UNCALIBRATED_PARAMETERS` (até aprovação justificada), `SUBCONTRACT_UNCONFIRMED`, `BELOW_FLOOR` (até aprovação justificada), mais pendências de serviço (`REPAIRS_HOURS_MISSING`, `TRANSPORT_COST_MISSING`, `CLIENT_MISSING`).
Com bloqueios ainda é possível gerar **estimativa preliminar rotulada NÃO DEFINITIVA**.

## 7. Resultado e caixa
- Resultado econômico (por serviço) = contratado − **consumo** (reposição) − despesas. A diferença remunera a mão de obra própria e a reserva.
- Fluxo de caixa = recebimentos − **compras** − despesas. Consumo de estoque não é saída de caixa.
- Compras e consumo ficam em tabelas separadas (`purchases`, `material_consumptions`) e **nunca são somados** (aceite 5).
- Situação financeira (`SEM_COBRANCA/EM_ABERTO/PARCIAL/QUITADO`) é derivada; estornos subtraem.
