import { describe, expect, it } from "vitest";
import { ADMIN_TG, ARTISAN_TG, buttonsOf, count, createHarness } from "./harness.js";
import { processOutbox } from "../src/services/outbox.js";
import { api, artisanCreatesQuote, pdfText } from "./helpers.js";

describe("Fluxo ponta a ponta (aceite 28)", () => {
  it("cliente → serviço → orçamento → revisão → aprovação → PDF → aceite → pagamento → saldo", async () => {
    const h = await createHarness();
    const jobId = await artisanCreatesQuote(h);

    // material em estoque: meia lata da base de pátina, comprada há anos por preço antigo
    const base = await h.ctx.db.first<{ id: string }>("SELECT id FROM materials WHERE key = 'tinta_base_patina'");
    await h.ctx.db.run("INSERT INTO stock_movements (id, material_id, kind, quantity, historical_unit_cost_cents, created_at) VALUES ('s1', ?, 'ENTRADA', '0.45', '1000', '2020-01-01T00:00:00Z')", base!.id);

    // admin calibra o catálogo, mas a base da pátina ainda não tem preço:
    // o bot pergunta ao Adriano em vez de travar ou mandar para o administrador
    await h.calibrateAndPrice();
    await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL WHERE key = 'tinta_base_patina'");
    const calc1 = await h.click("calc:yes");
    expect(h.allText(calc1)).toMatch(/preço atual da tinta base para pátina/i);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'AGUARDANDO_REVISAO'")).toBe(0);
    const confirm = await h.send("a lata de 900 ml custa 50 reais");
    expect(h.allText(confirm)).toMatch(/900 ml.*R\$ 50,00.*Está certo/s);
    const okData = buttonsOf(confirm[confirm.length - 1]).find((d) => d.startsWith("mp:ok:"))!;
    const after = await h.click(okData);
    expect(h.allText(after)).toMatch(/Atualizei o preço da tinta base para pátina/);
    expect(h.allText(after)).toMatch(/usa algum outro material/);
    // D-070: sem revisão do administrador — o Adriano vê a sugestão e decide o valor
    const decision = await h.click("mp:noextra");
    const dt = h.allText(decision);
    expect(dt).toMatch(/Minha sugestão é cobrar R\$/);
    expect(dt).toMatch(/você começa a ter prejuízo/);
    expect(dt).not.toMatch(/Confiança|Pendências|CALIBRADOS|administrador conferir/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'AGUARDANDO_REVISAO'")).toBe(0);
    const q1 = (await h.ctx.db.first<{ id: string }>("SELECT id FROM quotes"))!.id;
    expect(buttonsOf(decision.at(-1))).toEqual([`qa:ok:${q1}`, `qa:disc:${q1}`, `qa:add:${q1}`]);
    const quote = await api(h, "GET", `/quotes/${q1}`);
    const result = (quote.json!.quote as { result: { materials: { lines: { materialKey: string; consumptionCostCents: number; inventoryUsed: string; purchaseCashOutlayCents: number }[] }; floorCents: number; recommendedCents: number } }).result;
    // FIN-ESTOQUE-001 em integração: base de pátina em estoque é cobrada pelo preço de reposição
    const baseLine = result.materials.lines.find((l) => l.materialKey === "tinta_base_patina")!;
    expect(baseLine.inventoryUsed).toBe("0.45");
    expect(baseLine.consumptionCostCents).toBeGreaterThan(0);
    expect(result.floorCents).toBeLessThanOrEqual(result.recommendedCents);

    // dá 50 reais de desconto → PDF na hora, com o desconto destacado
    await h.click(`qa:disc:${q1}`);
    h.telegram.clear();
    const closed = await h.send("50 reais");
    const final = result.recommendedCents - 5000;
    const ct = h.allText(closed);
    if (final < result.floorCents) {
      expect(ct).toMatch(/prejuízo/);
      await h.click(`qa:force:${q1}`);
    } else expect(ct).toMatch(/Fechado!/);
    const doc = h.telegram.sent.find((s) => s.kind === "document");
    expect(doc).toBeDefined();
    expect(doc!.chatId).toBe(String(ARTISAN_TG)); // somente ao artesão (aceite 24)
    expect(doc!.filename).toBe("Proposta-AP-2026-0001-v1.pdf");
    const text = pdfText(doc!.bytes!);
    expect(text).toContain("adripatina");
    expect(text).toContain("Dona Maria");
    expect(text).toContain("Desconto");
    for (const forbidden of ["markup", "Piso", "piso", "margem", "estoque", "fornecedor", "4010", "hora "]) expect(text).not.toContain(forbidden);
    expect(buttonsOf(h.telegram.sent.filter((s) => s.kind !== "document").at(-1))).toContain(`outcome:accept:${q1}`);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'ENVIADO'")).toBe(1);
    // o administrador fica sabendo do valor fechado
    h.telegram.clear();
    await processOutbox(h.ctx);
    expect(h.telegram.sent.some((s) => s.chatId === String(ADMIN_TG) && /fechou o orçamento/.test(s.text ?? ""))).toBe(true);

    // cliente aceitou → valor contratado (o valor do Adriano, com desconto)
    await h.click(`outcome:accept:${q1}`);
    const job = await h.ctx.db.first<{ contracted_cents: number; status: string }>("SELECT contracted_cents, status FROM jobs WHERE id = ?", jobId);
    expect(job!.contracted_cents).toBe(final);
    expect(job!.status).toBe("AGUARDANDO_INICIO");

    // pagamento por linguagem natural, com confirmação, e saldo
    await h.send("A dona Maria pagou duzentos reais");
    const paid = await h.click("pay:confirm");
    expect(h.allText(paid)).toMatch(/Já recebeu R\$ 200,00/);
    expect(h.allText(paid)).toMatch(/Falta R\$/);

    // andamento
    await h.send("comecei a cristaleira da dona Maria");
    await h.click("prog:confirm");
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs WHERE id = ?", jobId))!.status).toBe("EM_EXECUCAO");

    // painel: dashboard reflete a situação
    const dash = await api(h, "GET", "/dashboard/summary");
    const s = dash.json!.summary as { activeJobs: number; receivablesCents: number; monthReceivedCents: number };
    expect(s.activeJobs).toBe(1);
    expect(s.monthReceivedCents).toBe(20000);
    expect(s.receivablesCents).toBe(final - 20000);
  });

  it("estimativa preliminar é gerada como NÃO DEFINITIVA antes da aprovação", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    await h.click("calc:yes");
    const q = (await h.ctx.db.first<{ id: string }>("SELECT id FROM quotes"))!.id;
    await h.click(`pdf:prelim:${q}`);
    const doc = h.telegram.sent.find((s) => s.kind === "document");
    expect(doc!.filename).toMatch(/^Estimativa-AP-/);
    expect(pdfText(doc!.bytes!)).toContain("NÃO DEFINITIVA".normalize("NFC").replace("Ã", "Ã"));
    // definitivo continua bloqueado sem aprovação
    const r = await h.click(`pdf:issue:${q}`);
    expect(h.allText(r)).toMatch(/ainda não foi aprovado/);
  });

  it("D-070: concordou com a sugestão → PDF definitivo na hora, sem o administrador", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    const r = await h.click("calc:yes");
    expect(h.allText(r)).toMatch(/você concorda com esse valor/);
    const q = (await h.ctx.db.first<{ id: string; recommended_cents: number }>("SELECT id, recommended_cents FROM quotes"))!;
    h.telegram.clear();
    const done = await h.send("pode ser esse");
    expect(h.allText(done)).toMatch(/Fechado!/);
    const doc = h.telegram.sent.find((s) => s.kind === "document");
    expect(doc!.filename).toMatch(/^Proposta-AP-/);
    expect(pdfText(doc!.bytes!)).not.toContain("Desconto");
    const row = (await h.ctx.db.first<{ status: string; final_price_cents: number; approved_by: string }>("SELECT status, final_price_cents, approved_by FROM quotes"))!;
    expect(row.status).toBe("ENVIADO");
    expect(row.final_price_cents).toBe(q.recommended_cents);
  });

  it("D-070: 'vou cobrar' um valor direto e acréscimo com motivo aparecem no PDF", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    await h.click("calc:yes");
    const q = (await h.ctx.db.first<{ id: string; recommended_cents: number }>("SELECT id, recommended_cents FROM quotes"))!;
    await h.click(`qa:add:${q.id}`);
    h.telegram.clear();
    const done = await h.send("100 reais do frete");
    expect(h.allText(done)).toMatch(/Fechado!/);
    const doc = h.telegram.sent.find((s) => s.kind === "document");
    expect(pdfText(doc!.bytes!)).toContain("Acréscimo (frete)");
    const row = (await h.ctx.db.first<{ final_price_cents: number }>("SELECT final_price_cents FROM quotes"))!;
    expect(row.final_price_cents).toBe(q.recommended_cents + 10000);
  });
});
