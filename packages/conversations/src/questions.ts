import type { FactValueMap, ProjectField } from "@adripatina/domain";
import { Dec, normalizeText } from "@adripatina/shared";
import { interpretRules, extractClientName, insideNegated, stripNegated } from "./nlu.js";
import { findFurniture, findTechniques, findDescriptors, furnitureLabel, TECHNIQUES } from "./vocabulary.js";

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
    case "scope":
      return q(field, "Você vai trabalhar só no tampo ou na peça inteira?", "Pode dizer \"só o tampo\" ou \"ela inteira\".");
  }
}

export type ParsedAnswer<F extends ProjectField = ProjectField> =
  /** specific = padrão reconhecido; free = texto livre aceito como está (menos confiável) */
  | { kind: "value"; field: F; value: FactValueMap[F]; strength?: "specific" | "free" }
  | { kind: "dont_know" }
  /** o usuário fez uma pergunta de volta ("como assim?") — explicar, não gravar */
  | { kind: "question" }
  /** resposta parcial (ex.: logística: sabe que não precisa buscar, falta saber da entrega) */
  | { kind: "partial"; field: "logistics"; known: { pickup?: boolean; delivery?: boolean } }
  | { kind: "unparsed" };

const YES_RE = /^(sim|s|precisa|precisa sim|tem|vai|claro|isso)\b/;
const NO_RE = /^(nao|n|nada|nenhum|nenhuma|sem|nao precisa|nao tem|nao vai)\b/;

/** "Como assim?", "O que é isso?", "Cama tem dentro e fora?" — pergunta dirigida ao bot. */
export function isQuestionToBot(text: string): boolean {
  const t = text.trim();
  const n = normalizeText(t);
  if (/^(sim|nao|isso|nao sei)\b/.test(n) && !/\?$/.test(t)) return false;
  if (/^(como assim|o que (e|eh|seria|significa|voce quer dizer|vc quer dizer)|pra que|para que|por que (voce|vc) (quer|pergunta|precisa)|nao entendi( a pergunta)?|que pergunta|hein|ue)\b/.test(n)) return true;
  return /\?\s*$/.test(t) && /\b(como|o que|qual|tem|existe|precisa|porque|por que|pra que)\b/.test(n);
}

/** Pede o valor do orçamento no meio da conversa ("e o valor? quanto eu cobro?"). */
export function asksForPrice(text: string): boolean {
  return /\b(quanto (eu )?(tenho que |devo |deveria |vou |posso )?cobra[r]?|quanto cobro|quanto fica|quanto custa (o servico|isso)|e o valor|valor do orcamento|qual o (valor|preco)|me (fala|diz) o (valor|preco))\b/.test(normalizeText(text));
}

const PICKUP_NOT_NEEDED = /\b(vai|vem|vao|ela vai|ele vai|eles vao|vou receber|cliente vai|vai mandar|manda|vai contratar|contratar)\b.*\b(deixar|trazer|levar|entregar)\b.*\b(minha casa|aqui|na oficina|em casa|pra mim|para mim|comigo)\b|\b(traz|trazem|deixa|deixam)\b.*\b(aqui|minha casa|oficina)\b/;
const CLIENT_PICKS_UP = /\b(vem buscar|vai buscar|busca aqui|retira aqui|vai retirar|passa (pra )?pegar|vem pegar|manda buscar)\b|\b(ela|ele|elas|eles|cliente|dona \w+|seu \w+) (mesm[oa]s? )?(busca|buscam|pega|pegam|retira|retiram)\b/;
const I_DELIVER = /\b(eu (levo|entrego|vou levar|vou entregar)|levo de volta|entrego (la|na casa|pra ela|pra ele)|vou ter que (levar|entregar))\b/;
const I_PICK_UP = /\b(eu (busco|pego|vou buscar|vou pegar)|tenho que buscar|vou ter que buscar|preciso buscar)\b/;
// quem fala do transporte em 1ª pessoa: as regras do cliente não valem
const FIRST_PERSON_TRANSPORT = /\b(eu (busco|pego|levo|entrego|vou)|vou (buscar|pegar|levar|entregar)|busco|levo|entrego|tenho que (buscar|levar|entregar|pegar)|preciso (buscar|levar|entregar|pegar)|vou ter que)\b/;
const THIRD_PERSON = /\b(ele|ela|eles|elas|cliente|dona|seu|moca|moco|rapaz|senhora|senhor|vai|vem|vao|traz|trazem|deixa|deixam|busca|buscam|pega|pegam|retira|retiram|manda|mandam)\b/;
const CLIENT_BRINGS = /\b(traz|trazem|trazer|trouxe|deixa|deixam|deixar|deixou|manda|mandam|mandar)\b/;
const CLIENT_TAKES_BACK = /\b(busca|buscam|buscar|pega|pegam|pegar|retira|retiram|retirar|leva de volta|levar de volta|leva embora|levar embora|e leva|e levar)\b/;

