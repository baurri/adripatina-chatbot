import { describe, expect, it } from "vitest";
import { interpretRules } from "@adripatina/conversations";
import { decideRoute } from "../src/conversation/router.js";
import type { PendingQuestion } from "../src/repos/sessions.js";

const pending = (type: PendingQuestion["type"]): PendingQuestion => ({ type, entity: { kind: "job" }, askedAt: "2026-11-22T00:00:00Z" });

describe("Política única de roteamento contextual", () => {
  it("13/17. resposta de condição vence intenção global (nunca vira andamento)", () => {
    const nlu = interpretRules("Um deles a mesinha de centro está com o tampo precisando de reparos os outros estão melhores");
    const d = decideRoute({ nlu, flow: "collecting", pendingQuestion: pending("item_condition"), plausibleAnswer: true });
    expect(d.route).toBe("pending_answer");
    expect(d.contextualIntent).toBe("item_condition_answer");
    expect(d.rawIntent).not.toBe("job_progress");
  });

  it("17. intenção global de média confiança não sobrescreve pergunta pendente", () => {
    const nlu = { ...interpretRules("como está"), intent: "query_status" as const, confidence: 0.6 };
    const d = decideRoute({ nlu, flow: "quote_request", pendingQuestion: pending("item_dimensions"), plausibleAnswer: false });
    expect(d.route).toBe("active_goal");
  });

  it("intenção vinda só da IA nunca interrompe a pergunta pendente ('entrada agora, metade na entrega')", () => {
    const rules = interpretRules("entrada agora metade na entrega");
    const nlu = { ...rules, intent: "agenda" as const, confidence: 0.95, source: "ai" as const };
    const d = decideRoute({ nlu, flow: "collecting", pendingQuestion: pending("deadline" as never), plausibleAnswer: false });
    expect(d.route).not.toBe("interruption");
  });

  it("18. comando inequívoco ainda funciona durante fluxo ativo", () => {
    const d = decideRoute({ nlu: interpretRules("cancelar"), flow: "quote_request", pendingQuestion: pending("item_owner"), plausibleAnswer: false });
    expect(d.route).toBe("universal");
    expect(d.contextualIntent).toBe("cancel");
  });

  it("19. pagamento explícito com valor interrompe (objetivo será retomado)", () => {
    const d = decideRoute({ nlu: interpretRules("A dona Maria me pagou 200 reais"), flow: "quote_request", pendingQuestion: pending("item_identity"), plausibleAnswer: false });
    expect(d.route).toBe("interruption");
    expect(d.activeGoal).toBe("quote_request");
  });

  it("andamento explícito interrompe; durante a coleta de preço, 'comprei por 90' é resposta", () => {
    expect(decideRoute({ nlu: interpretRules("já comecei a mesa do Roberto"), flow: "collecting", pendingQuestion: pending("item_dimensions"), plausibleAnswer: false }).route).toBe("interruption");
    const d = decideRoute({ nlu: interpretRules("comprei por 90 reais"), flow: "quote_material_pricing", pendingQuestion: pending("material_purchase_price"), plausibleAnswer: true });
    expect(d.route).toBe("pending_answer");
  });

  it("sem objetivo: intenção global; sem nada reconhecido: fallback", () => {
    expect(decideRoute({ nlu: interpretRules("quais serviços eu tenho?"), flow: "idle", pendingQuestion: null, plausibleAnswer: false }).route).toBe("global");
    expect(decideRoute({ nlu: interpretRules("xpto qwerty"), flow: "idle", pendingQuestion: null, plausibleAnswer: false }).route).toBe("fallback");
  });
});
