import { Dec, formatBRL } from "@adripatina/shared";
import type { NeedKind, NeedReason } from "./types.js";

/**
 * Mensagens da coleta proativa. A estrutura é determinística:
 *   [saudação curta] · contexto (por que pergunto) · linha em branco · UMA pergunta
 * Variações vêm de pequenos conjuntos escolhidos por semente, sempre
 * parametrizados pelo dado, motivo e assunto. A IA pode reescrever SÓ a frase de
 * contexto (validada por validateContextRephrase); a pergunta nunca muda.
 */

export interface QuestionSpec {
  kind: NeedKind;
  reason: NeedReason;
  /** "verniz", "lixa" (material) ou título do trabalho */
  subject: string;
  baseUnit?: string;
  firstName: string;
  greet: boolean;
  seed: number;
  /** "da mesinha da Dona Ana" já com preposição, quando há orçamento beneficiado */
  benefitLabel?: string;
  knownPriceCents?: number | null;
  /** trabalho concluído (horas/consumo) */
  jobTitle?: string;
  /** material usado no trabalho/técnica */
  materialName?: string;
  materialUnit?: string;
  techniqueName?: string;
}

export interface ComposedQuestion {
  text: string;
  greeting: string | null;
  context: string;
  question: string;
  emoji: string;
}

const PAINT = /\b(verniz|tinta|esmalte|cera|fundo|betume|patina|pátina|seladora|selador|laca|primer|stain|folha de ouro|douração|mordente|cola)\b/i;

export function emojiFor(kind: NeedKind, subject: string): string {
  if (kind === "stock_level") return "📦";
  if (kind === "job_actual_hours") return "🛠️";
  if (kind === "technique_coats") return "🖌️";
  return PAINT.test(subject) ? "🎨" : "📦";
}

/** "do verniz" / "da lixa" (heurística simples pelo primeiro substantivo). */
export function ofArticle(subject: string): string {
  const first = subject.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return /a$/.test(first) && !/^(sistema|clima|tema)$/.test(first) ? "da" : "do";
}
function theArticle(subject: string): string {
  return ofArticle(subject) === "da" ? "a" : "o";
}

export function containerOf(baseUnit?: string): { one: string; many: string; feminine: boolean } {
  switch ((baseUnit ?? "").toLowerCase()) {
    case "l":
      return { one: "lata", many: "latas", feminine: true };
    case "kg":
      return { one: "embalagem", many: "embalagens", feminine: true };
    case "folha":
      return { one: "folha", many: "folhas", feminine: true };
    default:
      return { one: "unidade", many: "unidades", feminine: true };
  }
}

export function sizeQuestionOf(baseUnit?: string): string {
  switch ((baseUnit ?? "").toLowerCase()) {
    case "l":
      return "quantos litros";
    case "kg":
      return "quantos quilos";
    case "folha":
      return "quantas folhas";
    default:
      return "quantas unidades";
  }
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.floor(seed)) % list.length]!;
}

export function assemble(blocks: (string | null | undefined)[]): string {
  return blocks.filter((b): b is string => !!b && b.trim().length > 0).join("\n\n");
}

function contextFor(spec: QuestionSpec): string {
  const s = spec.subject;
  const of = `${ofArticle(s)} ${s}`;
  const quote = spec.benefitLabel ? `o orçamento ${spec.benefitLabel}` : "aquele orçamento";
  switch (spec.kind) {
    case "material_price":
      switch (spec.reason) {
        case "quote_blocked":
          return pick([`Quero continuar ${quote}, mas preciso atualizar o preço ${of}.`, `Para fechar ${quote} direitinho, falta só o preço ${of}.`], spec.seed);
        case "price_demo":
          return pick([`O preço ${of} que tenho aqui é só uma estimativa inicial.`, `Quero trocar a estimativa do preço ${of} por um valor de verdade.`], spec.seed);
        case "price_stale":
          return pick([`Faz um tempinho que o preço ${of} não é atualizado.`, `Quero conferir se o preço ${of} ainda é o mesmo.`], spec.seed);
        default:
          return pick([`Quero deixar os próximos orçamentos com ${s} mais certinhos.`, `Ainda não tenho o preço ${of} anotado.`], spec.seed);
      }
    case "material_package_size":
      return spec.knownPriceCents ? `Tenho anotado que ${theArticle(s)} ${s} custa ${formatBRL(spec.knownPriceCents)}.` : `Tenho o preço ${of} anotado.`;
    case "stock_level":
      if (spec.reason === "stock_negative") return `Pelas minhas contas, o estoque ${of} ficou estranho.`;
      return pick([`Posso conferir uma coisa do estoque?`, `Queria dar uma conferida no estoque ${of}.`], spec.seed);
    case "job_actual_hours":
      return pick([`Quero aprender com aquele trabalho: ${spec.jobTitle ?? s}.`, `Fiquei curioso sobre o trabalho ${spec.jobTitle ?? s}.`], spec.seed);
    case "job_materials_used":
      return `Para eu aprender com o serviço ${spec.jobTitle ?? s}:`;
    case "technique_coats":
      return `Quero entender melhor como você faz ${spec.techniqueName ?? "esse acabamento"}.`;
  }
}

