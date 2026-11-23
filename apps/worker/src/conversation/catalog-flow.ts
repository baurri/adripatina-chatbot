import {
  ATTRIBUTES,
  asksForPrice,
  parseAnswer,
  catalogAttributesFor,
  describePreset,
  dimensionQuestion,
  furnitureLabel,
  isQuestionToBot,
  keyTermsOf,
  nominalDimensions,
  parseCatalogDimensions,
  pickAmongCandidates,
  shortlistFurniture,
  suggestPreset,
  usesCatalogDimensionOrder,
  type AttributeKey,
  type AttributeValue,
  type CatalogType,
  type MessagePlan,
} from "@adripatina/conversations";
import { isRealMeasurement, type FactValueMap, type ProjectField } from "@adripatina/domain";
import { normalizeText } from "@adripatina/shared";
import { chooseAmong, composeMessage, interpretOption } from "../ai/orchestrator.js";
import { getJob, setFact, type Job } from "../repos/jobs.js";
import { loadFurnitureCatalog, type LoadedCatalog } from "../repos/furniture.js";
import type { Conversation } from "./engine.js";

/**
 * Integração do catálogo mestre com a conversa:
 *  1) qual é o móvel de verdade ("armário" → de quarto, cozinha, banheiro...?);
 *  2) medida na ordem certa para o tipo, com hipótese nominal explícita (colchão ≠ estrutura);
 *  3) perguntas específicas do tipo (portas, gavetas, estofado, exposição ao tempo...).
 * Uma pergunta por vez; respostas que não respondem voltam para o fluxo comum (sem beco sem saída).
 */

export type CatalogStep = { kind: "kind" } | { kind: "dims"; hint: string | null } | { kind: "attr"; key: AttributeKey };

type FT = FactValueMap["furniture_type"];

export async function ensureCatalog(c: Conversation): Promise<LoadedCatalog> {
  if (!c.furnitureCatalog) c.furnitureCatalog = await loadFurnitureCatalog(c.ctx);
  return c.furnitureCatalog;
}

function ftOf(job: Job): FT | undefined {
  return job.facts.furniture_type?.value as FT | undefined;
}

export function catalogTypeSync(c: Conversation, job: Job): CatalogType | null {
  const key = ftOf(job)?.catalogKey;
  if (!key || !c.furnitureCatalog) return null;
  return c.furnitureCatalog.types.find((t) => t.key === key) ?? null;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

async function saveFt(c: Conversation, jobId: string, value: FT): Promise<void> {
  await setFact(c.ctx, jobId, "furniture_type", value, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true, changeKind: "set" });
}

/**
 * Classifica o móvel no catálogo a partir do texto. Termo genérico → candidatos guardados
 * para perguntar (ou a IA escolhe entre eles com confiança alta). Devolve uma nota para o artesão.
 */
export async function classifyFurniture(c: Conversation, jobId: string, text: string): Promise<string | null> {
  const job = await getJob(c.ctx, jobId);
  const fv = job ? ftOf(job) : undefined;
  if (!job || !fv) return null;
  const cat = await ensureCatalog(c);
  if (!fv.catalogKey) {
    // a escolha já feita (ex.: botão "De centro" → mesa + "de centro") vale mais que o texto genérico
    const chosen = `${furnitureLabel(fv.type)} ${(fv.descriptors ?? []).join(" ")}`.trim();
    const byChoice = (fv.descriptors ?? []).length ? shortlistFurniture(chosen, cat.types, cat.ambiguous) : null;
    const sl = byChoice?.status === "match" ? byChoice : shortlistFurniture(text, cat.types, cat.ambiguous);
    let key = sl.status === "match" && sl.best && sl.best.key !== "movel_nao_identificado" ? sl.best.key : null;
    const candidates = sl.status === "ambiguous" ? sl.candidates.map((x) => x.key).slice(0, 4) : [];
    if (!key && candidates.length > 1) {
      const choice = await chooseAmong(
        c.ctx,
        "tipo de móvel",
        text,
        candidates.map((k) => ({ key: k, name: cat.types.find((t) => t.key === k)?.name ?? k })),
      );
      if (choice?.chosenKey) key = choice.chosenKey;
    }
    if (key) {
      const t = cat.types.find((x) => x.key === key)!;
      const { kindTerm: _t, kindCandidates: _c, ...rest } = fv;
      await saveFt(c, jobId, { ...rest, catalogKey: key, type: t.legacyKey ?? fv.type });
    } else if (candidates.length > 1) {
      await saveFt(c, jobId, { ...fv, kindTerm: sl.term ?? fv.type, kindCandidates: candidates });
      return null;
    } else return null;
  }
  return applyCatalogPreset(c, jobId, text);
}

