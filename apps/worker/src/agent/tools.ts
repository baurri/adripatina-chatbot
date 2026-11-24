import { FURNITURE, TECHNIQUES, findFurniture, findTechniques, grounded, groundNumbers, parseFurnitureList, pieceLabel, techniqueLabel } from "@adripatina/conversations";
import { OPTIONAL_FIELDS, type FactValueMap, type JobStatus, type ProjectField } from "@adripatina/domain";
import { allocateCents, formatBRL, normalizeText } from "@adripatina/shared";
import { findConfidentialTerms } from "@adripatina/pdf";
import type { Ctx } from "../context.js";
import type { AgentTool } from "../ports.js";
import { getActiveSettings, getMaterialByKey, listMaterials } from "../repos/catalog.js";
import { createJob, getJob, jobPhrase, listActiveJobs, setFact, transitionJob, computePending, jobBalance, type Job } from "../repos/jobs.js";
import { financialIdempotencyKey, recordExpense, recordPayment, recordPurchase } from "../repos/finance.js";
import { applyConfirmedPrice, missingPriceKeys } from "../services/material-pricing.js";
import { calculateQuote, closeQuoteByArtisan, getOverrides, issueDocuments, latestQuoteForJob, markQuoteOutcome, saveOverrides, sendDocumentToArtisan, type PriceAdjustment, type QuoteRecord } from "../services/quotes.js";
import { enqueueOutbox } from "../services/outbox.js";
import type { User } from "../repos/users.js";

/**
 * D-075 — ferramentas do agente de conversa. O Claude decide QUANDO e O QUE chamar; aqui o código
 * confere e grava:
 *  - todo número (medida, preço, valor, frete, quantidade) tem que ter sido dito pelo usuário;
 *  - móvel e técnica passam pelo catálogo;
 *  - dinheiro, situação do serviço e cancelamento NÃO são gravados direto: viram uma ação pendente
 *    com botões de confirmação (o usuário confirma, o código executa);
 *  - o orçamento só fecha num turno DEPOIS de o valor ter sido mostrado.
 * Erros voltam para o Claude como texto ("número não foi dito"), para ele perguntar em vez de chutar.
 */

export interface PendingAction {
  id: string;
  kind: "pagamento" | "gasto" | "situacao" | "cancelar";
  summary: string;
  payload: Record<string, unknown>;
}

export interface AgentState {
  /** serviços em foco na conversa (ordem de citação) */
  focus?: string[];
  /** fotos recebidas que ainda não foram ligadas a um serviço (ids de attachments) */
  photos?: string[];
  /** último orçamento mostrado (para fechar só num turno seguinte) */
  presented?: { jobIds: string[]; quoteIds: string[]; turn: number; baseCents: number; floorCents: number | null; stale?: boolean };
  /** contador de turnos (mensagens do usuário) — o orçamento mostrado num turno só fecha num seguinte */
  turn?: number;
  pending?: PendingAction | null;
  /** orçamentos fechados juntos: "cliente aceitou" vale para todos */
  closed?: string[];
  /** valores calculados por simular_ajuste (em reais) — podem ser usados no fechamento */
  simulated?: number[];
}

export interface ToolContext {
  ctx: Ctx;
  user: User;
  chatId: string;
  inboundMessageId: string;
  /** texto do usuário nesta mensagem e nas recentes (para conferir números) */
  userCorpus: string;
  state: AgentState;
  /** número deste turno — o orçamento mostrado neste turno não fecha neste turno */
  turn: number;
  /** o que aconteceu de relevante (botões a anexar, PDFs enviados) */
  effects: { presentedQuote?: boolean; pendingCreated?: PendingAction; pdfsSent?: number; askPhoto?: boolean };
}

// ------------------------------------------------------------------ helpers

const said = (t: ToolContext) => groundNumbers(t.userCorpus);
function ok(v: number | undefined | null, t: ToolContext): boolean {
  return v === undefined || v === null || grounded(v, said(t));
}
const reais = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : formatBRL(cents));

const REQUIRED_LABEL: Partial<Record<ProjectField, string>> = {
  furniture_type: "qual é o móvel",
  techniques: "o que vai ser feito (técnica)",
  client_name: "de quem é",
  dimensions: "tamanho (medidas ou pequeno/médio/grande)",
  condition: "estado da peça",
  surfaces: "só por fora ou por dentro também",
  repairs: "se precisa de conserto",
  logistics: "quem leva e traz (busca/entrega)",
  application_method: "pincel, rolo ou pistola",
  scope: "só o tampo ou a peça inteira",
};

function missingFor(job: Job): string[] {
  const techs = (job.facts.techniques?.value as string[] | null | undefined) ?? [];
  // trabalho só sob medida (tecido, pintura artística...): cobra pelas horas, não precisa de medida nem método
  const hoursOnly = techs.includes("sob_medida");
  const skip: ProjectField[] = hoursOnly ? ["dimensions", "application_method", "surfaces", "scope"] : [];
  return computePending(job.facts)
    .filter((f) => !OPTIONAL_FIELDS.includes(f) && f !== "details" && f !== "size_class" && !skip.includes(f))
    .filter((f) => !(f === "dimensions" && (job.facts.size_class?.value || job.facts.dimensions?.value)))
    .map((f) => REQUIRED_LABEL[f] ?? f);
}

function describeJob(job: Job): Record<string, unknown> {
  const f = job.facts;
  const v = (k: ProjectField) => f[k]?.value ?? null;
  const ft = v("furniture_type") as (FactValueMap["furniture_type"] & { attributes?: Record<string, unknown> }) | null;
  return {
    servico_id: job.id,
    nome: jobPhrase(job),
    situacao: job.status,
    movel: ft ? { tipo: pieceLabel(ft), quantidade: ft.quantity ?? 1, gavetas: ft.drawers ?? ft.attributes?.drawers_count ?? null, portas: ft.doors ?? ft.attributes?.doors_count ?? null, detalhes: ft.descriptors ?? [] } : null,
    tecnicas: ((v("techniques") as string[] | null) ?? []).map(techniqueLabel),
    cliente: v("client_name"),
    medidas_m: v("dimensions"),
    porte: v("size_class"),
    estado: v("condition"),
    superficies: v("surfaces"),
    parte: (v("scope") as { part?: string } | null)?.part ?? null,
    conserto: v("repairs"),
    metodo: v("application_method"),
    transporte: v("logistics"),
    material: v("material_status"),
    prazo: v("deadline"),
    observacoes: v("details"),
    falta_para_orcamento: missingFor(job),
  };
}

async function loadJob(t: ToolContext, id: unknown): Promise<Job | string> {
  if (typeof id !== "string") return "servico_id ausente";
  const job = await getJob(t.ctx, id);
  if (!job) return `serviço ${id} não encontrado — use listar_servicos`;
  return job;
}

function focus(t: ToolContext, id: string): void {
  t.state.focus = [id, ...(t.state.focus ?? []).filter((x) => x !== id)].slice(0, 6);
}

const opts = (t: ToolContext) => ({ actor: t.user.id, source: "telegram_text" as const, messageId: t.inboundMessageId });

// ------------------------------------------------------------------ definições

const n = (description: string) => ({ type: ["number", "null"], description });
const s = (description: string, e?: string[]) => ({ type: ["string", "null"], description, ...(e ? { enum: [...e, null] } : {}) });
const b = (description: string) => ({ type: ["boolean", "null"], description });