/**
 * "ele vai trazer e buscar quando estiver pronta", "cliente deixa comigo e depois ele busca",
 * "cliente traz": o cliente cuida do transporte. Visto no teste real de 23/11/2026, em que
 * nenhuma dessas foi entendida.
 */
export function clientHandlesTransport(text: string): { pickup?: false; delivery?: false } {
  const n = normalizeText(text);
  if (FIRST_PERSON_TRANSPORT.test(n) || !THIRD_PERSON.test(n)) return {};
  const out: { pickup?: false; delivery?: false } = {};
  if (CLIENT_BRINGS.test(n)) out.pickup = false;
  if (CLIENT_TAKES_BACK.test(n)) out.delivery = false;
  return out;
}

/**
 * Interpreta a resposta do usuário a uma pergunta específica.
 * "Não sei" só vale quando a fala não traz a resposta: "tamanho médio, não sei a medida exata" é
 * médio (avaliação real 24/11/2026: o "não sei" atropelava a resposta dita junto).
 */
export function parseAnswer(field: ProjectField, rawText: string): ParsedAnswer {
  const text = rawText.startsWith("ans:") ? rawText.slice(4) : rawText;
  const norm = normalizeText(text);
  if (text.trim().toLowerCase() === "nao_sei" || norm === "nao_sei") return { kind: "dont_know" };
  if (!DONT_KNOW_RE.test(norm)) return parseAnswerCore(field, rawText);
  // tira o "não sei ..." e vê se sobrou uma resposta de verdade ("não sei a medida, mas é médio");
  // sem isso o "não" do "não sei" virava "não precisa" em outros campos
  const rest = norm.replace(/(nao sei|sei la|nao lembro|nao tenho certeza)( (a|o|as|os) [a-z]+( exata| exato)?)?/g, " ").replace(/\s+/g, " ").trim();
  if (rest.split(" ").filter((w) => w.length > 2).length >= 1) {
    const r = parseAnswerCore(field, rest);
    if (r.kind === "value" && r.strength === "specific") return r;
  }
  return { kind: "dont_know" };
}

const DONT_KNOW_RE = /(^|[^a-z])(nao sei|sei la|nao lembro|nao tenho certeza)([^a-z]|$)/;