/**
 * Sugere a medida de referência (ex.: colchão queen). Só preenche sozinho quando o preset
 * permite (autoSuggest e sem exigência de confirmação) — e sempre como HIPÓTESE nominal.
 */
export async function applyCatalogPreset(c: Conversation, jobId: string, text: string): Promise<string | null> {
  const job = await getJob(c.ctx, jobId);
  if (!job) return null;
  const type = catalogTypeSync(c, job) ?? (await ensureCatalog(c)).types.find((t) => t.key === ftOf(job)?.catalogKey) ?? null;
  if (!type) return null;
  const dims = job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined;
  if (dims && isRealMeasurement(dims)) return null;
  const preset = suggestPreset(type, text);
  if (!preset || !preset.autoSuggest || preset.requiresConfirmation || dims) return null;
  await setFact(c.ctx, jobId, "dimensions", nominalDimensions(preset), { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, status: "unconfirmed", correction: true });
  if (preset.dimensionKind === "mattress") {
    return `${cap(type.name.replace(/^Cama /, "").replace(/^de /, ""))} normalmente se refere ao ${describePreset(preset)}, mas a estrutura da cama costuma ser um pouco maior.`;
  }
  return `${type.name} costuma ter ${describePreset(preset)}, mas cada peça é de um jeito.`;
}

function attrAnswered(job: Job, key: AttributeKey): boolean {
  const fv = ftOf(job);
  if (key === "doors_count") return fv?.doors !== undefined || fv?.attributes?.doors_count !== undefined;
  if (key === "drawers_count") return fv?.drawers !== undefined || fv?.attributes?.drawers_count !== undefined;
  if (key === "work_scope") return !!job.facts.scope || fv?.attributes?.work_scope !== undefined;
  return fv?.attributes?.[key] !== undefined;
}

/** Hint de medida padrão para a pergunta de medidas (quando há referência que precisa de confirmação). */
function presetHint(type: CatalogType, dims: FactValueMap["dimensions"] | undefined): string | null {
  if (dims && !isRealMeasurement(dims) && dims.kind === "mattress") return "Se não tiver como medir agora, tudo bem: uso a medida do colchão como referência e deixo isso anotado.";
  const p = suggestPreset(type) ?? type.presets[0];
  if (!p) return null;
  if (p.dimensionKind === "mattress") return `Se for o tamanho padrão (${describePreset(p)}), pode só me dizer "é o padrão".`;
  return `Se não souber, pode dizer "é o padrão" que eu uso ${describePreset(p)} como referência.`;
}

/**
 * Próximo passo do catálogo. O tipo (quando genérico) vem primeiro; escopo, medidas e
 * perguntas específicas entram no ponto das medidas do fluxo comum.
 */
export async function nextCatalogStep(c: Conversation, job: Job, nextFieldIn: ProjectField | null): Promise<CatalogStep | null> {
  let nextField = nextFieldIn;
  const fv = ftOf(job);
  if (!fv) return null;
  if (fv.kindCandidates?.length && !fv.catalogKey) return { kind: "kind" };
  await ensureCatalog(c);
  const type = catalogTypeSync(c, job);
  if (!type) return null;
  const dims = job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined;
  const dimsReached = nextField === "dimensions" || nextField === "size_class" || !!job.facts.dimensions || !!job.facts.size_class || nextField === null;
  if (!dimsReached) return null;
  const attrs = catalogAttributesFor(type).filter((k) => !attrAnswered(job, k));
  if (attrs.includes("work_scope")) return { kind: "attr", key: "work_scope" };
  const asked = c.session.context.nominalAsked ?? [];
  const nominalPending = !!dims && !isRealMeasurement(dims) && !dims.standardConfirmed && !asked.includes(job.id);
  const nominalSettled = !!dims && !isRealMeasurement(dims) && (dims.standardConfirmed || asked.includes(job.id));
  if (nominalSettled && nextField === "dimensions") nextField = null;
  if ((nextField === "dimensions" && usesCatalogDimensionOrder(type.measurementSchema)) || nominalPending) return { kind: "dims", hint: presetHint(type, dims) };
  // as demais perguntas do tipo vêm DEPOIS da medida (a do fluxo comum, quando o esquema é o de caixa)
  if (nextField === "dimensions" || nextField === "size_class") return null;
  const nextAttr = attrs.find((k) => k !== "extension" || !!job.facts.dimensions);
  return nextAttr ? { kind: "attr", key: nextAttr } : null;
}