const FIELDS_SCHEMA = {
  type: "object",
  description: "Só os campos que o Adriano disse. Campo não dito: deixe de fora.",
  properties: {
    tecnicas: { type: "array", items: { type: "string", enum: Object.keys(TECHNIQUES) }, description: "o trabalho: patina, verniz, pintura_lisa, decape, enceramento, folha_ouro, restauracao..." },
    estado: s("bom (está boa, só riscos, sem conserto) | reparos (acertar detalhes, colar, massa) | danificado (quebrada, cupim, bem estragada)", ["bom", "reparos", "danificado"]),
    superficies: s("externa = só por fora; interna_externa = por dentro também", ["externa", "interna_externa"]),
    parte: s("inteiro | tampo | cabeceira", ["inteiro", "tampo", "cabeceira"]),
    conserto: b("precisa de conserto?"),
    conserto_descricao: s("o que consertar"),
    conserto_horas: n("horas que ele estima para o conserto"),
    altura_cm: n("altura em cm"),
    largura_cm: n("largura em cm"),
    fundura_cm: n("fundura/profundidade em cm"),
    diametro_cm: n("diâmetro em cm (mesa redonda)"),
    porte: s("só se ele disser pequeno/médio/grande", ["pequeno", "medio", "grande"]),
    metodo: s("pincel (inclui trincha) | rolo | pistola", ["pincel", "rolo", "pistola"]),
    artesao_busca: b("o ARTESÃO vai levar a peça da casa do cliente para a oficina? Só com ele dizendo isso claramente. 'Vou lá na casa dela ver/pegar o serviço' é ir orçar, NÃO é buscar a peça — na dúvida, deixe de fora e pergunte. (cliente traz = false)"),
    artesao_entrega: b("o ARTESÃO vai entregar? (cliente busca = false)"),
    frete_reais: n("quanto ele cobra/gasta de frete, se disser"),
    material: s("tem_tudo (já tem) | tem_parte | precisa_comprar", ["tem_tudo", "tem_parte", "precisa_comprar"]),
    gavetas: n("total de gavetas"),
    portas: n("total de portas"),
    quantidade: n("quantas peças iguais neste serviço"),
    cliente: s("nome do dono com tratamento: 'Dona Carla', 'Seu Luiz'"),
    prazo: s("quando fica pronto para o cliente, do jeito que ele falou, incluindo quando ele consegue começar: 'começo daqui a 2 meses, fica pronto em uns 10 dias', 'daqui a 6 meses', 'sem prazo'"),
    trabalho_descricao: s("o que vai ser feito quando NÃO é uma das técnicas (ex.: 'encapar o interior com veludo vinho', 'pintar flores à mão', 'trocar os puxadores'). Vai no PDF."),
    horas_artesao: n("horas que ELE diz para o TRABALHO TODO desta peça (incluindo conserto). A conta passa a ser pelas horas dele + materiais_extras, sem a conta padrão. Use quando ele disser o tempo total, ou quando a peça/trabalho foge do comum (estátua, peça artística, tecido)."),
    dias_artesao: n("se ele falar o tempo do trabalho todo em DIAS de trabalho ('leva uns 7 dias'): use isto em vez de horas_artesao (não peça horas)"),
    material_total_reais: n("quanto ELE diz que gasta de material no total nesta peça ('de material dá uns 70'): substitui os materiais da conta padrão"),
    horas_extra: n("horas de um trabalho A MAIS que soma à conta normal (ex.: trocar os puxadores = 1 h). Vai junto com trabalho_descricao."),
    materiais_extras: {
      type: ["array", "null"],
      description: "material comprado só pra esta peça que ele quer cobrar (veludo, puxadores, ferragens, folha de ouro em caderno...)",
      items: { type: "object", properties: { descricao: { type: "string" }, valor_unitario_reais: { type: "number" }, quantidade: { type: "number" } }, required: ["descricao", "valor_unitario_reais"] },
    },
    terceiro_descricao: s("parte que OUTRA pessoa faz (ex.: 'palhinha do assento com o Seu Zé')"),
    terceiro_reais_cada: n("quanto o terceiro cobra POR PEÇA"),
    observacao: s("detalhe dito de passagem para guardar (cor, tempo que ele acha que leva, ferramenta extra...)"),
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "guardar_foto",
    description: "Guarda a(s) foto(s) que ele mandou junto de um serviço. (criar_servico e anotar já guardam sozinhos a foto recebida; use esta só quando a foto for de um serviço que você não vai criar nem anotar agora.)",
    input_schema: { type: "object", properties: { servico_id: { type: "string" } }, required: ["servico_id"] },
  },
  {
    name: "listar_servicos",
    description: "Lista os serviços em andamento (com o que já está anotado e o que falta). Use para achar o servico_id de um serviço que ele citar.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "criar_servico",
    description: "Cria um serviço novo (uma peça, ou várias peças IGUAIS com quantidade). Para peças diferentes, crie um serviço para cada. Já passe tudo o que ele disse sobre a peça em 'campos'.",
    input_schema: {
      type: "object",
      properties: { movel: { type: "string", description: "o móvel como ele falou, corrigindo erro óbvio: 'cômoda', 'mesa de centro', 'criado-mudo'" }, campos: FIELDS_SCHEMA },
      required: ["movel"],
    },
  },
  {
    name: "anotar",
    description: "Anota no serviço tudo o que ele disse (vários campos de uma vez). Use a cada resposta dele, ANTES de perguntar a próxima coisa. Para corrigir algo já anotado, mande correcao=true.",
    input_schema: {
      type: "object",
      properties: {
        servico_id: { type: "string" },
        campos: FIELDS_SCHEMA,
        correcao: { type: "boolean" },
        limpar: { type: "array", items: { type: "string", enum: ["metodo", "transporte", "porte", "medidas", "estado", "superficies", "parte", "conserto", "material", "prazo", "cliente"] }, description: "apaga o que foi anotado errado e ele ainda não sabe (ex.: 'não disse que ia buscar' → limpar ['transporte'] e pergunte)" },
      },
      required: ["servico_id", "campos"],
    },
  },
  {
    name: "calcular_orcamento",
    description: "Calcula o orçamento de um ou mais serviços quando os dados estiverem completos. Devolve sugestão, mínimo sem prejuízo, material a comprar, horas, e o que ainda falta (campos ou preços de material).",
    input_schema: { type: "object", properties: { servico_ids: { type: "array", items: { type: "string" } } }, required: ["servico_ids"] },
  },
  {
    name: "informar_preco_material",
    description: "Guarda o preço de um material que ele informou (preço de UMA embalagem e o tamanho dela). Ex.: 'duas latas de 900 ml por 150' → preco_embalagem_reais 75, tamanho 900, unidade ml.",
    input_schema: {
      type: "object",
      properties: {
        chave: { type: "string", description: "chave do material (vem do calcular_orcamento)" },
        preco_embalagem_reais: { type: "number" },
        tamanho_embalagem: { type: "number", description: "quantidade numa embalagem (ex.: 900, 3.6, 1)" },
        unidade: { type: "string", enum: ["ml", "l", "g", "kg", "folha", "un"] },
      },
      required: ["chave", "preco_embalagem_reais", "tamanho_embalagem", "unidade"],
    },
  },
  {
    name: "tirar_material",
    description: "Tira um material DESTE orçamento quando ele diz que não usa (ex.: 'não uso solvente').",
    input_schema: { type: "object", properties: { servico_id: { type: "string" }, chave: { type: "string" } }, required: ["servico_id", "chave"] },
  },
  {
    name: "simular_ajuste",
    description: "Faz a conta de um desconto ou acréscimo sobre o orçamento mostrado (sem fechar): devolve o valor final e se fica abaixo do mínimo. Use antes de falar qualquer valor ajustado.",
    input_schema: {
      type: "object",
      properties: {
        servico_ids: { type: "array", items: { type: "string" } },
        desconto_pct: n("desconto em %"),
        desconto_reais: n("desconto em reais"),
        acrescimo_reais: n("acréscimo em reais"),
        valor_final_reais: n("valor total que ele quer cobrar"),
      },
      required: ["servico_ids"],
    },
  },
  {
    name: "fechar_orcamento",
    description: "Fecha o orçamento com o valor que ELE decidiu e manda o PDF. Só depois de ele ver o valor e responder: sem valor_final_reais = concordou com a sugestão; com valor = o total que ele quer cobrar (já com desconto/acréscimo). Abaixo do mínimo: só depois de avisar e ele confirmar.",
    input_schema: {
      type: "object",
      properties: {
        servico_ids: { type: "array", items: { type: "string" } },
        valor_final_reais: n("total final que ele decidiu (omita se concordou com a sugestão)"),
        motivo_ajuste: s("ex.: 'frete' quando ele acrescenta"),
        confirmou_abaixo_do_minimo: b("ele confirmou que quer cobrar abaixo do mínimo"),
      },
      required: ["servico_ids"],
    },
  },
  {
    name: "registrar_pagamento",
    description: "Prepara o registro de um pagamento recebido de um cliente (ele confirma num botão).",
    input_schema: { type: "object", properties: { servico_id: { type: "string" }, valor_reais: { type: "number" } }, required: ["servico_id", "valor_reais"] },
  },
  {
    name: "registrar_gasto",
    description: "Prepara o registro de um gasto/compra (ele confirma num botão). material_chave se for material do catálogo.",
    input_schema: { type: "object", properties: { valor_reais: { type: "number" }, descricao: { type: "string" }, material_chave: s("chave do material, se for"), servico_id: s("serviço a que pertence, se ele disser") }, required: ["valor_reais", "descricao"] },
  },
  {
    name: "mudar_situacao",
    description: "Prepara a mudança da situação do serviço (ele confirma num botão): iniciado (começou), concluido (ficou pronto), entregue. 'Quando ficar pronto' NÃO é mudança.",
    input_schema: { type: "object", properties: { servico_id: { type: "string" }, situacao: { type: "string", enum: ["iniciado", "concluido", "entregue"] } }, required: ["servico_id", "situacao"] },
  },
  {
    name: "cancelar_servico",
    description: "Prepara o cancelamento de um serviço (ex.: ele quer recomeçar do zero). Ele confirma num botão; o histórico fica guardado.",
    input_schema: { type: "object", properties: { servico_id: { type: "string" } }, required: ["servico_id"] },
  },
  {
    name: "resultado_cliente",
    description: "Anota se o cliente aceitou ou recusou o orçamento já fechado.",
    input_schema: { type: "object", properties: { servico_ids: { type: "array", items: { type: "string" } }, aceitou: { type: "boolean" } }, required: ["servico_ids", "aceitou"] },
  },
  {
    name: "situacao_financeira",
    description: "Mostra quanto o cliente já pagou e quanto falta de um serviço.",
    input_schema: { type: "object", properties: { servico_id: { type: "string" } }, required: ["servico_id"] },
  },
];

