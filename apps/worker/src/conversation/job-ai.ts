import { TECHNIQUES, describeFact, systemPrompt } from "@adripatina/conversations";
import type { FactValueMap, ProjectField } from "@adripatina/domain";
import { extractLengths, normalizeText, wordsToNumber } from "@adripatina/shared";
import type { Conversation } from "./engine.js";
import { interpretStructured } from "../ai/orchestrator.js";
import { setFact, type Job } from "../repos/jobs.js";
import { getOverrides, saveOverrides } from "../services/quotes.js";

/**
 * D-074 — orçamento de UM móvel: o Claude lê cada resposta e devolve TODOS os campos que ela
 * traz (técnica, estado, por dentro/fora, conserto, medidas, porte, método, transporte, material),
 * não só o da pergunta. Avaliação real 24/11/2026: numa fala ele dizia técnica, estado, tamanho,
 * método, tempo e transporte; o bot aproveitava um e perguntava o resto de novo.
 *
 * Travas: medida só com número dito; técnica só da lista; campo já preenchido só muda se for
 * correção explícita. A IA sugere, o código grava.
 */

const nullable = (t: string, extra: Record<string, unknown> = {}) => ({ type: [t, "null"], ...extra });

const SCHEMA = {
  type: "object",
  properties: {
    correcao: { type: "boolean" },
    tecnicas: { type: "array", items: { type: "string", enum: Object.keys(TECHNIQUES) } },
    estado: nullable("string", { enum: ["bom", "reparos", "danificado", null] }),
    superficies: nullable("string", { enum: ["externa", "interna_externa", null] }),
    conserto: nullable("boolean"),
    conserto_descricao: nullable("string"),
    altura_cm: nullable("number"),
    largura_cm: nullable("number"),
    fundura_cm: nullable("number"),
    diametro_cm: nullable("number"),
    porte: nullable("string", { enum: ["pequeno", "medio", "grande", null] }),
    metodo: nullable("string", { enum: ["pincel", "rolo", "pistola", null] }),
    artesao_busca: nullable("boolean"),
    artesao_entrega: nullable("boolean"),
    material: nullable("string", { enum: ["tem_tudo", "tem_parte", "precisa_comprar", null] }),
    frete_reais: nullable("number"),
    gavetas: nullable("integer"),
    portas: nullable("integer"),
    cliente: nullable("string"),
  },
  required: ["correcao", "tecnicas"],
};

const SYSTEM = systemPrompt(`Você extrai os dados de um orçamento de UM móvel a partir da fala do Adriano.
- Preencha TODOS os campos que a fala diz (não só o da pergunta atual). Campo que a fala não diz → null (técnicas: lista vazia).
- estado: "bom" (está boa, só uns riscos, sem conserto), "reparos" (precisa acertar detalhes, colar, massa), "danificado" (bem estragada, quebrada, cupim). "Sem conserto nenhum" e "nada quebrado" são BOM.
- superficies: "externa" se só por fora (inclusive "por dentro não precisa"); "interna_externa" se por dentro também.
- conserto: false se ele diz que não precisa consertar; true se descreve conserto (e conserto_descricao).
- Medidas em centímetros, só com números ditos (1 metro = 100; "1,20" = 120). Mesa redonda com uma medida = diâmetro. "X por Y" num tampo = largura × fundura, salvo se ele disser altura.
- porte: só se ele disser pequeno/médio/grande.
- artesao_busca/artesao_entrega: o ARTESÃO busca/entrega? Cliente traz → artesao_busca false; cliente busca/leva de volta → artesao_entrega false; "não precisa buscar nem entregar" → os dois false.
- material: "tem_tudo" (já tem), "tem_parte", "precisa_comprar".
- frete_reais: só se ele disser quanto custa o frete/transporte (em reais).
- gavetas / portas: total de gavetas / portas, se ele disser ("4 gavetas e 1 gavetão" = 5; "acho que são 3" = 3).
- cliente: nome do dono do móvel com o tratamento ("Dona Bia", "Seu Luiz"), só se ele disser.
- correcao: true se ele está corrigindo algo dito antes ("errei", "na verdade", "corrigir:").
Responda só JSON.`);

