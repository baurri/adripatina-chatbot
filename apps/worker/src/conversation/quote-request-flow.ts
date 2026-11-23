import {
  AMBIGUOUS_FURNITURE,
  FURNITURE,
  nounFeminine,
  conditionOf,
  extractClientName,
  extractQuoteRequest,
  findTechniques,
  furnitureHasTop,
  parseOwnerStatement,
  parseQuantityCorrection,
  pluralLabel,
  resolveAmbiguousFurniture,
  splitUnitForStatement,
  itemName,
  labelDimensions,
  matchClientInAnswer,
  mergeAiQuoteRequest,
  parseAnswer,
  parseFurnitureList,
  parseGrouping,
  parseClientsRelation,
  parseItemStatements,
  partOf,
  techniqueLabel,
  type MentionedClient,
  type MentionedItem,
  type NluResult,
  type QuoteRequestDraft,
} from "@adripatina/conversations";
import { Dec, allocateCents, formatBRL, isoToBR, newId, normalizeText, parseBareAmountCents } from "@adripatina/shared";
import type { FactValueMap } from "@adripatina/domain";
import type { Conversation } from "./engine.js";
import { nowIso } from "../context.js";
import { auditStmt } from "../repos/audit.js";
import { getActiveSettings } from "../repos/catalog.js";
import { createJob, getJob, setFact, transitionJob } from "../repos/jobs.js";
import { recordMaterialSourceObservation } from "../services/learning.js";
import { missingPriceKeys } from "../services/material-pricing.js";
import { approveQuote, calculateQuote, getOverrides, saveOverrides, submitForReview, type QuoteRecord } from "../services/quotes.js";
import type { QuoteRequestState } from "../repos/sessions.js";
import { startPricing } from "./pricing-flow.js";
import { interpretQuoteRequestAnswer, type QrAiResult } from "./quote-request-ai.js";
import { presentMultiQuoteDecision } from "./quote-decision-flow.js";

/**
 * Objetivo persistente CALCULATE_QUOTE para pedidos com vários móveis/clientes.
 * Tudo o que foi dito é preservado no rascunho; ambiguidades viram perguntas
 * curtas, uma por vez, na ordem de maior ganho de informação. Serviços
 * definitivos só são criados depois que as associações importantes foram
 * confirmadas.
 */

const TECH_MATERIAL_WORD: Record<string, string> = {
  verniz: "verniz",
  pintura_lisa: "tinta",
  patina: "tinta da pátina",
  decape: "tinta",
  enceramento: "cera",
  folha_ouro: "folha de ouro",
  restauracao: "massa",
};

function totalPieces(d: QuoteRequestDraft): number {
  return d.items.reduce((a, i) => a + i.quantity, 0);
}

/** "dos dois", "é dos dois", "ambos": a peça é do casal */
const BOTH_OWNERS = /\b(dos dois|das duas|de ambos|ambos|os dois juntos|e do casal|do casal|deles dois|dos 2)\b/;

function clientName(d: QuoteRequestDraft, ref: string | null): string | null {
  return ref ? (d.clients.find((c) => c.ref === ref)?.name ?? null) : null;
}

function deOf(name: string): string {
  // casal tratado como um cliente: "do Seu Roberto e da Dona Jo"
  if (/ e /.test(name)) return name.split(/ e /).map(deOf).join(" e ");
  const n = normalizeText(name);
  if (/^(dona|sra|senhora|doutora|dra|tia|professora)\b/.test(n)) return `da ${name}`;
  if (/^(seu|sr|senhor|doutor|dr|tio|professor)\b/.test(n)) return `do ${name}`;
  return `de ${name}`;
}

function humanList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function servicesText(item: MentionedItem): string {
  const map: Record<string, string> = { lixar: "lixar", envernizar: "envernizar", pintar: "pintar", patina: "fazer pátina", decape: "fazer decapê", encerar: "encerar", restaurar: "restaurar", dourar: "aplicar folha de ouro" };
  const list = item.services.map((s) => map[s] ?? s);
  return list.length ? humanList(list) : item.techniqueKeys.map(techniqueLabel).join(" e ");
}

/** Detecta se a mensagem deve abrir o objetivo multi-item. */
export function shouldStartQuoteRequest(draft: QuoteRequestDraft): boolean {
  const pieces = totalPieces(draft);
  // UMA peça com dois nomes ("do seu Abreu e da dona Isa") é de um casal/família: serviço simples,
  // o segundo nome fica nas observações — não é pedido de vários clientes
  return draft.items.length > 0 && pieces > 1;
}

export async function buildDraft(c: Conversation, text: string): Promise<QuoteRequestDraft> {
  let draft = extractQuoteRequest(text, c.ctx.clock());
  // IA opcional: só acrescenta o que estiver literalmente no texto; falha → determinístico
  const provider = c.ctx.ai.extraction as { extractQuoteRequest?: (t: string) => Promise<unknown> } | null;
  if (provider?.extractQuoteRequest) {
    try {
      draft = mergeAiQuoteRequest(draft, await provider.extractQuoteRequest(text));
    } catch {
      /* fallback determinístico */
    }
  }
  return draft;
}

/** Abre o objetivo: resume o entendimento e faz a primeira pergunta estrutural. */
export async function startQuoteRequest(c: Conversation, draft: QuoteRequestDraft): Promise<void> {
  const id = newId();
  const now = nowIso(c.ctx);
  const state: QuoteRequestState = { id, draft, step: "review", currentRefs: [] };
  await c.ctx.db.batch([
    c.ctx.db.stmt(
      "INSERT INTO quote_requests (id, user_id, status, goal, raw_source_message, source_message_id, requested_for_date, requested_date_expression, state_json, created_at, updated_at) VALUES (?, ?, 'EM_ANDAMENTO', 'CALCULATE_QUOTE', ?, ?, ?, ?, ?, ?, ?)",
      id,
      c.input.user.id,
      draft.rawText.slice(0, 4000),
      c.input.inboundMessageId,
      draft.date?.isoDate ?? null,
      draft.date?.expression ?? null,
      JSON.stringify(state),
      now,
      now,
    ),
    c.ctx.db.stmt(
      "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, created_at, origin, source_text) VALUES (?, ?, NULL, ?, 'QUOTE_REQUEST', 'quote_request', ?, ?, 1, 'COLETADO', ?, 'telegram', ?)",
      newId(),
      c.input.user.id,
      c.input.inboundMessageId,
      id,
      JSON.stringify({ clients: draft.clients.map((x) => x.name), items: draft.items.map((i) => ({ description: i.description, quantity: i.quantity, part: i.affectedPart })), ambiguities: draft.ambiguities, date: draft.date }),
      now,
      draft.rawText.slice(0, 500),
    ),
    auditStmt(c.ctx, c.input.user.id, "quote_request.create", "quote_request", id, undefined, { items: draft.items.length, clients: draft.clients.length }),
  ]);
  c.session.flow = "quote_request";
  c.session.activeJobId = null;
  c.session.context.quoteRequest = state;

  const pieces = totalPieces(draft);
  const itemsText = humanList(
    draft.items.map((i) =>
      i.generic
        ? `${draft.items.length > 1 ? "mais " : ""}${i.description.replace(/^outros /, "")}`
        : `${i.quantity > 1 ? `${i.quantity} ${pluralLabel(i.description, i.quantity)}` : `${nounFeminine(i.description, i.furnitureType) ? "uma" : "um"} ${i.description}`}`,
    ),
  );
  const services = humanList([...new Set(draft.items.flatMap((i) => i.services))]);
  const who = draft.clients.length ? ` para ${humanList(draft.clients.map((x) => (normalizeText(x.name).startsWith("dona") ? `a ${x.name}` : `o ${x.name}`)))}` : "";
  // a data citada pode ser de retirada ou de entrega: não presumir; datas ambíguas pedem confirmação
  const date = draft.date
    ? // só um lembrete do dia que ele falou: não agenda nada nem vira prazo do serviço
      ` 📅 Anotei o dia que você falou: ${draft.date.expression.replace("terca", "terça")} (${isoToBR(draft.date.isoDate)}), só de lembrete${draft.date.ambiguous ? " — se for outro dia, me avisa" : ""}.`
    : "";
  const goal = draft.wantsPrice ? " Você quer saber quanto cobrar." : "";
  c.say(`Entendi: ${pieces === 1 ? "um móvel" : `são ${pieces} móveis`}${services ? ` para ${services}` : ""} — ${itemsText}${who}.${goal}${date}`);
  await nextQuoteRequestStep(c);
}