function parseAnswerCore(field: ProjectField, rawText: string): ParsedAnswer {
  const text = rawText.startsWith("ans:") ? rawText.slice(4) : rawText;
  const norm = normalizeText(text);
  const key = text.trim().toLowerCase();
  // valores de botões (com "_") são comparados antes da normalização
  const is = (v: string) => key === v || norm === v;
  if (!rawText.startsWith("ans:") && isQuestionToBot(text)) return { kind: "question" };
  const nlu = interpretRules(text);
  const e = nlu.entities;
  const specific = <K extends ProjectField>(f: K, value: FactValueMap[K]): ParsedAnswer => ({ kind: "value", field: f, value, strength: "specific" }) as ParsedAnswer;
  const free = <K extends ProjectField>(f: K, value: FactValueMap[K]): ParsedAnswer => ({ kind: "value", field: f, value, strength: "free" }) as ParsedAnswer;
  switch (field) {
    case "furniture_type": {
      const type = findFurniture(text);
      if (type) return specific(field, { type, descriptors: findDescriptors(text), ...(e.doors !== undefined ? { doors: e.doors } : {}), ...(e.drawers !== undefined ? { drawers: e.drawers } : {}) });
      if (norm.length >= 3 && norm.split(" ").length <= 4 && !/\b(imovel|registrar|queria|quero)\b/.test(norm)) return free(field, { type: norm.replace(/\s+/g, "_"), descriptors: [] });
      return { kind: "unparsed" };
    }
    case "techniques": {
      if (TECHNIQUES[key]) return specific(field, [key]);
      const t = findTechniques(text);
      if (t.length) return specific(field, t);
      // "reforma nas tábuas", "tá tudo velho, vou arrumar" → restauração
      if (/\b(reforma|reformar|arrumar|consertar|recuperar|tabuas|estrado)\b/.test(norm)) return specific(field, ["restauracao"]);
      return { kind: "unparsed" };
    }
    case "client_name": {
      const name = extractClientName(text);
      if (name) return specific(field, name);
      const cleaned = text
        .trim()
        .replace(/^(é|e|eh|a|o|da|do|de|cliente|chama|se chama)\s+/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      if (cleaned.length >= 2 && cleaned.split(/\s+/).length <= 5) return free(field, cleaned.replace(/\b\w/g, (c) => c.toUpperCase()));
      return { kind: "unparsed" };
    }
    case "condition": {
      // "sem conserto nenhum", "sem problema": o trecho negado não conta (D-074)
      const cn = stripNegated(norm);
      const negatedRepair = cn !== norm && /\b(conserto|reparo|problema|defeito|estrago|dano)/.test(norm);
      if (/\b(bem|muito|todo|toda|tudo|bastante) (estragad|detonad|judiad|acabad|ruim|velh|podre)\w*|\b(danificad|pessim|cupim|podre|quebrad|caindo aos pedacos|detonad)\w*/.test(cn)) return specific(field, "danificado");
      if (/\b(reparos?|consertos?|arranhad|riscad|descascand|desgastad|estragad|velh|manchad|lascad|solt)\w*/.test(cn) || /\bprecis\w* de (uns |um |alguns |algum )?(reparo|conserto|massa|cola|ajuste|cuidado|restauro)/.test(cn)) return specific(field, "reparos");
      if (/\b(bom|boa|boazinha|bonzinho|bonzinha|boinha|otim[oa]|inteir[oa]|inteirinh[oa]|conservad[oa]|bonit[oa]|tranquil[oa]|em bom estado|razoavel|ok|de boa|em ordem|ajeitad[oa]|direitinh[oa])\b/.test(cn)) return specific(field, "bom");
      if (negatedRepair) return specific(field, "bom");
      // texto livre só quando fala de alguma parte/acabamento da peça (nunca "hmm deixa eu ver")
      return /\b(pe|pes|perna|pernas|cabeceira|peseira|tampo|gaveta|gavetas|porta|portas|pintura|verniz|madeira|lateral|laterais|estrutura|acabamento|assento|encosto|puxador|puxadores)\b/.test(norm)
        ? free(field, text.trim())
        : { kind: "unparsed" };
    }
    case "dimensions":
    case "size_class": {
      // "1,20 por 50", "1,70 x 2,10": largura × fundura (na cama, largura × comprimento); > 10 = cm
      const by = /^\D*?(\d+(?:[.,]\d+)?)\s*(?:m|cm|metros?)?\s*(?:por|x)\s*(\d+(?:[.,]\d+)?)\s*(?:m|cm|metros?)?\D*$/.exec(norm);
      if (by) {
        const toM = (raw: string) => {
          const d = Dec.tryParse(raw.replace(",", "."));
          return d && d.gt(0) ? (d.gt(10) ? d.div(100) : d).toString() : undefined;
        };
        const w = toM(by[1]!);
        const dd = toM(by[2]!);
        if (w && dd) return specific("dimensions", { width: w, depth: dd });
      }
      if (e.lengthsM.length > 0) {
        const [a, b, c] = e.lengthsM;
        const dims: FactValueMap["dimensions"] = {};
        // convenção: altura, largura, fundura quando ditas nessa ordem; "altura"/"largura"/"fundo" explícitos têm prioridade
        const labeled = labelDimensions(norm);
        dims.height = labeled.height ?? a;
        dims.width = labeled.width ?? b;
        dims.depth = labeled.depth ?? c;
        return specific("dimensions", stripUndefined(dims));
      }
      const labeledOnly = labelDimensions(norm);
      if (labeledOnly.height || labeledOnly.width || labeledOnly.depth) {
        return specific("dimensions", stripUndefined({ height: labeledOnly.height, width: labeledOnly.width, depth: labeledOnly.depth }));
      }
      if (e.sizeClass || ["pequeno", "medio", "grande"].some(is)) return specific("size_class", (e.sizeClass ?? key) as FactValueMap["size_class"]);
      return { kind: "unparsed" };
    }
    case "surfaces":
      // "por dentro não precisa mexer" é só por fora (D-074)
      if (insideNegated(norm)) return specific(field, "externa");
      if (is("interna_externa") || e.surfaces === "interna_externa" || /\b(dentro e fora|por dentro tambem|os dois lados|interna e externa)\b/.test(norm)) return specific(field, "interna_externa");
      if (is("externa") || e.surfaces === "externa" || /\b(so (por )?fora|parte de fora|so o lado de fora|nao tem dentro|so a parte externa)\b/.test(norm)) return specific(field, "externa");
      return { kind: "unparsed" };
    case "repairs":
    case "subcontract":
      if (NO_RE.test(norm)) return specific(field, { needed: false });
      if (YES_RE.test(norm)) return specific(field, { needed: true, ...(norm.length > 12 ? { description: text.trim() } : {}) });
      // texto livre só vale se falar de conserto/terceiro (senão é resposta a outra coisa)
      if (norm.length > 6 && /\b(colar|cola|trocar|massa|perna|tabua|gaveta|porta|lasca|quebr|solt|bamb|conserto|marceneiro|tapeceiro|parceiro|assento|estofado)\w*/.test(norm)) return free(field, { needed: true, description: text.trim() });
      return { kind: "unparsed" };
    case "material_status":
      if (["tem_tudo", "tem_parte", "precisa_comprar"].some(is)) return specific(field, key as FactValueMap["material_status"]);
      if (/\b(tenho (uma )?parte|tenho um pouco|parte (eu tenho|em casa)|completar|comprar o resto|falta um pouco)\b/.test(norm)) return specific(field, "tem_parte");
      if (e.materialStatus) return specific(field, e.materialStatus);
      if (/\b(tenho|tem no estoque|estoque)\b/.test(norm)) return specific(field, "tem_tudo");
      if (/\bcompr/.test(norm)) return specific(field, "precisa_comprar");
      return { kind: "unparsed" };
    case "application_method": {
      if (["pincel", "rolo", "pistola"].some(is)) return specific(field, key as FactValueMap["application_method"]);
      const methods = findMethods(text);
      return methods.length ? specific(field, methods[0]!) : { kind: "unparsed" };
    }
    case "logistics": {
      if (is("nenhum") || /^(nao|nao precisa|nenhum|nada)\b/.test(norm)) return specific(field, { pickup: false, delivery: false });
      if (is("ambos") || /\b(os dois|ambos|buscar e entregar|busco e entrego)\b/.test(norm)) return specific(field, { pickup: true, delivery: true });
      const known: { pickup?: boolean; delivery?: boolean } = {};
      if (PICKUP_NOT_NEEDED.test(norm)) known.pickup = false;
      if (CLIENT_PICKS_UP.test(norm)) known.delivery = false;
      if (I_DELIVER.test(norm) || is("entregar") || /^(so )?entregar\b/.test(norm)) known.delivery = true;
      if (I_PICK_UP.test(norm) || is("buscar") || /^(so )?buscar\b/.test(norm)) known.pickup = true;
      if (/\bso (buscar|pegar)\b/.test(norm)) known.delivery = false;
      if (/\bso entregar\b/.test(norm)) known.pickup = false;
      const byClient = clientHandlesTransport(text);
      if (known.pickup === undefined && byClient.pickup === false) known.pickup = false;
      if (known.delivery === undefined && byClient.delivery === false) known.delivery = false;
      if (known.pickup !== undefined && known.delivery !== undefined) return specific(field, { pickup: known.pickup, delivery: known.delivery });
      if (known.pickup !== undefined || known.delivery !== undefined) return { kind: "partial", field: "logistics", known };
      return { kind: "unparsed" };
    }
    case "deadline":
      if (is("sem_prazo") || /\b(sem prazo|sem pressa|nao (ta|esta|tem|tao|estao) com pressa|nao tem pressa|quando der|quando puder|quando ficar pronto|tranquilo|nao corre)\b/.test(norm)) return specific(field, "sem prazo");
      if (/\b(\d+|um|uma|dois|duas|tres|quinze|vinte|trinta) (dias?|semanas?|mes|meses)\b|\b(ate|antes d[oa]|para o|pro) (natal|ano novo|fim do mes|final do mes|dia \d+)\b|\bmes que vem\b|\bsemana que vem\b/.test(norm)) return specific(field, text.trim().replace(/[.!]+$/, ""));
      return norm.length > 1 ? free(field, text.trim()) : { kind: "unparsed" };
    case "payment_terms":
      if (is("a_vista") || /\b(a vista|tudo de uma vez|pix|dinheiro|na hora)\b/.test(norm)) return specific(field, "à vista");
      if (is("entrada_entrega") || /\b(entrada|metade|sinal|50 ?%|cinquenta por cento)\b/.test(norm)) return specific(field, "entrada e restante na entrega");
      if (/\b(parcel|cartao|vezes)\w*/.test(norm)) return specific(field, "parcelado");
      if (/\b(a combinar|combinar depois|ainda nao combinei)\b/.test(norm)) return specific(field, "a combinar");
      return norm.length > 2 ? free(field, text.trim()) : { kind: "unparsed" };
    case "details":
      if (NO_RE.test(norm)) return specific(field, "nenhum");
      return norm.length > 2 ? free(field, text.trim()) : { kind: "unparsed" };
    case "scope": {
      if (/\b(so|somente|apenas)( o| no)? tampo\b|\bso tampo\b/.test(norm)) return specific(field, { part: "tampo" });
      if (/\b(so|somente|apenas)( a| na)? cabeceira\b|\bso cabeceira\b/.test(norm)) return specific(field, { part: "cabeceira" });
      if (/\b(inteir[oa]|tod[oa]|completa|completo|tudo|cabeceira,? peseira)\b/.test(norm)) return specific(field, { part: "inteiro" });
      return { kind: "unparsed" };
    }
  }
}

/** Todos os métodos citados ("pincel e rolo"). */
export function findMethods(text: string): ("pincel" | "rolo" | "pistola")[] {
  const n = normalizeText(text);
  const out: ("pincel" | "rolo" | "pistola")[] = [];
  if (/\b(pincel|trincha)\b/.test(n)) out.push("pincel");
  if (/\brolo\b/.test(n)) out.push("rolo");
  if (/\b(pistola|compressor)\b/.test(n)) out.push("pistola");
  return out;
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
      return `móvel: ${f.quantity && f.quantity > 1 ? `${f.quantity}× ` : ""}${furnitureLabel(f.type)}${f.doors ? `, ${f.doors} portas` : ""}${f.descriptors?.length ? ` (${f.descriptors.join(", ")})` : ""}`;
    }
    case "techniques":
      return `trabalho: ${(v as string[]).map((t) => TECHNIQUES[t]?.label ?? t).join(", ")}`;
    case "client_name":
      return `cliente: ${v as string}`;
    case "condition":
      return `estado: ${v as string}`;
    case "dimensions": {
      const d = v as FactValueMap["dimensions"];
      // hipótese nominal (ex.: colchão queen) nunca aparece como se fosse medida da peça
      if (d.source === "nominal" || d.source === "estimated" || d.source === "inferred") {
        const what = d.kind === "mattress" ? "colchão" : d.kind === "top" ? "tampo" : "peça";
        const size = d.diameter ? `${fmtM(d.diameter)} de diâmetro` : [d.width, d.depth, d.height].filter(Boolean).map((x) => fmtM(x!)).join(" × ");
        return `medida de referência: ${what} ${size}${d.standardConfirmed ? " (tamanho padrão confirmado)" : " (a confirmar)"}`;
      }
      const parts = [d.diameter && `diâmetro ${fmtM(d.diameter)}`, d.height && `altura ${fmtM(d.height)}`, d.width && `largura ${fmtM(d.width)}`, d.depth && `fundura ${fmtM(d.depth)}`].filter(Boolean);
      const open = d.open?.width ? ` (aberta: ${fmtM(d.open.width)})` : "";
      return `medidas: ${parts.join(", ")}${open}`;
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
      return `observações: ${v as string}`;
    case "scope": {
      const sc = v as FactValueMap["scope"];
      return sc.part === "tampo" ? "trabalho só no tampo" : sc.part === "cabeceira" ? "trabalho só na cabeceira" : "trabalho na peça inteira";
    }
  }
}