// ------------------------------------------------------------------ campos → fatos

type Fields = Record<string, unknown>;

/** campos que podem ser apagados (anotado errado / ele ainda não sabe) */
const CLEARABLE: Record<string, ProjectField> = {
  metodo: "application_method",
  transporte: "logistics",
  porte: "size_class",
  medidas: "dimensions",
  estado: "condition",
  superficies: "surfaces",
  parte: "scope",
  conserto: "repairs",
  material: "material_status",
  prazo: "deadline",
  cliente: "client_name",
};

async function clearFields(t: ToolContext, job: Job, keys: unknown): Promise<string[]> {
  const cleared: string[] = [];
  if (!Array.isArray(keys)) return cleared;
  for (const k of keys) {
    const field = typeof k === "string" ? CLEARABLE[k] : undefined;
    if (!field || job.facts[field]?.value === undefined || job.facts[field]?.value === null) continue;
    await setFact(t.ctx, job.id, field, null, { ...opts(t), correction: true, changeKind: "correction" });
    cleared.push(k as string);
  }
  return cleared;
}

async function applyFields(t: ToolContext, job: Job, fields: Fields, correction: boolean): Promise<{ saved: string[]; rejected: string[] }> {
  const r = await applyFieldsInner(t, job, fields, correction);
  const p = t.state.presented;
  if (p && p.jobIds.includes(job.id) && r.saved.some((x) => !/^prazo/.test(x))) p.stale = true;
  return r;
}

