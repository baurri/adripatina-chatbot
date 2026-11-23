import { z } from "zod";
import { extractLengths, extractLooseMoney, extractMoney, normalizeText, extractCount } from "@adripatina/shared";
import { findDescriptors, findFurniture, findTechniques } from "./vocabulary.js";

export const INTENTS = [
  "new_job",
  "register_expense",
  "register_payment",
  "query_status",
  "list_jobs",
  "job_progress",
  "agenda",
  "help",
  "menu",
  "greeting",
  "cancel",
  "back",
  "pause",
  "correction",
  "dont_know",
  "yes",
  "no",
  "unknown",
] as const;
export type Intent = (typeof INTENTS)[number];

/**
 * Entidades extraídas. Nenhum campo de preço FINAL existe aqui: valores em
 * dinheiro só aparecem como "quantia mencionada" (despesa/pagamento), sempre
 * confirmados pelo usuário antes de registrar.
 */
export const EntitiesSchema = z.object({
  furnitureType: z.string().optional(),
  furnitureQuantity: z.number().int().positive().optional(),
  doors: z.number().int().nonnegative().optional(),
  drawers: z.number().int().nonnegative().optional(),
  descriptors: z.array(z.string()).default([]),
  techniques: z.array(z.string()).default([]),
  clientName: z.string().optional(),
  /** todos os clientes citados, na ordem (ex.: "seu Roberto e Dona Jo") */
  clientNames: z.array(z.string()).default([]),
  amountCents: z.number().int().positive().optional(),
  lengthsM: z.array(z.string()).default([]),
  sizeClass: z.enum(["pequeno", "medio", "grande"]).optional(),
  condition: z.string().optional(),
  materialStatus: z.enum(["tem_tudo", "tem_parte", "precisa_comprar"]).optional(),
  method: z.enum(["pincel", "rolo", "pistola"]).optional(),
  surfaces: z.enum(["externa", "interna_externa"]).optional(),
  progress: z.enum(["iniciado", "em_execucao", "concluido", "entregue", "nao_iniciado", "parado"]).optional(),
  /** a frase descreve o ESTADO FÍSICO da peça ("precisa de reparos", "está riscada") */
  conditionStatement: z.boolean().default(false),
  materialMention: z.string().optional(),
  explicitNew: z.boolean().default(false),
  referencesExisting: z.boolean().default(false),
});
export type Entities = z.infer<typeof EntitiesSchema>;

export const NluResultSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1),
  entities: EntitiesSchema,
  source: z.enum(["rules", "ai", "merged"]),
});
export type NluResult = z.infer<typeof NluResultSchema>;

const HONORIFIC = "(?:dona|seu|dom|sr|sra|senhora|senhor|doutor|doutora|dr|dra|tia|tio|professora|professor)";
const NAME_STOP = new Set([
  "que", "para", "pra", "pro", "e", "com", "de", "do", "da", "dos", "das", "quer", "pagou", "me", "ja", "uma", "um", "a", "o",
  "hoje", "ontem", "agora", "reais", "real", "deu", "mandou", "trouxe", "vai", "esta", "ta", "ficou", "dela", "dele", "no", "na",
  "por", "porque", "mas", "pediu", "falou", "disse", "tem", "tinha", "precisa", "aquela", "aquele", "grande", "pequena",
  "trouxeram", "querem", "pediram", "mandaram", "deixou", "deixaram", "vao", "tem", "comprou", "compraram", "ligou", "ligaram",
  "precisam", "levou", "levaram", "chegou", "chegaram", "sao", "estao", "ele", "ela", "eles", "elas", "tambem", "ai", "aqui",
  // verbos de serviço no infinitivo nunca são sobrenome ("pra dona Ana lixar e pintar")
  "lixar", "pintar", "envernizar", "restaurar", "reformar", "patinar", "decapar", "encerar", "dourar", "fazer", "consertar",
  "arrumar", "limpar", "buscar", "entregar", "pegar", "levar", "trazer", "passar", "orcar", "cobrar", "ver", "olhar",
  "nao", "so", "quanto", "acho", "tipo", "terca", "segunda", "quarta", "quinta", "sexta", "sabado", "domingo", "amanha",
]);

