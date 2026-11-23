import { FURNITURE, TECHNIQUES, itemName, parseFurnitureList, type MentionedItem } from "@adripatina/conversations";
import { extractLengths, normalizeText, wordsToNumber } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { interpretStructured } from "../ai/orchestrator.js";

/**
 * O Claude lê a resposta do artesão NO CONTEXTO do pedido com vários móveis (quais peças,
 * qual pergunta) e devolve o que entendeu por peça. Teste real de 23/11/2026: "duas
 * aparadoras", "já tenho", "a mesinha tem 2 metros, é redonda, e os criados-mudos têm 80
 * de largura e 40 de altura" — tudo isso se perdia com as regras.
 *
 * Travas: a IA só SUGERE. Peça tem que existir; medida tem que ter número dito na mensagem;
 * tipo de móvel passa pelo catálogo; técnica só da lista; nome só se estiver no texto.
 */

export interface QrAiItem {
  ref: string;
  condition?: "bom" | "reparos" | "danificado";
  repairPart?: string;
  affectedPart?: "tampo" | "inteiro";
  dims?: { height?: string; width?: string; depth?: string; diameter?: string };
  sizeClass?: "pequeno" | "medio" | "grande";
}

export interface QrAiResult {
  items: QrAiItem[];
  furniture: { key: string; description: string; quantity: number }[];
  techniques: string[];
  method?: "pincel" | "rolo" | "pistola";
  materialStatus?: "tem_tudo" | "tem_parte" | "precisa_comprar";
  pickup?: boolean;
  delivery?: boolean;
  clientName?: string;
}

const nullable = (t: string, extra: Record<string, unknown> = {}) => ({ type: [t, "null"], ...extra });

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          condition: nullable("string", { enum: ["bom", "reparos", "danificado", null] }),
          repairPart: nullable("string"),
          affectedPart: nullable("string", { enum: ["tampo", "inteiro", null] }),
          heightCm: nullable("number"),
          widthCm: nullable("number"),
          depthCm: nullable("number"),
          diameterCm: nullable("number"),
          sizeClass: nullable("string", { enum: ["pequeno", "medio", "grande", null] }),
        },
        required: ["ref"],
      },
    },
    newFurniture: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "integer" } }, required: ["name", "quantity"] } },
    techniques: { type: "array", items: { type: "string", enum: Object.keys(TECHNIQUES) } },
    method: nullable("string", { enum: ["pincel", "rolo", "pistola", null] }),
    materialStatus: nullable("string", { enum: ["tem_tudo", "tem_parte", "precisa_comprar", null] }),
    pickup: nullable("boolean"),
    delivery: nullable("boolean"),
    clientName: nullable("string"),
  },
  required: ["items"],
};

const SYSTEM = `Você interpreta a resposta de Adriano, artesão de restauração de móveis, dentro de um orçamento com várias peças. Português do Brasil, fala transcrita de áudio (pode ter erros de digitação/transcrição: "aparadoras" = aparadores, "invernizar" = envernizar, "já trnho" = já tenho).
Regras:
- Use SOMENTE as refs da lista de peças. Uma frase no plural ("os criados-mudos", "todos eles", "as outras") vale para todas as peças correspondentes.
- Medidas em centímetros, só com números ditos na mensagem (1 metro = 100). Mesa redonda com uma medida só = diâmetro. "80 por 40" numa peça: o primeiro é largura, o segundo fundura, salvo se ele disser altura.
- condition: "bom" (está boa), "reparos" (precisa lixar forte, acertar detalhes, colar, massa), "danificado" (bem estragada, quebrada, cupim).
- affectedPart: "tampo" se só o tampo vai ser trabalhado; "inteiro" se a peça toda.
- newFurniture: só quando a pergunta é QUAIS são os móveis; nome do móvel do jeito que ele falou, corrigindo erro óbvio, e a quantidade.
- materialStatus: "tem_tudo" se ele já tem/usa do estoque; "tem_parte"; "precisa_comprar".
- pickup = ele (artesão) busca o móvel; delivery = ele entrega. Cliente traz → pickup false; cliente busca/leva de volta → delivery false.
- clientName: só o nome do dono dos móveis, se ele disser.
- Não invente nada. Campo que a mensagem não diz → null (ou fora da lista).
Responda só JSON.`;

