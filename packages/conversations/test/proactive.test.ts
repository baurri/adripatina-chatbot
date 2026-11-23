import { describe, expect, it } from "vitest";
import {
  canSendNow,
  checkMessageStyle,
  composeQuestion,
  confirmTotalText,
  countEmojis,
  detectNeeds,
  interpretCollectionAnswer,
  isWithinWindow,
  localDayStart,
  parseProactiveSettings,
  rankNeeds,
  scoreNeed,
  validateContextRephrase,
  zonedParts,
  type MaterialSnap,
  type SendState,
  type Snapshot,
} from "../src/index.js";

const NOW = new Date("2026-11-16T13:00:00Z"); // segunda, 10:00 em São Paulo
const settings = parseProactiveSettings({ enabled: true });

function mat(p: Partial<MaterialSnap> & { key: string }): MaterialSnap {
  return {
    id: `id-${p.key}`,
    name: p.key.charAt(0).toUpperCase() + p.key.slice(1),
    baseUnit: "L",
    packageSize: "3.6",
    priceCents: 9000,
    priceUpdatedAt: NOW.toISOString(),
    origin: "telegram_confirmed",
    active: true,
    mutedUntil: null,
    stockCheckedAt: NOW.toISOString(),
    stockQty: null,
    minStock: null,
    recipeUses: 1,
    activeJobUses: 0,
    upcomingJobUses: 0,
    blockedQuotes: [],
    recentlyMentioned: false,
    ...p,
  };
}

function snap(materials: MaterialSnap[], extra: Partial<Snapshot> = {}): Snapshot {
  return { now: NOW, materials, jobs: [], techniques: [], ...extra };
}

const kinds = (s: Snapshot) => detectNeeds(s, settings).map((n) => `${n.kind}:${n.reason}:${n.entityKey}`);

describe("detector de necessidades", () => {
  it("1. material relevante sem preço", () => {
    expect(kinds(snap([mat({ key: "verniz", priceCents: null, priceUpdatedAt: null })]))).toContain("material_price:price_missing:verniz");
  });
  it("2. preço marcado como demonstração", () => {
    expect(kinds(snap([mat({ key: "verniz", origin: "demo_only" })]))).toContain("material_price:price_demo:verniz");
  });
  it("3. preço desatualizado (validade de preço, não um prazo único)", () => {
    const old = new Date(NOW.getTime() - 120 * 86_400_000).toISOString();
    expect(kinds(snap([mat({ key: "verniz", priceUpdatedAt: old })]))).toContain("material_price:price_stale:verniz");
    const recent = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    expect(kinds(snap([mat({ key: "verniz", priceUpdatedAt: recent })]))).not.toContain("material_price:price_stale:verniz");
  });
  it("4. preço real conhecido mas embalagem sem tamanho", () => {
    expect(kinds(snap([mat({ key: "verniz", packageSize: "0" })]))).toContain("material_package_size:package_size_invalid:verniz");
  });
  it("5. estoque desatualizado e estoque negativo", () => {
    const old = new Date(NOW.getTime() - 45 * 86_400_000).toISOString();
    expect(kinds(snap([mat({ key: "lixa", baseUnit: "folha", stockCheckedAt: old })]))).toContain("stock_level:stock_stale:lixa");
    expect(kinds(snap([mat({ key: "lixa", baseUnit: "folha", stockQty: "-3" })]))).toContain("stock_level:stock_negative:lixa");
  });
  it("6. técnica não calibrada usada em serviços (sem observação recente)", () => {
    const s = snap([], { techniques: [{ id: "t1", key: "verniz_tec", name: "Envernizamento", calibrated: false, usedInJobs: 2, coatingMaterial: { key: "verniz", name: "Verniz" }, recentObservation: false }] });
    expect(kinds(s)).toContain("technique_coats:technique_uncalibrated:verniz_tec");
    const observed = snap([], { techniques: [{ id: "t1", key: "verniz_tec", name: "Envernizamento", calibrated: false, usedInJobs: 2, coatingMaterial: { key: "verniz", name: "Verniz" }, recentObservation: true }] });
    expect(kinds(observed)).toHaveLength(0);
  });
  it("7. orçamento bloqueado por preço ausente", () => {
    const needs = detectNeeds(snap([mat({ key: "verniz", priceCents: null, blockedQuotes: [{ quoteId: "q1", jobId: "j1", jobTitle: "Mesa da Dona Ana" }] })]), settings);
    expect(needs[0]).toMatchObject({ kind: "material_price", reason: "quote_blocked", benefit: { jobId: "j1", quoteId: "q1" } });
  });
  it("8. campo vazio irrelevante não vira pergunta (material sem uso, sem preço)", () => {
    expect(kinds(snap([mat({ key: "solvente", priceCents: null, recipeUses: 0, stockCheckedAt: null })]))).toEqual([]);
    expect(kinds(snap([mat({ key: "verniz", priceCents: null, active: false })]))).toEqual([]);
    expect(kinds(snap([mat({ key: "verniz", priceCents: null, mutedUntil: new Date(NOW.getTime() + 86_400_000).toISOString() })]))).toEqual([]);
  });
  it("tipos de coleta desativados não geram necessidades", () => {
    const off = parseProactiveSettings({ enabled: true, kinds: { material_price: false } });
    expect(detectNeeds(snap([mat({ key: "verniz", priceCents: null })]), off).filter((n) => n.kind === "material_price")).toHaveLength(0);
  });
});