/** verbo conjugado no lugar do sobrenome ("Dona Jo trouxeram") */
const VERB_LIKE = /(aram|eram|iram|ando|endo|indo|ou|eu)$/;
/** verbos comuns logo depois de "cliente" ("cliente traz", "cliente quer", "cliente vai buscar") */
const CLIENT_ACTION = /^(deix\w*|traz\w*|trouxe|busc\w*|peg\w*|retir\w*|lev\w*|vai|vem|vao|quer|queria|pediu|pede|mandou|manda|falou|fala|disse|ligou|pagou|paga|achou|acha|gostou|gosta|tem|tinha|precisa|ficou|esta|ta|e|eh|nao|ja|so|mesmo|mesma|chegou|aceitou|recusou|prefere|escolheu|marcou|combinou)$/;

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Todos os clientes com pronome de tratamento, na ordem: "do seu Roberto e Dona Jo" → ["Seu Roberto", "Dona Jo"]. */
export function extractClientNames(text: string): string[] {
  const norm = normalizeText(text).replace(/[.,!?;:]/g, " ");
  const re = new RegExp(`\\b(${HONORIFIC})\\s+([a-z]+(?:\\s+[a-z]+)?)`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const nameTokens: string[] = [];
    for (const t of (m[2] ?? "").split(" ")) {
      if (!t || NAME_STOP.has(t)) break;
      if (nameTokens.length > 0 && VERB_LIKE.test(t)) break;
      nameTokens.push(t);
    }
    if (nameTokens.length === 0) continue;
    const name = `${titleCase(m[1]!)} ${titleCase(nameTokens.join(" "))}`;
    if (!out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

export type ProgressKind = "iniciado" | "em_execucao" | "concluido" | "entregue" | "nao_iniciado" | "parado";

/**
 * Andamento OPERACIONAL do serviço. Exige verbo de ação do artesão sobre o trabalho
 * ou pedido explícito de marcação — palavras soltas ("reparo", "melhor", "pronto")
 * nunca bastam. Estado físico da peça não é andamento.
 */
/** Verbos/estados de andamento que uma negação próxima anula ("ainda não terminei"). */
const PROGRESS_WORDS = String.raw`(?:comecei|comecamos|iniciei|terminei|acabei|conclui|finalizei|entreguei|entregamos|levei|ficou pront\w*|(?:esta|ta) pront\w*|foi entregue|buscou|buscaram|estou fazendo|to fazendo|estou lixando|to lixando)`;
const NEGATED_PROGRESS = new RegExp(String.raw`\b(?:nao|nem|ainda nao|nunca)\s+(?:\w+\s+){0,3}?${PROGRESS_WORDS}`, "g");

export function detectProgress(text: string): ProgressKind | undefined {
  const raw = normalizeText(text);
  const mark = /\b(marca|marcar|marque|coloca|colocar|coloque|bota|botar|muda|mudar|pode marcar|pode colocar|deixa)\b/;
  if (/\b(ainda nao comecei|nao comecei|nem comecei|ainda nao iniciei|nao iniciei)\b/.test(raw)) return "nao_iniciado";
  // negação anula o verbo: "ainda não terminei", "não está pronta", "não entreguei" → sem transição
  // condição futura não é andamento: "depois de pronto ele busca", "quando ficar pronta" (teste real 23/11/2026)
  const n = raw.replace(NEGATED_PROGRESS, " ").replace(/\b(?:depois de|depois que|quando|qdo|qnd|assim que|ate)\s+(?:\w+\s+){0,2}?(?:pront|termin|acab)\w*/g, " ");
  // intenção futura não é andamento: "vou começar", "quis dizer que vou começar"
  if (/\b(vou|vamos|pretendo|quero|vai)\s+(comecar|iniciar|terminar|entregar|fazer)\b/.test(n) && !/\b(comecei|iniciei|terminei|entreguei)\b/.test(n)) return undefined;
  if (/\b(o (trabalho|servico) (esta|ta) parado|parei o (trabalho|servico))\b/.test(n)) return "parado";
  if (/\b(entreguei|foi entregue|ja entreguei|levei de volta|o cliente (ja )?buscou|ja buscaram)\b/.test(n)) return "entregue";
  if (mark.test(n) && /\bentregue\b/.test(n)) return "entregue";
  if (/\b(terminei|acabei (o|a|de fazer)|conclui|finalizei|ficou pront[oa]|(ja )?(esta|ta) pront[oa])\b/.test(n)) return "concluido";
  if (mark.test(n) && /\b(concluid[oa]|pront[oa]|terminad[oa]|finalizad[oa])\b/.test(n)) return "concluido";
  if (mark.test(n) && /\b(em execucao|em andamento|iniciad[oa]|comecad[oa])\b/.test(n)) return "em_execucao";
  if (/\b(comecei|iniciei)\b/.test(n)) return "iniciado";
  if (/\b(estou|to|ja estou) (fazendo|lixando|pintando|envernizando|trabalhando|mexendo)\b/.test(n)) return "iniciado";
  return undefined;
}

/** Descrição do ESTADO FÍSICO de uma peça (condição), não do andamento do trabalho. */
export function detectConditionStatement(text: string): boolean {
  const n = normalizeText(text);
  return (
    /\bprecis\w*\s+(de\s+)?(uns\s+|um\s+|alguns\s+|algum\s+|pequenos\s+|bastante\s+|muito\s+)?(reparos?|conserto|consertos|ajustes?|restauro|massa|cola)\b/.test(n) ||
    /\b(estragad|riscad|arranhad|quebrad|descascand|desgastad|manchad|rachad|lascad|empenad|podre|cupim|carcomid|conservad|judiad|detonad)\w*/.test(n) ||
    /\b(esta|estao|ta|tao|ficou|ficaram)\s+(bem\s+|muito\s+|um pouco\s+)?(melhor|melhores|bo[ma]|boazinha|bonzinho|bonzinha|razoavel|bons|boas|ruim|ruins|otim[oa]s?|pessim[oa]s?|inteir[oa]s?)\b/.test(n) ||
    /\b(em bom estado|em mau estado|tampo (esta|ta) ruim|vai precisar lixar bastante|tem partes? quebradas?)\b/.test(n)
  );
}

/** Extrai nome de cliente: "da dona Maria", "do seu João", "cliente Ana", "a dona Ana pagou". */
export function extractClientName(text: string): string | undefined {
  const norm = normalizeText(text).replace(/[.,!?;:]/g, " ");
  const patterns = [
    new RegExp(`\\b(${HONORIFIC})\\s+([a-z]+(?:\\s+[a-z]+)?)`),
    /\bcliente\s+(?:e\s+|eh\s+|chama\s+|se chama\s+)?(?:a\s+|o\s+)?([a-z]+(?:\s+[a-z]+)?)/,
  ];
  for (const re of patterns) {
    const m = re.exec(norm);
    if (!m) continue;
    const honor = m.length > 2 ? m[1] : undefined;
    const nameRaw = (m.length > 2 ? m[2] : m[1]) ?? "";
    // "cliente deixa comigo", "cliente traz": depois de "cliente" veio um verbo, não um nome (teste real 23/11/2026)
    if (!honor && CLIENT_ACTION.test(nameRaw.split(" ")[0] ?? "")) continue;
    const tokens = nameRaw.split(" ").filter((t) => t && !NAME_STOP.has(t));
    // mantém apenas tokens iniciais consecutivos que não são stopwords
    const nameTokens: string[] = [];
    for (const t of nameRaw.split(" ")) {
      if (!t || NAME_STOP.has(t)) break;
      if (nameTokens.length > 0 && VERB_LIKE.test(t)) break;
      nameTokens.push(t);
    }
    if (nameTokens.length === 0 && tokens.length === 0) continue;
    const name = titleCase((nameTokens.length ? nameTokens : tokens.slice(0, 1)).join(" "));
    return honor ? `${titleCase(honor)} ${name}` : name;
  }
  return undefined;
}

const YES = /^(sim|s|isso|isso mesmo|e essa|e esse|e ela|e ele|e essa mesma|essa mesma|esse mesmo|exato|exatamente|pode|pode sim|claro|ok|okay|certo|correto|confirmo|confirma|confirmar|aham|uhum|positivo|isso ai|ta certo|beleza|sim e essa)\b/;
const NO = /^(nao|n|negativo|nao e|nao e essa|nao e esse|errado|nada disso)\b/;
// "não tenho as medidas agora", "não medi" também valem como "não sei" (sem pressionar)
const DONT_KNOW = /\b(nao sei|sei la|nao tenho certeza|nao lembro|nao faco ideia|talvez|nao tenho (as |a )?medidas?|nao medi|sem (as )?medidas?|nao tenho como medir)\b/;

function classify(norm: string, e: Entities): { intent: Intent; confidence: number } {
  const trimmed = norm.trim();
  if (/^\/?(start|menu|inicio)\b/.test(trimmed)) return { intent: "menu", confidence: 1 };
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(trimmed) && trimmed.split(" ").length <= 4)
    return { intent: "greeting", confidence: 0.9 };
  if (/^\/?(ajuda|help)\b|como (funciona|usa)/.test(trimmed)) return { intent: "help", confidence: 0.95 };
  // "esquece o aparador" cancela UM item, não a conversa inteira: sem objeto → universal; com objeto → escopo
  if (/^(cancelar|cancela|esquece|deixa pra la|desisto)\b/.test(trimmed)) return e.furnitureType ? { intent: "cancel", confidence: 0.6 } : { intent: "cancel", confidence: 0.95 };
  if (/^(voltar|volta|anterior)\b/.test(trimmed)) return { intent: "back", confidence: 0.95 };
  if (/\b(continuar depois|continuo depois|depois a gente continua|mais tarde|pausar|pausa)\b/.test(trimmed))
    return { intent: "pause", confidence: 0.9 };
  if (/^(corrigir|corrige)\b|\b(na verdade|errei|me enganei|corrigindo|nao e .+ e |(muda|mudar|troca|trocar) (pra|para|por)|melhor colocar|coloca .+ no lugar)\b/.test(trimmed))
    return { intent: "correction", confidence: 0.85 };

  const money = e.amountCents !== undefined;
  if (/\b(recebi|pagou|me pagou|deu de entrada|deu entrada|adiantou|mandou o pix|fez o pix|fez um pix|depositou|acertou|quitou)\b/.test(trimmed) && money)
    return { intent: "register_payment", confidence: 0.9 };
  if (/\b(gastei|comprei|paguei|compra de|comprado|torrei)\b/.test(trimmed) && (money || e.materialMention))
    return { intent: "register_expense", confidence: money ? 0.9 : 0.82 };
  if (/\b(registrar|anotar) (gasto|despesa|compra)\b/.test(trimmed)) return { intent: "register_expense", confidence: 0.85 };
  if (/\b(registrar|anotar) (pagamento|recebimento)\b/.test(trimmed)) return { intent: "register_payment", confidence: 0.85 };

  // andamento só com evidência operacional explícita (ver detectProgress)
  if (e.progress) return { intent: "job_progress", confidence: e.progress === "em_execucao" || e.progress === "entregue" ? 0.9 : 0.85 };

  if (/\b(como (esta|ta|anda)|andamento|situacao|quanto falta|saldo|quanto (ela|ele) deve|ja pagou)\b/.test(trimmed))
    return { intent: "query_status", confidence: 0.8 };
  if (/\b(meus servicos|meus trabalhos|lista de servicos|o que tenho|quais servicos)\b/.test(trimmed)) return { intent: "list_jobs", confidence: 0.9 };
  if (/\b(agenda|o que tenho (pra|para) hoje|tarefas)\b/.test(trimmed)) return { intent: "agenda", confidence: 0.85 };

  if (/\b(novo orcamento|fazer um orcamento|fazer orcamento|orcamento novo)\b/.test(trimmed)) return { intent: "new_job", confidence: 0.95 };
  const jobVerb = /\b(peguei|recebi|vou pintar|vou fazer|vou restaurar|vou reformar|tenho (um|uma|aquela|aquele|a|o)|quer que eu|trouxe|chegou|pegar|precisa de|precisa)\b/.test(trimmed);
  if (e.furnitureType && (jobVerb || e.techniques.length > 0)) return { intent: "new_job", confidence: jobVerb ? 0.9 : 0.75 };
  if (e.furnitureType) return { intent: "new_job", confidence: 0.55 };
  // móvel sem nome ("um móvel antigo que não sei o nome", "um negócio da dona Ana"): serviço novo, perguntar qual é
  if (/\b(peguei|recebi|vou pintar|vou fazer|vou restaurar|vou reformar|trouxe|chegou)\b/.test(trimmed) && /\b(movel|moveis|peca|negocio|treco)\b/.test(trimmed))
    return { intent: "new_job", confidence: 0.75 };

  if (DONT_KNOW.test(trimmed)) return { intent: "dont_know", confidence: 0.9 };
  if (YES.test(trimmed)) return { intent: "yes", confidence: 0.9 };
  if (NO.test(trimmed)) return { intent: "no", confidence: 0.9 };
  return { intent: "unknown", confidence: 0.2 };
}

/** Intérprete por regras (pt-BR). Funciona sem IA e é o fallback quando a IA falha. */
export function interpretRules(text: string): NluResult {
  const norm = normalizeText(text);
  // valor sem "reais" só quando vem logo depois de verbo de dinheiro ("por 150", "me pagou 85,90")
  const money = extractMoney(text) ?? (/\b(comprei|paguei|gastei|pagou|me pagou|recebi|custou|deu)\b/.test(norm) ? extractLooseMoney(text) : null);
  const lengths = extractLengths(text).map((l) => l.meters.toString());
  const furnitureType = findFurniture(text);
  const techniques = findTechniques(text);
  const descriptors = findDescriptors(text);
  const e: Entities = {
    furnitureType,
    descriptors,
    techniques,
    clientName: extractClientName(text),
    clientNames: extractClientNames(text),
    conditionStatement: detectConditionStatement(text),
    amountCents: money?.cents,
    lengthsM: lengths,
    explicitNew: /\b(outra|outro|mais uma|mais um|segunda|segundo|nova|novo) (cristaleira|comoda|cadeira|mesa|armario|guarda|estante|movel|peca|[a-z]+)\b/.test(norm) && !/\b(novo orcamento)\b/.test(norm),
    referencesExisting: /\b(aquela|aquele|aquela mesma|daquela|daquele|a mesma|o mesmo|lembra|ja falei|ja te falei|de novo)\b/.test(norm),
  };
  const doors = extractCount(text, /^portas?$/);
  if (doors !== null) e.doors = doors;
  const drawers = extractCount(text, /^gavetas?$/);
  if (drawers !== null) e.drawers = drawers;
  if (/\b(pequen[oa]s?|pequenininh[oa])\b/.test(norm)) e.sizeClass = "pequeno";
  else if (/\b(medi[oa])\b/.test(norm)) e.sizeClass = "medio";
  else if (/\b(grande|enorme)\b/.test(norm)) e.sizeClass = "grande";
  if (/\b(ja tenho|tenho (o|a) (material|tinta|verniz)|tenho sobrando|sobrou|tenho em casa|tenho tudo)\b/.test(norm)) e.materialStatus = "tem_tudo";
  if (/\b(tenho uma parte|tenho um pouco|tenho parte|falta um pouco)\b/.test(norm)) e.materialStatus = "tem_parte";
  if (/\b(preciso comprar|vou precisar comprar|vou ter que comprar|tenho que comprar|nao tenho)\b/.test(norm)) e.materialStatus = "precisa_comprar";
  // "não é pincel, é rolo": o método negado não conta (teste real 23/11/2026)
  const mNorm = norm.replace(/\bnao (?:e |eh |vai ser |sera |uso |vou usar |quero )?(?:o |a |com )?(pincel|trincha|rolo|pistola|compressor)\b/g, " ");
  if (/\b(pincel|trincha)\b/.test(mNorm)) e.method = "pincel";
  else if (/\brolo\b/.test(mNorm)) e.method = "rolo";
  else if (/\b(pistola|compressor)\b/.test(mNorm)) e.method = "pistola";
  if (/\b(por dentro|dentro e fora|interna|parte de dentro)\b/.test(norm)) e.surfaces = "interna_externa";
  else if (/\b(so por fora|so fora|parte de fora|externa)\b/.test(norm)) e.surfaces = "externa";
  const progress = detectProgress(text);
  if (progress) e.progress = progress;
  const matMention = /\b(tinta|verniz|lixa|massa|cera|betume|thinner|solvente|folha de ouro|fundo|cola|pincel|rolo)\b/.exec(norm);
  if (matMention) e.materialMention = matMention[1];
  const { intent, confidence } = classify(norm, e);
  return { intent, confidence, entities: e, source: "rules" };
}