function spoken(text: string): number[] {
  const out = new Set<number>();
  const n = normalizeText(text);
  for (const m of n.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const v = Number(m[0].replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) continue;
    out.add(v);
    if (v <= 10) out.add(Math.round(v * 100));
  }
  for (const tok of n.split(/\s+/)) {
    const w = wordsToNumber([tok]);
    if (w && w > 0) {
      out.add(w);
      if (w <= 10) out.add(w * 100);
    }
  }
  for (const l of extractLengths(text)) out.add(Math.round(Number(l.meters.toString()) * 100));
  return [...out];
}

/** Propostas validadas campo → valor. */
export function validateJobAi(raw: unknown, text: string): { correction: boolean; facts: [ProjectField, unknown][]; freightCents?: number; drawers?: number; doors?: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const facts: [ProjectField, unknown][] = [];
  const nums = spoken(text);
  const g = (v: unknown) => (typeof v === "number" && v > 0 && v <= 500 && nums.some((s) => Math.abs(s - v) < 0.6) ? String(Math.round(v) / 100) : undefined);
  const techs = Array.isArray(r.tecnicas) ? r.tecnicas.filter((t): t is string => typeof t === "string" && !!TECHNIQUES[t]) : [];
  if (techs.length) facts.push(["techniques", [...new Set(techs)]]);
  if (r.estado === "bom" || r.estado === "reparos" || r.estado === "danificado") facts.push(["condition", r.estado]);
  if (r.superficies === "externa" || r.superficies === "interna_externa") facts.push(["surfaces", r.superficies]);
  if (typeof r.conserto === "boolean") facts.push(["repairs", { needed: r.conserto, ...(r.conserto && typeof r.conserto_descricao === "string" && r.conserto_descricao.trim() ? { description: r.conserto_descricao.trim().slice(0, 200) } : {}) }]);
  const dims: FactValueMap["dimensions"] = {};
  const h = g(r.altura_cm);
  const w = g(r.largura_cm);
  const d = g(r.fundura_cm);
  const di = g(r.diametro_cm);
  if (h) dims.height = h;
  if (w) dims.width = w;
  if (d) dims.depth = d;
  if (di) dims.diameter = di;
  if (Object.keys(dims).length) facts.push(["dimensions", dims]);
  else if ((r.porte === "pequeno" || r.porte === "medio" || r.porte === "grande") && /\b(pequen|medi|grand)/.test(normalizeText(text))) facts.push(["size_class", r.porte]);
  if (r.metodo === "pincel" || r.metodo === "rolo" || r.metodo === "pistola") facts.push(["application_method", r.metodo]);
  if (typeof r.artesao_busca === "boolean" && typeof r.artesao_entrega === "boolean") facts.push(["logistics", { pickup: r.artesao_busca, delivery: r.artesao_entrega }]);
  if (r.material === "tem_tudo" || r.material === "tem_parte" || r.material === "precisa_comprar") facts.push(["material_status", r.material]);
  // frete: só valor dito na fala (nunca inventado)
  const fr = typeof r.frete_reais === "number" && r.frete_reais > 0 && r.frete_reais < 5000 && nums.some((x) => Math.abs(x - (r.frete_reais as number)) < 0.01) ? Math.round((r.frete_reais as number) * 100) : undefined;
  // contagens: número dito na fala (ou por extenso), até 30
  const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 30 && nums.includes(v) ? v : undefined);
  const drawers = count(r.gavetas);
  const doors = count(r.portas);
  // cliente: o primeiro nome tem que estar na fala
  if (typeof r.cliente === "string" && r.cliente.trim().length >= 3) {
    const first = normalizeText(r.cliente).replace(/^(dona|seu|dom|sr|sra|senhor|senhora)\s+/, "").split(" ")[0]!;
    if (first.length >= 2 && normalizeText(text).includes(first)) facts.push(["client_name", r.cliente.trim().slice(0, 60)]);
  }
  return { correction: r.correcao === true, facts, ...(fr ? { freightCents: fr } : {}), ...(drawers ? { drawers } : {}), ...(doors ? { doors } : {}) };
}

/**
 * Aplica o que o Claude entendeu ao serviço. Devolve os campos gravados (para a confirmação curta)
 * e se o campo da pergunta atual ficou respondido.
 */