function fmtM(m: string): string {
  return `${m.replace(".", ",")} m`;
}

// --------------------------------------------------------------- linguagem natural

export interface QuestionContext {
  furnitureType?: string | null;
  furnitureLabel?: string | null;
  feminine?: boolean;
  condition?: string | null;
  techniques?: string[];
  clientName?: string | null;
  /** escolhe a variação (muda a cada interação para não soar robótico) */
  seed: number;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!;
}

/**
 * Pergunta em linguagem natural, variando a forma e adaptando ao móvel e ao que
 * já foi dito. Sempre com um exemplo de resposta. `questionFor` continua sendo
 * a forma-base (reserva).
 */
export function naturalQuestion(field: ProjectField, c: QuestionContext): string {
  const ele = c.feminine ? "ela" : "ele";
  const nele = c.feminine ? "nela" : "nele";
  const dele = c.feminine ? "dela" : "dele";
  const movel = c.furnitureLabel ?? "móvel";
  const art = c.feminine ? "a" : "o";
  const Art = c.feminine ? "A" : "O";
  const bad = c.condition === "danificado" || c.condition === "reparos";
  const painting = (c.techniques ?? []).some((t) => ["pintura_lisa", "patina", "decape"].includes(t));
  switch (field) {
    case "furniture_type":
      return pick(
        [
          "Que móvel é esse? Pode falar do seu jeito, tipo \"uma cristaleira\" ou \"uma cômoda de quatro gavetas\".",
          "Me conta: qual é o móvel? Por exemplo: \"uma cadeira\" ou \"um guarda-roupa\".",
          "E que móvel é? Só o nome já me ajuda, tipo \"uma mesa\" ou \"uma cama\".",
        ],
        c.seed,
      );
    case "techniques":
      return pick(
        [
          `E o que você vai fazer ${nele}? Pode ser mais de uma coisa, tipo "pátina e verniz" ou "reformar e envernizar".`,
          `Qual vai ser o trabalho n${art} ${movel}? Pintura, pátina, verniz, uma reforma? Pode falar do seu jeito.`,
          `Me conta o serviço: o que ${art} ${movel} vai precisar? Por exemplo "lixar e passar verniz".`,
        ],
        c.seed,
      );
    case "client_name":
      return pick(["De quem é esse móvel? Só o nome do cliente, tipo \"da dona Maria\".", "E esse trabalho é pra quem? Me diz o nome do cliente.", `${Art} ${movel} é de qual cliente?`], c.seed);
    case "condition":
      return pick(
        [
          `E como ${ele} está hoje? Tá bom, precisa de uns reparos ou tá bem estragad${art}?`,
          `Como tá o estado ${dele}? Pode descrever do seu jeito, tipo "tá bem judiad${art}" ou "só uns riscos".`,
          `Me conta como ${art} ${movel} chegou: em bom estado, com alguns problemas, ou bem acabad${art}?`,
        ],
        c.seed,
      );
    case "dimensions":
    case "size_class":
      if (c.furnitureType === "cama")
        return `E a medida da cama por fora (a estrutura, não o colchão)? Largura e comprimento já bastam, tipo "1,70 por 2,10". Se não tiver agora, diz "não sei" que eu estimo pelo tamanho e deixo como preliminar.`;
      return pick(
        [
          `Agora o tamanho, que mexe bastante no preço. Se tiver as medidas, fala assim: "1,80 de altura, 1 metro de largura e 40 de fundura". Se não, só pequeno, médio ou grande já serve.`,
          `Qual é o tamanho ${dele}? Pode ser com medidas (altura, largura e fundura) ou só se é pequen${art}, médi${art} ou grande.`,
          `E de tamanho, ${ele} é como? Medida aproximada ou só "pequeno, médio ou grande", o que for mais fácil pra você.`,
        ],
        c.seed,
      );
    case "surfaces":
      return pick(
        [
          `${Art} ${movel} vai ser trabalhad${art} só por fora, ou a parte de dentro (prateleiras, gavetas) também?`,
          "Você vai mexer só na parte de fora ou por dentro também (prateleiras, gavetas, portas por dentro)?",
        ],
        c.seed,
      );
    case "repairs":
      if (bad)
        return pick(
          [
            `Você falou que ${ele} tá precisando de cuidado. O que vai ter que consertar antes do acabamento? Tipo colar, trocar tábua, passar massa.`,
            `E sobre os consertos: o que precisa arrumar ${nele}? Pode contar do seu jeito.`,
          ],
          c.seed,
        );
      return pick(
        [
          `Antes ${painting ? "da pintura" : "do acabamento"}, ${ele} precisa de algum conserto? Tipo colar uma perna ou passar massa. Se não precisar, é só dizer "não".`,
          "Tem algum conserto pra fazer antes? Uma perna bamba, uma lasca, uma tábua solta. Se não tiver, só \"não\".",
        ],
        c.seed,
      );
    case "subcontract":
      return pick(["Alguma parte vai pra outro profissional, tipo marceneiro ou tapeceiro? Se for tudo com você, é só dizer \"não\".", "Você vai fazer tudo sozinho ou alguma parte vai pra um parceiro (marceneiro, tapeceiro)?"], c.seed);
    case "material_status":
      return pick(["E o material: você já tem em casa ou vai precisar comprar? Pode dizer \"já tenho tudo\", \"tenho uma parte\" ou \"vou comprar\".", "Sobre o material: tem aí no estoque ou vai ter que comprar?"], c.seed);
    case "application_method":
      return pick(["Você vai aplicar com pincel, rolo ou pistola?", "E pra aplicar, vai de pincel, rolo ou pistola? Se for mais de um, pode falar."], c.seed);
    case "logistics":
      return pick(
        [
          `E o transporte: o cliente traz ${art} ${movel} aí, ou você vai precisar buscar? E depois, você entrega ou o cliente vem pegar?`,
          `Como ${art} ${movel} chega até você e volta pro cliente? Você busca e entrega, ou o cliente leva e traz?`,
        ],
        c.seed,
      );
    case "deadline":
      return pick(["Tem algum prazo combinado? Tipo \"daqui a 15 dias\", \"até o Natal\" ou \"sem pressa\".", "O cliente tem pressa ou pode ser no seu tempo?"], c.seed);
    case "payment_terms":
      return pick(["E o pagamento, como vai ser? À vista, ou metade agora e metade na entrega?", "Como ficou combinado o pagamento? Por exemplo: \"à vista\" ou \"entrada e o resto na entrega\"."], c.seed);
    case "details":
      return pick(["Tem algum detalhe especial, tipo entalhe, puxador ou vidro? Se não, só \"não\".", "Algum detalhe que dá mais trabalho, como entalhes ou vidros?"], c.seed);
    case "scope":
      if (c.furnitureType === "cama") return "Você vai trabalhar a cama toda (cabeceira, peseira e laterais) ou só a cabeceira?";
      return pick([`Você vai trabalhar só no tampo ou ${nele} inteir${art}?`, `É só o tampo ou ${art} ${movel} inteir${art}?`], c.seed);
  }
}

