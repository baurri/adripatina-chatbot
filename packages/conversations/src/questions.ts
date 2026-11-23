import type { FactValueMap, ProjectField } from "@adripatina/domain";
import { Dec, normalizeText } from "@adripatina/shared";
import { interpretRules, extractClientName } from "./nlu.js";
import { findFurniture, findTechniques, findDescriptors, TECHNIQUES } from "./vocabulary.js";

export interface Button {
  text: string;
  data: string;
}

export interface Question {
  field: ProjectField;
  text: string;
  buttons: Button[][];
  example?: string;
}

/**
 * Perguntas pensadas para o Adriano: uma de cada vez, linguagem direta e
 * acolhedora, sempre com um exemplo de resposta. Sem botões — ele responde
 * livremente, por áudio ou texto. "Não sei" continua funcionando se ele disser.
 */
function q(field: ProjectField, text: string, example: string): Question {
  return { field, text, buttons: [], example };
}

export function questionFor(field: ProjectField): Question {
  switch (field) {
    case "furniture_type":
      return q(field, "Que móvel é esse? Pode falar do seu jeito, por exemplo: \"uma cristaleira\" ou \"uma cômoda de quatro gavetas\".", "Me diga só o nome do móvel, por exemplo: \"cristaleira\", \"cômoda\" ou \"cadeira\".");
    case "techniques":
      return q(field, "Que trabalho você vai fazer nele? Pode ser mais de um, por exemplo: \"pátina e verniz\".", "Por exemplo: \"pátina\", \"pintura\", \"decapê\", \"verniz\", \"folha de ouro\" ou \"restauração\".");
    case "client_name":
      return q(field, "De quem é esse móvel? Pode falar só o nome, por exemplo: \"da dona Maria\".", "Me diga o nome do cliente, por exemplo: \"dona Maria\" ou \"seu João\".");
    case "condition":
      return q(field, "Como o móvel está hoje? Por exemplo: \"está bom\", \"precisa de uns reparos\" ou \"está bem estragado\".", "Por exemplo: \"está bom\", \"precisa de reparos\" ou \"está bem estragado\".");
    case "dimensions":
    case "size_class":
      return q(
        "dimensions",
        "Qual é o tamanho dele? Se tiver as medidas, pode falar assim: \"1,80 de altura, 1 metro de largura e 40 de fundura\". Se não tiver, pode só dizer se é pequeno, médio ou grande.",
        "Pode dizer as medidas, por exemplo \"1,80 de altura e 1 metro de largura\", ou só \"pequeno\", \"médio\" ou \"grande\".",
      );
    case "surfaces":
      return q(field, "Você vai trabalhar só na parte de fora ou por dentro também?", "Pode dizer \"só por fora\" ou \"por dentro e por fora\".");
    case "repairs":
      return q(field, "Antes da pintura, ele precisa de algum conserto? Por exemplo: colar uma perna, passar massa ou trocar uma peça. Se não precisar, é só dizer \"não\".", "Pode dizer \"não precisa\" ou contar o conserto, por exemplo \"colar a gaveta\".");
    case "subcontract":
      return q(field, "Alguma parte vai para outro profissional, como marceneiro ou tapeceiro? Se for tudo com você, é só dizer \"não\".", "Pode dizer \"não\" ou, por exemplo, \"o assento vai para o tapeceiro\".");
    case "material_status":
      return q(field, "Sobre o material: você já tem em casa ou vai precisar comprar? Pode dizer \"já tenho tudo\", \"tenho uma parte\" ou \"preciso comprar\".", "Pode dizer \"já tenho tudo\", \"tenho uma parte\" ou \"preciso comprar\".");
    case "application_method":
      return q(field, "Você vai aplicar com pincel, rolo ou pistola?", "Pode dizer \"pincel\", \"rolo\" ou \"pistola\".");
    case "logistics":
      return q(field, "Precisa buscar ou entregar o móvel na casa do cliente? Por exemplo: \"só entregar\", \"buscar e entregar\" ou \"não precisa\".", "Pode dizer \"não precisa\", \"só buscar\", \"só entregar\" ou \"buscar e entregar\".");
    case "deadline":
      return q(field, "Você combinou algum prazo com o cliente? Por exemplo: \"daqui a 15 dias\" ou \"sem prazo\".", "Por exemplo: \"daqui a 15 dias\", \"até o Natal\" ou \"sem prazo\".");
    case "payment_terms":
      return q(field, "Como o cliente vai pagar? Por exemplo: \"à vista\" ou \"metade agora e metade na entrega\".", "Por exemplo: \"à vista\" ou \"metade de entrada e o resto na entrega\".");
    case "details":
      return q(field, "Tem algum detalhe especial, como entalhes, puxadores ou vidros? Se não tiver, é só dizer \"não\".", "Pode dizer \"não\" ou contar o detalhe.");
  }
}

export type ParsedAnswer<F extends ProjectField = ProjectField> =
  | { kind: "value"; field: F; value: FactValueMap[F] }
  | { kind: "dont_know" }
  | { kind: "unparsed" };