export async function applyJobAi(c: Conversation, job: Job, question: string, field: ProjectField | null, text: string): Promise<{ saved: string[]; answeredField: boolean; correction: boolean } | null> {
  const facts = Object.entries(job.facts)
    .filter(([, f]) => f?.value !== null && f?.value !== undefined)
    .map(([k, f]) => {
      try {
        return describeFact(k as ProjectField, f!.value);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const user = JSON.stringify({ ja_anotado: facts, pergunta_atual: question.slice(0, 300), fala: text.slice(0, 1500) });
  const raw = await interpretStructured(c.ctx, "job:interpret", SYSTEM, user, SCHEMA, 600);
  const v = raw ? validateJobAi(raw, text) : null;
  if (!v) return null;
  // correção também pelo texto (o texto claro começa com "corrigir:"), não só pela marcação da IA
  if (/^(corrigir|corrige)\b|\b(na verdade|errei|me enganei|ta errad|esta errad|ficou errad|o contrario)/.test(normalizeText(text))) v.correction = true;
  const saved: string[] = [];
  let answeredField = false;
  // o próprio artesão nunca é o cliente
  const me = normalizeText(c.firstName || "");
  for (const [f, value] of v.facts) {
    if (f === "client_name" && me && normalizeText(String(value)).includes(me)) continue;
    const current = job.facts[f]?.value;
    // campo já preenchido só muda em correção explícita (e só se for diferente)
    if (current !== undefined && current !== null && !v.correction) {
      if (f === field) answeredField = true;
      continue;
    }
    if (current !== undefined && JSON.stringify(current) === JSON.stringify(value)) continue;
    const r = await setFact(c.ctx, job.id, f, value as never, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, ...(current !== undefined && current !== null ? { correction: true } : {}) });
    if (r.kind === "set" || r.kind === "conflict") saved.push(describeFact(f, value));
    if (f === field || (field === "dimensions" && f === "size_class") || (field === "size_class" && f === "dimensions")) answeredField = true;
  }
  // gavetas/portas vão para o móvel (o catálogo não pergunta de novo)
  if (v.drawers || v.doors) {
    const ft = job.facts.furniture_type?.value as (FactValueMap["furniture_type"] & { attributes?: Record<string, unknown> }) | undefined;
    if (ft) {
      const attrs = { ...(ft.attributes ?? {}) };
      const next = { ...ft } as FactValueMap["furniture_type"] & { attributes?: Record<string, unknown> };
      let changed = false;
      if (v.drawers && (v.correction || attrs.drawers_count === undefined)) {
        attrs.drawers_count = v.drawers;
        next.drawers = v.drawers;
        changed = true;
        saved.push(`${v.drawers} gavetas`);
      }
      if (v.doors && (v.correction || attrs.doors_count === undefined)) {
        attrs.doors_count = v.doors;
        next.doors = v.doors;
        changed = true;
        saved.push(`${v.doors} portas`);
      }
      if (changed) {
        next.attributes = attrs;
        await setFact(c.ctx, job.id, "furniture_type", next as never, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId, correction: true, changeKind: "set" });
        if (c.session.context.catalogQ?.kind === "attr" && ["drawers_count", "doors_count"].includes(String((c.session.context.catalogQ as { key?: string }).key))) {
          delete c.session.context.catalogQ;
          answeredField = true;
        }
      }
    }
  }
  if (v.freightCents) {
    const ov = await getOverrides(c.ctx, job.id);
    const others = ov.specificExpenses.filter((e) => e.category !== "transporte");
    await saveOverrides(c.ctx, job.id, { ...ov, specificExpenses: [...others, { description: "Transporte (frete informado pelo artesão)", amountCents: v.freightCents, category: "transporte" }] }, c.input.user.id);
    saved.push(`frete de R$ ${(v.freightCents / 100).toFixed(2).replace(".", ",")} no orçamento`);
    if (!job.facts.logistics?.value) await setFact(c.ctx, job.id, "logistics", { pickup: true, delivery: true } as never, { actor: c.input.user.id, source: c.sourceKind(), messageId: c.input.inboundMessageId });
  }
  return { saved, answeredField, correction: v.correction };
}