function questionFor(spec: QuestionSpec): string {
  const s = spec.subject;
  const c = containerOf(spec.baseUnit);
  switch (spec.kind) {
    case "material_price":
      if ((spec.baseUnit ?? "").toLowerCase() === "folha") return `Quanto está custando cada folha de ${s}?`;
      return pick([`Quanto está custando a ${c.one} que você costuma comprar?`, `Quanto custa, mais ou menos, a ${c.one} ${ofArticle(s)} ${s} que você costuma comprar?`], spec.seed);
    case "material_package_size":
      return `Só faltou uma informação: essa ${c.one} é de ${sizeQuestionOf(spec.baseUnit)}?`;
    case "stock_level":
      if ((spec.baseUnit ?? "").toLowerCase() === "folha") return `Quantas folhas de ${s} você acha que ainda temos?`;
      if ((spec.baseUnit ?? "").toLowerCase() === "l") return `Quanto ${s} você acha que ainda tem aí? Pode ser assim: "meia lata".`;
      return `Quanto ${theArticle(s) === "a" ? "de " : ""}${s} você acha que ainda tem por aí?`;
    case "job_actual_hours":
      return "Mais ou menos quantas horas você levou nele, no total?";
    case "job_materials_used":
      return `Você lembra quanto ${spec.materialName ? spec.materialName.toLowerCase() : "material"} usou, mais ou menos?`;
    case "technique_coats":
      return `Quantas demãos de ${s} você costuma passar?`;
  }
}

/** Monta a pergunta proativa completa. `contextOverride` = frase de contexto reescrita e já validada. */
export function composeQuestion(spec: QuestionSpec, contextOverride?: string | null): ComposedQuestion {
  const emoji = emojiFor(spec.kind, spec.subject);
  const context = contextOverride ?? contextFor(spec);
  const question = questionFor(spec);
  // "Adriano, posso conferir uma coisa do estoque? 📦" já funciona como saudação
  if (spec.greet && /^Posso /.test(context)) {
    const merged = `${spec.firstName}, ${context.charAt(0).toLowerCase()}${context.slice(1)} ${emoji}`;
    return { text: assemble([merged, question]), greeting: null, context, question, emoji };
  }
  const greeting = spec.greet ? `Oi, ${spec.firstName}! ${emoji}` : null;
  // sem saudação, o emoji vai no contexto (um só por mensagem)
  const contextLine = greeting ? context : `${context} ${emoji}`;
  return { text: assemble([greeting, contextLine, question]), greeting, context, question, emoji };
}

/** Frase de contexto base (para a IA reescrever). */
export function baseContext(spec: QuestionSpec): string {
  return contextFor(spec);
}

// ------------------------------------------------------------------ respostas de seguimento

export function askPackageSizeText(p: { amountCents: number; approximate: boolean; baseUnit?: string }): string {
  const c = containerOf(p.baseUnit);
  return assemble([`Perfeito, anotei ${p.approximate ? "cerca de " : ""}${formatBRL(p.amountCents)}. 💰`, `Essa ${c.one} é de ${sizeQuestionOf(p.baseUnit)}?`]);
}

export function confirmTotalText(p: { packages: number; amountCents: number; baseUnit?: string }): string {
  const c = containerOf(p.baseUnit);
  return assemble([`Entendi: foram ${p.packages} ${c.many} por ${formatBRL(p.amountCents)} no total, certo?`, `Se foi esse valor em cada uma, é só me dizer "cada uma".`]);
}

export function confirmPriceText(p: { subject: string; baseUnit?: string; sizeLabel: string; priceCents: number; approximate: boolean }): string {
  const c = containerOf(p.baseUnit);
  return `Só para confirmar: a ${c.one} ${ofArticle(p.subject)} ${p.subject} de ${p.sizeLabel} está custando ${p.approximate ? "cerca de " : ""}${formatBRL(p.priceCents)}. Certo? ✅`;
}

export function thanksPriceText(p: { subject: string; resumeLabel?: string | null }): string {
  return assemble([
    `Obrigado! Atualizei o preço ${ofArticle(p.subject)} ${p.subject}. ${PAINT.test(p.subject) ? "🎨" : "💰"}`,
    p.resumeLabel ? `Agora já consigo continuar o orçamento ${p.resumeLabel}.` : null,
  ]);
}

export function stillMissingText(p: { subject: string }): string {
  return `Ainda falta o preço ${ofArticle(p.subject)} ${p.subject} para fechar esse orçamento.`;
}

export function formatQuantity(quantity: string, baseUnit?: string): string {
  const d = Dec.from(quantity);
  const u = (baseUnit ?? "").toLowerCase();
  const num = d.round(2).toString().replace(".", ",");
  if (u === "l") return d.lt(1) && d.gt(0) ? `${d.mul(1000).round(0).toString()} ml` : `${num} ${d.eq(1) ? "litro" : "litros"}`;
  if (u === "kg") return d.lt(1) && d.gt(0) ? `${d.mul(1000).round(0).toString()} g` : `${num} kg`;
  if (u === "folha") return `${num} ${d.eq(1) ? "folha" : "folhas"}`;
  return `${num} ${d.eq(1) ? "unidade" : "unidades"}`;
}

