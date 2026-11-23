import { normalizeText } from "@adripatina/shared";

/**
 * Composição de mensagens com LLM, de forma segura:
 *  - o CÓDIGO define objetivo, fatos permitidos, a pergunta essencial e o texto de reserva;
 *  - a LLM só escreve a frase de um jeito natural;
 *  - o VALIDADOR confere que a pergunta essencial continua lá, que nenhum número/valor foi
 *    inventado, que há no máximo uma pergunta e poucos emojis, sem termos proibidos.
 * Se falhar, usa-se o texto determinístico (fallback).
 */

export interface MessagePlan {
  /** objetivo interno, ex.: "ask_dimensions" (vai para a auditoria, não para o artesão) */
  purpose: string;
  /** mensagem determinística completa (usada se a IA estiver desligada ou falhar) */
  fallback: string;
  /** pergunta essencial que precisa continuar presente (determinística) */
  question: string | null;
  /** palavras-chave que a mensagem final precisa conter (ex.: ["largura", "comprimento"]) */
  keyTerms: string[];
  /** fatos confirmados que podem ser citados (únicos números permitidos) */
  facts: string[];
  /** o que NÃO perguntar de novo / não mencionar */
  avoid?: string[];
  /** emoji sugerido para o assunto (🎨 📦 🛠️ 📏 💰 ✅ 📅 💡) */
  topicEmoji?: string | null;
  /** pode cumprimentar? (não repetir saudação a cada mensagem) */
  greet?: boolean;
  /** últimas mensagens do bot, para não repetir a mesma frase */
  recent?: string[];
  /** nomes que podem aparecer (quem está conversando, clientes já citados) */
  names?: string[];
}

/** Preferências de comunicação (explícitas; nada de diagnóstico nas mensagens). */
export const COMMUNICATION_PROFILE = [
  "frases curtas e claras, vocabulário simples e respeitoso, tom acolhedor, curioso e leve",
  "parágrafos curtos separados por uma linha em branco; a pergunta no último parágrafo",
  "uma única pergunta por mensagem",
  "no máximo um ou dois emojis, ligados ao assunto (🎨 pintura, 📦 materiais, 🛠️ trabalho manual, 📏 medidas, 💰 valores, ✅ confirmação, 📅 agenda, 💡 ideia)",
  "sem pressão, sem cobrança, sem linguagem técnica, sem tom infantil",
].join("; ");

export const COMPOSE_SYSTEM_PROMPT = `Você escreve mensagens de Telegram de um assistente para Adriano, artesão experiente de pintura e restauração de móveis, em português do Brasil.
Estilo: ${COMMUNICATION_PROFILE}.
Regras obrigatórias:
- Mantenha EXATAMENTE o objetivo e a pergunta essencial informados; não troque o assunto nem peça outro dado.
- Não invente fatos, números, medidas, preços, nomes ou datas: só cite o que está em "fatos".
- Não repita perguntas listadas em "evitar". Não use termos de sistema (campo, cadastro, inválido, processando).
- Não mencione condições pessoais, saúde ou diagnóstico. Não trate o Adriano como criança.
- Só reescreva o "texto_de_referencia": não acrescente situações, histórias, exemplos ou comentários que não estejam nele. Você é um assistente: não fale de família, casa ou vida pessoal.
- Se "pode_cumprimentar" for falso, não comece com saudação.
Responda só com JSON: {"text": "<mensagem>"}`;

export const COMPOSE_JSON_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
} as const;

export function composeUserPrompt(plan: MessagePlan): string {
  return JSON.stringify({
    objetivo: plan.purpose,
    pergunta_essencial: plan.question,
    palavras_obrigatorias: plan.keyTerms,
    fatos: plan.facts,
    evitar: plan.avoid ?? [],
    emoji_sugerido: plan.topicEmoji ?? null,
    pode_cumprimentar: !!plan.greet,
    texto_de_referencia: plan.fallback,
    mensagens_recentes_nao_repetir: (plan.recent ?? []).slice(-3),
  });
}

// ------------------------------------------------------------------ validação