/** Por que perguntamos: usado quando o artesão pergunta "como assim?". */
export const FIELD_EXPLANATION: Record<ProjectField, string> = {
  furniture_type: "Pergunto o móvel porque cada um dá um trabalho diferente.",
  techniques: "Preciso saber o serviço (pintar, envernizar, reformar) porque cada um leva um tempo e um material diferente.",
  client_name: "O nome do cliente é pra eu não misturar os serviços e saber pra quem é o orçamento.",
  condition: "O estado da peça muda o tempo de preparo: uma peça bem judiada leva bem mais horas.",
  dimensions: "O tamanho define quanto material e quantas horas vão. Não precisa ser exato: pequeno, médio ou grande já ajuda.",
  size_class: "O tamanho define quanto material e quantas horas vão. Não precisa ser exato.",
  surfaces: "Em armários, cômodas e cristaleiras às vezes a parte de dentro (prateleiras, gavetas) também é trabalhada, e isso aumenta a área.",
  details: "Entalhes e vidros dão mais trabalho, então entram no tempo.",
  repairs: "Consertos (colar, trocar tábua, massa) levam tempo além do acabamento, e esse tempo precisa entrar no preço.",
  subcontract: "Se uma parte vai pra outro profissional, o valor dele entra no orçamento.",
  logistics: "Se você precisar buscar ou entregar, o transporte é um custo que entra no orçamento. Se o cliente traz e busca, não entra.",
  material_status: "Pergunto só pra saber se você vai precisar comprar. O material do estoque também entra no preço (pelo valor de reposição), pra você não sair perdendo.",
  application_method: "Pincel, rolo e pistola têm velocidades e desperdícios diferentes, e isso muda a conta.",
  deadline: "O prazo me ajuda a organizar sua agenda.",
  payment_terms: "Como o cliente paga entra na proposta que vai pra ele.",
  scope: "Se for só o tampo, a área é bem menor e o preço também.",
};