export function thanksStockText(p: { subject: string; quantity: string; baseUnit?: string; approximate: boolean }): string {
  const q = formatQuantity(p.quantity, p.baseUnit);
  const zero = Dec.from(p.quantity).eq(0);
  return assemble([zero ? `Anotado: ${theArticle(p.subject)} ${p.subject} acabou. 📦` : `Anotado: ${p.approximate ? "mais ou menos " : ""}${q} de ${p.subject}. 📦`, "Obrigado!"]);
}

export function thanksHoursText(p: { hours: string; approximate: boolean }): string {
  return assemble([`Anotado: ${p.approximate ? "mais ou menos " : ""}${p.hours.replace(".", ",")} horas. 🛠️`, "Isso me ajuda a calcular melhor os próximos trabalhos."]);
}

export function thanksCoatsText(p: { coats: number; subject: string }): string {
  return assemble([`Anotado: ${p.coats} ${p.coats === 1 ? "demão" : "demãos"} de ${p.subject}. 🖌️`, "Obrigado por me explicar!"]);
}

export function thanksUsageText(p: { quantityLabel: string; subject: string }): string {
  return assemble([`Anotado: mais ou menos ${p.quantityLabel} de ${p.subject}. 🎨`, "Isso me ajuda a calcular melhor o rendimento."]);
}

export const DONT_KNOW_TEXT = assemble(["Sem problema 😊", "A gente confere isso outro dia."]);
export const LATER_TEXT = assemble(["Combinado! 😊", "Pergunto de novo daqui a uns dias."]);

export function discontinuedText(subject: string): string {
  return `Entendi! Não vou mais perguntar sobre ${theArticle(subject)} ${subject}. 👍`;
}

export function retryText(question: string, example: string): string {
  return assemble(["Acho que não entendi direitinho. 🤔", question, `Pode ser assim: "${example}".`]);
}

export function exampleFor(kind: NeedKind, baseUnit?: string, expecting?: string): string {
  if (expecting === "size") return (baseUnit ?? "").toLowerCase() === "l" ? "1 litro" : (baseUnit ?? "").toLowerCase() === "folha" ? "50 folhas" : "1 quilo";
  if (expecting === "confirm") return "sim, no total";
  switch (kind) {
    case "material_price":
      return "uns 85 reais";
    case "material_package_size":
      return (baseUnit ?? "").toLowerCase() === "l" ? "1 litro" : "1 quilo";
    case "stock_level":
      return (baseUnit ?? "").toLowerCase() === "folha" ? "umas 12" : "meia lata";
    case "job_actual_hours":
      return "umas 6 horas";
    case "job_materials_used":
      return "meia lata";
    case "technique_coats":
      return "duas demãos";
  }
}

// ------------------------------------------------------------------ verificação de estilo

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

const FORBIDDEN = /\b(autis\w*|campo|nulo|null|sistema|banco de dados|tentativa|urgente|agora mesmo|obrigat\w*|bloquead\w* por (voce|você)|voce ainda nao respondeu|você ainda não respondeu|preciso que responda|querid\w*|fofinh\w*|amiguinh\w*)\b/i;

/** Regras de forma: pergunta presente, ≤2 emojis, sem termos técnicos/infantis/pressão. */
export function checkMessageStyle(text: string): string[] {
  const problems: string[] = [];
  if (countEmojis(text) > 2) problems.push("emojis_demais");
  if (FORBIDDEN.test(text)) problems.push("termo_proibido");
  const questions = (text.match(/\?/g) ?? []).length;
  if (questions === 0) problems.push("sem_pergunta");
  if (questions > 2) problems.push("perguntas_demais");
  if (text.split("\n\n").some((b) => b.length > 220)) problems.push("bloco_longo");
  return problems;
}

/**
 * Valida a reescrita da frase de CONTEXTO feita pela IA: não pode introduzir
 * números/valores, fazer perguntas, citar termos proibidos ou mudar o assunto.
 */
export function validateContextRephrase(base: string, candidate: unknown, mustMention: string): string | null {
  if (typeof candidate !== "string") return null;
  const c = candidate.trim().replace(/^["“]|["”]$/g, "");
  if (!c || c.length > base.length * 2 + 40 || c.includes("\n") || c.includes("?")) return null;
  if (/r\$|reais|\d/i.test(c) && !/\d/.test(base)) return null;
  const baseDigits: string[] = base.match(/\d+/g) ?? [];
  if ((c.match(/\d+/g) ?? []).some((d) => !baseDigits.includes(d))) return null;
  if (countEmojis(c) > 0) return null;
  if (FORBIDDEN.test(c)) return null;
  if (mustMention && !c.toLowerCase().includes(mustMention.toLowerCase())) return null;
  return c;
}
