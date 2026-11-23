import { packageSizeLabel, parsePriceAnswer, pricePerPackageCents, type Button, type NluResult } from "@adripatina/conversations";
import { formatBRL, newId, normalizeText } from "@adripatina/shared";
import type { Conversation } from "./engine.js";
import { getActiveSettings, getMaterialByKey } from "../repos/catalog.js";
import { getJob, jobPhrase } from "../repos/jobs.js";
import { applyConfirmedPrice } from "../services/material-pricing.js";
import { enqueueOutbox } from "../services/outbox.js";
import type { PricingCurrent, PricingState } from "../repos/sessions.js";

/**
 * Fluxo persistente `quote_material_pricing`: quando o orçamento trava por falta
 * de preço, a pendência vira perguntas curtas ao artesão (um material por vez),
 * a resposta é CONFIRMADA, o catálogo é atualizado com histórico e o orçamento
 * é recalculado automaticamente. Nada é inventado; preço zero nunca é usado.
 */

const SIZELESS_UNITS = ["folha", "un"];

function newCurrent(key: string): PricingCurrent {
  return { key, step: "ask_price", rawTexts: [], token: newId().slice(0, 8) };
}

async function materialInfo(c: Conversation, key: string): Promise<{ name: string; unit: string }> {
  const m = await getMaterialByKey(c.ctx, key);
  return { name: (m?.name ?? key).toLowerCase(), unit: m?.unit ?? "un" };
}

export async function targetPhrase(c: Conversation, p: PricingState): Promise<string> {
  if (p.target.kind === "job") {
    const job = await getJob(c.ctx, p.target.jobId);
    return job ? `d${jobPhrase(job)}` : "desse serviço";
  }
  const qr = c.session.context.quoteRequest;
  const n = qr?.draft.items.reduce((a, i) => a + i.quantity, 0) ?? 0;
  return n > 1 ? `dos ${n} móveis` : "desse serviço";
}

/** Inicia a coleta (persistida na sessão). */
export async function startPricing(c: Conversation, target: PricingState["target"], missingKeys: string[], quoteIds: string[]): Promise<void> {
  const p: PricingState = { target, quoteIds, pending: [...missingKeys], resolved: [], total: missingKeys.length, current: newCurrent(missingKeys[0]!) };
  c.session.flow = "quote_material_pricing";
  c.session.context.pricing = p;
  const names = await Promise.all(missingKeys.map(async (k) => (await materialInfo(c, k)).name));
  const where = await targetPhrase(c, p);
  if (missingKeys.length === 1) {
    c.say(`${c.firstName}, já estou quase terminando as contas ${where}. 🙂 Só falta eu saber o preço atual ${deName(names[0]!)}.`);
  } else {
    c.say(`${c.firstName}, para terminar o orçamento ${where} preciso atualizar ${missingKeys.length} materiais: ${humanList(names)}. Vou perguntar um de cada vez, é rapidinho.`);
  }
  await askCurrent(c);
}