describe("priorização explicável", () => {
  it("9. dado que bloqueia orçamento vem antes", () => {
    const needs = detectNeeds(
      snap([
        mat({ key: "tinta", priceCents: null, recipeUses: 4 }),
        mat({ key: "verniz", priceCents: null, recipeUses: 1, blockedQuotes: [{ quoteId: "q", jobId: "j", jobTitle: "Mesa" }] }),
      ]),
      settings,
    );
    const ranked = rankNeeds(needs, 0);
    expect(ranked[0]!.need.entityKey).toBe("verniz");
    expect(ranked[0]!.score.reasons.join(" ")).toMatch(/Orçamento em andamento travado/);
  });
  it("10. material usado com frequência vem antes de um pouco usado", () => {
    const ranked = rankNeeds(detectNeeds(snap([mat({ key: "cera", priceCents: null, recipeUses: 1 }), mat({ key: "verniz", priceCents: null, recipeUses: 5 })]), settings), 0);
    expect(ranked.map((r) => r.need.entityKey)).toEqual(["verniz", "cera"]);
  });
  it("tentativas e 'não sei' reduzem a prioridade, com motivo registrado", () => {
    const [n] = detectNeeds(snap([mat({ key: "verniz", priceCents: null })]), settings);
    const base = scoreNeed(n!).score;
    const after = scoreNeed({ ...n!, signals: { ...n!.signals, attempts: 1, dontKnowCount: 1 } });
    expect(after.score).toBe(base - 25);
    expect(after.reasons.join(" ")).toMatch(/Já perguntado 1 vez.*não sabia/);
  });
});

