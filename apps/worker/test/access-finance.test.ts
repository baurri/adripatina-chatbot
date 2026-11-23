import { describe, expect, it } from "vitest";
import { ADMIN_TG, STRANGER_TG, count, createHarness } from "./harness.js";
import { api, artisanCreatesQuote, fakeVerifier } from "./helpers.js";
import { processUpdate } from "../src/telegram/webhook.js";
import { calculateQuote, issueDocuments, approveQuote, sendDocumentToArtisan, DomainError } from "../src/services/quotes.js";
import { getActiveSettings, saveSettingsVersion } from "../src/repos/catalog.js";
import { jobEconomics, recordConsumption, recordPayment, recordPurchase } from "../src/repos/finance.js";
import { MockExtraction } from "../src/ai/providers.js";
import { sha256Hex } from "@adripatina/shared";

describe("Acesso e segurança (aceites 22–26)", () => {
  it("23. remetente fora da allowlist recebe negação genérica; username não concede acesso", async () => {
    const h = await createHarness();
    const n = h.telegram.sent.length;
    await processUpdate(h.ctx, {
      update_id: 77,
      message: { message_id: 1, from: { id: STRANGER_TG, username: "Admin Família" }, chat: { id: STRANGER_TG, type: "private" }, date: 0, text: "Peguei uma cristaleira da dona Maria" },
    });
    const reply = h.telegram.sent.slice(n);
    expect(reply).toHaveLength(1);
    expect(reply[0]!.text).toMatch(/^Desculpe, este bot é de uso privado./);
    expect(reply[0]!.text).not.toMatch(/Maria|S-0|R$/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    // botões de estranhos também são ignorados
    await processUpdate(h.ctx, { update_id: 78, callback_query: { id: "c", from: { id: STRANGER_TG }, data: "pay:confirm" } });
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments")).toBe(0);
  });

  it("comandos de admin no Telegram só funcionam para ADMIN autenticado por ID", async () => {
    const h = await createHarness();
    const denied = await h.send("/admin");
    expect(h.allText(denied)).toBe("Esse comando não está disponível.");
    const ok = await h.send("/admin", ADMIN_TG);
    expect(h.allText(ok)).toMatch(/Resumo administrativo/);
    const alerts = await h.send("/alertas", ADMIN_TG);
    expect(h.allText(alerts)).toMatch(/sem preço de reposição/);
  });

  it("/aprovar no Telegram pede confirmação e respeita bloqueios", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    await h.click("calc:yes");
    const code = (await h.ctx.db.first<{ code: string }>("SELECT code FROM jobs"))!.code;
    const r = await h.send(`/aprovar ${code}`, ADMIN_TG);
    expect(h.allText(r)).toMatch(/Aprovar .* pelo valor recomendado/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'APROVADO'")).toBe(0);
    await h.send("sim", ADMIN_TG);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'APROVADO'")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'quote.transition'")).toBeGreaterThan(0);
  });

  it("25. API administrativa exige JWT válido do Cloudflare Access", async () => {
    const h = await createHarness();
    expect((await api(h, "GET", "/dashboard/summary", undefined, "")).status).toBe(401);
    expect((await api(h, "GET", "/dashboard/summary", undefined, "jwt-forjado")).status).toBe(401);
    expect((await api(h, "GET", "/dashboard/summary", undefined, "jwt-outsider")).status).toBe(403);
    expect((await api(h, "GET", "/dashboard/summary")).status).toBe(200);
    // sem verificador configurado em produção: nenhum bypass
    const prod = await h.app(null, "production").request("/api/v1/admin/dashboard/summary");
    expect(prod.status).toBe(401);
    // health não exige auth e não vaza segredos
    const health = await h.app(fakeVerifier).request("/api/v1/health");
    expect(health.status).toBe(200);
    expect(JSON.stringify(await health.json())).not.toMatch(/secret|token|DB/i);
  });

  it("webhook exige o header secreto do Telegram", async () => {
    const h = await createHarness();
    const app = h.app(fakeVerifier);
    const bad = await app.request("/api/v1/telegram/webhook", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(bad.status).toBe(401);
    const good = await app.request("/api/v1/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, from: { id: STRANGER_TG }, chat: { id: STRANGER_TG, type: "private" }, date: 0, text: "oi" } }),
      headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "segredo-de-teste" },
    });
    expect(good.status).toBe(200);
  });

  it("22/24. documentos privados: interno nunca vai ao artesão, chat não autorizado é recusado, download exige admin", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    const job = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id;
    const q = await calculateQuote(h.ctx, job, h.adminId);
    await approveQuote(h.ctx, q.id, h.adminId, {});
    const docs = await issueDocuments(h.ctx, q.id, h.adminId, { preliminary: false });
    await expect(sendDocumentToArtisan(h.ctx, docs.internal.id, h.adminId, "1001")).rejects.toBeInstanceOf(DomainError);
    await expect(sendDocumentToArtisan(h.ctx, docs.commercial.id, h.adminId, "55555")).rejects.toBeInstanceOf(DomainError);
    expect((await api(h, "GET", `/documents/${docs.commercial.id}/download`, undefined, "")).status).toBe(401);
    const dl = await api(h, "GET", `/documents/${docs.commercial.id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.res.headers.get("cache-control")).toContain("no-store");
    // lista de documentos não expõe chaves do R2
    const list = await api(h, "GET", `/quotes/${q.id}/documents`);
    expect(JSON.stringify(list.json)).not.toContain("documents/");
    // nenhum documento enviado automaticamente a ninguém
    expect(h.telegram.sent.filter((s) => s.kind === "document")).toHaveLength(0);
  });

  it("26. falha da IA não impede consultas nem registro por texto", async () => {
    const h = await createHarness();
    const failing = new MockExtraction();
    failing.fail = true;
    h.ctx.ai.extraction = failing;
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina");
    const r = await h.send("meus serviços");
    expect(h.allText(r)).toMatch(/Seus serviços/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    // extração ambígua com IA falhando → regras
    await h.send("xpto blablabla qwerty");
    expect(await count(h, "SELECT COUNT(*) AS n FROM ai_usage WHERE success = 0")).toBeGreaterThan(0);
  });

  it("IA que sugere preço é ignorada (somente o motor calcula)", async () => {
    const h = await createHarness();
    const ai = new MockExtraction();
    ai.response = { intent: "new_job", confidence: 0.9, furnitureType: "comoda", precoFinal: 1, orcamento: 99999 };
    h.ctx.ai.extraction = ai;
    await h.send("aquela peça grande da Joana precisa de um trato");
    const facts = await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs");
    expect(facts?.facts_json ?? "").not.toMatch(/99999/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes")).toBe(0);
  });
});

describe("Financeiro integrado (aceites 5, 10, 11, 12)", () => {
  it("11. pagamentos parciais, estorno e saldo em centavos exatos (idempotente)", async () => {
    const h = await createHarness();
    const { json } = await api(h, "POST", "/jobs", { description: "Mesa de centro, verniz" });
    const jobId = json!.id as string;
    await h.ctx.db.run("UPDATE jobs SET contracted_cents = 100001 WHERE id = ?", jobId);
    const p1 = await api(h, "POST", `/jobs/${jobId}/payments`, { amountCents: 33333 });
    expect(p1.status).toBe(201);
    const again = await api(h, "POST", `/jobs/${jobId}/payments`, { amountCents: 33333 });
    expect(again.json!.kind).toBe("duplicate");
    await recordPayment(h.ctx, { jobId, amountCents: 33334, actor: "t", idempotencyKey: "k2" });
    await recordPayment(h.ctx, { jobId, amountCents: 1000, kind: "ESTORNO", actor: "t", idempotencyKey: "k3" });
    const bal = await api(h, "POST", `/jobs/${jobId}/payments`, { amountCents: 33334, reference: "pix final" });
    const b = bal.json!.balance as { paidCents: number; balanceCents: number; status: string };
    expect(b.paidCents).toBe(33333 + 33334 - 1000 + 33334);
    expect(b.balanceCents).toBe(100001 - b.paidCents);
    expect(b.status).toBe("PARCIAL");
  });

  it("5. compra registrada não duplica o custo de consumo no resultado", async () => {
    const h = await createHarness();
    await h.calibrateAndPrice();
    const { json } = await api(h, "POST", "/jobs", { description: "Cômoda" });
    const jobId = json!.id as string;
    await h.ctx.db.run("UPDATE jobs SET contracted_cents = 50000 WHERE id = ?", jobId);
    const verniz = (await h.ctx.db.first<{ id: string }>("SELECT id FROM materials WHERE key = 'verniz'"))!.id;
    await recordPurchase(h.ctx, { materialId: verniz, description: "verniz", amountCents: 9000, packages: 1, jobId, actor: "t", idempotencyKey: "p1" });
    // consumo de meia lata (0,45 L de 0,9 L a R$ 90) = R$ 45 de custo econômico
    await recordConsumption(h.ctx, { jobId, quoteId: null, materialId: verniz, quantity: "0.45", replacementUnitCostCents: "10000", source: "COMPRA", actor: "t" });
    const e = await jobEconomics(h.ctx, jobId);
    expect(e.materialConsumptionCents).toBe(4500);
    expect(e.purchaseCashCents).toBe(9000);
    expect(e.economicResultBeforeOwnLaborCents).toBe(50000 - 4500); // sem somar a compra
    expect(e.cashFlowCents).toBe(0 - 9000);
    // estoque restante 0,45 L com custo histórico preservado
    const inv = await api(h, "GET", "/inventory");
    const line = (inv.json!.rows as { key: string; quantity: string; avgHistoricalUnitCostCents: string }[]).find((r) => r.key === "verniz")!;
    expect(line.quantity).toBe("0.45");
    expect(line.avgHistoricalUnitCostCents).toBe("10000");
  });

  it("10. preço abaixo do piso: bloqueado sem justificativa; aprovado com exceção auditada", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    await h.click("calc:yes");
    const q = (await h.ctx.db.first<{ id: string; floor_cents: number }>("SELECT id, floor_cents FROM quotes"))!;
    const low = q.floor_cents - 1000;
    const noJust = await api(h, "POST", `/quotes/${q.id}/approve`, { finalPriceCents: low });
    expect(noJust.status).toBe(422);
    const noFlag = await api(h, "POST", `/quotes/${q.id}/approve`, { finalPriceCents: low, justification: "cliente antiga" });
    expect(noFlag.status).toBe(422);
    const ok = await api(h, "POST", `/quotes/${q.id}/approve`, { finalPriceCents: low, approveBelowFloor: true, justification: "Cliente antiga, peça pequena para portfólio" });
    expect(ok.status).toBe(200);
    expect(ok.json!.finalPriceCents).toBe(low);
    expect(await count(h, "SELECT COUNT(*) AS n FROM approval_requests WHERE kind = 'excecao_abaixo_do_piso' AND status = 'APROVADA'")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'quote.transition' AND after_json LIKE '%portfólio%'")).toBe(1);
  });

  it("12. recalcular após mudar parâmetros não altera snapshots/PDFs já emitidos", async () => {
    const h = await createHarness();
    await artisanCreatesQuote(h);
    await h.calibrateAndPrice();
    const jobId = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id;
    const q = await calculateQuote(h.ctx, jobId, h.adminId);
    await approveQuote(h.ctx, q.id, h.adminId, {});
    const docs = await issueDocuments(h.ctx, q.id, h.adminId, { preliminary: false });
    const snapBefore = await h.ctx.db.first<{ sha256: string; snapshot_json: string }>("SELECT sha256, snapshot_json FROM quote_snapshots");
    const pdfBefore = await sha256Hex(h.bucket.objects.get(docs.commercial.r2Key)!.bytes);

    const s = await getActiveSettings(h.ctx);
    await saveSettingsVersion(h.ctx, h.adminId, { ...s.params, incomeIdealCents: 600000 }, s.business, "teste");
    const q2 = await calculateQuote(h.ctx, jobId, h.adminId);
    expect(q2.id).not.toBe(q.id); // nova versão, a antiga é preservada
    expect(q2.version).toBe(2);
    expect(q2.recommendedCents!).toBeGreaterThan(q.recommendedCents!);

    const snapAfter = await h.ctx.db.first<{ sha256: string; snapshot_json: string }>("SELECT sha256, snapshot_json FROM quote_snapshots WHERE quote_id = ?", q.id);
    expect(snapAfter).toEqual(snapBefore);
    expect(await sha256Hex(h.bucket.objects.get(docs.commercial.r2Key)!.bytes)).toBe(pdfBefore);
    // banco impede alteração direta
    await expect(h.ctx.db.run("UPDATE quote_snapshots SET sha256 = 'x'")).rejects.toThrow(/imutável/);
    await expect(h.ctx.db.run("UPDATE quote_documents SET r2_key = 'x'")).rejects.toThrow(/imutável/);
    // revisão gera nova versão do documento com o mesmo número
    await approveQuote(h.ctx, q2.id, h.adminId, {});
    const docs2 = await issueDocuments(h.ctx, q2.id, h.adminId, { preliminary: false });
    expect(docs2.commercial.number).toBe(docs.commercial.number);
    expect(docs2.commercial.docVersion).toBe(2);
  });

  it("9 (integração). terceirização sem cotação confirmada impede aprovação definitiva", async () => {
    const h = await createHarness();
    await h.send("Peguei uma cadeira do seu João para fazer pátina");
    await h.click("ans:bom");
    await h.send("90 de altura, 45 de largura e 45 de fundura");
    await h.send("os dois, madeira e estofado"); // pergunta específica de cadeira
    await h.click("ans:nao");
    await h.send("sim, o assento vai para o tapeceiro");
    await h.calibrateAndPrice();
    const jobId = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id;
    const q = await calculateQuote(h.ctx, jobId, h.adminId);
    expect(q.result.blockers.map((b) => b.code)).toContain("SUBCONTRACT_UNCONFIRMED");
    const r = await api(h, "POST", `/quotes/${q.id}/approve`, {});
    expect(r.status).toBe(422);
    // cotação confirmada libera
    await api(h, "POST", `/jobs/${jobId}/subcontracts`, { scope: "Tapeçaria do assento", costCents: 15000, logisticsCents: 2000, confirmed: true, leadDays: 5 });
    await api(h, "PATCH", `/jobs/${jobId}/facts`, { field: "application_method", value: "pincel" });
    const q2 = await calculateQuote(h.ctx, jobId, h.adminId);
    expect(q2.result.blockers.map((b) => b.code)).not.toContain("SUBCONTRACT_UNCONFIRMED");
  });
});

describe("Administração de duplicidades e mesclagem segura", () => {
  it("mesclar preserva pagamentos e mensagens; desfazer restaura tudo", async () => {
    const h = await createHarness();
    const a = (await api(h, "POST", "/jobs", { description: "cristaleira da dona Maria" })).json!.id as string;
    const b = (await api(h, "POST", "/jobs", { description: "cristaleira grande (Maria)" })).json!.id as string;
    await api(h, "PATCH", `/jobs/${a}/facts`, { field: "furniture_type", value: { type: "cristaleira", descriptors: [] } });
    await api(h, "PATCH", `/jobs/${a}/facts`, { field: "client_name", value: "Dona Maria" });
    await api(h, "PATCH", `/jobs/${b}/facts`, { field: "furniture_type", value: { type: "cristaleira", descriptors: ["grande"] } });
    await api(h, "PATCH", `/jobs/${b}/facts`, { field: "client_name", value: "Dona Maria" });
    await api(h, "PATCH", `/jobs/${b}/facts`, { field: "techniques", value: ["patina"] });
    await recordPayment(h.ctx, { jobId: b, amountCents: 20000, actor: "t", idempotencyKey: "m1" });

    const scan = await api(h, "POST", "/duplicates/scan", {});
    expect(scan.json!.found).toBe(1);
    const list = await api(h, "GET", "/duplicates");
    expect((list.json!.rows as unknown[]).length).toBe(1);

    expect((await api(h, "POST", "/duplicates/merge", { sourceJobId: b, targetJobId: a, reason: "" })).status).toBe(422);
    const m = await api(h, "POST", "/duplicates/merge", { sourceJobId: b, targetJobId: a, reason: "mesmo móvel, cadastrado duas vezes" });
    expect(m.status).toBe(201);
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments WHERE job_id = ?", a)).toBe(1);
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs WHERE id = ?", b))!.status).toBe("MESCLADO");
    const facts = JSON.parse((await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", a))!.facts_json);
    expect(facts.techniques.value).toEqual(["patina"]); // fato ausente no alvo copiado

    const undo = await api(h, "POST", `/merges/${m.json!.mergeId}/undo`, {});
    expect(undo.status).toBe(200);
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments WHERE job_id = ?", b)).toBe(1);
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs WHERE id = ?", b))!.status).toBe("ORCAMENTO");
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action IN ('job.merge','job.merge_undo')")).toBe(2);
    expect(await count(h, "SELECT COUNT(*) AS n FROM duplicate_suspicions WHERE status = 'DISTINTOS'")).toBe(1);
  });

  it("IA/varredura nunca mescla sozinha: só registra suspeita", async () => {
    const h = await createHarness();
    for (let i = 0; i < 2; i++) {
      const id = (await api(h, "POST", "/jobs", { description: "cômoda da Ana" })).json!.id as string;
      await api(h, "PATCH", `/jobs/${id}/facts`, { field: "furniture_type", value: { type: "comoda", descriptors: [] } });
      await api(h, "PATCH", `/jobs/${id}/facts`, { field: "client_name", value: "Ana" });
    }
    await api(h, "POST", "/duplicates/scan", {});
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs WHERE status = 'MESCLADO'")).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM duplicate_suspicions WHERE status = 'ABERTA'")).toBe(1);
  });
});

describe("Painel: validação e proteção", () => {
  it("configurações geram nova versão auditada e validam percentuais", async () => {
    const h = await createHarness();
    const bad = await api(h, "PATCH", "/settings", { params: { taxRatePct: "100" } });
    expect(bad.status).toBe(422);
    const ok = await api(h, "PATCH", "/settings", { params: { incomeMinCents: 320000 }, business: { phone: "(11) 90000-0000" } });
    expect(ok.status).toBe(200);
    expect(await count(h, "SELECT COUNT(*) AS n FROM settings_versions")).toBe(2);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'settings.update'")).toBe(1);
  });

  it("mutação de outra origem é recusada (CSRF)", async () => {
    const h = await createHarness();
    const res = await h.app(fakeVerifier).request("http://painel.local/api/v1/admin/jobs", {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": "jwt-admin", "content-type": "application/json", origin: "https://malicioso.example", host: "painel.local" },
      body: JSON.stringify({ description: "teste" }),
    });
    expect(res.status).toBe(403);
  });

  it("CSV de relatórios protege contra injeção de fórmula", async () => {
    const h = await createHarness();
    await api(h, "POST", "/jobs", { description: "=HYPERLINK(\"x\")" });
    const r = await api(h, "GET", "/reports/profitability?format=csv");
    expect(r.status).toBe(200);
  });
});