const YES_RE = /^(sim|s|precisa|precisa sim|tem|vai|claro|isso)\b/;
const NO_RE = /^(nao|n|nada|nenhum|nenhuma|sem|nao precisa|nao tem|nao vai)\b/;

/** Interpreta a resposta do usuário a uma pergunta específica. */
export function parseAnswer(field: ProjectField, rawText: string): ParsedAnswer {
  const text = rawText.startsWith("ans:") ? rawText.slice(4) : rawText;
  const norm = normalizeText(text);
  const key = text.trim().toLowerCase();
  // valores de botões (com "_") são comparados antes da normalização
  const is = (v: string) => key === v || norm === v;
  if (is("nao_sei") || /\b(nao sei|sei la|nao lembro|nao tenho certeza)\b/.test(norm)) return { kind: "dont_know" };
  const nlu = interpretRules(text);
  const e = nlu.entities;
  switch (field) {
    case "furniture_type": {
      const type = findFurniture(text);
      if (type) return { kind: "value", field, value: { type, descriptors: findDescriptors(text), ...(e.doors !== undefined ? { doors: e.doors } : {}), ...(e.drawers !== undefined ? { drawers: e.drawers } : {}) } };
      if (norm.length >= 3 && norm.split(" ").length <= 4) return { kind: "value", field, value: { type: norm.replace(/\s+/g, "_"), descriptors: [] } };
      return { kind: "unparsed" };
    }
    case "techniques": {
      if (TECHNIQUES[key]) return { kind: "value", field, value: [key] };
      const t = findTechniques(text);
      return t.length ? { kind: "value", field, value: t } : { kind: "unparsed" };
    }
    case "client_name": {
      const name = extractClientName(text);
      if (name) return { kind: "value", field, value: name };
      const cleaned = text
        .trim()
        .replace(/^(é|e|eh|a|o|da|do|de|cliente|chama|se chama)\s+/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      if (cleaned.length >= 2 && cleaned.split(/\s+/).length <= 5) return { kind: "value", field, value: cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) };
      return { kind: "unparsed" };
    }
    case "condition": {
      if (/\b(bom|boa|otimo|inteiro|conservado)\b/.test(norm)) return { kind: "value", field, value: "bom" };
      if (/\b(danificado|muito ruim|pessimo|cupim|podre|quebrad[oa])\b/.test(norm)) return { kind: "value", field, value: "danificado" };
      if (/\b(reparo|reparos|arranhado|descascando|desgastado|precisa)\b/.test(norm)) return { kind: "value", field, value: "reparos" };
      return norm.length > 2 ? { kind: "value", field, value: text.trim() } : { kind: "unparsed" };
    }
    case "dimensions":
    case "size_class": {
      if (e.lengthsM.length > 0) {
        const [a, b, c] = e.lengthsM;
        const dims: FactValueMap["dimensions"] = {};
        // convenção: altura, largura, fundura quando ditas nessa ordem; "altura"/"largura"/"fundo" explícitos têm prioridade
        const labeled = labelDimensions(norm);
        dims.height = labeled.height ?? a;
        dims.width = labeled.width ?? b;
        dims.depth = labeled.depth ?? c;
        return { kind: "value", field: "dimensions", value: stripUndefined(dims) };
      }
      const labeledOnly = labelDimensions(norm);
      if (labeledOnly.height || labeledOnly.width || labeledOnly.depth) {
        return { kind: "value", field: "dimensions", value: stripUndefined({ height: labeledOnly.height, width: labeledOnly.width, depth: labeledOnly.depth }) };
      }
      if (e.sizeClass || ["pequeno", "medio", "grande"].some(is))
        return { kind: "value", field: "size_class", value: (e.sizeClass ?? key) as FactValueMap["size_class"] };
      return { kind: "unparsed" };
    }
    case "surfaces":
      if (is("interna_externa") || e.surfaces === "interna_externa") return { kind: "value", field, value: "interna_externa" };
      if (is("externa") || e.surfaces === "externa" || /\bfora\b/.test(norm)) return { kind: "value", field, value: "externa" };
      return { kind: "unparsed" };
    case "repairs":
    case "subcontract":
      if (NO_RE.test(norm)) return { kind: "value", field, value: { needed: false } };
      if (YES_RE.test(norm) || norm.length > 6) return { kind: "value", field, value: { needed: true, ...(norm.length > 6 ? { description: text.trim() } : {}) } };
      return { kind: "unparsed" };
    case "material_status":
      if (["tem_tudo", "tem_parte", "precisa_comprar"].some(is)) return { kind: "value", field, value: key as FactValueMap["material_status"] };
      if (e.materialStatus) return { kind: "value", field, value: e.materialStatus };
      if (/\b(tenho)\b/.test(norm)) return { kind: "value", field, value: "tem_tudo" };
      return { kind: "unparsed" };
    case "application_method":
      if (["pincel", "rolo", "pistola"].some(is)) return { kind: "value", field, value: key as FactValueMap["application_method"] };
      return e.method ? { kind: "value", field, value: e.method } : { kind: "unparsed" };
    case "logistics": {
      if (is("nenhum") || NO_RE.test(norm)) return { kind: "value", field, value: { pickup: false, delivery: false } };
      if (is("ambos") || /\b(os dois|ambos|buscar e entregar)\b/.test(norm)) return { kind: "value", field, value: { pickup: true, delivery: true } };
      if (/\bbuscar\b/.test(norm)) return { kind: "value", field, value: { pickup: true, delivery: false } };
      if (/\bentregar\b/.test(norm)) return { kind: "value", field, value: { pickup: false, delivery: true } };
      return { kind: "unparsed" };
    }
    case "deadline":
      if (is("sem_prazo") || /\bsem prazo\b/.test(norm)) return { kind: "value", field, value: "sem prazo" };
      return norm.length > 1 ? { kind: "value", field, value: text.trim() } : { kind: "unparsed" };
    case "payment_terms":
      if (is("a_vista") || /\ba vista\b/.test(norm)) return { kind: "value", field, value: "à vista" };
      if (is("entrada_entrega") || /\b(entrada|metade|sinal)\b/.test(norm)) return { kind: "value", field, value: "entrada e restante na entrega" };
      return norm.length > 2 ? { kind: "value", field, value: text.trim() } : { kind: "unparsed" };
    case "details":
      if (NO_RE.test(norm)) return { kind: "value", field, value: "nenhum" };
      return norm.length > 2 ? { kind: "value", field, value: text.trim() } : { kind: "unparsed" };
  }
}