describe("política de envio", () => {
  const idle: SendState = { sentToday: 0, sentLast7Days: 0, lastSentAt: null, waitingRequest: false, lastActivityAt: null, flowIdle: true };
  it("15. limite diário", () => {
    expect(canSendNow(settings, { ...idle, sentToday: 1 }, NOW)).toEqual({ ok: false, reason: "limite_diario" });
  });
  it("16. intervalo mínimo", () => {
    const sevenHoursAgo = new Date(NOW.getTime() - 7 * 3_600_000).toISOString();
    expect(canSendNow({ ...settings, maxPerDay: 3 }, { ...idle, lastSentAt: sevenHoursAgo }, NOW)).toEqual({ ok: false, reason: "intervalo_minimo" });
  });
  it("17/18. horário permitido no fuso America/Sao_Paulo", () => {
    // 11:00 UTC = 08:00 em SP (antes da janela); 13:00 UTC = 10:00 (dentro)
    expect(isWithinWindow(settings, new Date("2026-11-16T11:00:00Z")).ok).toBe(false);
    expect(isWithinWindow(settings, NOW).ok).toBe(true);
    expect(zonedParts(new Date("2026-11-17T02:30:00Z"), "America/Sao_Paulo")).toMatchObject({ dateKey: "2026-11-16", hour: 23 });
    expect(localDayStart(NOW, "America/Sao_Paulo").toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
  it("19. madrugada, domingo e pausa global bloqueiam", () => {
    expect(canSendNow(settings, idle, new Date("2026-11-16T06:00:00Z"))).toEqual({ ok: false, reason: "fora_do_horario" });
    expect(canSendNow(settings, idle, new Date("2026-11-15T13:00:00Z"))).toEqual({ ok: false, reason: "dia_nao_permitido" });
    expect(canSendNow({ ...settings, pausedUntil: "2026-12-01T00:00:00Z" }, idle, NOW)).toEqual({ ok: false, reason: "pausado" });
    expect(canSendNow({ ...settings, enabled: false }, idle, NOW)).toEqual({ ok: false, reason: "desativado" });
  });
  it("20. pergunta aguardando resposta e conversa ativa bloqueiam", () => {
    expect(canSendNow(settings, { ...idle, waitingRequest: true }, NOW)).toEqual({ ok: false, reason: "aguardando_resposta" });
    expect(canSendNow(settings, { ...idle, flowIdle: false }, NOW)).toEqual({ ok: false, reason: "conversa_ativa" });
    expect(canSendNow(settings, { ...idle, lastActivityAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }, NOW)).toEqual({ ok: false, reason: "conversa_ativa" });
    expect(canSendNow(settings, idle, NOW)).toEqual({ ok: true });
  });
  it("padrões conservadores: começa desligada, 1 por dia, sem domingo", () => {
    const d = parseProactiveSettings({});
    expect(d).toMatchObject({ enabled: false, maxPerDay: 1, timezone: "America/Sao_Paulo", showButtons: false });
    expect(d.allowedWeekdays).not.toContain(0);
  });
});

describe("mensagens", () => {
  const spec = { kind: "material_price" as const, reason: "quote_blocked" as const, subject: "verniz", baseUnit: "L", firstName: "Adriano", greet: true, seed: 0 };
  it("22/23/24. contexto correto, espaçamento e emoji moderado", () => {
    const m = composeQuestion(spec);
    expect(m.text).toBe("Oi, Adriano! 🎨\n\nQuero continuar aquele orçamento, mas preciso atualizar o preço do verniz.\n\nQuanto está custando a lata que você costuma comprar?");
    expect(countEmojis(m.text)).toBeLessThanOrEqual(2);
    expect(checkMessageStyle(m.text)).toEqual([]);
  });
  it("25. uma pergunta principal (sem agrupar assuntos)", () => {
    for (const kind of ["material_price", "material_package_size", "stock_level", "job_actual_hours", "technique_coats"] as const) {
      const t = composeQuestion({ ...spec, kind, reason: kind === "stock_level" ? "stock_unknown" : "price_missing", knownPriceCents: 8500, jobTitle: "cômoda", techniqueName: "envernizamento" }).text;
      expect((t.match(/\?/g) ?? []).length).toBeLessThanOrEqual(2);
      expect(t.split("\n\n").length).toBeLessThanOrEqual(3);
    }
  });
  it("estoque: '<nome>, posso conferir uma coisa do estoque? 📦' + pergunta", () => {
    expect(composeQuestion({ ...spec, kind: "stock_level", reason: "stock_unknown", subject: "lixa", baseUnit: "folha" }).text).toBe(
      "Adriano, posso conferir uma coisa do estoque? 📦\n\nQuantas folhas de lixa você acha que ainda temos?",
    );
  });
  it("26. sem tom infantil, linguagem técnica ou pressão", () => {
    for (const bad of ["Oi querido! Campo nulo?", "Você ainda não respondeu?", "Esta é a terceira tentativa, responda?"]) expect(checkMessageStyle(bad)).toContain("termo_proibido");
    const t = composeQuestion(spec).text;
    expect(t).not.toMatch(/autis|campo|replacement|null|tentativa/i);
  });
  it("reescrita da IA só é aceita se não mudar o sentido", () => {
    const base = "Quero continuar aquele orçamento, mas preciso atualizar o preço do verniz.";
    expect(validateContextRephrase(base, "Queria seguir com aquele orçamento, só falta atualizar o preço do verniz.", "verniz")).toBeTruthy();
    expect(validateContextRephrase(base, "O verniz custa R$ 90 agora.", "verniz")).toBeNull();
    expect(validateContextRephrase(base, "Quanto custa o verniz?", "verniz")).toBeNull();
    expect(validateContextRephrase(base, "Preciso atualizar um preço.", "verniz")).toBeNull();
    expect(validateContextRephrase(base, { not: "string" }, "verniz")).toBeNull();
  });
});

describe("interpretação das respostas", () => {
  it("29. 'uns 85 reais' é valor aproximado", () => {
    expect(interpretCollectionAnswer("material_price", "Uns 85 reais", { baseUnit: "L" })).toMatchObject({ kind: "price", amountCents: 8500, approximate: true });
  });
  it("30. 'acho que umas 12' é estoque estimado", () => {
    expect(interpretCollectionAnswer("stock_level", "Acho que umas 12", { baseUnit: "folha" })).toMatchObject({ kind: "quantity", quantity: "12", approximate: true });
    expect(interpretCollectionAnswer("stock_level", "deve ter meia lata", { baseUnit: "L", packageSize: "3.6" })).toMatchObject({ kind: "quantity", quantity: "1.8", label: "meia lata", approximate: true });
    expect(interpretCollectionAnswer("stock_level", "acabou", { baseUnit: "folha" })).toMatchObject({ kind: "quantity", quantity: "0" });
  });
  it("32/33. 'comprei duas latas por 150' não decide sozinho total × unitário", () => {
    const a = interpretCollectionAnswer("material_price", "Comprei duas latas por 150", { baseUnit: "L" });
    expect(a).toMatchObject({ kind: "price", amountCents: 15000, packages: 2, perPackage: false });
    expect(interpretCollectionAnswer("material_price", "duas latas, 75 cada uma", { baseUnit: "L" })).toMatchObject({ perPackage: true });
    expect(confirmTotalText({ packages: 2, amountCents: 15000, baseUnit: "L" })).toMatch(/^Entendi: foram 2 latas por R\$ 150,00 no total, certo\?/);
  });
  it("31. tamanho da embalagem: '1 litro', '900 ml', número solto", () => {
    expect(interpretCollectionAnswer("material_price", "1 litro", { baseUnit: "L", expecting: "size" })).toMatchObject({ kind: "size", packageSize: "1" });
    expect(interpretCollectionAnswer("material_price", "900 ml", { baseUnit: "L", expecting: "size" })).toMatchObject({ kind: "size", packageSize: "0.9" });
    expect(interpretCollectionAnswer("material_price", "3,6", { baseUnit: "L", expecting: "size" })).toMatchObject({ kind: "size", packageSize: "3.6" });
  });
  it("respostas negativas, adiamentos e descontinuado", () => {
    expect(interpretCollectionAnswer("material_price", "não lembro agora", { baseUnit: "L" }).kind).toBe("dont_know");
    expect(interpretCollectionAnswer("material_price", "pergunta amanhã", { baseUnit: "L" }).kind).toBe("later");
    expect(interpretCollectionAnswer("material_price", "não uso mais essa tinta", { baseUnit: "L" }).kind).toBe("discontinued");
    expect(interpretCollectionAnswer("material_price", "sim, no total", { baseUnit: "L", expecting: "confirm" }).kind).toBe("yes");
    expect(interpretCollectionAnswer("material_price", "não, cada uma", { baseUnit: "L", expecting: "confirm" })).toEqual({ kind: "no", perPackage: true });
  });
  it("horas e demãos", () => {
    expect(interpretCollectionAnswer("job_actual_hours", "umas 6 horas e meia", {})).toMatchObject({ kind: "hours", hours: "6.5", approximate: true });
    expect(interpretCollectionAnswer("job_actual_hours", "uns dois dias", {}).kind).toBe("needs_hours");
    expect(interpretCollectionAnswer("technique_coats", "duas demãos", {})).toMatchObject({ kind: "coats", coats: 2 });
  });
});