async function applyFieldsInner(t: ToolContext, job: Job, fields: Fields, correction: boolean): Promise<{ saved: string[]; rejected: string[] }> {
  const saved: string[] = [];
  const rejected: string[] = [];
  const set = async (field: ProjectField, value: unknown, label: string) => {
    const current = job.facts[field]?.value;
    if (current !== undefined && current !== null && JSON.stringify(current) === JSON.stringify(value)) return;
    const r = await setFact(t.ctx, job.id, field, value as never, { ...opts(t), ...(current !== undefined && current !== null ? { correction: true } : {}) });
    if (r.kind !== "same") saved.push(label);
    void correction;
  };
  const num = (k: string, max = 1000): number | undefined => {
    const v = fields[k];
    if (typeof v !== "number" || !(v > 0) || v > max) return undefined;
    if (!ok(v, t)) {
      rejected.push(`${k}=${v} (esse número não foi dito por ele — pergunte)`);
      return undefined;
    }
    return v;
  };
  const techs = Array.isArray(fields.tecnicas) ? fields.tecnicas.filter((x): x is string => typeof x === "string" && !!TECHNIQUES[x]) : [];
  if (techs.length) await set("techniques", [...new Set(techs)], `técnica: ${techs.map(techniqueLabel).join(" e ")}`);
  if (fields.estado === "bom" || fields.estado === "reparos" || fields.estado === "danificado") await set("condition", fields.estado, `estado: ${fields.estado}`);
  if (fields.superficies === "externa" || fields.superficies === "interna_externa") await set("surfaces", fields.superficies, fields.superficies === "externa" ? "só por fora" : "por dentro e por fora");
  if (fields.parte === "inteiro" || fields.parte === "tampo" || fields.parte === "cabeceira") await set("scope", { part: fields.parte }, fields.parte === "inteiro" ? "peça inteira" : `só ${fields.parte === "tampo" ? "o tampo" : "a cabeceira"}`);
  if (typeof fields.conserto === "boolean") {
    const desc = typeof fields.conserto_descricao === "string" && fields.conserto_descricao.trim() ? fields.conserto_descricao.trim().slice(0, 200) : undefined;
    await set("repairs", { needed: fields.conserto, ...(fields.conserto && desc ? { description: desc } : {}) }, fields.conserto ? `conserto${desc ? `: ${desc}` : ""}` : "sem conserto");
  }
  const hrs = num("conserto_horas", 200);
  if (hrs) {
    const ov = await getOverrides(t.ctx, job.id);
    await saveOverrides(t.ctx, job.id, { ...ov, extraLabor: [...ov.extraLabor.filter((x) => !/estimativa do artesão/.test(x.description)), { description: "Conserto (estimativa do artesão)", hours: String(hrs) }] }, t.user.id);
    saved.push(`${hrs} h de conserto`);
  }
  const dims: FactValueMap["dimensions"] = {};
  const h = num("altura_cm", 500);
  const w = num("largura_cm", 500);
  const d = num("fundura_cm", 500);
  const di = num("diametro_cm", 500);
  if (h) dims.height = String(h / 100);
  if (w) dims.width = String(w / 100);
  if (d) dims.depth = String(d / 100);
  if (di) dims.diameter = String(di / 100);
  if (Object.keys(dims).length) {
    const cur = (job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined) ?? {};
    // completa a medida que já existia (ele costuma dar uma de cada vez); correção substitui
    const merged = correction ? { ...cur, ...dims } : { ...cur, ...dims };
    await set("dimensions", merged, `medidas: ${[merged.height && `altura ${merged.height} m`, merged.width && `largura ${merged.width} m`, merged.depth && `fundura ${merged.depth} m`, merged.diameter && `diâmetro ${merged.diameter} m`].filter(Boolean).join(", ")}`);
  } else if (fields.porte === "pequeno" || fields.porte === "medio" || fields.porte === "grande") {
    await set("size_class", fields.porte, `tamanho ${fields.porte}`);
  }
  if (fields.metodo === "pincel" || fields.metodo === "rolo" || fields.metodo === "pistola") await set("application_method", fields.metodo, `aplicação: ${fields.metodo}`);
  if (typeof fields.artesao_busca === "boolean" || typeof fields.artesao_entrega === "boolean") {
    const cur = (job.facts.logistics?.value as FactValueMap["logistics"] | undefined) ?? null;
    const pickup = typeof fields.artesao_busca === "boolean" ? fields.artesao_busca : (cur?.pickup ?? false);
    const delivery = typeof fields.artesao_entrega === "boolean" ? fields.artesao_entrega : (cur?.delivery ?? false);
    await set("logistics", { pickup, delivery }, pickup || delivery ? `${pickup ? "você busca" : ""}${pickup && delivery ? " e " : ""}${delivery ? "você entrega" : ""}` : "sem frete (cliente traz e busca)");
  }
  const frete = num("frete_reais", 5000);
  if (frete) {
    const ov = await getOverrides(t.ctx, job.id);
    await saveOverrides(t.ctx, job.id, { ...ov, specificExpenses: [...ov.specificExpenses.filter((e) => e.category !== "transporte"), { description: "Transporte (frete informado pelo artesão)", amountCents: Math.round(frete * 100), category: "transporte" }] }, t.user.id);
    saved.push(`frete de ${formatBRL(Math.round(frete * 100))}`);
  }
  // trabalho sob medida: cobrado pelas horas que ele estima (vai no PDF com a descrição dele)
  const desc = typeof fields.trabalho_descricao === "string" && fields.trabalho_descricao.trim().length >= 3 ? fields.trabalho_descricao.trim().slice(0, 80) : null;
  const dias = num("dias_artesao", 120);
  const perDay = dias ? Number((await getActiveSettings(t.ctx)).params.hoursPerWorkday) || 6 : 0;
  const horas = num("horas_artesao", 400) ?? (dias ? Math.round(dias * perDay * 10) / 10 : undefined);
  const matTotal = num("material_total_reais", 20000);
  if (matTotal) {
    const ov = await getOverrides(t.ctx, job.id);
    await saveOverrides(t.ctx, job.id, { ...ov, artisanMaterialCents: Math.round(matTotal * 100) }, t.user.id);
    saved.push(`material: ${formatBRL(Math.round(matTotal * 100))} no total (o que você falou)`);
  }
  const extra = num("horas_extra", 200);
  const curTechs = (job.facts.techniques?.value as string[] | null | undefined) ?? [];
  const realTechs = curTechs.filter((x) => x !== "sob_medida");
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  if (extra) {
    // trabalho a mais que soma à conta normal
    const ov = await getOverrides(t.ctx, job.id);
    const description = cap(desc ?? "Trabalho extra");
    await saveOverrides(t.ctx, job.id, { ...ov, extraLabor: [...ov.extraLabor.filter((x) => normalizeText(x.description) !== normalizeText(description)), { description, hours: String(extra) }] }, t.user.id);
    saved.push(`${description}: ${extra} h a mais`);
  } else if (horas || (desc && realTechs.length === 0)) {
    // conta pelas horas dele (trabalho todo)
    if (!curTechs.includes("sob_medida")) await set("techniques", [...curTechs, "sob_medida"], `trabalho: ${desc ?? "sob medida"}`);
    const ov = await getOverrides(t.ctx, job.id);
    const description = cap(desc ?? ov.artisanTotal?.description ?? (realTechs.length ? `Trabalho de ${realTechs.map(techniqueLabel).join(" e ")}` : "Trabalho sob medida"));
    const hours = horas ? String(horas) : ov.artisanTotal?.hours;
    if (hours) {
      await saveOverrides(t.ctx, job.id, { ...ov, artisanTotal: { description, hours } }, t.user.id);
      saved.push(`conta pelas suas horas: ${description}, ${hours} h`);
    } else if (desc) {
      const notes = (job.facts.details?.value as string | undefined) ?? "";
      if (!notes.includes(desc)) await set("details", notes ? `${notes}; ${desc}` : desc, `trabalho: ${desc}`);
    }
  } else if (desc) {
    const notes = (job.facts.details?.value as string | undefined) ?? "";
    if (!notes.includes(desc)) await set("details", notes ? `${notes}; ${desc}` : desc, `trabalho: ${desc}`);
  }
  if (Array.isArray(fields.materiais_extras)) {
    const ov = await getOverrides(t.ctx, job.id);
    let expenses = [...ov.specificExpenses];
    for (const m of fields.materiais_extras as { descricao?: unknown; valor_unitario_reais?: unknown; quantidade?: unknown }[]) {
      if (typeof m?.descricao !== "string" || typeof m.valor_unitario_reais !== "number" || !(m.valor_unitario_reais > 0)) continue;
      if (!ok(m.valor_unitario_reais, t)) {
        rejected.push(`material ${m.descricao}=${m.valor_unitario_reais} (valor não foi dito por ele — pergunte)`);
        continue;
      }
      const qty = typeof m.quantidade === "number" && m.quantidade > 0 && m.quantidade <= 200 ? m.quantidade : 1;
      const label = `${m.descricao.trim().slice(0, 60)}${qty > 1 ? ` (${qty} un.)` : ""}`;
      expenses = [...expenses.filter((e) => !(e.category === "outros" && normalizeText(e.description).startsWith(normalizeText(m.descricao as string).slice(0, 12)))), { description: label, amountCents: Math.round(m.valor_unitario_reais * 100 * qty), category: "outros" }];
      saved.push(`material: ${label} ${formatBRL(Math.round(m.valor_unitario_reais * 100 * qty))}`);
    }
    await saveOverrides(t.ctx, job.id, { ...ov, specificExpenses: expenses }, t.user.id);
  }
  const terceiro = typeof fields.terceiro_descricao === "string" && fields.terceiro_descricao.trim().length >= 3 ? fields.terceiro_descricao.trim().slice(0, 100) : null;
  const terceiroCada = num("terceiro_reais_cada", 20000);
  if (terceiro || terceiroCada) {
    const ft0 = job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined;
    const qty = ft0?.quantity && ft0.quantity > 1 ? ft0.quantity : 1;
    const prev = await t.ctx.db.first<{ scope: string; cost_cents: number | null }>("SELECT scope, cost_cents FROM subcontract_quotes WHERE job_id = ? ORDER BY created_at DESC LIMIT 1", job.id);
    const scope = terceiro ?? prev?.scope ?? "Serviço de parceiro";
    const cost = terceiroCada ? Math.round(terceiroCada * 100 * qty) : (prev?.cost_cents ?? null);
    const now = new Date(t.ctx.clock()).toISOString();
    await t.ctx.db.run("DELETE FROM subcontract_quotes WHERE job_id = ?", job.id);
    await t.ctx.db.run(
      "INSERT INTO subcontract_quotes (id, job_id, scope, cost_cents, logistics_cents, confirmed, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
      crypto.randomUUID(),
      job.id,
      scope,
      cost,
      cost !== null ? 1 : 0,
      now,
      now,
    );
    saved.push(`parceiro: ${scope}${cost !== null ? ` ${formatBRL(cost)}` : " (falta o valor)"}`);
  }
  if (typeof fields.prazo === "string" && fields.prazo.trim().length >= 3) await set("deadline", fields.prazo.trim().slice(0, 120), `prazo: ${fields.prazo.trim().slice(0, 120)}`);
  if (fields.material === "tem_tudo" || fields.material === "tem_parte" || fields.material === "precisa_comprar") await set("material_status", fields.material, `material: ${fields.material}`);
  const drawers = num("gavetas", 40);
  const doors = num("portas", 40);
  const qty = num("quantidade", 30);
  if (drawers || doors || qty) {
    const ft = job.facts.furniture_type?.value as (FactValueMap["furniture_type"] & { attributes?: Record<string, unknown> }) | undefined;
    if (ft) {
      const next = { ...ft, attributes: { ...(ft.attributes ?? {}) } } as FactValueMap["furniture_type"] & { attributes: Record<string, unknown> };
      if (drawers) {
        next.drawers = drawers;
        next.attributes.drawers_count = drawers;
      }
      if (doors) {
        next.doors = doors;
        next.attributes.doors_count = doors;
      }
      if (qty) next.quantity = qty;
      await setFact(t.ctx, job.id, "furniture_type", next as never, { ...opts(t), correction: true, changeKind: "set" });
      saved.push([drawers && `${drawers} gavetas`, doors && `${doors} portas`, qty && `${qty} peças`].filter(Boolean).join(", "));
    }
  }
  if (typeof fields.cliente === "string" && fields.cliente.trim().length >= 3) {
    const name = fields.cliente.trim().slice(0, 60);
    const first = normalizeText(name).replace(/^(dona|seu|dom|sr|sra|senhor|senhora)\s+/, "").split(" ")[0]!;
    const me = normalizeText(t.user.displayName.split(" ")[0] ?? "");
    if (first.length < 2 || !normalizeText(t.userCorpus).includes(first)) rejected.push(`cliente=${name} (nome não foi dito por ele)`);
    else if (me && normalizeText(name).includes(me)) rejected.push(`cliente=${name} (é o próprio artesão, não o cliente)`);
    else await set("client_name", name, `cliente: ${name}`);
  }
  if (typeof fields.observacao === "string" && fields.observacao.trim().length >= 3) {
    const prev = (job.facts.details?.value as string | undefined) ?? "";
    const note = fields.observacao.trim().slice(0, 200);
    if (!normalizeText(prev).includes(normalizeText(note))) await set("details", prev ? `${prev}; ${note}` : note, `observação: ${note}`);
  }
  return { saved, rejected };
}