export function labelDimensions(norm: string): { height?: string; width?: string; depth?: string } {
  const out: { height?: string; width?: string; depth?: string } = {};
  const grab = (re: RegExp) => {
    const m = re.exec(norm);
    if (!m) return undefined;
    const v = m[1]!.replace(",", ".");
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    // valores > 10 sem unidade são centímetros
    return n > 10 ? Dec.parse(v).div(100).toString() : Dec.parse(v).toString();
  };
  out.height = grab(/(\d+(?:[.,]\d+)?)\s*(?:m|metros?|cm)?\s*de altura/) ?? grab(/altura\s*(?:de|e|eh|:|=|tem|mede)?\s*(\d+(?:[.,]\d+)?)/);
  out.width = grab(/(\d+(?:[.,]\d+)?)\s*(?:m|metros?|cm)?\s*de largura/) ?? grab(/largura\s*(?:de|e|eh|:|=|tem|mede)?\s*(\d+(?:[.,]\d+)?)/);
  out.depth =
    grab(/(\d+(?:[.,]\d+)?)\s*(?:m|metros?|cm)?\s*de (?:fundura|fundo|profundidade)/) ??
    grab(/(?:fundura|profundidade)\s*(?:de|e|eh|:|=|tem|mede)?\s*(\d+(?:[.,]\d+)?)/);
  return out;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Texto humano de um fato, para resumos e "já anotei que...". */
export function describeFact(field: ProjectField, value: unknown): string {
  const v = value as never;
  switch (field) {
    case "furniture_type": {
      const f = v as FactValueMap["furniture_type"];
      return `móvel: ${f.type.replace(/_/g, " ")}${f.doors ? `, ${f.doors} portas` : ""}${f.descriptors?.length ? ` (${f.descriptors.join(", ")})` : ""}`;
    }
    case "techniques":
      return `trabalho: ${(v as string[]).map((t) => TECHNIQUES[t]?.label ?? t).join(", ")}`;
    case "client_name":
      return `cliente: ${v as string}`;
    case "condition":
      return `estado: ${v as string}`;
    case "dimensions": {
      const d = v as FactValueMap["dimensions"];
      const parts = [d.height && `altura ${fmtM(d.height)}`, d.width && `largura ${fmtM(d.width)}`, d.depth && `fundura ${fmtM(d.depth)}`].filter(Boolean);
      return `medidas: ${parts.join(", ")}`;
    }
    case "size_class":
      return `tamanho: ${v as string}`;
    case "surfaces":
      return (v as string) === "externa" ? "só por fora" : "por dentro e por fora";
    case "repairs":
      return (v as FactValueMap["repairs"]).needed ? `precisa de conserto${(v as FactValueMap["repairs"]).description ? `: ${(v as FactValueMap["repairs"]).description}` : ""}` : "sem consertos";
    case "subcontract":
      return (v as FactValueMap["subcontract"]).needed ? "tem parte com outro profissional" : "sem terceiros";
    case "material_status":
      return { tem_tudo: "já tem o material", tem_parte: "tem parte do material", precisa_comprar: "precisa comprar material" }[v as string] ?? String(v);
    case "application_method":
      return `aplicação: ${v as string}`;
    case "logistics": {
      const l = v as FactValueMap["logistics"];
      return l.pickup && l.delivery ? "buscar e entregar" : l.pickup ? "buscar" : l.delivery ? "entregar" : "sem frete";
    }
    case "deadline":
      return `prazo: ${v as string}`;
    case "payment_terms":
      return `pagamento: ${v as string}`;
    case "details":
      return `detalhes: ${v as string}`;
  }
}

function fmtM(m: string): string {
  return `${m.replace(".", ",")} m`;
}