/** Confirmações variadas e naturais (nunca o mesmo "Anotado" sempre). */
export function naturalAck(fact: string, seed: number): string {
  const cap = fact ? fact[0]!.toUpperCase() + fact.slice(1) : fact;
  return pick([`Anotado: ${fact}. ✅`, `Show! Anotei: ${fact}. 👌`, `Beleza, ${fact}. Tá na mão! 🙌`, `Perfeito, ${fact}. ✍️`, `Opa, anotadinho: ${fact}. 📝`, `Entendi! ${cap}. 😉`, `Certo, ${fact}. 👍`], seed);
}

/**
 * INFORMAÇÃO ADIANTADA (D-074): o que ele já contou na primeira fala ("tá boazinha, só por fora,
 * sem conserto, ela traz e busca") vira dado na hora — o bot não pergunta de novo. Só respostas
 * específicas e inequívocas (nunca texto livre); campo já preenchido não é tocado pelo chamador.
 * Avaliação real 24/11/2026: perguntou conserto e frete que já tinham sido ditos três vezes.
 */
export function volunteeredFacts(text: string): [ProjectField, unknown][] {
  const out: [ProjectField, unknown][] = [];
  const norm = normalizeText(text);
  const take = (field: ProjectField) => {
    const a = parseAnswer(field, text);
    if (a.kind === "value" && a.strength === "specific") out.push([field, a.value]);
  };
  // estado só com palavra de estado (não "danificado" solto de outra peça num pedido longo)
  if (/\b(bo[am]|boazinha|bonzinho|conservad|estragad|danificad|riscad|reparo|conserto|problema|judiad|detonad|inteir)\w*/.test(norm)) take("condition");
  if (/\b(por fora|por dentro|lado de fora|parte de fora|parte de dentro)\b/.test(norm)) take("surfaces");
  if (/\b(sem (nenhum )?(conserto|reparo)s?|(conserto|reparo)s? nenhum|nao precisa (de )?(conserto|reparo|consertar|arrumar nada))\b/.test(norm)) out.push(["repairs", { needed: false }]);
  if (/\b(traz|trazer|busca|buscar|entrega|entregar|leva|levar|pega|pegar|retira|frete)\w*/.test(norm)) {
    const a = parseAnswer("logistics", text);
    if (a.kind === "value") out.push(["logistics", a.value]);
  }
  return out;
}