function plan(c: Conversation, purpose: string, fallback: string, question: string, extraKeys: string[] = [], facts: string[] = []): MessagePlan {
  return { purpose, fallback, question, keyTerms: keyTermsOf(question, extraKeys), facts, greet: false, recent: c.recentBotTexts(), topicEmoji: null };
}

export async function askCatalogStep(c: Conversation, job: Job, step: CatalogStep, prefix: string): Promise<void> {
  const type = catalogTypeSync(c, job);
  const fv = ftOf(job)!;
  c.session.flow = "collecting";
  c.session.context.unparsedCount = 0;
  if (step.kind === "kind") {
    const cat = await ensureCatalog(c);
    const names = (fv.kindCandidates ?? []).map((k) => cat.types.find((t) => t.key === k)?.name.toLowerCase() ?? k);
    const term = fv.kindTerm ?? fv.type;
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}` : names[0] ?? "";
    const question = `Esse ${term} é qual destes: ${list}?`.replace(/^Esse (mesinha|mesa|cama|estante|bancada)/, "Essa $1");
    c.session.lastQuestion = null;
    c.session.context.catalogQ = { kind: "kind", jobId: job.id, tries: 0 };
    c.setPending({ type: "furniture_kind", entity: { kind: "job", id: job.id } });
    const msg = await composeMessage(c.ctx, plan(c, "clarify_furniture_kind", question, question, names.slice(0, 2)));
    c.say(`${prefix}${msg.text}`);
    return;
  }
  if (!type) return;
  if (step.kind === "dims") {
    const question = dimensionQuestion(type, { presetHint: step.hint ?? undefined });
    c.session.lastQuestion = "dimensions";
    c.session.context.catalogQ = { kind: "dims", jobId: job.id, tries: 0 };
    c.setPending({ type: "item_dimensions", entity: { kind: "job", id: job.id }, field: "dimensions" });
    const core = question.split("\n\n")[0]!;
    const msg = await composeMessage(c.ctx, { ...plan(c, "ask_dimensions", question, core), topicEmoji: "📏" });
    c.say(`${prefix}${msg.text}`);
    return;
  }
  const spec = ATTRIBUTES[step.key];
  const question = spec.question(type);
  c.session.lastQuestion = null;
  c.session.context.catalogQ = { kind: "attr", key: step.key, jobId: job.id, tries: 0 };
  c.setPending({ type: "furniture_detail", entity: { kind: "job", id: job.id } });
  const msg = await composeMessage(c.ctx, plan(c, `ask_${step.key}`, question, question));
  c.say(`${prefix}${msg.text}`);
}

const DONT_KNOW = /\b(nao sei|nao lembro|sei la|nao faco ideia|nao tenho ideia|tanto faz)\b/;

async function saveAttr(c: Conversation, job: Job, key: AttributeKey, value: AttributeValue): Promise<void> {
  const fv = ftOf(job)!;
  const attributes = { ...(fv.attributes ?? {}), [key]: value };
  const next: FT = { ...fv, attributes };
  if (key === "doors_count" && typeof value === "number") next.doors = value;
  if (key === "drawers_count" && typeof value === "number") next.drawers = value;
  await saveFt(c, job.id, next);
  if (key === "work_scope" && (value === "tampo" || value === "inteiro" || value === "cabeceira")) {
    await setFact(c.ctx, job.id, "scope", { part: value }, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true });
  }
  if (key === "extension" && typeof value === "object") {
    const dims = job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined;
    if (dims) await setFact(c.ctx, job.id, "dimensions", { ...dims, open: value }, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true });
  }
}

function describeAttr(key: AttributeKey, v: AttributeValue): string {
  if (v === "nao_informado") return "";
  switch (key) {
    case "doors_count":
      return `${v} portas`;
    case "drawers_count":
      return `${v} gavetas`;
    case "door_type":
      return v === "correr" ? "portas de correr" : v === "abrir" ? "portas de abrir" : "portas de abrir e de correr";
    case "upholstery_scope":
      return v === "madeira" ? "só a madeira" : v === "estofado" ? "só o estofado" : "madeira e estofado";
    case "exposure":
      return v === "coberta" ? "fica em área coberta" : v === "interna" ? "fica dentro de casa" : v === "sol_e_chuva" ? "pega sol e chuva" : `pega ${v}`;
    case "work_scope":
      return v === "inteiro" ? "a peça inteira" : `só ${v === "tampo" ? "o tampo" : "a cabeceira"}`;
    case "seats_count":
      return `${v} lugares`;
    case "modules":
      return `${v} módulos`;
    case "extension":
      return typeof v === "object" && v.width ? `aberta com ${v.width.replace(".", ",")} m` : "medida aberta anotada";
    default:
      return typeof v === "boolean" ? (v ? "sim" : "não") : String(v);
  }
}

/** Intenções que nunca são resposta a uma pergunta do catálogo (o fluxo comum trata). */
const OTHER_INTENTS = ["new_job", "register_expense", "register_payment", "job_progress", "query_status", "list_jobs", "agenda", "cancel", "help", "menu", "pause", "back", "correction"];
/** Respostas de outras perguntas que podem vir fora de hora ("sem pressa", "metade na entrega"). */
const OTHER_FIELDS: ProjectField[] = ["deadline", "payment_terms", "logistics", "application_method", "material_status"];

/** Interpreta a resposta a um passo do catálogo. false = não era resposta (segue o fluxo comum). */
export async function catalogAnswer(c: Conversation, job: Job, text: string, nluIntent: string): Promise<boolean> {
  const q = c.session.context.catalogQ;
  if (!q) return false;
  // a resposta é lida ANTES das intenções globais ("a cama inteira" cita o móvel, mas responde a pergunta);
  // só interrupções claras (gasto, pagamento, cancelar...) e pedido de valor saem direto
  if ((OTHER_INTENTS.includes(nluIntent) && nluIntent !== "new_job") || asksForPrice(text)) return false;
  const elsewhere = nluIntent === "new_job";
  const otherAnswer = OTHER_FIELDS.some((f) => {
    if (job.facts[f]) return false;
    const a = parseAnswer(f, text);
    return a.kind === "value" && a.strength === "specific";
  });
  if (q.jobId !== job.id) {
    delete c.session.context.catalogQ;
    return false;
  }
  const cat = await ensureCatalog(c);
  const norm = normalizeText(text);
  const done = async (ack: string | null) => {
    delete c.session.context.catalogQ;
    if (ack) c.ack = ack;
    await c.askNext((await getJob(c.ctx, job.id))!);
    return true;
  };

  if (q.kind === "kind") {
    const fv = ftOf(job)!;
    const cands = fv.kindCandidates ?? [];
    if (isQuestionToBot(text)) {
      c.say(`Pergunto porque cada tipo tem medidas e partes diferentes, e isso muda o valor. 🙂\n\n${(await nextQuestionText(c, job)) ?? ""}`.trim());
      return true;
    }
    let pick = pickAmongCandidates(text, cands, cat.types, fv.kindTerm ?? "")?.key ?? null;
    if (!pick) {
      const choice = await chooseAmong(c.ctx, "tipo de móvel", text, cands.map((k) => ({ key: k, name: cat.types.find((t) => t.key === k)?.name ?? k })), `pergunta: qual tipo de ${fv.kindTerm ?? fv.type}`);
      pick = choice?.chosenKey ?? null;
    }
    if (pick) {
      const t = cat.types.find((x) => x.key === pick)!;
      const { kindTerm: _t, kindCandidates: _c, ...rest } = fv;
      await saveFt(c, job.id, { ...rest, catalogKey: pick, type: t.legacyKey ?? fv.type });
      const note = await applyCatalogPreset(c, job.id, `${t.name} ${text}`);
      return done(`Anotado: ${t.name.toLowerCase()}.${note ? `\n\n${note}` : ""}`);
    }
    if (elsewhere) return false;
    // não respondeu o tipo: segue com o nome genérico e trata a mensagem no fluxo comum
    const { kindTerm: _t, kindCandidates: _c, ...rest } = fv;
    await saveFt(c, job.id, rest);
    delete c.session.context.catalogQ;
    if (DONT_KNOW.test(norm) || nluIntent === "dont_know") return done(null);
    return false;
  }

  const type = catalogTypeSync(c, job);
  if (!type) {
    delete c.session.context.catalogQ;
    return false;
  }

  if (q.kind === "dims") {
    const dims = job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined;
    const kind = type.measurementSchema === "width_length" ? "external" : type.legacyKey === "mesa" ? "top" : "external";
    const r = parseCatalogDimensions(text, type.measurementSchema, kind);
    const aboutSize = /\b(medi\w*|medida\w*|tamanho|trena|padrao|colchao|estrutura)\b/.test(norm);
    if (r.kind === "none" || (r.kind !== "dims" && !aboutSize && (otherAnswer || elsewhere))) {
      // tamanho por porte, outra resposta fora de hora etc.: o fluxo comum resolve
      delete c.session.context.catalogQ;
      return false;
    }
    const asked = new Set(c.session.context.nominalAsked ?? []);
    asked.add(job.id);
    c.session.context.nominalAsked = [...asked].slice(-30);
    if (r.kind === "dims") {
      await setFact(c.ctx, job.id, "dimensions", r.dims, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true });
      const shown = [r.dims.width, r.dims.depth, r.dims.height].filter(Boolean).map((v) => v!.replace(".", ","));
      return done(`Anotei: ${r.dims.diameter ? `${r.dims.diameter.replace(".", ",")} m de diâmetro` : `${shown.join(" × ")} m`}. 📏`);
    }
    if (r.kind === "standard") {
      const preset = dims?.presetKey ? null : suggestPreset(type) ?? type.presets[0] ?? null;
      const base = dims && !isRealMeasurement(dims) ? dims : preset ? nominalDimensions(preset) : null;
      if (!base) return false;
      await setFact(c.ctx, job.id, "dimensions", { ...base, standardConfirmed: true }, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, status: "confirmed", correction: true });
      return done("Combinado! Uso a medida padrão como referência e deixo isso escrito no orçamento. ✅");
    }
    if (r.kind === "dont_know" && dims && !isRealMeasurement(dims)) {
      return done("Sem problema! Por enquanto uso a medida de referência só para uma estimativa. Quando puder medir, é só me mandar.");
    }
    // tamanho por porte, "não sei" sem referência etc.: o fluxo comum de medidas resolve
    delete c.session.context.catalogQ;
    return false;
  }

  // pergunta específica do tipo
  const key = q.key as AttributeKey;
  const spec = ATTRIBUTES[key];
  if (isQuestionToBot(text)) {
    c.say(`Boa pergunta! ${spec.why}\n\n${spec.question(type)}`);
    return true;
  }
  let value: AttributeValue | null = spec.parse(text, type);
  // medidas ditas durante outra pergunta: o fluxo comum guarda (nunca "não entendi")
  const saidMeasures = parseCatalogDimensions(text, "width_depth_height").kind === "dims" && /\b(altura|largura|fundura|profundidade|comprimento|metros?|cm|por|x)\b/.test(norm);
  if (value === null && (otherAnswer || elsewhere || saidMeasures)) return false;
  if (value === null && spec.options) {
    const opt = await interpretOption(c.ctx, key, spec.question(type), text, spec.options);
    if (opt !== null) value = opt === "sim" ? true : opt === "nao" ? false : opt;
  }
  if (value === null && (DONT_KNOW.test(norm) || nluIntent === "dont_know")) value = "nao_informado";
  if (value !== null) {
    await saveAttr(c, job, key, value);
    const d = describeAttr(key, value);
    return done(d ? `Anotado: ${d}.` : null);
  }
  q.tries = (q.tries ?? 0) + 1;
  if (q.tries >= 2) {
    // não insiste: segue sem esse detalhe
    await saveAttr(c, job, key, "nao_informado");
    delete c.session.context.catalogQ;
    return false;
  }
  c.say(`Acho que não entendi essa. 🙂\n\n${spec.question(type)}`);
  return true;
}

async function nextQuestionText(c: Conversation, job: Job): Promise<string | null> {
  const fv = ftOf(job);
  if (!fv?.kindCandidates?.length) return null;
  const cat = await ensureCatalog(c);
  const names = fv.kindCandidates.map((k) => cat.types.find((t) => t.key === k)?.name.toLowerCase() ?? k);
  return `Qual destes é o seu: ${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}?`;
}

/** Medida nominal já tratada (confirmada como padrão ou "não sei medir"): não perguntar de novo. */
export function nominalSettled(c: Conversation, job: Job): boolean {
  const dims = job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined;
  return !!dims && !isRealMeasurement(dims) && (!!dims.standardConfirmed || (c.session.context.nominalAsked ?? []).includes(job.id));
}