/** "do verniz", "da tinta base..." — artigo pelo gênero da primeira palavra. */
function deName(name: string): string {
  const first = name.split(/[\s/(]/)[0] ?? name;
  return `${/a$/.test(first) ? "da" : "do"} ${name}`;
}

function humanList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/** Faz (ou refaz) a pergunta da etapa atual. */
export async function askCurrent(c: Conversation): Promise<void> {
  const p = c.session.context.pricing;
  if (!p?.current) return finishPricing(c);
  const cur = p.current;
  const { name, unit } = await materialInfo(c, cur.key);
  const progress = p.total > 1 ? `Material ${p.resolved.length + 1} de ${p.total}: ${name}.\n` : "";
  c.setPending({ type: cur.step === "ask_size" ? "material_package_size" : cur.step === "ask_price" ? "material_purchase_price" : "confirmation", entity: { kind: "material", id: cur.key } });
  switch (cur.step) {
    case "ask_price":
      c.say(
        `${progress}Quanto custa ${SIZELESS_UNITS.includes(unit) ? "a" : "a embalagem de"} ${name} que você costuma comprar? Pode falar junto o tamanho, por exemplo: "a lata de 900 ml custa 90 reais".`,
      );
      return;
    case "ask_size":
      c.say(`${progress}Boa! E essa embalagem de ${formatBRL(cur.amountCents!)} é de quanto? Por exemplo: 900 ml, 3,6 litros ou outro tamanho.`);
      return;
    case "confirm":
    case "confirm_high":
      return askConfirmation(c);
    case "fix_choice":
      c.say("Sem problema! O que você quer corrigir?", [
        [
          { text: "Corrigir valor", data: "mp:fixprice" },
          { text: "Corrigir embalagem", data: "mp:fixsize" },
        ],
      ]);
      return;
    case "paused":
      c.say(`Ainda falta o preço ${deName(name)}. Quando souber, é só me dizer, por exemplo: "a lata de 900 ml custa 90 reais".`, laterButtons());
      return;
  }
}

function unitPrice(cur: PricingCurrent): number | null {
  if (cur.amountCents === undefined) return null;
  if (cur.totalGiven && cur.packages && cur.packages > 1) return pricePerPackageCents(cur.amountCents, cur.packages);
  return cur.amountCents;
}

async function askConfirmation(c: Conversation): Promise<void> {
  const p = c.session.context.pricing!;
  const cur = p.current!;
  const { name, unit } = await materialInfo(c, cur.key);
  const price = unitPrice(cur)!;
  const size = packageSizeLabel(cur.packageSize ?? "1", unit);
  const pack = SIZELESS_UNITS.includes(unit) ? (cur.packageSize && cur.packageSize !== "1" ? `pacote com ${size}` : unit === "folha" ? "folha" : "unidade") : `embalagem de ${size}`;
  const buttons: Button[][] = [
    [
      { text: "Sim, está certo", data: `mp:ok:${cur.token}` },
      { text: "Não, quero corrigir", data: "mp:fix" },
    ],
    [{ text: "Não lembro agora", data: "mp:later" }],
  ];
  if (cur.step === "confirm_high") {
    c.say(`Só para eu ter certeza: ${pack} de ${name} custa ${formatBRL(price)} mesmo? 🤔 Esse valor ficou bem fora do que eu esperava.`, [
      [
        { text: "Sim, é isso mesmo", data: `mp:ok:${cur.token}` },
        { text: "Não, corrigir", data: "mp:fixprice" },
      ],
    ]);
    return;
  }
  if (cur.totalGiven && cur.packages && cur.packages > 1) {
    c.say(`Só para confirmar: foram ${cur.packages} embalagens de ${name}, cada uma com ${size}. O total foi ${formatBRL(cur.amountCents!)}, então cada uma saiu por ${formatBRL(price)}. Certo?`, buttons);
    return;
  }
  if (cur.confidence === "media") {
    c.say(`Você acha que ${pack === "folha" || pack === "unidade" ? `a ${pack}` : `a ${pack}`} de ${name} está por volta de ${formatBRL(price)}. Posso usar esse valor como referência atual para o orçamento?`, buttons);
    return;
  }
  c.say(`Entendi: ${name}, ${pack}, por ${formatBRL(price)}. Está certo?`, buttons);
}

function laterButtons(): Button[][] {
  return [
    [
      { text: "Continuar depois", data: "mp:later" },
      { text: "Mandar foto", data: "mp:photo" },
    ],
    [
      { text: "Ver estimativa sem esse preço", data: "mp:estimate" },
      { text: "Pedir ajuda ao administrador", data: "mp:admin" },
    ],
  ];
}

/** Resposta plausível para a etapa atual (usada pelo roteador). */
export function isPlausiblePricingAnswer(c: Conversation, text: string, nlu: NluResult): boolean {
  const p = c.session.context.pricing;
  if (!p?.current) return false;
  if (["yes", "no", "dont_know"].includes(nlu.intent)) return true;
  const a = parsePriceAnswer(text, "L", { expectPrice: true });
  return a.amountCents !== undefined || a.packageSize !== undefined || a.dontKnow || a.wantsLater || a.wantsPhoto;
}

/** Interpreta texto/transcrição dentro da coleta de preço. */
export async function pricingText(c: Conversation, text: string, nlu: NluResult): Promise<void> {
  const p = c.session.context.pricing;
  if (!p?.current) return finishPricing(c);
  const cur = p.current;
  const { unit } = await materialInfo(c, cur.key);
  const norm = normalizeText(text);

  if (cur.step === "confirm" || cur.step === "confirm_high") {
    if (nlu.intent === "yes") return onPricingCallback(c, "ok", cur.token);
    if (nlu.intent === "no") return onPricingCallback(c, cur.step === "confirm_high" ? "fixprice" : "fix");
  }
  if (cur.step === "fix_choice") {
    if (/\b(valor|preco|reais)\b/.test(norm)) return onPricingCallback(c, "fixprice");
    if (/\b(embalagem|tamanho|lata|litro|ml|galao)\b/.test(norm) && !/\d/.test(norm)) return onPricingCallback(c, "fixsize");
  }

  const a = parsePriceAnswer(text, unit, { expectPrice: cur.step !== "ask_size" });
  if (a.dontKnow && a.amountCents === undefined && a.packageSize === undefined) {
    cur.step = "paused";
    cur.rawTexts.push(text);
    c.say(
      `Sem problema nenhum, ${c.firstName}! Não vou chutar preço. 🙂 Você pode olhar depois e me contar, mandar uma foto do recibo ou da etiqueta, ou eu te mostro uma estimativa NÃO definitiva sem esse material.`,
      laterButtons(),
    );
    return;
  }
  if (a.wantsPhoto && a.amountCents === undefined) return onPricingCallback(c, "photo");
  if (a.wantsLater && a.amountCents === undefined && a.packageSize === undefined) return onPricingCallback(c, "later");

  if (a.amountCents !== undefined && a.amountCents <= 0) {
    c.say("Esse valor não dá para usar: o preço precisa ser maior que zero. Quanto custa a embalagem? Por exemplo: \"90 reais\".");
    return;
  }
  let used = false;
  if (a.amountCents !== undefined && cur.step !== "ask_size") {
    cur.amountCents = a.amountCents;
    cur.confidence = a.confidence;
    used = true;
  }
  if (a.packageSize) {
    cur.packageSize = a.packageSize;
    cur.sizeLabel = a.sizeLabel;
    used = true;
  }
  if (a.packages !== undefined) {
    cur.packages = a.packages;
    cur.totalGiven = a.packages > 1 && !a.pricePerPackage;
    used = true;
  }
  if (cur.step === "ask_size" && a.amountCents !== undefined && !a.packageSize) {
    // falou de novo o valor em vez do tamanho: atualiza o valor
    cur.amountCents = a.amountCents;
    used = true;
  }
  if (!used) {
    c.say(
      cur.step === "ask_size"
        ? 'Não peguei o tamanho. Pode dizer, por exemplo: "900 ml" ou "3,6 litros".'
        : 'Não peguei o valor. Pode dizer, por exemplo: "90 reais" ou "a lata de 900 ml custa 90".',
    );
    return;
  }
  cur.rawTexts.push(text);
  cur.sourceMessageId = c.input.inboundMessageId;
  if (SIZELESS_UNITS.includes(unit) && !cur.packageSize) cur.packageSize = "1";
  return advance(c);
}

async function advance(c: Conversation): Promise<void> {
  const p = c.session.context.pricing!;
  const cur = p.current!;
  if (cur.amountCents === undefined) {
    cur.step = "ask_price";
    if (cur.packageSize) {
      c.say(`Anotei a embalagem de ${cur.sizeLabel ?? cur.packageSize}. E quanto ela custa?`);
      c.setPending({ type: "material_purchase_price", entity: { kind: "material", id: cur.key } });
      return;
    }
    return askCurrent(c);
  }
  if (!cur.packageSize) {
    cur.step = "ask_size";
    return askCurrent(c);
  }
  const settings = await getActiveSettings(c.ctx);
  const price = unitPrice(cur)!;
  const { minPackagePriceCents, maxPackagePriceCents } = settings.params.priceSanity;
  cur.step = price > maxPackagePriceCents || price < minPackagePriceCents ? "confirm_high" : "confirm";
  return askConfirmation(c);
}

/** Botões `mp:*` (idempotentes). */
export async function onPricingCallback(c: Conversation, action: string, arg?: string): Promise<void> {
  const p = c.session.context.pricing;
  if (!p) {
    c.say("Esse orçamento já foi resolvido, não precisa fazer mais nada. 🙂");
    return;
  }
  if (action === "retry" || action === "resume") {
    if (!p.current) return finishPricing(c);
    if (p.current.step === "paused") p.current.step = p.current.amountCents !== undefined ? "confirm" : "ask_price";
    c.session.flow = "quote_material_pricing";
    return askCurrent(c);
  }
  const cur = p.current;
  if (!cur) return finishPricing(c);
  switch (action) {
    case "ok": {
      if (arg !== cur.token || (cur.step !== "confirm" && cur.step !== "confirm_high")) {
        c.say("Esse preço já está anotado. 🙂");
        return;
      }
      const { name, unit } = await materialInfo(c, cur.key);
      const price = unitPrice(cur)!;
      const res = await applyConfirmedPrice(c.ctx, {
        materialKey: cur.key,
        priceCents: price,
        packageSize: cur.packageSize ?? "1",
        packages: cur.packages ?? null,
        totalCents: cur.totalGiven ? (cur.amountCents ?? null) : null,
        confidence: cur.confidence ?? "alta",
        origin: "telegram_quote_confirmed",
        userId: c.input.user.id,
        messageId: cur.sourceMessageId ?? c.input.inboundMessageId,
        jobId: p.target.kind === "job" ? p.target.jobId : null,
        quoteId: p.quoteIds[0] ?? null,
        sourceText: cur.rawTexts.join(" | "),
        idempotencyKey: `quote-price:${cur.token}:${cur.key}`,
      observationKind: "MATERIAL_PRICE_QUOTE",
      });
      if (res.kind === "invalid") {
        cur.step = "ask_price";
        delete cur.amountCents;
        c.say(`Não consegui usar esse valor (${res.reason}). Pode me dizer de novo quanto custa a embalagem de ${name}?`);
        return;
      }
      p.resolved.push(cur.key);
      p.pending = p.pending.filter((k) => k !== cur.key);
      void unit;
      c.say(res.kind === "duplicate" ? `O preço ${deName(name)} já estava atualizado. 🙂` : `Perfeito! Atualizei o preço ${deName(name)}. Obrigado por me ensinar! 🙂`);
      const next = p.pending[0];
      p.current = next ? newCurrent(next) : null;
      if (next) return askCurrent(c);
      return finishPricing(c);
    }
    case "fix":
      cur.step = "fix_choice";
      return askCurrent(c);
    case "fixprice":
      delete cur.amountCents;
      delete cur.packages;
      cur.totalGiven = false;
      cur.step = "ask_price";
      c.say('Qual é o valor certo? Por exemplo: "90 reais".');
      c.setPending({ type: "material_purchase_price", entity: { kind: "material", id: cur.key } });
      return;
    case "fixsize":
      delete cur.packageSize;
      cur.step = cur.amountCents !== undefined ? "ask_size" : "ask_price";
      c.say('Qual é o tamanho certo da embalagem? Por exemplo: "900 ml" ou "3,6 litros".');
      c.setPending({ type: "material_package_size", entity: { kind: "material", id: cur.key } });
      return;
    case "later":
      cur.step = "paused";
      c.say(`Combinado! Guardei tudo: o orçamento e o que falta. Quando você souber o preço, é só me dizer que eu continuo de onde paramos. 😉`);
      return;
    case "photo":
      cur.step = "paused";
      c.say("Pode mandar a foto do recibo, da etiqueta ou da embalagem. Eu guardo junto do orçamento e te peço para confirmar o valor antes de usar.");
      return;
    case "estimate":
      return showEstimate(c);
    case "admin":
      await enqueueOutbox(
        c.ctx,
        "notify_admins",
        { text: `${c.input.user.displayName} não sabe agora o preço de ${(await materialInfo(c, cur.key)).name}. O orçamento está esperando esse dado (painel → Materiais).` },
        `pricing-help:${cur.token}`,
      );
      cur.step = "paused";
      c.say("Pronto, avisei o administrador. Enquanto isso o orçamento fica guardado; se você descobrir o preço antes, é só me dizer.");
      return;
    case "cancel":
      delete c.session.context.pricing;
      c.session.flow = "idle";
      c.clearPending();
      c.say("Tudo bem, parei esse orçamento. Nada foi apagado: o serviço continua anotado.");
      return;
  }
}

/** Estimativa NÃO definitiva com os preços que existem (o material sem preço fica de fora e destacado). */
async function showEstimate(c: Conversation): Promise<void> {
  const p = c.session.context.pricing!;
  const names = await Promise.all(p.pending.map(async (k) => (await materialInfo(c, k)).name));
  const lines = [`Estimativa NÃO definitiva — sem o custo de ${humanList(names)}:`];
  for (const id of p.quoteIds) {
    const q = await c.ctx.db.first<{ floor_cents: number | null; recommended_cents: number | null; job_id: string }>("SELECT floor_cents, recommended_cents, job_id FROM quotes WHERE id = ?", id);
    if (!q) continue;
    const job = await getJob(c.ctx, q.job_id);
    lines.push(`• ${job ? capitalize(jobPhrase(job)) : "Serviço"}: a partir de ${q.floor_cents !== null ? formatBRL(q.floor_cents) : "—"} (recomendado ${q.recommended_cents !== null ? formatBRL(q.recommended_cents) : "—"})`);
  }
  lines.push("", "O valor real vai ser MAIOR, porque falta somar esse material. Não use essa estimativa como proposta final.");
  c.say(lines.join("\n"), laterButtons().slice(0, 1));
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Todos os preços resolvidos → recalcular automaticamente. Falha preserva o estado. */
export async function finishPricing(c: Conversation): Promise<void> {
  const p = c.session.context.pricing;
  if (!p) return;
  if (p.total > 1 && p.pending.length === 0 && !p.recalcFailed) c.say(`Pronto! Atualizei os ${p.total} materiais. Vou recalcular o orçamento. 🧮`);
  else if (p.pending.length === 0 && !p.recalcFailed) c.say("Vou refazer as contas desse orçamento agora. 🙂");
  try {
    p.recalcFailed = false;
    c.clearPending();
    if (p.target.kind === "job") {
      const jobId = p.target.jobId;
      delete c.session.context.pricing;
      c.session.activeJobId = jobId;
      await c.calculateAndPresent(jobId);
    } else {
      delete c.session.context.pricing;
      await c.quoteRequestCalculate();
    }
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "pricing_recalc_failed", error: err instanceof Error ? err.message : "unknown" }));
    p.recalcFailed = true;
    c.session.context.pricing = p;
    c.session.flow = "quote_material_pricing";
    c.say("Tive um probleminha para refazer as contas agora. Nada se perdeu: os preços já estão guardados. Quer que eu tente de novo?", [[{ text: "Tentar de novo", data: "mp:retry" }]]);
  }
}