/** Liga as fotos ainda soltas desta conversa ao serviço. Devolve quantas foram guardadas. */
async function attachPhotos(t: ToolContext, jobId: string): Promise<number> {
  const ids = t.state.photos ?? [];
  if (!ids.length) return 0;
  for (const id of ids) await t.ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ? AND job_id IS NULL", jobId, id);
  t.state.photos = [];
  return ids.length;
}

/** "outros dois móveis", "outro móvel (tampo, ainda sem nome)", "uma peça": não diz o que é */
function isVaguePiece(text: string): boolean {
  const norm = normalizeText(text.replace(/\([^)]*\)/g, " "));
  if (/sem nome|nao sei o que e|ainda nao sei/.test(normalizeText(text))) return true;
  const tokens = norm.split(/\s+/).filter((w) => w && !/^(o|a|os|as|um|uma|uns|umas|dois|duas|tres|quatro|outro|outra|outros|outras|mais|\d+)$/.test(w));
  return tokens.length === 0 || /^(moveis?|pecas?|coisas?|itens?|item|objetos?|trabalhos?|servicos?|tampos?|partes?|pes|gavetas?)$/.test(tokens[0]!);
}

function resolveFurniture(movel: string): { key: string; label: string } | null {
  const hit = parseFurnitureList(movel)[0] ?? parseFurnitureList(`um ${movel}`)[0];
  if (hit) return { key: hit.key, label: hit.description };
  const k = findFurniture(movel);
  if (k) return { key: k, label: FURNITURE[k]?.label ?? movel };
  return null;
}

// ------------------------------------------------------------------ execução