const FORBIDDEN = [
  /autis/i,
  /espectro/i,
  /defici[eê]ncia/i,
  /neurodiverg/i,
  /campo (obrigat|vazio)/i,
  /inv[aá]lid[oa]/i,
  /processando/i,
  /pergunta \d+ de \d+/i,
  /informe o valor/i,
  /n[aã]o h[aá] cadastro/i,
  /\b(amiguinho|amiguinha|fofinho|fofinha|bonitinho|campe[aã]ozinho|queridinho)\b/i,
  /\b(voc[eê] ainda n[aã]o respondeu|responda agora|por sua causa)\b/i,
];

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

function numbersOf(text: string): string[] {
  return (normalizeText(text).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
}

const GREETING = /^\s*(oi|ol[aá]|bom dia|boa tarde|boa noite|e a[ií])\b/i;

/** Garante espaçamento: a pergunta vai para um parágrafo próprio, separado por linha em branco. */
export function spaceParagraphs(text: string): string {
  let t = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!t.includes("\n\n") && t.includes("?")) {
    const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];
    // emoji solto no começo de uma frase pertence ao fim da frase anterior ("R$ 85,00. 🎨 Essa lata...")
    for (let i = 1; i < sentences.length; i++) {
      const lead = /^((?:\p{Extended_Pictographic}️?\s*)+)/u.exec(sentences[i]!)?.[1];
      if (lead) {
        sentences[i - 1] = `${sentences[i - 1]} ${lead.trim()}`;
        sentences[i] = sentences[i]!.slice(lead.length).trim();
      }
    }
    const qi = sentences.findIndex((s) => s.includes("?"));
    if (qi > 0) t = `${sentences.slice(0, qi).join(" ")}\n\n${sentences.slice(qi).join(" ")}`;
  }
  return t;
}

export interface ComposeCheck {
  ok: boolean;
  text: string;
  reasons: string[];
}

/** Valida (e normaliza o espaçamento de) uma mensagem gerada pela LLM. */
export function validateComposed(plan: MessagePlan, raw: unknown): ComposeCheck {
  const candidate = typeof raw === "string" ? raw : raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string" ? (raw as { text: string }).text : "";
  const reasons: string[] = [];
  const text = spaceParagraphs(candidate);
  if (text.length < 8 || text.length > 700) reasons.push("tamanho");
  for (const re of FORBIDDEN) if (re.test(text)) reasons.push(`termo proibido: ${re.source}`);
  const allowedNums = new Set([...numbersOf(plan.fallback), ...numbersOf(plan.question ?? ""), ...plan.facts.flatMap(numbersOf)]);
  for (const n of numbersOf(text)) if (!allowedNums.has(n)) reasons.push(`número inventado: ${n}`);
  if (/r\$/i.test(text) && !plan.facts.some((f) => /r\$/i.test(f)) && !/r\$/i.test(plan.fallback)) reasons.push("valor em dinheiro inventado");
  const questions = (text.match(/\?/g) ?? []).length;
  if (plan.question && questions !== 1) reasons.push(`perguntas: ${questions}`);
  if (!plan.question && questions > 1) reasons.push(`perguntas: ${questions}`);
  const norm = normalizeText(text);
  for (const k of plan.keyTerms) {
    const stem = normalizeText(k).slice(0, Math.max(4, Math.min(6, k.length)));
    if (!norm.includes(stem)) reasons.push(`faltou "${k}"`);
  }
  if (countEmojis(text) > 2) reasons.push("emojis demais");
  if (!plan.greet && GREETING.test(text)) reasons.push("saudação repetida");
  if ((plan.recent ?? []).some((r) => normalizeText(r) === norm)) reasons.push("repetiu mensagem recente");
  if (PERSONAL_STORY.test(norm)) reasons.push("história pessoal inventada");
  if (FORMAL_OR_PT_PT.test(norm)) reasons.push("tratamento formal ou português de Portugal");
  // quem faz a ação não pode mudar ("como o cliente vai pagar?" ≠ "preferes pagar?")
  const qNorm = normalizeText(`${plan.question ?? ""} ${plan.fallback}`);
  if (/\bcliente\b/.test(qNorm) && !/\bcliente\b/.test(norm) && !(plan.names ?? []).slice(1).some((n) => n && norm.includes(normalizeText(n)))) reasons.push("trocou de quem é a ação (cliente)");
  reasons.push(...groundingIssues(plan, text));
  return { ok: reasons.length === 0, text, reasons };
}