async function persist(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest;
  if (!qr) return;
  await c.ctx.db.run("UPDATE quote_requests SET state_json = ?, job_ids_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(qr), JSON.stringify(Object.values(qr.jobByRef ?? {})), nowIso(c.ctx), qr.id);
}

/** Escolhe e faz a próxima pergunta (uma por vez). */
export async function nextQuoteRequestStep(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest!;
  if (c.ack) {
    c.say(c.ack);
    c.ack = null;
  }
  const d = qr.draft;
  qr.unparsed = 0;
  numberDuplicates(d);
  // 0) nomes ditos juntos: casal (um cliente) ou dois clientes? Nunca adivinhar.
  if (d.clientsJoined && !qr.clientsRelation && d.clients.length === 2) {
    qr.step = "clients_relation";
    const [a, b] = d.clients as [MentionedClient, MentionedClient];
    const art = (x: MentionedClient) => (normalizeText(x.name).startsWith("dona") ? `a ${x.name}` : `o ${x.name}`);
    c.setPending({ type: "confirmation", entity: { kind: "quote_request", id: qr.id } });
    c.say(`Uma coisa antes: ${art(a)} e ${art(b)} são um casal, um cliente só? Ou são dois clientes diferentes, cada um com seus móveis?`, [
      [
        { text: "Um casal, cliente só", data: "qr:couple" },
        { text: "Dois clientes", data: "qr:separate" },
      ],
    ]);
    return persist(c);
  }
  const unresolvedOwner = d.clients.length > 1 ? d.items.filter((i) => !i.ownerRef || !i.ownerConfirmed) : [];

  // 1) de quem é cada peça
  if (unresolvedOwner.length && !qr.ownerProposal) {
    const proposal: Record<string, string> = {};
    d.items.forEach((it, idx) => {
      proposal[it.ref] = it.ownerRef ?? (idx === 0 ? d.clients[0]!.ref : d.clients[Math.min(idx, d.clients.length - 1)]!.ref);
    });
    qr.ownerProposal = proposal;
    qr.step = "owner_confirm";
    // agrupa por dono: "a mesinha é do Seu Roberto; a cômoda e o aparador são da Dona Jo"
    const byOwner = new Map<string, MentionedItem[]>();
    for (const it of d.items) byOwner.set(proposal[it.ref]!, [...(byOwner.get(proposal[it.ref]!) ?? []), it]);
    const parts = [...byOwner].map(([owner, its]) => `${humanList(its.map(itemName))} ${its.length > 1 || its[0]!.generic || its[0]!.quantity > 1 ? "são" : "é"} ${deOf(clientName(d, owner)!)}`);
    c.setPending({ type: "item_owner", entity: { kind: "quote_request", id: qr.id, refs: d.items.map((i) => i.ref) } });
    c.say(`Só preciso organizar de quem é cada peça: ${parts.join("; ")}?`, [
      [
        { text: "Isso", data: "qr:owner_yes" },
        { text: "Não", data: "qr:owner_no" },
      ],
    ]);
    return persist(c);
  }
  if (unresolvedOwner.length) {
    const it = unresolvedOwner[0]!;
    qr.step = "owner_each";
    qr.currentRefs = [it.ref];
    c.setPending({ type: "item_owner", entity: { kind: "item", refs: [it.ref] } });
    c.say(`${capitalize(itemName(it))} ${it.generic || it.quantity > 1 ? "são" : "é"} de quem: ${humanList(d.clients.map((x) => deOf(x.name)))}?`.replace(" e da ", " ou da ").replace(" e do ", " ou do "));
    return persist(c);
  }
  // 2) quais são os móveis genéricos
  const generic = d.items.find((i) => i.generic);
  if (generic) {
    qr.step = "identity";
    qr.currentRefs = [generic.ref];
    c.setPending({ type: "item_identity", entity: { kind: "item", refs: [generic.ref] } });
    const which = generic.quantity > 1 ? `Quais são ${/^outros /.test(generic.description) ? generic.description.replace(/^outros /, "os outros ") : `esses ${generic.description}`}?` : "Qual é o outro móvel?";
    c.say(`${qr.ownerProposal ? "Ótimo. " : ""}${which} Por exemplo: "uma cômoda e um aparador".`);
    return persist(c);
  }
  // 2b) nome ambíguo ("mesinha"): de centro, lateral, cabeceira, apoio?
  const vague = d.items.find((i) => i.typeQuestion !== undefined);
  if (vague) {
    qr.step = "identity";
    qr.currentRefs = [vague.ref];
    const amb = AMBIGUOUS_FURNITURE[vague.typeQuestion!]!;
    c.setPending({ type: "item_identity", entity: { kind: "item", refs: [vague.ref] } });
    const owner = d.clients.length > 1 ? clientName(d, vague.ownerRef) : null;
    c.say(owner ? amb.question.replace("Essa mesinha", `A mesinha ${deOf(owner)}`) : amb.question);
    return persist(c);
  }
  // 3) escopo (só tampo x peça inteira) — só para móveis com tampo; cadeira, cama, sofá: peça inteira
  for (const it of d.items) if (!it.affectedPart && !it.generic && !furnitureHasTop(it.furnitureType)) it.affectedPart = "inteiro";
  const noScope = d.items.find((i) => !i.affectedPart);
  if (noScope) {
    qr.step = "scope";
    qr.currentRefs = [noScope.ref];
    c.setPending({ type: "service_scope", entity: { kind: "item", refs: [noScope.ref] } });
    const pronoun = noScope.furnitureType && FURNITURE[noScope.furnitureType]?.feminine ? "nela inteira" : "nele inteiro";
    c.say(`${generic === undefined && !qr.askedCondition ? "Perfeito. " : ""}N${itemName(noScope).replace(/^(a|o) /, (m) => (m.startsWith("a") ? "a " : "o "))}, você vai trabalhar só no tampo ou ${pronoun}?`);
    return persist(c);
  }
  // 4) condição de cada peça
  const noCond = d.items.filter((i) => i.condition === null);
  if (noCond.length && !qr.askedCondition) {
    qr.step = "condition";
    qr.currentRefs = noCond.map((i) => i.ref);
    qr.askedCondition = true;
    c.setPending({ type: "item_condition", entity: { kind: "item", refs: qr.currentRefs } });
    // o que ele já tinha dito sem dizer de qual peça volta aqui, para não se perder
    const note = qr.notes?.length ? `Você tinha comentado: “${qr.notes.join("; ")}”. ` : "";
    c.say(
      noCond.length === 1 && noCond[0]!.quantity > 1
        ? `${note}E como estão ${itemName(noCond[0]!)} hoje? ${FURNITURE[noCond[0]!.furnitureType ?? ""]?.feminine ? "Alguma" : "Algum"} precisa de reparo?`
        : noCond.length === 1
        ? `${note}E como está ${itemName(noCond[0]!)} hoje? Precisa de algum reparo ou está ${FURNITURE[noCond[0]!.furnitureType ?? ""]?.feminine ? "boa" : "bom"}?`
        : `${note}${note ? "De qual peça era? E" : "E"} como estão ${humanList(noCond.map(itemName))}? Alguma peça precisa de reparo?`,
    );
    return persist(c);
  }
  // 4b) o que vai ser feito (sem técnica não há conta: pergunta em vez de orçamento "preliminar")
  const noTech = d.items.filter((i) => !i.generic && i.techniqueKeys.length === 0);
  if (noTech.length && !qr.techniquesAsked) {
    qr.step = "techniques";
    qr.currentRefs = noTech.map((i) => i.ref);
    qr.techniquesAsked = true;
    c.setPending({ type: "confirmation", entity: { kind: "quote_request", id: qr.id } });
    c.say(`E o que você vai fazer ${noTech.length === d.items.length ? "nas peças" : `n${humanList(noTech.map(itemName))}`}? 🎨 Por exemplo: "lixar e passar verniz", "pintar" ou "pátina".`);
    return persist(c);
  }
  // 4c) de quem são os móveis (sem cliente o PDF sai sem nome)
  if (d.clients.length === 0 && !qr.clientAsked) {
    qr.step = "client";
    qr.clientAsked = true;
    c.setPending({ type: "client_identity", entity: { kind: "quote_request", id: qr.id } });
    c.say(`E ${totalPieces(d) > 1 ? "esses móveis são" : "esse móvel é"} de quem? Só o nome do cliente, tipo "da dona Maria". 🙂`);
    return persist(c);
  }
  // 5) confirmação estrutural
  if (!qr.reviewed) {
    qr.step = "review";
    c.setPending({ type: "confirmation", entity: { kind: "quote_request", id: qr.id } });
    c.say(`Entendi: ${reviewText(d)}. Certo?`, [
      [
        { text: "Certo", data: "qr:review_yes" },
        { text: "Corrigir", data: "qr:review_no" },
      ],
    ]);
    return persist(c);
  }
  // 6) agrupamento por cliente
  if (d.clients.length > 1 && !qr.grouping) {
    qr.step = "grouping";
    c.setPending({ type: "quote_grouping", entity: { kind: "quote_request", id: qr.id } });
    c.say("Você prefere um orçamento separado para cada cliente ou tudo junto em um só?", [
      [
        { text: "Um para cada cliente", data: "qr:group_split" },
        { text: "Tudo junto", data: "qr:group_all" },
      ],
    ]);
    return persist(c);
  }
  // 7) cria os serviços (associações confirmadas)
  if (!qr.jobByRef) await materializeJobs(c);
  // 8) medidas de cada peça
  for (const it of d.items) {
    if (qr.askedDims?.includes(it.ref)) continue;
    const job = await getJob(c.ctx, qr.jobByRef![it.ref]!);
    if (job && (job.facts.dimensions?.value || job.facts.size_class?.value)) continue;
    const firstDims = !(qr.askedDims?.length);
    qr.step = "dims";
    qr.currentRefs = [it.ref];
    c.setPending({ type: "item_dimensions", entity: { kind: "item", id: qr.jobByRef![it.ref], refs: [it.ref] } });
    c.say(
      it.affectedPart === "tampo"
        ? `${firstDims ? "Agora as medidas, que fazem diferença no preço. Qual é" : "E qual é"} o tamanho do tampo d${itemName(it)}? Pode dizer largura e fundura, por exemplo "1,20 por 50", ou só se é pequeno, médio ou grande.`
        : `${firstDims ? "Agora as medidas, que fazem diferença no preço. Quais são" : "E quais são"} as medidas d${itemName(it)}? Por exemplo: "45 de altura, 1 metro de largura e 60 de fundura". Se não tiver, pode dizer só pequena, média ou grande.`,
    );
    return persist(c);
  }
  // 9) horas de reparo (estimativa do próprio artesão) — uma pergunta só quando são várias peças
  const toRepair = d.items.filter((i) => (i.condition === "reparos" || i.condition === "danificado") && !qr.askedRepair?.includes(i.ref));
  if (toRepair.length > 1 && !qr.repairAskedAll) {
    qr.step = "repair_hours";
    qr.currentRefs = toRepair.map((i) => i.ref);
    qr.repairAskedAll = true;
    c.setPending({ type: "repair_hours", entity: { kind: "quote_request", id: qr.id, refs: qr.currentRefs } });
    c.say(`Quanto tempo você acha que leva pra acertar os detalhes de ${toRepair.length === d.items.length ? "todas as peças" : humanList(toRepair.map(itemName))}, somando tudo? 🛠️ Por exemplo: "3 horas". Se não souber, tudo bem.`);
    return persist(c);
  }
  for (const it of d.items) {
    if (!(it.condition === "reparos" || it.condition === "danificado") || qr.askedRepair?.includes(it.ref)) continue;
    qr.step = "repair_hours";
    qr.currentRefs = [it.ref];
    c.setPending({ type: "repair_hours", entity: { kind: "item", id: qr.jobByRef![it.ref], refs: [it.ref] } });
    c.say(`Quanto tempo você acha que leva o reparo ${it.repairPart ? `do ${it.repairPart} ` : ""}d${itemName(it)}? Por exemplo: "2 horas". Se não souber, tudo bem.`);
    return persist(c);
  }
  // 10) método de aplicação (uma vez para o pedido)
  if (!qr.methodAsked) {
    qr.step = "method";
    c.setPending({ type: "application_method", entity: { kind: "quote_request", id: qr.id } });
    const mat = materialWord(d);
    c.say(`Você vai passar ${mat === "verniz" ? "o verniz" : "o acabamento"} com pincel, rolo ou pistola?`);
    return persist(c);
  }
  // 11) estoque x compra
  if (!qr.materialSourceAsked) {
    qr.step = "material_source";
    c.setPending({ type: "material_source", entity: { kind: "quote_request", id: qr.id } });
    const mat = materialWord(d);
    c.say(`E ${mat === "verniz" ? "o verniz" : mat === "material" ? "o material" : `o material (${mat})`}: você já tem aí ou vai precisar comprar? 📦`);
    return persist(c);
  }
  // 12) busca e entrega
  if (!qr.logisticsAsked) {
    qr.step = "logistics";
    c.setPending({ type: "logistics", entity: { kind: "quote_request", id: qr.id } });
    const when = d.date ? ` na ${d.date.expression.replace("terca", "terça")} (${isoToBR(d.date.isoDate)})` : "";
    c.say(`Você vai buscar os móveis${when}? E depois entregar também? Por exemplo: "buscar e entregar" ou "não precisa".`);
    return persist(c);
  }
  if ((qr.logistics?.pickup || qr.logistics?.delivery) && !qr.transportAsked) {
    qr.step = "transport_cost";
    c.setPending({ type: "transport_cost", entity: { kind: "quote_request", id: qr.id } });
    c.say('Quanto você costuma gastar com esse transporte (ida e volta)? Por exemplo: "60 reais". Se não souber, tudo bem.');
    return persist(c);
  }
  // 13) calcular
  await quoteRequestCalculate(c);
}

function materialWord(d: QuoteRequestDraft): string {
  const techs = [...new Set(d.items.flatMap((i) => i.techniqueKeys))];
  return humanList(techs.map((t) => TECH_MATERIAL_WORD[t] ?? techniqueLabel(t))) || "material";
}

function conditionText(it: MentionedItem): string {
  switch (it.condition) {
    case "reparos":
      return it.repairPart ? `com reparo no ${it.repairPart}` : "com reparos";
    case "danificado":
      return "bem danificad" + (nounFeminine(it.description, it.furnitureType) ? "a" : "o");
    case "melhor_que_outros":
    case "bom":
      return "sem reparos grandes";
    default:
      return "estado ainda não informado";
  }
}

function reviewText(d: QuoteRequestDraft): string {
  return d.items
    .map((it) => {
      const owner = d.clients.length > 1 ? ` (${clientName(d, it.ownerRef)})` : "";
      const scope = it.affectedPart === "tampo" ? "só o tampo" : "inteir" + (nounFeminine(it.description, it.furnitureType) ? "a" : "o");
      return `${itemName(it)}${owner}: ${servicesText(it)} ${scope}, ${conditionText(it)}`;
    })
    .join("; ");
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** A mensagem é uma resposta plausível à pergunta atual do pedido? (usado pelo roteador) */
export function isPlausibleQuoteRequestAnswer(c: Conversation, text: string, nlu: NluResult): boolean {
  const qr = c.session.context.quoteRequest;
  if (!qr) return false;
  if (["yes", "no", "dont_know"].includes(nlu.intent)) return true;
  switch (qr.step) {
    case "clients_relation":
      return !!parseClientsRelation(text);
    case "owner_confirm":
    case "owner_each":
      return !!matchClientInAnswer(text, qr.draft.clients) || BOTH_OWNERS.test(normalizeText(text));
    case "identity":
      return parseFurnitureList(text).length > 0;
    case "scope":
      return !!partOf(text) || !!conditionOf(text);
    case "condition":
    case "review_fix":
      return parseItemStatements(text, qr.draft.items, qr.currentRefs).length > 0 || nlu.entities.conditionStatement;
    case "grouping":
      return !!parseGrouping(text);
    case "dims":
      return parseDims(text) !== null || !!nlu.entities.sizeClass;
    case "repair_hours":
      return parseHoursLoose(text) !== null;
    case "method":
      return !!nlu.entities.method;
    case "material_source":
      return !!nlu.entities.materialStatus || /\b(estoque|tenho|ja t\w{2,4}|compr\w*)\b/.test(normalizeText(text));
    case "techniques":
      return findTechniques(text).length > 0;
    case "client":
      return !!extractClientName(text) || text.trim().split(/\s+/).length <= 4;
    case "logistics": {
      if (parseLogistics(text) !== null) return true;
      const ans = parseAnswer("logistics", text);
      return ans.kind === "partial" || ans.kind === "value";
    }
    case "transport_cost":
      return nlu.entities.amountCents !== undefined || /\b\d+\b/.test(text);
    default:
      return false;
  }
}

function parseLogistics(text: string): { pickup: boolean; delivery: boolean } | null {
  const n = normalizeText(text);
  if (/\b(nao precisa|nao|nenhum|o cliente traz|eles trazem|trazem aqui)\b/.test(n) && !/\b(buscar|entregar|levar)\b/.test(n.replace(/nao precisa (buscar|entregar)/, ""))) return { pickup: false, delivery: false };
  const pickup = /\b(buscar|busco|pegar|pego|retirar)\b/.test(n) && !/\bnao (vou )?(buscar|pegar)\b/.test(n);
  const delivery = /\b(entregar|entrego|levar|levo|os dois|ambos)\b/.test(n) && !/\bnao (vou )?(entregar|levar)\b/.test(n);
  if (/\b(os dois|ambos|buscar e entregar|busco e entrego)\b/.test(n)) return { pickup: true, delivery: true };
  if (/^(sim|isso|vou)\b/.test(n) && !pickup && !delivery) return { pickup: true, delivery: false };
  if (pickup || delivery) return { pickup, delivery };
  return null;
}

function parseHoursLoose(text: string): string | null {
  const n = normalizeText(text).replace(",", ".");
  const half = /\bmeia hora\b/.test(n);
  if (half) return "0.5";
  const m = /(\d+(?:\.\d+)?)\s*(h|hora|horas)\b/.exec(n) ?? /\b(\d+(?:\.\d+)?)\b/.exec(n);
  let hours = m ? Dec.tryParse(m[1]!) : null;
  if (!hours) {
    const words: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, oito: 8, dez: 10 };
    const w = /\b(uma|um|duas|dois|tres|quatro|cinco|seis|oito|dez)\s+horas?\b/.exec(n);
    if (w) hours = Dec.from(words[w[1]!]!);
  }
  if (!hours || !hours.gt(0) || hours.gt(200)) return null;
  if (/\be meia\b/.test(n)) hours = hours.add("0.5");
  return hours.toString();
}

/** Medidas: rotuladas, "1,20 por 50" (largura × fundura) ou porte. */
function parseDims(text: string): FactValueMap["dimensions"] | "pequeno" | "medio" | "grande" | null {
  const n = normalizeText(text);
  const toM = (raw: string) => {
    const d = Dec.tryParse(raw.replace(",", "."));
    if (!d || !d.gt(0)) return undefined;
    return d.gt(10) ? d.div(100).toString() : d.toString();
  };
  // "1,20 por 50", "1 metro por 60", "120 cm x 60"
  const by = /(\d+(?:[.,]\d+)?)\s*(?:metros?|centimetros?|cm|m)?\s*(?:por|x)\s*(\d+(?:[.,]\d+)?)/.exec(n);
  if (by) {
    const w = toM(by[1]!);
    const d = toM(by[2]!);
    if (w && d) return { width: w, depth: d };
  }
  const labeled = labelDimensions(n);
  if (labeled.height || labeled.width || labeled.depth) return Object.fromEntries(Object.entries(labeled).filter(([, v]) => v)) as FactValueMap["dimensions"];
  const ans = parseAnswer("dimensions", text);
  if (ans.kind === "value") {
    if (ans.field === "size_class") return ans.value as "pequeno" | "medio" | "grande";
    return ans.value as FactValueMap["dimensions"];
  }
  return null;
}

/** Interpreta a resposta conforme a etapa atual. */
export async function quoteRequestText(c: Conversation, text: string, nlu: NluResult): Promise<void> {
  const qr = c.session.context.quoteRequest;
  if (!qr) {
    c.session.flow = "idle";
    return;
  }
  const d = qr.draft;
  const dontKnow = nlu.intent === "dont_know";
  const retry = (msg: string) => {
    qr.unparsed = (qr.unparsed ?? 0) + 1;
    c.say(qr.unparsed > 1 ? `${msg}\n\nSe preferir, pode dizer "não sei" que eu sigo com o que já tenho.` : msg);
    return persist(c);
  };

  // correções e decisões ditas a QUALQUER momento (não só na pergunta certa)
  const global = await applyGlobalChanges(c, qr, text, nlu);
  if (global === "handled") return;
  if (global === "changed") return askQuoteRequestAgain(c);

  // o Claude lê a resposta no contexto (peças, pergunta): medidas de várias peças de uma vez,
  // "duas aparadoras", "já trnho"... Nas medidas sempre; nas outras perguntas quando as regras não entendem.
  if (AI_STEPS.includes(qr.step) && !dontKnow && (qr.step === "dims" || !isPlausibleQuoteRequestAnswer(c, text, nlu))) {
    const ai = await interpretQuoteRequestAnswer(c.ctx, d.items, questionOf(qr), text);
    if (ai && (await applyAi(c, qr, ai))) return nextQuoteRequestStep(c);
  }

  // informação útil dita fora de hora (ex.: estado das peças) é guardada, nunca descartada
  const answersItself = ["condition", "review_fix", "scope", "identity", "review"].includes(qr.step);
  let captured = false;
  if (!answersItself && nlu.intent !== "yes" && nlu.intent !== "no") {
    const notesBefore = qr.notes?.length ?? 0;
    captured = applyStatements(qr, text, []);
    if (captured) c.ack = `Anotei: ${statementsSummary(qr, text)}.`;
    else if ((qr.notes?.length ?? 0) > notesBefore) {
      // estado sem dizer a peça: não aplica a todas, guarda e avisa que vai perguntar
      c.ack = "Anotei o que você falou do estado 👍 Já já te pergunto de qual peça é.";
      captured = true;
    }
  }

  switch (qr.step) {
    case "clients_relation": {
      // "não" depois de "é dos dois?" (já sabemos que são dois clientes): volta a perguntar de quem é cada peça
      if (nlu.intent === "no" && qr.clientsRelation === "separate") return onQuoteRequestCallback(c, "owner_no");
      const rel = parseClientsRelation(text) ?? (nlu.intent === "yes" ? "couple" : null);
      if (rel) return onQuoteRequestCallback(c, rel);
      if (captured) return askQuoteRequestAgain(c);
      return retry('Me diz só assim: "é um casal" ou "são dois clientes".');
    }
    case "owner_confirm": {
      if (BOTH_OWNERS.test(normalizeText(text))) return onBothOwners(c);
      if (nlu.intent === "yes") return onQuoteRequestCallback(c, "owner_yes");
      if (nlu.intent === "no") return onQuoteRequestCallback(c, "owner_no");
      // resposta direta ("a mesinha é da dona Jo")
      const applied = applyOwnerStatements(qr, text);
      if (applied) return nextQuoteRequestStep(c);
      if (captured) return askQuoteRequestAgain(c);
      return retry('É só responder "isso" ou me dizer de quem é cada peça, por exemplo: "a mesinha é da Dona Jo".');
    }
    case "owner_each": {
      const it = d.items.find((i) => i.ref === qr.currentRefs[0]);
      if (BOTH_OWNERS.test(normalizeText(text)) && d.clients.length === 2) return onBothOwners(c);
      const client = matchClientInAnswer(text, d.clients);
      if (it && client) {
        it.ownerRef = client.ref;
        it.ownerConfirmed = true;
        return nextQuoteRequestStep(c);
      }
      return retry(`De quem é ${it ? itemName(it) : "essa peça"}? Pode dizer só o nome, por exemplo "da ${d.clients[0]?.name.replace(/^(Seu|Dona) /, "") ?? "Maria"}".`);
    }
    case "identity": {
      const group = d.items.find((i) => i.ref === qr.currentRefs[0]);
      if (!group) return nextQuoteRequestStep(c);
      if (group.typeQuestion !== undefined) {
        // "de centro", "a de cabeceira", "lateral"
        const r = resolveAmbiguousFurniture(group.typeQuestion, text);
        if (!r && !dontKnow) return retry(AMBIGUOUS_FURNITURE[group.typeQuestion]!.question);
        if (r) {
          group.furnitureType = r.key;
          group.description = r.key === "mesa" ? `mesinha${r.descriptor ? ` ${r.descriptor}` : ""}` : FURNITURE[r.key]?.label ?? group.description;
        }
        delete group.typeQuestion;
        return nextQuoteRequestStep(c);
      }
      if (dontKnow) {
        group.generic = false;
        group.description = group.quantity > 1 ? "móveis" : "móvel";
        return nextQuoteRequestStep(c);
      }
      const list = parseFurnitureList(text);
      if (!list.length) return retry('Não peguei quais são. Pode dizer, por exemplo: "uma cômoda e um aparador".');
      replaceGroup(qr, group, list);
      // aproveita estado/escopo ditos junto
      applyStatements(qr, text, qr.currentRefs);
      return nextQuoteRequestStep(c);
    }
    case "scope": {
      const it = d.items.find((i) => i.ref === qr.currentRefs[0]);
      // primeiro o que foi dito por peça ("na mesa é inteira, nos outros dois só o tampo"); só então a frase toda
      const st = applyStatements(qr, text, [...qr.currentRefs]);
      const part = partOf(text);
      if (it && part && !it.affectedPart) it.affectedPart = part;
      if (it && !it.affectedPart) {
        const na = `${FURNITURE[it.furnitureType ?? ""]?.feminine ? "Na" : "No"} ${itemName(it).replace(/^(a|o|as|os) /, "")}`;
        if (dontKnow) it.affectedPart = "inteiro";
        // falou do estado em vez do escopo: anota o estado e pergunta de novo (não presume "inteira")
        else return retry(`${st ? "Anotei o estado 👍 " : ""}${na}, é só o tampo ou a peça inteira?`);
      }
      return nextQuoteRequestStep(c);
    }
    case "condition":
    case "review_fix": {
      const changed = applyStatements(qr, text, qr.currentRefs);
      if (qr.step === "review_fix") {
        const list = parseFurnitureList(text);
        void list;
        qr.reviewed = false;
        return nextQuoteRequestStep(c);
      }
      if (!changed && !dontKnow) return retry('Pode me contar, por exemplo: "a mesinha precisa de reparo no tampo e as outras estão boas".');
      return nextQuoteRequestStep(c);
    }
    case "review":
      if (nlu.intent === "yes") return onQuoteRequestCallback(c, "review_yes");
      if (nlu.intent === "no") return onQuoteRequestCallback(c, "review_no");
      if (applyStatements(qr, text, d.items.map((i) => i.ref))) return nextQuoteRequestStep(c);
      return retry('É só dizer "certo" ou me contar o que mudar.');
    case "grouping": {
      const g = parseGrouping(text);
      if (g) {
        qr.grouping = g;
        return nextQuoteRequestStep(c);
      }
      if (dontKnow) {
        qr.grouping = "por_cliente";
        return nextQuoteRequestStep(c);
      }
      return retry('Pode dizer "um para cada cliente" ou "tudo junto".');
    }
    case "dims": {
      const ref = qr.currentRefs[0]!;
      const jobId = qr.jobByRef![ref]!;
      qr.askedDims = [...(qr.askedDims ?? []), ref];
      if (dontKnow) {
        await setFact(c.ctx, jobId, "dimensions", null, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
        c.ack = "Sem problema, sigo sem a medida dessa peça (o orçamento dela fica como estimativa).";
        return nextQuoteRequestStep(c);
      }
      const dims = parseDims(text) ?? nlu.entities.sizeClass ?? null;
      if (!dims) {
        qr.askedDims = qr.askedDims.filter((r) => r !== ref);
        return retry('Não peguei a medida. Pode dizer, por exemplo, "1,20 por 50" ou só "média".');
      }
      if (typeof dims === "string") await setFact(c.ctx, jobId, "size_class", dims, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
      else await setFact(c.ctx, jobId, "dimensions", dims, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true });
      return nextQuoteRequestStep(c);
    }
    case "repair_hours": {
      const refs = [...qr.currentRefs];
      qr.askedRepair = [...new Set([...(qr.askedRepair ?? []), ...refs])];
      const hours = dontKnow ? null : parseHoursLoose(text);
      if (!hours && !dontKnow) {
        qr.askedRepair = qr.askedRepair.filter((r) => !refs.includes(r));
        if (refs.length > 1) qr.repairAskedAll = false;
        return retry('Pode dizer, por exemplo, "2 horas" ou "meia hora".');
      }
      if (hours) {
        // total dito para várias peças: dividido igualmente
        const each = Dec.from(hours).div(refs.length).toString();
        for (const ref of refs) {
          const jobId = qr.jobByRef![ref]!;
          const it = d.items.find((i) => i.ref === ref)!;
          const ov = await getOverrides(c.ctx, jobId);
          await saveOverrides(c.ctx, jobId, { ...ov, extraLabor: [...ov.extraLabor, { description: `Reparo${it.repairPart ? ` do ${it.repairPart}` : ""} (estimativa do artesão)`, hours: each }] }, c.input.user.id);
        }
      }
      return nextQuoteRequestStep(c);
    }
    case "techniques": {
      const techs = findTechniques(text);
      if (!techs.length && !dontKnow) return retry('Pode dizer, por exemplo: "lixar e passar verniz", "pintar" ou "pátina".');
      for (const it of d.items.filter((i) => qr.currentRefs.includes(i.ref))) {
        if (!techs.length) continue;
        it.techniqueKeys = techs;
        const jobId = qr.jobByRef?.[it.ref];
        if (jobId) await setFact(c.ctx, jobId, "techniques", techs, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
      }
      return nextQuoteRequestStep(c);
    }
    case "client": {
      const name = extractClientName(text.match(/^(d[ao]s?|de) /i) ? text : `da ${text}`) ?? extractClientName(text);
      if (name && !dontKnow) setClient(qr, name);
      return nextQuoteRequestStep(c);
    }
    case "method": {
      const method = nlu.entities.method ?? (dontKnow ? null : undefined);
      if (method === undefined) return retry('Pode dizer "pincel", "rolo" ou "pistola".');
      qr.methodAsked = true;
      qr.method = method;
      if (method) for (const jobId of Object.values(qr.jobByRef ?? {})) await setFact(c.ctx, jobId, "application_method", method, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
      return nextQuoteRequestStep(c);
    }
    case "material_source": {
      // tolera erro de digitação: "já trnho", "ja tenhu" (teste real 23/11/2026)
      const nm = normalizeText(text);
      const status = nlu.entities.materialStatus ?? (/\bcompr/.test(nm) ? "precisa_comprar" : /\b(estoque|tenho|ja t\w{2,4}|tem tudo|ja tem|tenho tudo|tenho sim)\b/.test(nm) ? "tem_tudo" : undefined);
      if (!status && !dontKnow) return retry('Pode dizer "uso do estoque", "tenho uma parte" ou "vou comprar".');
      qr.materialSourceAsked = true;
      if (status) {
        for (const jobId of Object.values(qr.jobByRef ?? {})) {
          await setFact(c.ctx, jobId, "material_status", status, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
        }
        const firstJob = Object.values(qr.jobByRef ?? {})[0];
        if (firstJob) {
          const techs = [...new Set(d.items.flatMap((i) => i.techniqueKeys))];
          await recordMaterialSourceObservation(c.ctx, { userId: c.input.user.id, jobId: firstJob, messageId: c.input.inboundMessageId, materialKeys: techs.map((t) => (t === "verniz" ? "verniz" : t)), source: status });
        }
        c.ack = status === "precisa_comprar" ? "Certo, vou considerar a compra. 🛒" : "Beleza! 👍 Mesmo já tendo, o material entra no preço (pra você repor depois sem sair no prejuízo).";
      }
      return nextQuoteRequestStep(c);
    }
    case "logistics": {
      // linguagem natural primeiro ("ela vai deixar aqui", "ela mesma busca"), juntando o que já se sabia
      const ans = dontKnow ? ({ kind: "unparsed" } as const) : parseAnswer("logistics", text);
      let l: { pickup: boolean; delivery: boolean } | null = dontKnow ? { pickup: false, delivery: false } : null;
      if (!l && ans.kind !== "partial" && ans.kind !== "value") l = parseLogistics(text);
      if (!l) {
        const known = { ...(qr.partialLogistics ?? {}), ...(ans.kind === "partial" ? ans.known : ans.kind === "value" ? (ans.value as { pickup: boolean; delivery: boolean }) : {}) };
        if (known.pickup !== undefined && known.delivery !== undefined) l = { pickup: known.pickup, delivery: known.delivery };
        else if (known.pickup !== undefined || known.delivery !== undefined) {
          qr.partialLogistics = known;
          c.say(
            known.pickup === false
              ? "Ah, beleza! Então o cliente traz até você. 👍 E depois de pronto, o cliente vem pegar ou você vai entregar?"
              : known.pickup === true
                ? "Certo, você vai buscar. E na volta, você entrega ou o cliente vem pegar?"
                : known.delivery === false
                  ? "Entendi, o cliente vem buscar quando ficar pronto. E pra chegar até você: ele traz ou você vai buscar?"
                  : "Certo, você entrega no final. E pra chegar até você: o cliente traz ou você vai buscar?",
          );
          return persist(c);
        }
      }
      if (!l) return retry('Pode dizer "buscar e entregar", "só buscar", "só entregar" ou "não precisa".');
      delete qr.partialLogistics;
      qr.logisticsAsked = true;
      qr.logistics = l;
      for (const jobId of Object.values(qr.jobByRef ?? {})) await setFact(c.ctx, jobId, "logistics", l, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
      return nextQuoteRequestStep(c);
    }
    case "transport_cost": {
      qr.transportAsked = true;
      // parser único pt-BR ("1.000" = mil, "60,50")
      const amount = nlu.entities.amountCents ?? parseBareAmountCents(text) ?? undefined;
      if (amount && !dontKnow) {
        const jobIds = Object.values(qr.jobByRef ?? {});
        const parts = allocateCents(amount, jobIds.map(() => 1));
        for (let i = 0; i < jobIds.length; i++) {
          const ov = await getOverrides(c.ctx, jobIds[i]!);
          await saveOverrides(c.ctx, jobIds[i]!, { ...ov, specificExpenses: [...ov.specificExpenses.filter((e) => e.category !== "transporte"), { description: "Transporte (busca/entrega)", amountCents: parts[i]!, category: "transporte" }] }, c.input.user.id);
        }
      }
      return nextQuoteRequestStep(c);
    }
    default:
      return nextQuoteRequestStep(c);
  }
}

/** "esquece o aparador", "tira a cômoda", "ela não vai mais fazer o aparador" */
const DROP_ITEM = /^(esquece|cancela|cancelar|tira|tirar|remove|remover|deixa de fora|pode tirar)\b|\b(nao vai mais (fazer|querer)|desistiu d[aeo]|nao quer mais)\b/;
/** agrupamento só vale fora da pergunta própria quando fala de orçamento ("busco tudo junto" não é agrupamento) */
const GROUPING_CONTEXT = /\b(orcamentos?|separad[oa]s?|cada cliente|por cliente|um (pra|para) cada)\b/;

/**
 * Correções e decisões que o artesão pode dizer a QUALQUER momento do pedido, não só na
 * pergunta certa: tirar uma peça, trocar o dono, juntar/separar orçamentos, corrigir
 * quantidade. Nada é apagado de verdade: peças tiradas ficam em `removed` (auditoria).
 */
async function applyGlobalChanges(c: Conversation, qr: QuoteRequestState, text: string, nlu: NluResult): Promise<"none" | "changed" | "handled"> {
  const d = qr.draft;
  const n = normalizeText(text);
  const acks: string[] = [];
  let changed = false;
  const actor = c.input.user.id;
  const factOpts = { actor, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true };

  // 1) tirar uma peça (só a citada; nunca o pedido inteiro)
  if (DROP_ITEM.test(n) || (nlu.intent === "cancel" && nlu.confidence < 0.9)) {
    const targets: MentionedItem[] = [];
    for (const h of parseFurnitureList(text)) {
      const it = d.items.find((i) => i.furnitureType === h.key && !targets.includes(i));
      if (it) targets.push(it);
    }
    if (targets.length && targets.length >= d.items.length) {
      c.say(`Assim não sobra nenhuma peça no orçamento. Se quiser cancelar o pedido todo, é só dizer "cancelar".`);
      await persist(c);
      return "handled";
    }
    if (targets.length) {
      for (const it of targets) {
        const jobId = qr.jobByRef?.[it.ref] ?? null;
        if (jobId) {
          try {
            await transitionJob(c.ctx, jobId, "CANCELADO", actor, `Retirado do pedido pelo artesão: "${text.slice(0, 120)}"`);
          } catch {
            /* status que não permite cancelar: só sai do pedido */
          }
          delete qr.jobByRef![it.ref];
        }
        qr.removed = [...(qr.removed ?? []), { ref: it.ref, description: it.description, at: nowIso(c.ctx), jobId }];
        d.items.splice(d.items.indexOf(it), 1);
      }
      qr.currentRefs = qr.currentRefs.filter((r) => d.items.some((i) => i.ref === r));
      await c.ctx.db.batch([auditStmt(c.ctx, actor, "quote_request.item_removed", "quote_request", qr.id, targets.map((t) => ({ ref: t.ref, description: t.description, quantity: t.quantity })), null)]);
      acks.push(`Combinado, tirei ${humanList(targets.map(itemName))} do orçamento. O resto continua.`);
      changed = true;
    }
  }

  // 2) dono corrigido ("a cômoda não é da Dona Jo, é do Roberto")
  if (qr.step !== "clients_relation") {
    const os = parseOwnerStatement(text, d.items, d.clients);
    if (os) {
      const moved: MentionedItem[] = [];
      for (const ref of os.refs) {
        const it = d.items.find((i) => i.ref === ref);
        if (!it) continue;
        if (it.ownerRef === os.clientRef && it.ownerConfirmed) continue;
        it.ownerRef = os.clientRef;
        it.ownerConfirmed = true;
        moved.push(it);
        const jobId = qr.jobByRef?.[it.ref];
        if (jobId) await setFact(c.ctx, jobId, "client_name", clientName(d, os.clientRef)!, factOpts);
      }
      if (moved.length) {
        delete qr.ownerProposal;
        acks.push(`Corrigi: ${humanList(moved.map(itemName))} ${moved.length > 1 || moved[0]!.quantity > 1 ? "são" : "é"} ${deOf(clientName(d, os.clientRef)!)}.`);
        changed = true;
      }
    }
  }

  // 3) juntar/separar orçamentos dito antes da hora (ou mudando de ideia)
  if (d.clients.length > 1 && qr.step !== "grouping" && qr.step !== "clients_relation" && GROUPING_CONTEXT.test(n)) {
    const g = parseGrouping(text);
    if (g && g !== qr.grouping) {
      qr.grouping = g;
      acks.push(g === "agrupado" ? "Certo, junto tudo num orçamento só." : "Certo, faço um orçamento para cada cliente.");
      changed = true;
    }
  }

  // 4) quantidade corrigida ("não são duas, são três")
  const qc = parseQuantityCorrection(text);
  if (qc) {
    const named = parseFurnitureList(text).map((h) => h.key);
    const pool = d.items.filter((i) => !i.generic);
    const target = pool.find((i) => named.includes(i.furnitureType ?? "")) ?? pool.find((i) => qc.from !== null && i.quantity === qc.from) ?? (pool.length === 1 ? pool[0] : undefined);
    if (target && target.quantity !== qc.to) {
      target.quantity = qc.to;
      const jobId = qr.jobByRef?.[target.ref];
      if (jobId) {
        const job = await getJob(c.ctx, jobId);
        const fv = job?.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined;
        if (fv) await setFact(c.ctx, jobId, "furniture_type", { ...fv, quantity: qc.to }, factOpts);
      }
      acks.push(`Corrigi: são ${qc.to} ${pluralLabel(target.description, qc.to)}.`);
      changed = true;
    }
  }

  // 5) "são dois clientes" respondido na confirmação de quem é cada peça
  if (qr.step === "owner_confirm" && !qr.clientsRelation && parseClientsRelation(text) === "separate" && !changed) {
    qr.clientsRelation = "separate";
    acks.push("Certo, são dois clientes.");
    changed = true;
  }

  if (acks.length) c.ack = [c.ack, ...acks].filter(Boolean).join("\n");
  return changed ? "changed" : "none";
}

function applyOwnerStatements(qr: QuoteRequestState, text: string): boolean {
  const d = qr.draft;
  const n = normalizeText(text);
  let any = false;
  for (const piece of n.split(/[.;,]| e (?=a |o |as |os )/)) {
    const client = matchClientInAnswer(piece, d.clients);
    if (!client) continue;
    const hits = parseFurnitureList(piece);
    for (const h of hits) {
      const it = d.items.find((i) => i.furnitureType === h.key);
      if (it) {
        it.ownerRef = client.ref;
        it.ownerConfirmed = true;
        any = true;
      }
    }
    if (!hits.length && /\b(os outros|as outras|o resto|os demais)\b/.test(piece)) {
      for (const it of d.items.filter((i) => !i.ownerConfirmed)) {
        it.ownerRef = client.ref;
        it.ownerConfirmed = true;
        any = true;
      }
    }
  }
  return any;
}

/** Substitui o grupo genérico ("outros dois móveis") pelos móveis informados. */
function replaceGroup(qr: QuoteRequestState, group: MentionedItem, list: { key: string; description: string; quantity: number }[]): void {
  const d = qr.draft;
  const idx = d.items.indexOf(group);
  const expanded: MentionedItem[] = [];
  let remaining = group.quantity;
  for (const f of list) {
    for (let k = 0; k < f.quantity && remaining > 0; k++, remaining--) {
      expanded.push({ ...group, ref: `${group.ref}_${expanded.length + 1}`, description: f.description, furnitureType: f.key, quantity: 1, generic: false, sourceExcerpt: `${group.sourceExcerpt} → ${f.description}` });
    }
  }
  if (remaining > 0) expanded.push({ ...group, ref: `${group.ref}_${expanded.length + 1}`, description: remaining > 1 ? `outros ${remaining} móveis` : "outro móvel", quantity: remaining, generic: true });
  d.items.splice(idx, 1, ...expanded);
  qr.currentRefs = expanded.map((e) => e.ref);
  if (qr.ownerProposal) for (const e of expanded) qr.ownerProposal[e.ref] = qr.ownerProposal[group.ref] ?? "";
}

function statementsSummary(qr: QuoteRequestState, text: string): string {
  const parts: string[] = [];
  for (const st of parseItemStatements(text, qr.draft.items, [])) {
    const names = humanList(st.refs.map((r) => qr.draft.items.find((i) => i.ref === r)).filter(Boolean).map((i) => itemName(i!)));
    const what = st.condition === "melhor_que_outros" ? "estão em melhor estado" : st.condition === "bom" ? "está em bom estado" : st.condition === "reparos" ? `precisa de reparo${st.repairPart ? ` no ${st.repairPart}` : ""}` : st.condition === "danificado" ? "está bem danificada" : st.affectedPart === "tampo" ? "é só o tampo" : "é a peça inteira";
    parts.push(`${names} ${what}`);
  }
  return parts.join("; ");
}

/** Aplica condições/escopo ditos na resposta, resolvendo "um deles", "os outros" etc. */
function applyStatements(qr: QuoteRequestState, text: string, currentRefs: string[]): boolean {
  // "uma tá quebrada, as outras estão boas" sobre "2 cadeiras": separa uma unidade
  // (só antes de criar os serviços: depois, cada peça já tem o seu)
  if (!qr.jobByRef) splitUnitForStatement(qr.draft.items, text, currentRefs);
  const unresolved: string[] = [];
  const statements = parseItemStatements(text, qr.draft.items, currentRefs, unresolved);
  // estado dito sem a peça: guarda a frase e pergunta depois (nunca aplica a todas, nunca descarta)
  if (unresolved.length) qr.notes = [...new Set([...(qr.notes ?? []), ...unresolved])].slice(-3);
  if (statements.length && qr.step === "condition") delete qr.notes;
  for (const st of statements) {
    for (const ref of st.refs) {
      const it = qr.draft.items.find((i) => i.ref === ref);
      if (!it) continue;
      if (st.condition) {
        it.condition = st.condition;
        if (st.repairPart !== undefined) it.repairPart = st.repairPart ?? it.repairPart;
      }
      if (st.affectedPart && !(st.condition && st.repairPart)) it.affectedPart = st.affectedPart;
    }
  }
  return statements.length > 0;
}

export async function onQuoteRequestCallback(c: Conversation, action: string): Promise<void> {
  const qr = c.session.context.quoteRequest;
  if (!qr) {
    c.say("Esse pedido já foi concluído. 🙂");
    return;
  }
  switch (action) {
    case "couple": {
      // um cliente só com o nome dos dois; todas as peças são dele
      qr.clientsRelation = "couple";
      const d = qr.draft;
      if (d.clients.length >= 2) {
        const merged: MentionedClient = { ref: d.clients[0]!.ref, rawName: d.clients.map((x) => x.rawName).join(" e "), name: d.clients.map((x) => x.name).join(" e "), confidence: 1 };
        d.clients = [merged];
      }
      for (const it of d.items) {
        it.ownerRef = d.clients[0]?.ref ?? null;
        it.ownerConfirmed = true;
      }
      d.ambiguities = d.ambiguities.filter((a) => !["clients_relation", "item_owner_mapping", "quote_grouping"].includes(a));
      delete qr.ownerProposal;
      c.ack = `Combinado: ${d.clients[0]?.name ?? "os dois"} ficam como um cliente só, com um orçamento só.`;
      return nextQuoteRequestStep(c);
    }
    case "separate":
      qr.clientsRelation = "separate";
      qr.draft.ambiguities = qr.draft.ambiguities.filter((a) => a !== "clients_relation");
      c.ack = "Certo, são dois clientes.";
      return nextQuoteRequestStep(c);
    case "owner_yes":
      for (const it of qr.draft.items) {
        it.ownerRef = qr.ownerProposal?.[it.ref] ?? it.ownerRef;
        it.ownerConfirmed = true;
      }
      return nextQuoteRequestStep(c);
    case "owner_no":
      for (const it of qr.draft.items) {
        it.ownerConfirmed = false;
        it.ownerRef = null;
      }
      return nextQuoteRequestStep(c);
    case "review_yes":
      qr.reviewed = true;
      return nextQuoteRequestStep(c);
    case "review_no":
      qr.step = "review_fix";
      qr.currentRefs = qr.draft.items.map((i) => i.ref);
      c.setPending({ type: "item_condition", entity: { kind: "quote_request", id: qr.id } });
      c.say('O que ficou diferente? Pode me falar do seu jeito, por exemplo: "a cômoda também precisa de reparo".');
      return persist(c);
    case "group_split":
      qr.grouping = "por_cliente";
      return nextQuoteRequestStep(c);
    case "group_all":
      qr.grouping = "agrupado";
      return nextQuoteRequestStep(c);
  }
}

/**
 * "É dos dois": se ele já disse que são dois clientes, não contrariar em silêncio —
 * perguntar se quer tratar como um cliente só.
 */
async function onBothOwners(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest!;
  if (qr.clientsRelation !== "separate") return onQuoteRequestCallback(c, "couple");
  const names = humanList(qr.draft.clients.map((x) => x.name));
  qr.step = "clients_relation";
  c.setPending({ type: "confirmation", entity: { kind: "quote_request", id: qr.id } });
  c.say(`Entendi, é dos dois. Então quer que eu junte ${names} como um cliente só, com um orçamento só?`, [
    [
      { text: "Sim, um cliente só", data: "qr:couple" },
      { text: "Não, separo as peças", data: "qr:owner_no" },
    ],
  ]);
  return persist(c);
}

/** Cria um serviço por peça, com as associações confirmadas. */
async function materializeJobs(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest!;
  const d = qr.draft;
  const map: Record<string, string> = {};
  const actor = c.input.user.id;
  const source = c.sourceKind();
  const messageId = d.rawText ? c.input.inboundMessageId : undefined;
  for (const it of d.items) {
    const job = await createJob(c.ctx, { actor, description: `${it.description} — ${it.sourceExcerpt}`.slice(0, 900) });
    map[it.ref] = job.id;
    const opts = { actor, source, messageId };
    // a quantidade vai junto: "2 cadeiras" num serviço é precificado como 2 peças
    const descriptors = it.description.replace(/^\S+\s*/, "").trim();
    if (it.furnitureType) await setFact(c.ctx, job.id, "furniture_type", { type: it.furnitureType, descriptors: descriptors ? [descriptors] : [], ...(it.quantity > 1 ? { quantity: it.quantity } : {}) }, opts);
    if (it.techniqueKeys.length) await setFact(c.ctx, job.id, "techniques", it.techniqueKeys, opts);
    const owner = clientName(d, it.ownerRef);
    if (owner) await setFact(c.ctx, job.id, "client_name", owner, opts);
    if (it.condition) await setFact(c.ctx, job.id, "condition", it.condition === "melhor_que_outros" ? "bom" : it.condition, opts);
    await setFact(c.ctx, job.id, "repairs", { needed: it.condition === "reparos" || it.condition === "danificado", ...(it.repairPart ? { description: `reparo no ${it.repairPart}` } : {}) }, opts);
    await setFact(c.ctx, job.id, "scope", { part: it.affectedPart ?? "inteiro", repairPart: it.repairPart }, opts);
    await setFact(c.ctx, job.id, "surfaces", "externa", { ...opts, status: "unconfirmed" });
    await setFact(c.ctx, job.id, "subcontract", { needed: false }, { ...opts, status: "unconfirmed" });
    if (d.date) await c.ctx.db.run("UPDATE jobs SET due_date = NULL, delivery_address = NULL WHERE id = ?", job.id);
  }
  qr.jobByRef = map;
  c.session.activeJobId = Object.values(map)[0] ?? null;
  await persist(c);
}

/** Calcula todos os itens; falta de preço → coleta com o artesão; senão apresenta. */
export async function quoteRequestCalculate(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest;
  if (!qr?.jobByRef) return;
  qr.step = "calculating";
  c.session.flow = "quote_request";
  const quotes: { ref: string; quote: QuoteRecord }[] = [];
  for (const it of qr.draft.items) {
    const jobId = qr.jobByRef[it.ref];
    if (!jobId) continue;
    quotes.push({ ref: it.ref, quote: await calculateQuote(c.ctx, jobId, c.input.user.id) });
  }
  // trava de cálculo vira pergunta (uma vez por campo e peça), nunca "orçamento preliminar"
  if (await askBlocked(c, quotes)) return;
  const missing = missingPriceKeys(quotes.map((q) => q.quote.result));
  if (missing.length) {
    await persist(c);
    return startPricing(c, { kind: "quote_request", requestId: qr.id }, missing, quotes.map((q) => q.quote.id));
  }
  // D-070: com tudo calculado, o artesão decide o valor (concorda, desconto ou acréscimo)
  if (quotes.length && quotes.every((q) => q.quote.result.computable && q.quote.recommendedCents !== null)) {
    const names = quotes.map(({ ref, quote }) => {
      const it = qr.draft.items.find((i) => i.ref === ref)!;
      const owner = qr.draft.clients.length > 1 ? clientName(qr.draft, it.ownerRef) : null;
      return { name: `${itemName(it)}${owner ? ` (${owner})` : ""}`, quote };
    });
    qr.step = "done";
    await c.ctx.db.run("UPDATE quote_requests SET status = 'CALCULADO', state_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(qr), nowIso(c.ctx), qr.id);
    const notes = qr.draft.rawText;
    delete c.session.context.quoteRequest;
    return presentMultiQuoteDecision(c, names, notes);
  }
  await presentQuoteRequest(c, quotes);
}

async function presentQuoteRequest(c: Conversation, quotes: { ref: string; quote: QuoteRecord }[]): Promise<void> {
  const qr = c.session.context.quoteRequest!;
  const d = qr.draft;
  const lines: string[] = ["Aqui está o orçamento 🧮", ""];
  const byClient = new Map<string, { floor: number; rec: number; names: string[] }>();
  let totalFloor = 0;
  let totalRec = 0;
  let allComputable = true;
  let allDefinitive = true;
  const hypotheses = new Set<string>();
  for (const { ref, quote } of quotes) {
    const it = d.items.find((i) => i.ref === ref)!;
    const owner = clientName(d, it.ownerRef) ?? "cliente";
    const r = quote.result;
    if (!r.computable) {
      allComputable = false;
      lines.push(`• ${capitalize(itemName(it))} (${owner}): ainda não consigo calcular — ${r.blockers.map((b) => b.message).join(" ")}`);
      continue;
    }
    allDefinitive &&= quote.definitiveAllowed;
    totalFloor += r.floorCents!;
    totalRec += r.recommendedCents!;
    const g = byClient.get(owner) ?? { floor: 0, rec: 0, names: [] };
    g.floor += r.floorCents!;
    g.rec += r.recommendedCents!;
    g.names.push(itemName(it));
    byClient.set(owner, g);
    lines.push(`• ${capitalize(itemName(it))}${d.clients.length > 1 ? ` (${owner})` : ""}: recomendado ${formatBRL(r.recommendedCents!)} — mínimo ${formatBRL(r.floorCents!)}`);
    for (const w of r.warnings) if (w.code === "AREA_RANGE_MAX_USED") hypotheses.add("medida estimada pelo tamanho (usei o maior valor da faixa, para não ter prejuízo)");
    for (const b of r.blockers) {
      if (b.code === "UNCALIBRATED_PARAMETERS") hypotheses.add("tempos e rendimentos ainda não calibrados com a sua experiência");
      if (b.code === "MATERIAL_YIELD_MISSING") hypotheses.add(b.message);
    }
    for (const g2 of r.gaps ?? []) hypotheses.add(g2.message);
  }
  if (allComputable) {
    lines.push("");
    if (d.clients.length > 1 && qr.grouping === "por_cliente") {
      for (const [owner, g] of byClient) lines.push(`${owner}: recomendado ${formatBRL(g.rec)} (mínimo ${formatBRL(g.floor)})`);
    }
    lines.push(`Total: recomendado ${formatBRL(totalRec)} — mínimo para não ter prejuízo ${formatBRL(totalFloor)}`);
  }
  if (d.items.some((i) => i.condition === "melhor_que_outros")) hypotheses.add("peças descritas como \"melhores\" consideradas sem reparos grandes");
  if (hypotheses.size) lines.push("", "O que eu considerei:", ...[...hypotheses].map((h) => `• ${h}`));
  lines.push("", allDefinitive && allComputable ? "Esse orçamento pode virar proposta definitiva." : "Por enquanto é um orçamento PRELIMINAR (não definitivo).");
  c.say(lines.join("\n"));

  const settings = await getActiveSettings(c.ctx);
  for (const { quote } of quotes) {
    if (!quote.result.computable) continue;
    if (settings.params.requireAdminReview || !quote.definitiveAllowed) await submitForReview(c.ctx, quote.id, c.input.user.id);
    else await approveQuote(c.ctx, quote.id, "system", { finalPriceCents: null });
  }
  c.say(
    settings.params.requireAdminReview || !allDefinitive
      ? "Mandei para o administrador conferir. Assim que ele aprovar, eu te aviso e preparo os PDFs. Se quiser ajustar alguma coisa, é só me falar, por exemplo: \"o tampo da cômoda é 1,10 por 45\"."
      : "Está pronto para virar proposta. Quer ajustar algo antes? É só me falar.",
  );
  qr.step = "done";
  await c.ctx.db.run("UPDATE quote_requests SET status = 'CALCULADO', state_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(qr), nowIso(c.ctx), qr.id);
  delete c.session.context.quoteRequest;
  c.session.flow = "idle";
  c.clearPending();
}

export async function askQuoteRequestAgain(c: Conversation): Promise<void> {
  const qr = c.session.context.quoteRequest;
  if (!qr) return;
  if (qr.step === "owner_confirm") delete qr.ownerProposal;
  if (qr.step === "condition") qr.askedCondition = false;
  if (qr.step === "dims") qr.askedDims = (qr.askedDims ?? []).filter((r) => !qr.currentRefs.includes(r));
  if (qr.step === "repair_hours") qr.askedRepair = (qr.askedRepair ?? []).filter((r) => !qr.currentRefs.includes(r));
  if (qr.step === "method") qr.methodAsked = false;
  if (qr.step === "material_source") qr.materialSourceAsked = false;
  if (qr.step === "logistics") qr.logisticsAsked = false;
  if (qr.step === "transport_cost") qr.transportAsked = false;
  if (qr.step === "review") qr.reviewed = false;
  return nextQuoteRequestStep(c);
}

/** Peças iguais ganham número: "o 1º criado-mudo", "o 2º criado-mudo" (antes as perguntas pareciam repetidas). */
function numberDuplicates(d: QuoteRequestDraft): void {
  const groups = new Map<string, MentionedItem[]>();
  for (const it of d.items) {
    if (it.generic || it.quantity > 1) continue;
    const k = normalizeText(it.description);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  for (const list of groups.values()) list.forEach((it, i) => (it.ordinal = list.length > 1 ? i + 1 : undefined));
}

/** Um cliente só para todas as peças (pedido sem nome de cliente). */
function setClient(qr: QuoteRequestState, name: string): void {
  const ref = "c1";
  qr.draft.clients = [{ ref, rawName: name, name, confidence: 1 }];
  for (const it of qr.draft.items) {
    it.ownerRef = ref;
    it.ownerConfirmed = true;
  }
}

/** Pergunta atual em palavras (contexto para a IA). */
function questionOf(qr: QuoteRequestState): string {
  const names = humanList(qr.draft.items.filter((i) => qr.currentRefs.includes(i.ref)).map(itemName));
  switch (qr.step) {
    case "identity":
      return "Quais são os outros móveis?";
    case "scope":
      return `Em ${names}, vai trabalhar só no tampo ou na peça inteira?`;
    case "condition":
      return `Como estão ${names}? Alguma precisa de reparo?`;
    case "dims":
      return `Quais são as medidas de ${names}?`;
    case "method":
      return "Vai aplicar com pincel, rolo ou pistola?";
    case "material_source":
      return "O material: já tem ou vai comprar?";
    case "logistics":
      return "Precisa buscar ou entregar os móveis?";
    case "techniques":
      return "O que vai ser feito nas peças?";
    case "client":
      return "De quem são os móveis?";
    default:
      return qr.step;
  }
}

const AI_STEPS: readonly string[] = ["identity", "scope", "condition", "review_fix", "dims", "method", "material_source", "logistics", "techniques", "client"];

/**
 * Aplica o que o Claude entendeu. Devolve o que ficou resolvido para a pergunta atual
 * (as informações extras — medida de outra peça, estado dito de passagem — também ficam).
 */
async function applyAi(c: Conversation, qr: QuoteRequestState, ai: QrAiResult): Promise<boolean> {
  const d = qr.draft;
  const opts = { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId };
  let resolved = false;
  if (qr.step === "identity" && ai.furniture.length) {
    const group = d.items.find((i) => i.ref === qr.currentRefs[0]);
    if (group?.generic) {
      replaceGroup(qr, group, ai.furniture);
      resolved = true;
    }
  }
  for (const x of ai.items) {
    const it = d.items.find((i) => i.ref === x.ref);
    if (!it) continue;
    if (x.condition && (it.condition === null || qr.step === "condition" || qr.step === "review_fix")) {
      it.condition = x.condition;
      if (x.repairPart) it.repairPart = x.repairPart;
      if (qr.step === "condition" && qr.currentRefs.includes(it.ref)) resolved = true;
    }
    if (x.affectedPart && (!it.affectedPart || qr.step === "scope")) {
      it.affectedPart = x.affectedPart;
      if (qr.step === "scope" && qr.currentRefs.includes(it.ref)) resolved = true;
    }
    const jobId = qr.jobByRef?.[it.ref];
    if (jobId && (x.dims || x.sizeClass)) {
      if (x.dims) await setFact(c.ctx, jobId, "dimensions", x.dims, { ...opts, correction: true });
      else await setFact(c.ctx, jobId, "size_class", x.sizeClass!, opts);
      qr.askedDims = [...new Set([...(qr.askedDims ?? []), it.ref])];
      if (qr.step === "dims" && qr.currentRefs.includes(it.ref)) resolved = true;
    }
  }
  if (ai.techniques.length) {
    for (const it of d.items) {
      if (it.generic || it.techniqueKeys.length) continue;
      it.techniqueKeys = ai.techniques;
      const jobId = qr.jobByRef?.[it.ref];
      if (jobId) await setFact(c.ctx, jobId, "techniques", ai.techniques, opts);
    }
    if (qr.step === "techniques") resolved = true;
  }
  if (ai.clientName && d.clients.length === 0) {
    setClient(qr, ai.clientName);
    if (qr.step === "client") resolved = true;
  }
  const jobIds = Object.values(qr.jobByRef ?? {});
  if (ai.method && (qr.step === "method" || !qr.methodAsked)) {
    qr.method = ai.method;
    qr.methodAsked = true;
    for (const jobId of jobIds) await setFact(c.ctx, jobId, "application_method", ai.method, opts);
    if (qr.step === "method") resolved = true;
  }
  if (ai.materialStatus && qr.step === "material_source") {
    qr.materialSourceAsked = true;
    for (const jobId of jobIds) await setFact(c.ctx, jobId, "material_status", ai.materialStatus, opts);
    c.ack = ai.materialStatus === "precisa_comprar" ? "Certo, vou considerar a compra. 🛒" : "Beleza! 👍 Mesmo já tendo, o material entra no preço (pra você repor depois sem sair no prejuízo).";
    resolved = true;
  }
  if (qr.step === "logistics" && ai.pickup !== undefined && ai.delivery !== undefined) {
    const l = { pickup: ai.pickup, delivery: ai.delivery };
    delete qr.partialLogistics;
    qr.logisticsAsked = true;
    qr.logistics = l;
    for (const jobId of jobIds) await setFact(c.ctx, jobId, "logistics", l, opts);
    resolved = true;
  }
  return resolved;
}

/** Bloqueio do cálculo → pergunta (nunca orçamento "preliminar" com texto técnico). */
async function askBlocked(c: Conversation, quotes: { ref: string; quote: QuoteRecord }[]): Promise<boolean> {
  const qr = c.session.context.quoteRequest!;
  qr.calcRetry ??= [];
  for (const { ref, quote } of quotes) {
    if (quote.result.computable) continue;
    const it = qr.draft.items.find((i) => i.ref === ref);
    if (!it) continue;
    const codes = quote.result.blockers.map((b) => b.code);
    if (codes.includes("TECHNIQUE_UNKNOWN") && !quote.result.blockers.some((b) => b.code === "TECHNIQUE_UNKNOWN" && b.ref) && !qr.calcRetry.includes(`tech:${ref}`)) {
      qr.calcRetry.push(`tech:${ref}`);
      qr.techniquesAsked = false;
      it.techniqueKeys = [];
      c.ack = `Pra fechar a conta d${itemName(it)} eu ainda preciso saber o que vai ser feito nela.`;
      await nextQuoteRequestStep(c);
      return true;
    }
    if (codes.includes("AREA_UNKNOWN") && !qr.calcRetry.includes(`dims:${ref}`)) {
      qr.calcRetry.push(`dims:${ref}`);
      qr.askedDims = (qr.askedDims ?? []).filter((r) => r !== ref);
      const jobId = qr.jobByRef?.[ref];
      if (jobId) await setFact(c.ctx, jobId, "dimensions", null, { actor: c.input.user.id, source: c.sourceKind() });
      c.ack = `Pra fechar a conta d${itemName(it)} eu ainda preciso do tamanho. 📏 Se não tiver a medida, me diz só se é pequena, média ou grande.`;
      await nextQuoteRequestStep(c);
      return true;
    }
    if (codes.includes("METHOD_REQUIRED") && !qr.calcRetry.includes("method")) {
      qr.calcRetry.push("method");
      qr.methodAsked = false;
      await nextQuoteRequestStep(c);
      return true;
    }
  }
  return false;
}