export async function runTool(t: ToolContext, name: string, input: unknown): Promise<unknown> {
  const a = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "listar_servicos": {
      const jobs = await listActiveJobs(t.ctx, 12);
      return { servicos: jobs.map(describeJob) };
    }
    case "criar_servico": {
      if (typeof a.movel !== "string" || !a.movel.trim()) return { erro: "diga qual é o móvel" };
      // "outros dois móveis", "uma peça": não diz o que é — pergunte
      if (isVaguePiece(a.movel)) return { erro: `'${a.movel}' não diz qual é a peça — pergunte o que é antes de criar` };
      const f = resolveFurniture(a.movel);
      const job = await createJob(t.ctx, { actor: t.user.id, description: a.movel.slice(0, 200), messageId: t.inboundMessageId });
      // peça fora do catálogo (estátua, bandeja, faqueiro...): guarda o nome que ele usou
      const custom = a.movel.trim().replace(/^(um|uma|o|a)\s+/i, "").slice(0, 50);
      await setFact(t.ctx, job.id, "furniture_type", (f ? { type: f.key, descriptors: [] } : { type: "outro", label: custom, descriptors: [] }) as never, opts(t));
      const fields = (a.campos && typeof a.campos === "object" ? a.campos : {}) as Fields;
      // técnica dita em texto livre no nome do móvel ("cômoda pra patinar") também vale
      if (!Array.isArray(fields.tecnicas) || !fields.tecnicas.length) {
        const tt = findTechniques(a.movel);
        if (tt.length) fields.tecnicas = tt;
      }
      const fresh = (await getJob(t.ctx, job.id))!;
      const r = await applyFields(t, fresh, fields, false);
      focus(t, job.id);
      const done = (await getJob(t.ctx, job.id))!;
      const fotos = await attachPhotos(t, job.id);
      const hasPhoto = fotos > 0 || !!(await t.ctx.db.first("SELECT 1 FROM attachments WHERE job_id = ? AND deleted_at IS NULL LIMIT 1", job.id));
      if (!hasPhoto) t.effects.askPhoto = true;
      return { criado: describeJob(done), anotado: r.saved, recusado: r.rejected, ...(fotos ? { fotos_guardadas: fotos } : {}), ...(!hasPhoto ? { sem_foto: "peça uma foto desta peça nesta mensagem, uma vez, sem obrigar" } : {}) };
    }
    case "anotar": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const cleared = await clearFields(t, job, a.limpar);
      const r = await applyFields(t, (await getJob(t.ctx, job.id))!, (a.campos && typeof a.campos === "object" ? a.campos : {}) as Fields, a.correcao === true || cleared.length > 0);
      if (cleared.length) r.saved.push(`apagado: ${cleared.join(", ")}`);
      focus(t, job.id);
      const fotos = await attachPhotos(t, job.id);
      return { anotado: r.saved, recusado: r.rejected, servico: describeJob((await getJob(t.ctx, job.id))!), ...(fotos ? { fotos_guardadas: fotos } : {}) };
    }
    case "guardar_foto": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const fotos = await attachPhotos(t, job.id);
      if (!fotos) return { erro: "não tem foto nova para guardar" };
      focus(t, job.id);
      return { fotos_guardadas: fotos, servico: jobPhrase(job) };
    }
    case "calcular_orcamento": {
      const ids = Array.isArray(a.servico_ids) ? a.servico_ids.filter((x): x is string => typeof x === "string") : [];
      if (!ids.length) return { erro: "servico_ids vazio" };
      const items: Record<string, unknown>[] = [];
      const quotes: QuoteRecord[] = [];
      const missingPrices = new Set<string>();
      for (const id of ids) {
        const job = await loadJob(t, id);
        if (typeof job === "string") return { erro: job };
        const falta = missingFor(job);
        const tk = (job.facts.techniques?.value as string[] | null | undefined) ?? [];
        if (tk.includes("sob_medida") && !(await getOverrides(t.ctx, job.id)).artisanTotal) falta.push("quantas horas ele acha que leva o trabalho todo");
        if (falta.length) {
          items.push({ servico_id: job.id, nome: jobPhrase(job), pode_calcular: false, falta });
          continue;
        }
        const q = await calculateQuote(t.ctx, job.id, t.user.id);
        for (const k of missingPriceKeys([q.result])) missingPrices.add(k);
        const r = q.result;
        if (!r.computable) {
          items.push({ servico_id: job.id, nome: jobPhrase(job), pode_calcular: false, falta: r.blockers.map((x) => x.message) });
          continue;
        }
        quotes.push(q);
        items.push({
          servico_id: job.id,
          nome: jobPhrase(job),
          sugestao: reais(r.recommendedCents),
          minimo_sem_prejuizo: reais(r.floorCents),
          material_a_comprar: reais(r.materials.purchaseCashOutlayCents),
          material_usado: reais(r.materials.lines.reduce((acc, l) => acc + (l.consumptionCostCents ?? 0), 0)),
          materiais: r.materials.lines.map((l) => ({ nome: l.name, gasto: reais(l.consumptionCostCents), a_comprar: l.packagesToBuy > 0 ? `${l.packagesToBuy} embalagem(ns)` : "já tem" })),
          extras_cobrados: [...r.subcontracts.lines.map((s) => s.description), ...(await getOverrides(t.ctx, job.id)).specificExpenses.map((e) => e.description)],
          horas_de_trabalho: Math.round(Number(r.labor.totalHours)),
          mao_de_obra: reais(r.labor.idealCents),
          dias_de_trabalho: r.leadTime.workingDays,
          prazo_combinado: (job.facts.deadline?.value as string | null | undefined) ?? null,
          avisos: [
            ...(r.gaps ?? []).map((g) => g.message),
            ...r.warnings.filter((w) => w.code === "AREA_RANGE_MAX_USED").map(() => "medida aproximada (pelo porte)"),
          ],
        });
      }
      const prices = await Promise.all([...missingPrices].map(async (k) => {
        const m = await getMaterialByKey(t.ctx, k);
        return { chave: k, nome: m?.name ?? k, unidade_base: m?.unit ?? "" };
      }));
      if (prices.length) return { itens: items, faltam_precos_de_material: prices, instrucao: "Pergunte o preço de UM material por vez (valor e tamanho da embalagem). Se ele não usa algum, use tirar_material." };
      if (quotes.length === ids.length) {
        const base = quotes.reduce((acc, q) => acc + (q.recommendedCents ?? 0), 0);
        const floors = quotes.map((q) => q.floorCents);
        const floor = floors.every((x) => x !== null) ? floors.reduce((acc, x) => acc! + x!, 0) : null;
        t.state.presented = { jobIds: ids, quoteIds: quotes.map((q) => q.id), turn: t.turn, baseCents: base, floorCents: floor };
        t.effects.presentedQuote = true;
        const jobs = await Promise.all(ids.map((id) => getJob(t.ctx, id)));
        const hasMaterial = jobs.every((j) => j?.facts.material_status?.value === "tem_tudo");
        const buy = quotes.reduce((acc, q) => acc + q.result.materials.purchaseCashOutlayCents, 0);
        const hours = Math.round(quotes.reduce((acc, q) => acc + Number(q.result.labor.totalHours), 0));
        const roundUp = (c: number) => formatBRL(Math.ceil(c / 100) * 100);
        const lines = [`🧮 Fiz as contas${quotes.length > 1 ? ` dos ${quotes.length} serviços` : ` d${jobs[0] ? jobPhrase(jobs[0]) : "o serviço"}`}!`, ""];
        if (quotes.length > 1) for (let i = 0; i < quotes.length; i++) lines.push(`• ${jobs[i] ? jobPhrase(jobs[i]!) : "serviço"}: ${reais(quotes[i]!.recommendedCents)}`);
        if (quotes.length > 1) lines.push("");
        lines.push(`💰 Minha sugestão${quotes.length > 1 ? " pro total" : ""}: ${reais(base)}`);
        if (floor !== null) lines.push(`⚠️ Menos que ${roundUp(floor)} você fica no prejuízo.`);
        if (buy > 0 && !hasMaterial) lines.push(`🛒 De material novo, uns ${roundUp(buy)}.`);
        if (hours > 0) lines.push(`⏱️ Umas ${hours} horas de trabalho.`);
        lines.push("", "Você concorda, quer dar um desconto ou acrescentar algo? 🤝");
        return { itens: items, total_sugerido: reais(base), mensagem_pronta: lines.join("\n"), proximo_passo: "Responda com a mensagem_pronta (pode trocar uma palavra ou outra, mas sem tirar nem pôr números e sem outra pergunta)." };
      }
      return { itens: items, proximo_passo: "Ainda falta informação: pergunte UMA coisa por vez." };
    }
    case "informar_preco_material": {
      const key = typeof a.chave === "string" ? a.chave : "";
      const mat = await getMaterialByKey(t.ctx, key);
      if (!mat) {
        const all = await listMaterials(t.ctx);
        return { erro: `material '${key}' não existe`, materiais: all.map((m) => ({ chave: m.key, nome: m.name })) };
      }
      const price = typeof a.preco_embalagem_reais === "number" ? a.preco_embalagem_reais : NaN;
      const size = typeof a.tamanho_embalagem === "number" ? a.tamanho_embalagem : NaN;
      if (!(price > 0) || !(size > 0)) return { erro: "preço e tamanho da embalagem precisam ser maiores que zero" };
      // o preço por embalagem pode ser conta dele (150 ÷ 2): aceita se o total ou o unitário foi dito
      const corpusNums = said(t);
      const priceOk = grounded(price, corpusNums) || corpusNums.some((x) => [2, 3, 4, 5, 6].some((k) => Math.abs(x / k - price) < 0.01));
      if (!priceOk) return { erro: `o preço ${price} não foi dito por ele — pergunte quanto custou` };
      if (!grounded(size, corpusNums) && !["un", "folha"].includes(String(a.unidade))) return { erro: `o tamanho ${size} não foi dito por ele — pergunte o tamanho da embalagem` };
      const unit = String(a.unidade);
      const base = mat.unit.toLowerCase();
      let qty = size;
      if (unit === "ml" && base === "l") qty = size / 1000;
      else if (unit === "g" && base === "kg") qty = size / 1000;
      else if (unit === "l" && base === "ml") qty = size * 1000;
      const res = await applyConfirmedPrice(t.ctx, {
        materialKey: mat.key,
        priceCents: Math.round(price * 100),
        packageSize: String(qty),
        packages: null,
        totalCents: null,
        confidence: "alta",
        origin: "telegram_quote_confirmed",
        userId: t.user.id,
        messageId: t.inboundMessageId,
        jobId: t.state.focus?.[0] ?? null,
        quoteId: null,
        sourceText: t.userCorpus.slice(-300),
        idempotencyKey: `agent-price:${t.inboundMessageId}:${mat.key}`,
        observationKind: "MATERIAL_PRICE_QUOTE",
      });
      if (res.kind === "invalid") return { erro: res.reason };
      return { ok: true, material: mat.name, preco: formatBRL(Math.round(price * 100)), embalagem: `${size} ${unit}`, proximo_passo: "Se não faltar outro preço, recalcule com calcular_orcamento." };
    }
    case "tirar_material": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const key = typeof a.chave === "string" ? a.chave : "";
      const ov = await getOverrides(t.ctx, job.id);
      if (!ov.excludedMaterials.includes(key)) await saveOverrides(t.ctx, job.id, { ...ov, excludedMaterials: [...ov.excludedMaterials, key] }, t.user.id);
      return { ok: true, tirado: key, proximo_passo: "Recalcule com calcular_orcamento." };
    }
    case "simular_ajuste": {
      const p = t.state.presented;
      if (!p) return { erro: "calcule e mostre o orçamento antes (calcular_orcamento)" };
      const base = p.baseCents;
      const num = (k: string) => (typeof a[k] === "number" && (a[k] as number) > 0 ? (a[k] as number) : undefined);
      for (const k of ["desconto_pct", "desconto_reais", "acrescimo_reais", "valor_final_reais"]) {
        const v = num(k);
        if (v !== undefined && !ok(v, t)) return { erro: `${k}=${v} não foi dito por ele — pergunte` };
      }
      let final = base;
      if (num("valor_final_reais")) final = Math.round(num("valor_final_reais")! * 100);
      else if (num("desconto_pct")) final = Math.round(base * (1 - num("desconto_pct")! / 100));
      else if (num("desconto_reais")) final = base - Math.round(num("desconto_reais")! * 100);
      else if (num("acrescimo_reais")) final = base + Math.round(num("acrescimo_reais")! * 100);
      t.state.simulated = [...(t.state.simulated ?? []), final / 100].slice(-6);
      return { sugestao: formatBRL(base), valor_final: formatBRL(final), diferenca: formatBRL(Math.abs(final - base)), abaixo_do_minimo: p.floorCents !== null && final < p.floorCents, minimo: reais(p.floorCents), proximo_passo: "Diga o valor final e pergunte se fecha assim (se abaixo do mínimo, avise que dá prejuízo)." };
    }
    case "fechar_orcamento": {
      const p = t.state.presented;
      const ids = Array.isArray(a.servico_ids) ? a.servico_ids.filter((x): x is string => typeof x === "string") : [];
      if (!p || !ids.length || ids.some((id) => !p.jobIds.includes(id))) return { erro: "calcule e mostre o orçamento antes (calcular_orcamento)" };
      if (p.turn >= t.turn) return { erro: "ele ainda não respondeu ao valor: mostre e pergunte se concorda; feche só depois da resposta" };
      if (p.stale) return { erro: "depois do valor mostrado ele acrescentou ou mudou coisas", proximo_passo: "Calcule de novo (calcular_orcamento), mostre o NOVO valor com o que ele acrescentou e pergunte se fecha assim." };
      // prazo é crítico (ele tem fila de serviços): nunca vai pro PDF um prazo que ele não deu
      for (const id of ids) {
        const j = await getJob(t.ctx, id);
        if (j && !j.facts.deadline?.value) return { erro: "falta o prazo", proximo_passo: "Antes de fechar, pergunte quando ele consegue começar e quando fica pronto pro cliente (ex.: 'daqui a 2 meses'). Anote em campos.prazo e depois feche." };
      }
      let final = p.baseCents;
      if (typeof a.valor_final_reais === "number") {
        const simulated = (t.state.simulated ?? []).some((x) => Math.abs(x - (a.valor_final_reais as number)) < 0.01);
        if (!simulated && !grounded(a.valor_final_reais, said(t))) {
          // desconto/acréscimo dito: o total pode ser conta (692 − 50); aceita se a diferença ou o % foi dito
          const diff = Math.abs(p.baseCents / 100 - a.valor_final_reais);
          const pctOk = said(t).some((x) => x < 100 && Math.abs((p.baseCents / 100) * (x / 100) - diff) < 1);
          if (!grounded(diff, said(t)) && !pctOk) return { erro: `o valor ${a.valor_final_reais} não bate com o que ele disse — confirme com ele` };
        }
        final = Math.round(a.valor_final_reais * 100);
      }
      if (final <= 0) return { erro: "valor final inválido" };
      if (p.floorCents !== null && final < p.floorCents && a.confirmou_abaixo_do_minimo !== true) {
        return { erro: "abaixo_do_minimo", minimo: reais(p.floorCents), proximo_passo: "Avise que abaixo desse valor ele tem prejuízo e pergunte se quer fechar assim mesmo." };
      }
      const quotes = await Promise.all(p.quoteIds.map((qid) => latestQuoteForJob(t.ctx, p.jobIds[p.quoteIds.indexOf(qid)]!)));
      const valid = quotes.filter((q): q is QuoteRecord => !!q && q.recommendedCents !== null);
      if (valid.length !== p.jobIds.length) return { erro: "orçamento mudou: calcule de novo" };
      const shares = valid.length === 1 ? [final] : allocateCents(final, valid.map((q) => q.recommendedCents!));
      const reason = typeof a.motivo_ajuste === "string" && a.motivo_ajuste.trim() ? a.motivo_ajuste.trim().slice(0, 30) : undefined;
      let pdfs = 0;
      const closedIds: string[] = [];
      for (let i = 0; i < valid.length; i++) {
        const q = valid[i]!;
        const delta = shares[i]! - q.recommendedCents!;
        let label = delta < 0 ? "Desconto" : reason ? `Acréscimo (${reason})` : "Acréscimo";
        if (findConfidentialTerms([label]).length) label = delta < 0 ? "Desconto" : "Acréscimo";
        const adj: PriceAdjustment | null = delta === 0 ? null : { baseCents: q.recommendedCents!, deltaCents: delta, label };
        const res = await closeQuoteByArtisan(t.ctx, q.id, t.user.id, shares[i]!, adj);
        closedIds.push(res.quote.id);
        try {
          const docs = await issueDocuments(t.ctx, res.quote.id, t.user.id, { preliminary: res.preliminary, artisanClosed: true });
          await sendDocumentToArtisan(t.ctx, docs.commercial.id, t.user.id, t.chatId);
          pdfs++;
        } catch (err) {
          console.error(JSON.stringify({ level: "error", msg: "agent_pdf_failed", error: err instanceof Error ? err.message.slice(0, 160) : String(err) }));
        }
      }
      t.state.closed = closedIds;
      t.state.presented = undefined;
      t.effects.pdfsSent = pdfs;
      const first = await getJob(t.ctx, p.jobIds[0]!);
      await enqueueOutbox(t.ctx, "notify_admins", { text: `${t.user.displayName} fechou o orçamento ${first?.code ?? ""} (${first?.title ?? ""}${p.jobIds.length > 1 ? ` e mais ${p.jobIds.length - 1}` : ""}) por ${formatBRL(final)}. Sugerido: ${formatBRL(p.baseCents)}${p.floorCents !== null && final < p.floorCents ? ` · ABAIXO do mínimo (${formatBRL(p.floorCents)})` : ""}.` }, `agent-close:${closedIds.join(",").slice(0, 150)}`);
      return { ok: true, valor_final: formatBRL(final), sugestao_era: formatBRL(p.baseCents), pdfs_enviados: pdfs, proximo_passo: "Diga que fechou e que mandou o PDF; peça pra avisar quando o cliente responder." };
    }
    case "registrar_pagamento": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const v = typeof a.valor_reais === "number" ? a.valor_reais : NaN;
      if (!(v > 0) || !ok(v, t)) return { erro: "valor não foi dito por ele — pergunte quanto recebeu" };
      // mesmo valor do mesmo serviço já anotado hoje: não prepara de novo (avaliação: pagamento em dobro)
      const dupe = await t.ctx.db.first<{ id: string }>("SELECT id FROM payments WHERE job_id = ? AND amount_cents = ? AND created_at >= ?", job.id, Math.round(v * 100), new Date(t.ctx.clock().getTime() - 12 * 3600_000).toISOString());
      if (dupe) return { ja_anotado: true, resumo: "esse pagamento já está anotado (hoje)", proximo_passo: "Diga que já estava anotado; só registre de novo se ele disser que foi OUTRO pagamento." };
      return pend(t, "pagamento", `pagamento de ${formatBRL(Math.round(v * 100))} d${jobPhrase(job)}`, { jobId: job.id, cents: Math.round(v * 100) });
    }
    case "registrar_gasto": {
      const v = typeof a.valor_reais === "number" ? a.valor_reais : NaN;
      if (!(v > 0) || !ok(v, t)) return { erro: "valor não foi dito por ele — pergunte quanto gastou" };
      const desc = typeof a.descricao === "string" ? a.descricao.slice(0, 120) : "gasto";
      const job = typeof a.servico_id === "string" ? await getJob(t.ctx, a.servico_id) : null;
      const mat = typeof a.material_chave === "string" ? await getMaterialByKey(t.ctx, a.material_chave) : null;
      const since = new Date(t.ctx.clock().getTime() - 12 * 3600_000).toISOString();
      const dupeG = await t.ctx.db.first<{ id: string }>("SELECT id FROM purchases WHERE amount_cents = ? AND voided_at IS NULL AND created_at >= ? UNION SELECT id FROM expenses WHERE amount_cents = ? AND created_at >= ?", Math.round(v * 100), since, Math.round(v * 100), since);
      if (dupeG) return { ja_anotado: true, resumo: "um gasto desse valor já foi anotado hoje", proximo_passo: "Diga que já estava anotado; só registre de novo se ele disser que foi OUTRA compra." };
      return pend(t, "gasto", `gasto de ${formatBRL(Math.round(v * 100))} com ${desc}${job ? ` (${jobPhrase(job)})` : ""}`, { cents: Math.round(v * 100), desc, jobId: job?.id ?? null, materialId: mat?.id ?? null });
    }
    case "mudar_situacao": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const to = ({ iniciado: "EM_EXECUCAO", concluido: "CONCLUIDO", entregue: "ENTREGUE" } as Record<string, JobStatus>)[String(a.situacao)];
      if (!to) return { erro: "situação inválida" };
      return pend(t, "situacao", `${jobPhrase(job)}: ${String(a.situacao)}`, { jobId: job.id, to });
    }
    case "cancelar_servico": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      return pend(t, "cancelar", `cancelar ${jobPhrase(job)} (fica no histórico)`, { jobId: job.id });
    }
    case "resultado_cliente": {
      const ids = Array.isArray(a.servico_ids) ? a.servico_ids.filter((x): x is string => typeof x === "string") : [];
      let total = 0;
      for (const id of ids) {
        const q = await latestQuoteForJob(t.ctx, id);
        if (!q || !["APROVADO", "ENVIADO"].includes(q.status)) continue;
        const r = await markQuoteOutcome(t.ctx, q.id, t.user.id, a.aceitou === true ? "ACEITO" : "RECUSADO");
        total += r.finalPriceCents ?? r.recommendedCents ?? 0;
      }
      return { ok: true, total: formatBRL(total) };
    }
    case "situacao_financeira": {
      const job = await loadJob(t, a.servico_id);
      if (typeof job === "string") return { erro: job };
      const bal = await jobBalance(t.ctx, job.id);
      // orçamento fechado mas o cliente ainda não deu o aceite: o valor combinado é o do orçamento
      const q = await latestQuoteForJob(t.ctx, job.id);
      const quoted = q && ["APROVADO", "ENVIADO", "ACEITO"].includes(q.status) ? (q.finalPriceCents ?? q.recommendedCents) : null;
      const total = bal.contractedCents ?? quoted;
      return {
        servico: jobPhrase(job),
        valor_do_servico: reais(total),
        situacao_do_orcamento: q ? (q.status === "ACEITO" ? "cliente aceitou" : ["APROVADO", "ENVIADO"].includes(q.status) ? "orçamento enviado, cliente ainda não respondeu" : "orçamento ainda não fechado") : "sem orçamento",
        ja_pagou: reais(bal.paidCents),
        falta: total !== null ? reais(Math.max(0, total - bal.paidCents)) : null,
      };
    }
    default:
      return { erro: `ferramenta desconhecida: ${name}` };
  }
}

