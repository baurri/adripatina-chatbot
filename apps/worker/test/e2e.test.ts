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
    expect(h.allText(after)).toMatch(/administrador conferir/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'AGUARDANDO_REVISAO'")).toBe(1);
    await processOutbox(h.ctx);
    expect(h.telegram.sent.some((s) => s.chatId === String(ADMIN_TG) && /aguardando revisão/.test(s.text ?? ""))).toBe(true);

    // admin aprova (o preço do dia a dia não precisou de aprovação dele)
    const q1 = (await h.ctx.db.first<{ id: string }>("SELECT id FROM quotes"))!.id;
    const ok = await api(h, "POST", `/quotes/${q1}/approve`, {});
    expect(ok.status).toBe(200);
    expect(ok.json!.status).toBe("APROVADO");
    const quote = await api(h, "GET", `/quotes/${q1}`);
    const result = (quote.json!.quote as { result: { materials: { lines: { materialKey: string; consumptionCostCents: number; inventoryUsed: string; purchaseCashOutlayCents: number }[] }; floorCents: number; recommendedCents: number } }).result;
    // FIN-ESTOQUE-001 em integração: base de pátina em estoque é cobrada pelo preço de reposição
    const baseLine = result.materials.lines.find((l) => l.materialKey === "tinta_base_patina")!;
    expect(baseLine.inventoryUsed).toBe("0.45");
    expect(baseLine.consumptionCostCents).toBeGreaterThan(0);
    expect(result.floorCents).toBeLessThanOrEqual(result.recommendedCents);

    // artesão é avisado e pede o PDF
    h.telegram.clear();
    await processOutbox(h.ctx);
    const notice = h.telegram.sent.find((s) => s.chatId === String(ARTISAN_TG));
    expect(notice?.text).toMatch(/foi aprovado/);
    expect(buttonsOf(notice)).toContain(`pdf:issue:${q1}`);
    const pdfReplies = await h.click(`pdf:issue:${q1}`);
    const doc = h.telegram.sent.find((s) => s.kind === "document");
    expect(doc).toBeDefined();
    expect(doc!.chatId).toBe(String(ARTISAN_TG)); // somente ao artesão (aceite 24)
    expect(doc!.filename).toBe("Proposta-AP-2026-0001-v1.pdf");
    const text = pdfText(doc!.bytes!);
    expect(text).toContain("adripatina");
    expect(text).toContain("Dona Maria");
    for (const forbidden of ["markup", "Piso", "piso", "margem", "estoque", "fornecedor", "4010", "hora "]) expect(text).not.toContain(forbidden);
    expect(buttonsOf(pdfReplies[pdfReplies.length - 1])).toContain(`outcome:accept:${q1}`);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'ENVIADO'")).toBe(1);

    // cliente aceitou → valor contratado
    await h.click(`outcome:accept:${q1}`);
    const job = await h.ctx.db.first<{ contracted_cents: number; status: string }>("SELECT contracted_cents, status FROM jobs WHERE id = ?", jobId);
    expect(job!.contracted_cents).toBe(result.recommendedCents);
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
    expect(s.receivablesCents).toBe(result.recommendedCents - 20000);
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

  it("sem revisão obrigatória e sem pendências, orçamento fica pronto para PDF", async () => {
    const h = await createHarness({ requireAdminReview: false });
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    const r = await h.click("calc:yes");
    expect(h.allText(r)).toMatch(/Quer que eu gere o PDF/);
  });
});