// ------------------------------------------------------------------ ancoragem
/*
 * A IA só pode REESCREVER: cada frase precisa ser feita do que o código mandou (texto de
 * referência, pergunta, fatos, nome) mais palavras de tom/ligação. Frases com conteúdo novo
 * ("alguém do meu filho, brincando, quebrou a perna da mesa") são recusadas — não há como
 * validar um fato inventado, então o conteúdo novo em si é o defeito. A frase da pergunta
 * tem um pouco mais de folga (sinônimos), as demais quase nenhuma.
 */

/** o assistente não tem família, casa nem vida pessoal */
const PERSONAL_STORY = /\b(meu|minha|meus|minhas|nosso|nossa)\s+(filh|esposa|marido|mulher|mae|pai|irma|irmao|neto|neta|sobrinh|famil|vizinh|cachorr|gat|amig)/;

/** o Adriano é tratado por "você", em português do Brasil */
const FORMAL_OR_PT_PT = /\b(o senhor|a senhora|ao senhor|do senhor|preferes|queres|tens|podes|sabes|(diga|diz|conte|informe)[- ]me|o traz|a traz|busca[- ]l[oa])\b/;

const TONE_WORDS = new Set(
  "perfeito perfeita otimo otima beleza certinho entendi entendido anotei anotado anotada combinado tranquilo tranquila valeu obrigado obrigada legal bacana maravilha show joia agora entao menos cerca aproximadamente sobre ainda depois preciso precisar saber queria gostaria seguir seguimos vamos proxima proximo pergunta coisa coisinha rapidinho rapida rapido momento ajuda ajudar contar conta dizer falar melhor tambem aquele aquela assim parte ultima ultimo falta faltando pouco pouquinho quase terminar continuar orcamento servico movel peca pecas moveis conferir confirmar pronto pronta registrado registrei guardei guardado deixei deixar pendente problema certeza sabe acha achar lembra lembrar quando puder ideia importante fechar conta contas calculo calcular entender boa bom caso".split(" "),
);

const STOP = new Set(["voce", "voces", "qual", "quais", "quanto", "quantos", "quantas", "como", "esta", "estao", "essa", "esse", "isso", "pode", "para", "mais", "tem", "sao", "dele", "dela", "nela", "nele", "aqui", "seria", "fica", "ficar", "vai", "precisa", "porque", "onde", "tudo", "todo", "toda", "algum", "alguma", "nenhum", "nenhuma", "outro", "outra", "muito", "muita", "seus", "suas", "este", "estes", "esses", "essas", "foram", "estava", "sendo", "sido", "tinha", "temos", "vamos", "favor"]);

const stem = (w: string): string => w.slice(0, 5);

function contentWords(text: string): string[] {
  return normalizeText(text).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 5 && !STOP.has(w));
}

function groundingIssues(plan: MessagePlan, text: string): string[] {
  const allowed = new Set<string>();
  for (const src of [plan.fallback, plan.question ?? "", ...plan.facts, ...plan.keyTerms, ...(plan.names ?? []), "Adriano"]) for (const w of contentWords(src)) allowed.add(stem(w));
  for (const w of TONE_WORDS) allowed.add(stem(w));
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const issues: string[] = [];
  for (const s of sentences) {
    const novel = contentWords(s).filter((w) => !allowed.has(stem(w)));
    const limit = s.includes("?") ? 3 : 1;
    if (novel.length > limit) issues.push(`frase sem base no contexto: ${novel.slice(0, 4).join(", ")}`);
  }
  return issues;
}

/** Palavras-chave de uma pergunta (para conferir que a reescrita não perdeu o propósito). */
export function keyTermsOf(question: string, extra: string[] = []): string[] {
  const stop = new Set(["voce", "qual", "quais", "quanto", "quantos", "quantas", "como", "esta", "essa", "esse", "isso", "pode", "para", "pra", "mais", "menos", "uma", "umas", "uns", "com", "sem", "que", "tem", "sao", "dele", "dela", "nela", "nele", "aqui", "ainda", "agora", "tambem", "sobre", "seria", "fica", "ficar", "vai", "precisa", "dizer", "falar", "mais", "ou", "de", "do", "da", "dos", "das", "no", "na", "por", "favor", "me"]);
  const words = normalizeText(question).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 5 && !stop.has(w));
  return [...new Set([...extra, ...words.slice(0, 2)])];
}