function pend(t: ToolContext, kind: PendingAction["kind"], summary: string, payload: Record<string, unknown>): unknown {
  const p: PendingAction = { id: crypto.randomUUID().slice(0, 8), kind, summary, payload };
  t.state.pending = p;
  t.effects.pendingCreated = p;
  return { aguardando_confirmacao: true, resumo: summary, proximo_passo: "Diga em uma frase o que vai ser anotado e peça pra ele confirmar no botão." };
}

/** Executa a ação confirmada pelo usuário (botão ou "sim"). */
export async function executePending(ctx: Ctx, user: User, p: PendingAction): Promise<string> {
  const actor = user.id;
  switch (p.kind) {
    case "pagamento": {
      const jobId = String(p.payload.jobId);
      const cents = Number(p.payload.cents);
      await recordPayment(ctx, { jobId, amountCents: cents, actor, idempotencyKey: await financialIdempotencyKey(ctx, { userId: user.id, kind: "payment", amountCents: cents, jobId, description: p.id }) });
      const bal = await jobBalance(ctx, jobId);
      return `pagamento anotado; já pagou ${formatBRL(bal.paidCents)}${bal.balanceCents !== null ? `, falta ${formatBRL(Math.max(0, bal.balanceCents))}` : " (valor do serviço ainda não fechado)"}`;
    }
    case "gasto": {
      const cents = Number(p.payload.cents);
      const jobId = (p.payload.jobId as string | null) ?? null;
      const key = await financialIdempotencyKey(ctx, { userId: user.id, kind: "expense", amountCents: cents, jobId, description: `${String(p.payload.desc)}:${p.id}` });
      if (p.payload.materialId) await recordPurchase(ctx, { materialId: String(p.payload.materialId), description: String(p.payload.desc), amountCents: cents, jobId, actor, idempotencyKey: key });
      else await recordExpense(ctx, { jobId, category: "outros", description: String(p.payload.desc), amountCents: cents, actor, idempotencyKey: key });
      return "gasto anotado";
    }
    case "situacao": {
      const job = await transitionJob(ctx, String(p.payload.jobId), p.payload.to as JobStatus, actor, "informado pelo artesão");
      return `situação: ${job.status}`;
    }
    case "cancelar": {
      await transitionJob(ctx, String(p.payload.jobId), "CANCELADO", actor, "cancelado pelo artesão (conversa)");
      return "serviço cancelado (fica no histórico)";
    }
  }
}