/** Números ditos na mensagem, já em centímetros possíveis (80 → 80; 1,2 → 120; "dois metros" → 200). */
function spokenCm(text: string): number[] {
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

const cmToM = (cm: number): string => String(Math.round(cm) / 100);

export function validateQrAi(raw: unknown, items: MentionedItem[], text: string): QrAiResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const refs = new Set(items.map((i) => i.ref));
  const spoken = spokenCm(text);
  const grounded = (v: unknown): number | undefined => (typeof v === "number" && v > 0 && v <= 500 && spoken.some((s) => Math.abs(s - v) < 0.6) ? v : undefined);
  const out: QrAiResult = { items: [], furniture: [], techniques: [] };
  for (const x of Array.isArray(r.items) ? r.items : []) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.ref !== "string" || !refs.has(o.ref)) continue;
    const it: QrAiItem = { ref: o.ref };
    if (o.condition === "bom" || o.condition === "reparos" || o.condition === "danificado") it.condition = o.condition;
    if (typeof o.repairPart === "string" && o.repairPart.length <= 20 && normalizeText(text).includes(normalizeText(o.repairPart))) it.repairPart = normalizeText(o.repairPart);
    if (o.affectedPart === "tampo" || o.affectedPart === "inteiro") it.affectedPart = o.affectedPart;
    const dims: NonNullable<QrAiItem["dims"]> = {};
    const h = grounded(o.heightCm);
    const w = grounded(o.widthCm);
    const d = grounded(o.depthCm);
    const di = grounded(o.diameterCm);
    if (h) dims.height = cmToM(h);
    if (w) dims.width = cmToM(w);
    if (d) dims.depth = cmToM(d);
    if (di) dims.diameter = cmToM(di);
    if (Object.keys(dims).length) it.dims = dims;
    if (o.sizeClass === "pequeno" || o.sizeClass === "medio" || o.sizeClass === "grande") it.sizeClass = o.sizeClass;
    out.items.push(it);
  }
  for (const f of Array.isArray(r.newFurniture) ? r.newFurniture : []) {
    if (!f || typeof f !== "object") continue;
    const o = f as { name?: unknown; quantity?: unknown };
    if (typeof o.name !== "string") continue;
    const q = typeof o.quantity === "number" && o.quantity >= 1 && o.quantity <= 20 ? Math.round(o.quantity) : 1;
    // o tipo sempre passa pelo catálogo: a IA só corrige o nome ("aparadoras" → "aparador")
    const hit = parseFurnitureList(o.name)[0] ?? parseFurnitureList(`um ${o.name}`)[0];
    if (hit) out.furniture.push({ key: hit.key, description: hit.description, quantity: q });
  }
  for (const t of Array.isArray(r.techniques) ? r.techniques : []) if (typeof t === "string" && TECHNIQUES[t] && !out.techniques.includes(t)) out.techniques.push(t);
  if (r.method === "pincel" || r.method === "rolo" || r.method === "pistola") out.method = r.method;
  if (r.materialStatus === "tem_tudo" || r.materialStatus === "tem_parte" || r.materialStatus === "precisa_comprar") out.materialStatus = r.materialStatus;
  if (typeof r.pickup === "boolean") out.pickup = r.pickup;
  if (typeof r.delivery === "boolean") out.delivery = r.delivery;
  if (typeof r.clientName === "string" && r.clientName.trim().length >= 2) {
    const first = normalizeText(r.clientName).replace(/^(dona|seu|sr|sra)\s+/, "").split(" ")[0]!;
    if (first.length >= 2 && normalizeText(text).includes(first)) out.clientName = r.clientName.trim().slice(0, 60);
  }
  return out;
}

/** Pergunta ao Claude. Sem IA, erro ou nada válido → null (o fluxo segue com as regras). */
export async function interpretQuoteRequestAnswer(ctx: Ctx, items: MentionedItem[], question: string, text: string): Promise<QrAiResult | null> {
  const pieces = items.map((i) => ({ ref: i.ref, nome: itemName(i), tipo: i.furnitureType ? (FURNITURE[i.furnitureType]?.label ?? i.furnitureType) : null, quantidade: i.quantity }));
  const user = JSON.stringify({ pecas: pieces, pergunta_atual: question.slice(0, 400), resposta: text.slice(0, 1200) });
  const raw = await interpretStructured(ctx, "qr:interpret", SYSTEM, user, SCHEMA, 700);
  return raw ? validateQrAi(raw, items, text) : null;
}
