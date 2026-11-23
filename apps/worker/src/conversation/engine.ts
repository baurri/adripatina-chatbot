import {
  FIELD_EXPLANATION,
  AMBIGUOUS_FURNITURE,
  ambiguousFurnitureKind,
  asksForPrice,
  findFurniture,
  resolveAmbiguousFurniture,
  findFurnitureMentions,
  withoutDescriptiveFurniture,
  keyTermsOf,
  findMethods,
  furnitureHasInterior,
  isQuestionToBot,
  naturalAck,
  extractNotes,
  detectMeta,
  type MetaTurn,
  mergeNotes,
  naturalQuestion,
  type ParsedAnswer,
  type QuestionContext,
  clientMatches,
  decideMatch,
  describeFact,
  findDescriptors,
  furnitureLabel,
  labelDimensions,
  parseAnswer,
  questionFor,
  techniquesLabel,
  type Button,
  type NluResult,
  type ProjectMention,
} from "@adripatina/conversations";
import { nextQuestion, OPTIONAL_FIELDS, QUESTION_ORDER, type FactValueMap, type JobStatus, type ProjectField, JOB_STATUS_LABEL, ACTIVE_JOB_STATUSES } from "@adripatina/domain";
import { extractCount, formatBRL, formatDateBR, normalizeText, parseBareAmountCents } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { aiInterpretAnswer, interpret } from "../ai/service.js";
import { chooseAmong, composeMessage } from "../ai/orchestrator.js";
import type { LoadedCatalog } from "../repos/furniture.js";
import { askCatalogStep, catalogAnswer, catalogTypeSync, classifyFurniture, ensureCatalog, nextCatalogStep, nominalSettled } from "./catalog-flow.js";
import type { OutgoingMessage } from "../ports.js";
import {
  addJobEvent,
  createJob,
  getJob,
  jobBalance,
  jobPhrase,
  listActiveJobs,
  loadCandidates,
  setFact,
  summarizeJob,
  touchJob,
  transitionJob,
  type Job,
} from "../repos/jobs.js";
import { GOAL_FLOWS, linkMessageToJob, loadSession, saveSession, type MentionSnapshot, type PendingQuestion, type PendingQuestionType, type Session } from "../repos/sessions.js";
import type { User } from "../repos/users.js";
import { financialIdempotencyKey, recordExpense, recordPayment, recordPurchase } from "../repos/finance.js";
import { getActiveSettings, getMaterialByKey, listMethods } from "../repos/catalog.js";
import { recordSuspicion } from "../services/duplicates.js";
import { learnFromConfirmedPurchase, recordMaterialSourceObservation, recordTechniqueTimeObservation } from "../services/learning.js";
import {
  approveQuote,
  artisanQuoteSummary,
  calculateQuote,
  DomainError,
  getQuote,
  issueDocuments,
  latestQuoteForJob,
  markQuoteOutcome,
  previewPriceRange,
  type PriceRangePreview,
  sendDocumentToArtisan,
  submitForReview,
} from "../services/quotes.js";
import { handleAdminCommand } from "./admin-commands.js";
import { decideRoute, type RoutingDecision } from "./router.js";
import { dataCollectionText, isPlausibleCollectionAnswer, onDataCollectionCallback, releaseCollection } from "./data-collection-flow.js";
import { missingPriceKeys } from "../services/material-pricing.js";
import { askCurrent as askPricingCurrent, isPlausiblePricingAnswer, onPricingCallback, pricingText, startPricing, targetPhrase } from "./pricing-flow.js";
import { onQuoteDecisionCallback, presentQuoteDecision, quoteDecisionText, reaskQuoteDecision } from "./quote-decision-flow.js";
import {
  askQuoteRequestAgain,
  buildDraft,
  isPlausibleQuoteRequestAnswer,
  onQuoteRequestCallback,
  quoteRequestCalculate,
  quoteRequestText,
  shouldStartQuoteRequest,
  startQuoteRequest,
} from "./quote-request-flow.js";

export interface EngineInput {
  user: User;
  chatId: string;
  kind: "text" | "voice" | "photo" | "callback";
  text: string;
  inboundMessageId: string;
  photo?: { attachmentId: string; hash: string; visionHint?: string | null };
}

const RESUME_GAP_HOURS = 6;
/** campos que costumam ser respondidos antes da hora, com respostas bem reconhecíveis */
const OUT_OF_ORDER_FIELDS: ProjectField[] = ["payment_terms", "deadline", "application_method"];

export const MAIN_MENU: Button[][] = [
  [
    { text: "Novo orçamento", data: "cmd:new_quote" },
    { text: "Meus serviços", data: "cmd:list_jobs" },
  ],
  [
    { text: "Registrar gasto", data: "cmd:expense" },
    { text: "Registrar pagamento", data: "cmd:payment" },
  ],
  [
    { text: "Agenda", data: "cmd:agenda" },
    { text: "Ajuda", data: "cmd:help" },
  ],
];

const MATERIAL_WORDS: Record<string, string> = {
  tinta: "tinta_esmalte",
  verniz: "verniz",
  lixa: "lixa",
  massa: "massa_madeira",
  cera: "cera",
  betume: "betume_patina",
  thinner: "solvente",
  solvente: "solvente",
  "folha de ouro": "folha_ouro",
  fundo: "fundo_preparador",
  cola: "cola_mordente",
};
/** artigo de cada material na conversa ("a tinta", "o verniz") */
const MATERIAL_ARTICLE: Record<string, string> = { tinta: "a", lixa: "a", massa: "a", cera: "a", "folha de ouro": "a", cola: "a" };
const TRANSPORT_RE = /\b(gasolina|combustivel|frete|uber|taxi|estacionamento|pedagio|onibus|carreto)\b/;

export class Conversation {
  readonly out: OutgoingMessage[] = [];
  /** confirmação curta da última resposta, enviada junto com a próxima pergunta */
  ack: string | null = null;
  /** observações novas da mensagem atual, anexadas ao próximo reconhecimento */
  notesAck: string | null = null;
  session!: Session;
  /** catálogo mestre de móveis (carregado sob demanda, uma vez por mensagem) */
  furnitureCatalog: LoadedCatalog | null = null;
  constructor(
    readonly ctx: Ctx,
    readonly input: EngineInput,
  ) {}

  get firstName(): string {
    return this.input.user.displayName.split(" ")[0] ?? "";
  }

  say(text: string, buttons?: Button[][]): void {
    this.out.push(buttons ? { text, buttons } : { text });
  }

  /** mensagens já enviadas neste turno (a IA não deve repetir a mesma frase) */
  recentBotTexts(): string[] {
    return this.out.map((o) => o.text).slice(-3);
  }

  /** decisão de roteamento da mensagem atual (auditoria) */
  routing: RoutingDecision | null = null;

  setPending(p: Omit<PendingQuestion, "askedAt">): void {
    this.session.context.pendingQuestion = { ...p, askedAt: this.ctx.clock().toISOString() };
  }

  clearPending(): void {
    delete this.session.context.pendingQuestion;
  }

  async run(): Promise<OutgoingMessage[]> {
    this.session = await loadSession(this.ctx, this.input.user.id);
    const gapHours = (this.ctx.clock().getTime() - new Date(this.session.lastActivityAt).getTime()) / 3_600_000;
    const resuming = gapHours >= RESUME_GAP_HOURS;

    // confirmações financeiras/associações antigas expiram: nada é gravado sem confirmação recente
    if (resuming && ["expense", "payment", "confirm_match", "choose_match", "confirm_new_similar", "disambiguate", "progress_confirm", "admin_confirm"].includes(this.session.flow)) {
      const wasFinance = this.session.flow === "expense" || this.session.flow === "payment";
      const stack = this.session.context.goalStack;
      if (stack?.length) {
        this.restoreGoal(stack.pop()!);
      } else {
        this.session.flow = this.session.activeJobId ? "collecting" : "idle";
        this.session.context = { questionHistory: this.session.context.questionHistory ?? [] };
      }
      if (wasFinance) this.say("Aquele registro que estávamos fazendo da outra vez não foi confirmado, então não anotei nada. Se quiser, é só me falar de novo.");
    }

    try {
      if (this.input.kind === "callback") await this.onCallback(this.input.text);
      else if (this.input.kind === "photo") await this.onPhoto();
      else await this.onText(this.input.text, resuming);
    } catch (err) {
      if (err instanceof DomainError) this.say(friendlyDomainError(err));
      else throw err;
    }
    await saveSession(this.ctx, this.session);
    if (this.session.activeJobId) await linkMessageToJob(this.ctx, this.input.inboundMessageId, this.session.activeJobId);
    return this.out;
  }

  // ------------------------------------------------------------------ texto
  /** A mensagem responde plausivelmente à pergunta pendente? (por tipo) */
  isPlausibleAnswer(text: string, nlu: NluResult): boolean {
    const flow = this.session.flow;
    // nesses fluxos qualquer resposta é dirigida à pergunta feita (o handler pede de novo se não entender)
    if (flow === "disambiguate" || flow === "contradiction") return true;
    if (flow === "quote_material_pricing") return isPlausiblePricingAnswer(this, text, nlu);
    if (flow === "data_collection") return isPlausibleCollectionAnswer(this, text, nlu);
    if (flow === "quote_request") return isPlausibleQuoteRequestAnswer(this, text, nlu);
    if (flow === "expense" || flow === "payment") return nlu.entities.amountCents !== undefined || ["yes", "no"].includes(nlu.intent) || /\d/.test(text);
    if (flow === "learning_time") return /\d|hora|nao sei|não sei|nao lembro|não lembro/i.test(text);
    if (flow === "intake") return parseAnswer("furniture_type", text).kind !== "unparsed";
    if ((flow === "collecting" || flow === "confirm_calc") && this.session.lastQuestion) {
      const field = this.session.lastQuestion;
      if (field === "condition" && nlu.entities.conditionStatement) return true;
      const ans = parseAnswer(field, text);
      if (ans.kind === "dont_know") return true;
      // campos de texto livre aceitam quase tudo: só são "plausíveis" sem intenção forte concorrente
      if (ans.kind === "value") return !["condition", "deadline", "payment_terms", "details"].includes(field) || nlu.intent === "unknown" || nlu.intent === "new_job" || nlu.entities.conditionStatement;
    }
    if (flow === "confirm_calc") return nlu.intent === "yes" || nlu.intent === "no";
    return false;
  }

  async logRouting(nlu: NluResult, decision: RoutingDecision): Promise<void> {
    this.routing = decision;
    const e = nlu.entities;
    const detail = {
      ...decision,
      flow: this.session.flow,
      requestId: this.ctx.requestId,
      entities: {
        furnitureType: e.furnitureType ?? null,
        clients: e.clientNames,
        techniques: e.techniques,
        amountCents: e.amountCents ?? null,
        progress: e.progress ?? null,
        conditionStatement: e.conditionStatement,
        materialStatus: e.materialStatus ?? null,
      },
      nluSource: nlu.source,
    };
    await this.ctx.db.run(
      "UPDATE conversation_messages SET intent = ?, confidence = ?, contextual_intent = ?, route = ?, routing_json = ? WHERE id = ?",
      nlu.intent,
      nlu.confidence,
      decision.contextualIntent,
      decision.route,
      JSON.stringify(detail),
      this.input.inboundMessageId,
    );
  }

  async onText(text: string, resuming: boolean): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) {
      const handled = await this.onSlashCommand(trimmed);
      if (handled) return;
    }
    // fora do roteiro (recomeçar, testar o áudio, conversa social): responde e volta ao ponto
    const meta = detectMeta(trimmed, { voice: this.input.kind === "voice" });
    if (meta && (await this.onMeta(meta))) return;
    const nlu = await interpret(this.ctx, trimmed);
    const decision = decideRoute({ nlu, flow: this.session.flow, pendingQuestion: this.session.context.pendingQuestion ?? null, plausibleAnswer: this.isPlausibleAnswer(trimmed, nlu) });
    await this.logRouting(nlu, decision);

    // retomada depois de horas/dias num objetivo de orçamento: lembrar onde paramos
    if (resuming && decision.route !== "pending_answer" && decision.route !== "universal" && (this.session.flow === "quote_material_pricing" || this.session.flow === "quote_request")) {
      return this.resumePrompt();
    }

    // pergunta proativa pendente + assunto claramente diferente: libera a conversa
    // (a solicitação continua aguardando, sem insistir)
    if (this.session.flow === "data_collection" && (decision.route === "global" || decision.route === "interruption" || decision.route === "fallback")) releaseCollection(this);

    switch (decision.route) {
      case "universal":
        return this.onUniversal(nlu.intent);
      case "expected_confirmation":
      case "pending_answer":
      case "active_goal":
        return this.continueFlow(trimmed, nlu, resuming);
      case "interruption":
        return this.interrupt(trimmed, nlu);
      case "global":
        return this.onGlobal(trimmed, nlu);
      default:
        return this.onFallback(trimmed, nlu);
    }
  }

  /** Fala fora do roteiro. Devolve false quando o fluxo normal deve tratar (ex.: "oi" sem nada em andamento). */
  async onMeta(meta: MetaTurn): Promise<boolean> {
    const busy = this.session.flow !== "idle";
    switch (meta) {
      case "restart": {
        const job = this.session.activeJobId && ["collecting", "confirm_calc"].includes(this.session.flow) ? await getJob(this.ctx, this.session.activeJobId) : null;
        if (job) {
          this.say(`Quer recomeçar ${jobPhrase(job)} do zero? Eu tiro ele da lista (fica guardado no histórico) e você me conta tudo de novo.`, [
            [
              { text: "Recomeçar do zero", data: "rst:yes" },
              { text: "Continuar de onde parei", data: "cmd:continue" },
            ],
          ]);
          return true;
        }
        if (busy) await this.cancel();
        this.say("Pode me contar do começo: qual é o móvel, de quem é e o que vai fazer nele? Pode ser por áudio. 🙂");
        return true;
      }
      case "audio_test":
        this.say(this.input.kind === "voice" ? "Tá chegando direitinho! 🎧 Pode mandar áudio à vontade que eu transcrevo." : "Tô aqui! 🎧 Pode mandar áudio que eu escuto e transcrevo.");
        if (busy) await this.reaskCurrent();
        return true;
      case "thanks":
        this.say(busy ? "Por nada! 😊" : "Por nada! Qualquer coisa, é só chamar. 😊");
        if (busy) await this.reaskCurrent();
        return true;
      case "small_talk":
        if (!busy) return false;
        this.say(pick(["Tudo certo por aqui, obrigado! 😊", "Tudo bem sim! 😊"], this.seed(13)));
        await this.reaskCurrent();
        return true;
    }
  }

  /** Volta ao ponto da conversa sem repetir tudo (resumo longo vira um lembrete curto). */
  async reaskCurrent(): Promise<void> {
    const flow = this.session.flow;
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    if (flow === "confirm_calc" && job) {
      this.say(`Voltando ao orçamento ${de(job)}: já tenho o que preciso. Quer que eu calcule?`, [
        [
          { text: "Pode calcular", data: "calc:yes" },
          { text: "Quero corrigir", data: "calc:fix" },
        ],
      ]);
      return;
    }
    if (flow === "collecting" && job) return this.askNext(job);
    if (flow === "quote_request" || flow === "quote_material_pricing") return this.resumePrompt();
    if (flow === "quote_decision") return reaskQuoteDecision(this);
  }

  /** "Recomeçar do zero": o serviço sai da lista (cancelado, com histórico) e a conversa volta ao início. */
  async onRestart(): Promise<void> {
    const jobId = this.session.activeJobId;
    if (jobId) {
      try {
        await transitionJob(this.ctx, jobId, "CANCELADO", this.input.user.id, "Recomeçado do zero pelo artesão");
      } catch {
        /* estado que não permite cancelar: segue só limpando a conversa */
      }
    }
    this.session.flow = "idle";
    this.session.activeJobId = null;
    this.session.lastQuestion = null;
    this.session.context = {};
    this.say("Pronto, recomecei. 👍 Me conta: qual é o móvel, de quem é e o que vai fazer nele? Pode ser por áudio.");
  }

  async resumePrompt(): Promise<void> {
    const where = await this.goalPhrase();
    let missing = "";
    const p = this.session.context.pricing;
    if (this.session.flow === "quote_material_pricing" && p?.current) {
      const m = await getMaterialByKey(this.ctx, p.current.key);
      const nm = (m?.name ?? p.current.key).toLowerCase();
      missing = ` Faltava confirmar o preço ${/a$/.test(nm.split(/[\s/(]/)[0] ?? "") ? "da" : "do"} ${nm}.`;
    }
    this.say(`${this.firstName}, podemos continuar ${where.replace(/^ao /, "aquele ").replace(/^à /, "aquela ")}?${missing}`, [
      [
        { text: "Sim, continuar", data: this.session.flow === "quote_material_pricing" ? "mp:resume" : "qr:resume" },
        { text: "Continuar depois", data: this.session.flow === "quote_material_pricing" ? "mp:later" : "cmd:pause" },
      ],
    ]);
  }

  async onUniversal(intent: string): Promise<void> {
    switch (intent) {
      case "menu":
      case "greeting":
        return this.greet();
      case "help":
        return this.help();
      case "cancel":
        return this.cancel();
      case "pause":
        return this.pause();
      case "back":
        return this.back();
    }
  }

  /** Mensagem pertence ao fluxo/objetivo atual. */
  async continueFlow(text: string, nlu: NluResult, resuming: boolean): Promise<void> {
    const flow = this.session.flow;
    switch (flow) {
      case "quote_material_pricing":
        return pricingText(this, text, nlu);
      case "quote_decision":
        return quoteDecisionText(this, text, nlu);
      case "data_collection":
        return dataCollectionText(this, text, nlu);
      case "quote_request":
        return quoteRequestText(this, text, nlu);
      case "expense":
        return this.expenseText(text, nlu);
      case "payment":
        return this.paymentText(text, nlu);
      case "learning_time":
        return this.learningTimeText(text);
      case "contradiction":
        return this.contradictionText(text, nlu);
      case "disambiguate":
        return this.disambiguateText(text, nlu);
      case "confirm_match":
      case "choose_match":
      case "confirm_new_similar":
        if (nlu.intent === "yes") return this.onCallback(flow === "confirm_new_similar" ? "match:no" : "match:yes");
        if (nlu.intent === "no") return this.onCallback(flow === "confirm_new_similar" ? "match:yes" : "match:no");
        if (nlu.intent === "dont_know") return this.onCallback("match:unsure");
        return this.onGlobal(text, nlu);
      case "progress_confirm":
      case "admin_confirm":
        if (nlu.intent === "yes") return this.onCallback(flow === "progress_confirm" ? "prog:confirm" : `adm:approve_confirm:${this.session.context.adminAction?.quoteId ?? ""}`);
        return this.cancel();
      case "resume_prompt":
        if (nlu.intent === "yes") return this.onCmd("continue");
        if (nlu.intent === "no") return this.onCmd("other_subject");
        this.session.flow = this.session.activeJobId ? "collecting" : "idle";
        return this.onText(text, false);
      case "confirm_calc":
        if (nlu.intent === "yes") return this.onCallback("calc:yes");
        return this.collectingText(text, nlu, resuming);
      case "collecting":
        if (this.session.activeJobId) return this.collectingText(text, nlu, resuming);
        break;
      case "intake":
        return this.intakeText(text, nlu);
    }
    return this.onGlobal(text, nlu);
  }

  /** Intenção global sem objetivo ativo. */
  async onGlobal(text: string, nlu: NluResult): Promise<void> {
    if (nlu.intent === "register_expense" && nlu.confidence >= 0.7) return this.startExpense(text, nlu);
    if (nlu.intent === "register_payment" && nlu.confidence >= 0.7) return this.startPayment(nlu);
    if (nlu.intent === "list_jobs") return this.listJobs();
    if (nlu.intent === "agenda") return this.agenda();
    if (nlu.intent === "query_status") return this.queryStatus(text, nlu);
    if (nlu.intent === "job_progress" && nlu.entities.progress) return this.startProgress(text, nlu);
    if (nlu.intent === "back") return this.back();
    // "esquece o aparador" sem pedido aberto: nunca vira serviço novo nem apaga nada sem confirmação
    if (nlu.intent === "cancel") {
      this.say(`Não apaguei nada. 🙂 Se quiser cancelar um serviço que já está anotado, me diz qual é (por exemplo "${nlu.entities.furnitureType ? `o ${furnitureLabel(nlu.entities.furnitureType)} da dona Ana` : "a cômoda da dona Ana"}") que eu confirmo com você antes.`);
      return;
    }

    // pedido com vários móveis/clientes → objetivo persistente de orçamento
    if (nlu.intent === "new_job" || nlu.entities.furnitureType) {
      const draft = await buildDraft(this, text);
      if (shouldStartQuoteRequest(draft)) return startQuoteRequest(this, draft);
      return this.newJobMention(text, nlu);
    }
    return this.onFallback(text, nlu);
  }

  async onFallback(text: string, nlu: NluResult): Promise<void> {
    // sem fluxo: informações soltas sobre o último projeto
    if (this.session.activeJobId && hasProjectInfo(nlu)) {
      const job = await getJob(this.ctx, this.session.activeJobId);
      if (job) {
        this.session.flow = "confirm_match";
        this.session.context.mention = this.mention(text, nlu);
        this.session.context.candidateJobIds = [job.id];
        this.setPending({ type: "confirmation", entity: { kind: "job", id: job.id } });
        this.say(`${this.firstName}, isso é sobre ${jobPhrase(job)}?`, matchButtons());
        return;
      }
    }
    if (nlu.intent === "yes" || nlu.intent === "no") {
      this.say(`Certo! ${GUIDE}`);
      return;
    }
    // móvel que só o catálogo conhece (apelido novo, "uma peça diferente para restaurar"): é serviço novo
    {
      const probe = this.mention(text, nlu);
      await this.catalogFurniture(probe, text);
      if (probe.furnitureType && (probe.techniques?.length || probe.clientName || /\b(peguei|pegar|vou pegar|trouxe|chegou|restaurar|reformar|pintar|envernizar|lixar)\b/.test(normalizeText(text)))) {
        return this.newJobMention(text, nlu);
      }
    }
    // "testando o áudio", "tá funcionando?" → responder como gente, não como erro
    if (/\b(testar|testando|teste|funcionando|ta me ouvindo|esta me ouvindo|ta ouvindo)\b/i.test(normalizeText(text))) {
      this.say(`${this.input.kind === "voice" ? "Tá funcionando sim, ouvi direitinho! 😊" : "Tá funcionando sim! 😊"} Quando quiser, é só me contar de um móvel, um gasto ou um pagamento.\n\n${GUIDE}`);
      return;
    }
    this.say(`${this.input.kind === "voice" ? "Ouvi seu áudio direitinho! 🙂" : "Recebi sua mensagem! 🙂"} Só não entendi o que você quer que eu faça agora.

${GUIDE}`);
  }

  // --------------------------------------------- suspensão e retomada de objetivos
  /** Suspende o objetivo atual (pilha) para atender uma ação lateral clara. */
  suspendGoal(reason: string): void {
    if (!GOAL_FLOWS.includes(this.session.flow)) return;
    const { goalStack, ...rest } = this.session.context;
    const stack = goalStack ?? [];
    stack.push({
      flow: this.session.flow,
      context: structuredClone(rest),
      activeJobId: this.session.activeJobId,
      lastQuestion: this.session.lastQuestion,
      suspendedAt: this.ctx.clock().toISOString(),
      reason,
    });
    this.session.context = { goalStack: stack };
    this.session.flow = "idle";
  }

  restoreGoal(g: NonNullable<Session["context"]["goalStack"]>[number]): void {
    const stack = this.session.context.goalStack ?? [];
    this.session.flow = g.flow;
    this.session.context = { ...structuredClone(g.context), goalStack: stack };
    if (!stack.length) delete this.session.context.goalStack;
    this.session.activeJobId = g.activeJobId;
    this.session.lastQuestion = g.lastQuestion;
  }

  /** Ao terminar a ação lateral: retoma o objetivo suspenso, se houver, e repete a pergunta. */
  async resumeGoal(): Promise<boolean> {
    const stack = this.session.context.goalStack;
    if (!stack?.length) return false;
    const g = stack.pop()!;
    this.restoreGoal(g);
    this.say(`Agora, voltando ${await this.goalPhrase()}:`);
    await this.reaskGoal();
    return true;
  }

  async goalPhrase(): Promise<string> {
    const flow = this.session.flow;
    if (flow === "quote_request") {
      const n = this.session.context.quoteRequest?.draft.items.reduce((a, i) => a + i.quantity, 0) ?? 0;
      return n > 1 ? `ao orçamento dos ${n} móveis` : "ao orçamento";
    }
    if (flow === "quote_material_pricing" && this.session.context.pricing) return `ao orçamento ${await targetPhrase(this, this.session.context.pricing)}`;
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    return job ? aPrep(job) : "ao que estávamos fazendo";
  }

  async reaskGoal(): Promise<void> {
    switch (this.session.flow) {
      case "quote_material_pricing":
        return askPricingCurrent(this);
      case "quote_decision":
        return reaskQuoteDecision(this);
      case "quote_request":
        return askQuoteRequestAgain(this);
      case "intake":
        this.say(questionFor("furniture_type").text);
        return;
      case "collecting":
      case "confirm_calc": {
        const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
        if (job) return this.askNext(job);
      }
    }
  }

  /** Interrupção clara: suspende o objetivo, atende e (se terminar na hora) retoma. */
  async interrupt(text: string, nlu: NluResult): Promise<void> {
    const readOnly = ["list_jobs", "agenda", "query_status"].includes(nlu.intent);
    this.suspendGoal(`interrupção: ${nlu.intent}`);
    await this.onGlobal(text, nlu);
    // consultas terminam na hora; ações (gasto, pagamento, andamento) retomam ao concluir
    if (readOnly || this.session.flow === "idle") await this.resumeGoal();
  }

  /** Chamado ao concluir/cancelar uma ação lateral. */
  async endSideAction(): Promise<void> {
    this.clearPending();
    if (await this.resumeGoal()) return;
    this.session.flow = this.session.activeJobId ? "collecting" : "idle";
  }

  /** Calcula o orçamento de um serviço; falta de preço vira coleta com o artesão. */
  async calculateAndPresent(jobId: string): Promise<void> {
    const job = await getJob(this.ctx, jobId);
    if (!job) return this.greet();
    const quote = await calculateQuote(this.ctx, job.id, this.input.user.id);
    const missing = missingPriceKeys([quote.result]);
    if (missing.length && quote.result.computable) return startPricing(this, { kind: "job", jobId: job.id }, missing, [quote.id]);
    if (!quote.result.computable) {
      // o bloqueio vira pergunta (mesmo que o campo tenha ficado "pra depois"); nunca volta ao
      // resumo + "pode calcular?" sem mudar nada — isso era um ciclo sem saída
      const field = blockingField(job, quote.result.blockers);
      if (field) {
        this.session.context.calcAfter = { jobId: job.id, field };
        this.ack = `Pra fechar a conta ${de(job)} eu ainda preciso saber isso, sem isso o cálculo não sai. Se ainda não decidiu, me diz o mais provável.`;
        return this.askNext(job, field);
      }
      this.say(`Orçamento ${de(job)}:\n${artisanQuoteSummary(quote)}`);
      this.session.flow = "idle";
      this.session.lastQuestion = null;
      this.clearPending();
      this.say("Isso eu não consigo resolver por aqui: depende de um ajuste no cadastro, que o administrador faz no painel. O serviço fica guardado e, depois do ajuste, é só pedir \"calcular o orçamento\" de novo.");
      return;
    }
    // D-070: o artesão decide o valor (concorda, desconto ou acréscimo) e o PDF sai na hora
    if (quote.recommendedCents !== null) return presentQuoteDecision(this, job, quote);
    const settings = await getActiveSettings(this.ctx);
    this.clearPending();
    if (settings.params.requireAdminReview || !quote.definitiveAllowed) {
      await submitForReview(this.ctx, quote.id, this.input.user.id);
      this.session.flow = "idle";
      this.say("Mandei o orçamento para o administrador conferir. Assim que ele aprovar, eu te aviso aqui e preparo o PDF para você mandar ao cliente.\n\nEnquanto isso, se quiser, pode me contar sobre outro serviço.");
      return;
    }
    // sem revisão obrigatória e sem pendências: aprovação automática registrada como "sistema"
    await approveQuote(this.ctx, quote.id, "system", { finalPriceCents: null });
    this.session.flow = "idle";
    this.say("Orçamento pronto. Quer que eu gere o PDF para você mandar ao cliente?", [
      [
        { text: "Gerar PDF", data: `pdf:issue:${quote.id}` },
        { text: "Ainda não", data: "cmd:noop" },
      ],
    ]);
  }

  async quoteRequestCalculate(): Promise<void> {
    return quoteRequestCalculate(this);
  }

  mention(text: string, nlu: NluResult, extra: Partial<MentionSnapshot> = {}): MentionSnapshot {
    const source = this.input.kind === "voice" ? "telegram_voice" : this.input.kind === "photo" ? "telegram_photo" : "telegram_text";
    return { ...nlu.entities, text, source, messageId: this.input.inboundMessageId, ...extra };
  }

  // ------------------------------------------------------------ comandos /
  async onSlashCommand(cmd: string): Promise<boolean> {
    const name = cmd.split(/\s+/)[0]!.toLowerCase().replace(/@.*/, "");
    if (name === "/start" || name === "/menu") {
      await this.greet();
      return true;
    }
    if (name === "/ajuda" || name === "/help") {
      this.help();
      return true;
    }
    if (name === "/cancelar") {
      await this.cancel();
      return true;
    }
    const adminCommands = ["/admin", "/pendentes", "/servicos", "/caixa", "/alertas", "/custos", "/ajuda_admin", "/aprovar"];
    if (adminCommands.includes(name)) {
      if (this.input.user.role !== "ADMIN") {
        this.say("Esse comando não está disponível.");
        return true;
      }
      const res = await handleAdminCommand(this.ctx, this.input.user, cmd);
      for (const m of res.messages) this.out.push(m);
      if (res.pendingApproval) {
        this.session.flow = "admin_confirm";
        this.session.context.adminAction = { kind: "approve", quoteId: res.pendingApproval };
      }
      return true;
    }
    return false;
  }

  async greet(): Promise<void> {
    // objetivo de orçamento em aberto: oferecer continuar de onde parou
    if (this.session.flow === "quote_material_pricing" || this.session.flow === "quote_request") {
      this.say(`Oi, ${this.firstName}! Que bom te ver. 😊`);
      return this.resumePrompt();
    }
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    const pending = job && ["collecting", "confirm_calc"].includes(this.session.flow) ? nextQuestion(job.facts) : null;
    if (job && pending) {
      this.session.flow = "resume_prompt";
      this.say(
        `Oi, ${this.firstName}! Que bom te ver de novo. 😊\n\nDa última vez estávamos falando ${de(job)}. Ainda falta saber ${FIELD_LABEL[pending]}.\n\nQuer continuar com ${pronounFor(job) === "ela" ? "ela" : "ele"} agora?`,
        [
          [
            { text: "Sim, continuar", data: "cmd:continue" },
            { text: "Não, é outro assunto", data: "cmd:other_subject" },
          ],
        ],
      );
      return;
    }
    const seen = await this.ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM conversation_messages WHERE user_id = ? AND direction = 'out'", this.input.user.id);
    if ((seen?.n ?? 0) === 0) {
      this.say(
        [
          `Olá, ${this.firstName}! Que bom ter você aqui. 😊`,
          "",
          "Eu sou o assistente da adripatina. Eu anoto os seus serviços, faço as contas dos orçamentos e guardo tudo organizado para você.",
          "",
          "Funciona assim:",
          "1. Você me conta sobre o móvel, por áudio ou escrevendo, do seu jeito.",
          "2. Eu faço algumas perguntas, uma de cada vez.",
          "3. No final, eu calculo o orçamento e preparo o PDF para você mandar ao cliente.",
          "",
          "Também posso anotar gastos e pagamentos que você receber.",
          "",
          "Para começar, é só me contar. Por exemplo:",
          "\"Peguei uma cômoda da dona Ana para fazer pátina.\"",
        ].join("\n"),
      );
      return;
    }
    this.say(`Oi, ${this.firstName}! Bom te ver. 😊\n\n${GUIDE}`);
  }

  help(): void {
    this.say(
      [
        `${this.firstName}, aqui vai um resumo de como eu funciono:`,
        "",
        "• Pode falar por áudio ou escrever, do seu jeito. Eu entendo os dois.",
        "• Eu faço uma pergunta de cada vez e sempre dou um exemplo de resposta.",
        "• Se não souber alguma coisa, é só dizer \"não sei\". Eu deixo anotado e seguimos.",
        "• Se precisar mudar algo, é só falar, por exemplo: \"na verdade a altura é 1,90\".",
        "• Se quiser parar no meio, pode parar. Eu guardo tudo e continuamos depois.",
        "",
        "Exemplos do que você pode me dizer:",
        "• \"Peguei uma cadeira do seu João para pintar\"",
        "• \"Gastei 90 reais em verniz\"",
        "• \"A dona Maria me pagou 200 reais\"",
        "• \"Quais serviços eu tenho?\"",
        "",
        "Nada é apagado sem você confirmar.",
      ].join("\n"),
    );
  }

  async cancel(): Promise<void> {
    // "cancelar" logo depois de uma pergunta proativa: deixa a pergunta de lado
    const dc = this.session.context.dataCollection;
    if (this.session.flow === "data_collection" && dc) return onDataCollectionCallback(this, "cancel", dc.requestId);
    // cancelar uma ação lateral não derruba o objetivo suspenso: ele é retomado
    if (["expense", "payment", "progress_confirm", "learning_time"].includes(this.session.flow) && this.session.context.goalStack?.length) {
      this.say("Tudo bem, não fiz essa alteração.");
      return void (await this.resumeGoal());
    }
    const qr = this.session.context.quoteRequest;
    if (qr) await this.ctx.db.run("UPDATE quote_requests SET status = 'CANCELADO', updated_at = ? WHERE id = ?", this.ctx.clock().toISOString(), qr.id);
    const hadJob = !!this.session.activeJobId;
    this.session.flow = "idle";
    this.session.context = {};
    this.session.lastQuestion = null;
    this.say(
      hadJob
        ? "Tudo bem, parei por aqui. Nada foi apagado: o que já anotamos continua guardado. Quando quiser, é só me contar outra coisa."
        : "Tudo bem, cancelei. Nada foi anotado. Quando quiser, é só me contar outra coisa.",
    );
  }

  pause(): void {
    this.say("Combinado. Guardei tudo. Quando quiser, é só me chamar que a gente continua de onde parou.");
  }

  async back(): Promise<void> {
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    const hist = this.session.context.questionHistory ?? [];
    if (!job || hist.length < 2) {
      this.say("Não tenho pergunta anterior para voltar. Pode me dizer o que quer corrigir.");
      return;
    }
    hist.pop();
    const prev = hist[hist.length - 1]!;
    this.session.context.questionHistory = hist;
    this.session.flow = "collecting";
    this.session.lastQuestion = prev;
    this.session.context.unparsedCount = 0;
    const q = questionFor(prev);
    const current = job.facts[prev];
    const note = current && current.value !== null ? ` (agora está: ${describeFact(prev, current.value)})` : "";
    this.say(`Voltando: ${q.text}${note}`, q.buttons);
    (this.session.context as { backField?: ProjectField }).backField = prev;
  }

  // ---------------------------------------------------- novo projeto / dedupe
  /**
   * Catálogo mestre na abertura: reconhece tipos que o vocabulário antigo não conhece
   * ("carrinho de chá", apelidos cadastrados no painel) e registra provisoriamente um
   * móvel não identificado quando há serviço descrito ("uma peça diferente para restaurar").
   */
  async catalogFurniture(m: MentionSnapshot, text: string): Promise<void> {
    if (m.catalogKey) return;
    const cat = await ensureCatalog(this);
    // "mesa de oito cadeiras": a cadeira descreve a mesa, não é a peça
    const mentions = findFurnitureMentions(withoutDescriptiveFurniture(text), cat.types, cat.ambiguous);
    const useType = (key: string) => {
      const t = cat.types.find((x) => x.key === key)!;
      m.furnitureType = t.legacyKey ?? t.key;
      m.catalogKey = t.key;
    };
    const hit = mentions.find((x) => x.best && x.best.key !== "movel_nao_identificado");
    if (hit?.best) return useType(hit.best.key);
    const generic = mentions.find((x) => x.candidates.length > 1 && !x.candidates.some((c) => c.key === "movel_nao_identificado"));
    if (generic) {
      // termo genérico ("mesinha", "armário"): a IA pode escolher entre os candidatos se o contexto deixar claro
      const choice = await chooseAmong(this.ctx, "tipo de móvel", text, generic.candidates.slice(0, 4).map((c) => ({ key: c.key, name: c.name })));
      if (choice?.chosenKey) return useType(choice.chosenKey);
      if (!m.furnitureType) {
        // cadastra pelo tipo antigo mais próximo e pergunta qual é depois
        const t = cat.types.find((x) => x.key === generic.candidates[0]!.key);
        m.furnitureType = t?.legacyKey ?? "movel";
      }
      return;
    }
    if (m.furnitureType) return;
    const unknownPiece = mentions.some((x) => x.candidates.some((c) => c.key === "movel_nao_identificado"));
    if (unknownPiece && (m.techniques?.length || /\b(restaurar|reformar|pintar|envernizar|lixar|consertar)\b/.test(normalizeText(text)))) {
      m.furnitureType = "movel";
      m.catalogKey = "movel_nao_identificado";
      // descritores curtos ("antigo", "de madeira"), nunca a frase inteira como nome do móvel
      m.descriptors = [...new Set([...(m.descriptors ?? []), ...unknownPieceDescription(text)])];
    }
  }

  async newJobMention(text: string, nlu: NluResult, extra: Partial<MentionSnapshot> = {}): Promise<void> {
    const mention = this.mention(text, nlu, extra);
    // catálogo mestre primeiro: nome exato, contexto claro ou escolha confiante da IA dispensam a pergunta
    await this.catalogFurniture(mention, text);
    // nome que não basta ("mesinha", "o móvel das louças"): pergunta antes de cadastrar, sem assumir
    const amb = mention.catalogKey && mention.catalogKey !== "movel_nao_identificado" ? -1 : ambiguousFurnitureKind(text);
    if (amb >= 0 && !mention.photoHash && (!mention.furnitureType || mention.furnitureType === "mesa" || mention.furnitureType === "movel")) {
      delete mention.furnitureType;
      delete mention.catalogKey;
      this.session.flow = "intake";
      this.session.context.mention = mention;
      (this.session.context as { ambiguousKind?: number }).ambiguousKind = amb;
      const q = AMBIGUOUS_FURNITURE[amb]!;
      this.say(q.question, [q.options.map((o, i) => ({ text: o.label, data: `amb:${amb}:${i}` }))]);
      return;
    }
    if (!mention.furnitureType && !mention.photoHash) {
      // ainda não sabemos o móvel: perguntar antes de cadastrar
      this.session.flow = "intake";
      this.session.context.mention = mention;
      // já sabemos o cliente? pergunta direta e calorosa sobre o móvel
      const cn = mention.clientName;
      const who = cn ? ` d${/^(dona|sra|senhora)\b/i.test(cn) ? "a" : /^(seu|sr|senhor)\b/i.test(cn) ? "o" : "e"} ${cn}` : "";
      this.say(who ? pick([`Claro! Qual é o móvel${who}?`, `Bora! E qual é o móvel${who}? Tipo "uma cômoda" ou "uma cama de casal".`], this.seed()) : `Vamos lá! ${naturalQuestion("furniture_type", { seed: this.seed() })}`);
      return;
    }
    await this.matchOrCreate(mention);
  }

  async intakeText(text: string, nlu: NluResult): Promise<void> {
    const m = this.session.context.mention ?? this.mention(text, nlu);
    const ambKind = (this.session.context as { ambiguousKind?: number }).ambiguousKind;
    if (ambKind !== undefined) {
      const r = resolveAmbiguousFurniture(ambKind, text) ?? (findFurniture(text) ? { key: findFurniture(text)! } : null);
      if (r || nlu.intent === "dont_know") {
        delete (this.session.context as { ambiguousKind?: number }).ambiguousKind;
        // "não sei" na mesinha: fica mesa; no móvel das louças, pergunta o nome livre abaixo
        const chosen = r ?? (ambKind === 0 ? { key: "mesa", descriptor: "mesinha" } : null);
        if (chosen) {
          m.furnitureType = chosen.key;
          m.descriptors = [...new Set([...(m.descriptors ?? []), ...(chosen.descriptor ? [chosen.descriptor] : [])])];
          if (nlu.entities.clientName) m.clientName = nlu.entities.clientName;
          return this.matchOrCreate(m);
        }
      } else {
        this.say(AMBIGUOUS_FURNITURE[ambKind]!.question);
        return;
      }
    }
    const ans = parseAnswer("furniture_type", text);
    if (ans.kind === "value") {
      const ft = ans.value as FactValueMap["furniture_type"];
      m.furnitureType = ft.type;
      m.descriptors = [...new Set([...(m.descriptors ?? []), ...(ft.descriptors ?? [])])];
    }
    // outras informações ditas junto
    if (nlu.entities.clientName) m.clientName = nlu.entities.clientName;
    if (nlu.entities.techniques.length) m.techniques = nlu.entities.techniques;
    m.text = `${m.text} ${text}`.trim();
    if (!m.furnitureType) await this.catalogFurniture(m, text);
    if (!m.furnitureType) {
      if (ans.kind === "dont_know") {
        this.say("Sem problema. Me conta como é o móvel, do seu jeito (por exemplo: \"um armário de cozinha\").");
        return;
      }
      this.say(pick(["Hmm, não peguei qual é o móvel 😅 Pode dizer só o nome? Tipo cristaleira, cômoda, cama.", "Desculpa, não entendi o móvel. É uma mesa, um armário, uma cama?"], this.seed(1)));
      return;
    }
    await this.matchOrCreate(m);
  }

  async matchOrCreate(mention: MentionSnapshot): Promise<void> {
    const candidates = await loadCandidates(this.ctx);
    const pm: ProjectMention = toProjectMention(mention);
    const decision = decideMatch(pm, candidates, this.ctx.clock());
    this.session.context.mention = mention;
    const byId = new Map(candidates.map((c) => [c.jobId, c]));

    if (decision.kind === "none") return this.createFromMention(mention);

    if (decision.kind === "confirm_single") {
      const job = await getJob(this.ctx, decision.candidate.jobId);
      if (!job) return this.createFromMention(mention);
      // já estamos falando deste projeto agora: repetição = retomada, sem atrito
      if (this.session.activeJobId === job.id && ["collecting", "confirm_calc"].includes(this.session.flow) && decision.strength === "forte") {
        return this.continueWithJob(job, mention, { quiet: true });
      }
      this.session.flow = "confirm_match";
      this.session.context.candidateJobIds = [job.id];
      const lead = decision.strength === "forte" ? `${this.firstName}, acho que você está falando ${de(job)} que já anotamos.` : `${this.firstName}, pode ser ${jobPhrase(job)} que já anotamos?`;
      this.say(decision.strength === "forte" ? `${lead} É essa mesma?` : lead, matchButtons());
      return;
    }

    if (decision.kind === "choose_among") {
      this.session.flow = "choose_match";
      this.session.context.candidateJobIds = decision.candidates.map((c) => c.jobId);
      const rows: Button[][] = [];
      for (const c of decision.candidates) {
        const cand = byId.get(c.jobId)!;
        const job = await getJob(this.ctx, c.jobId);
        const desc = cand.descriptors.length ? ` (${cand.descriptors.join(", ")})` : "";
        rows.push([{ text: `${job ? capitalize(jobPhrase(job)) : cand.code}${desc} — desde ${formatDateBR(cand.createdAt)}`.slice(0, 60), data: `match:pick:${c.jobId}` }]);
      }
      rows.push([
        { text: "É outro serviço", data: "match:no" },
        { text: "Não tenho certeza", data: "match:unsure" },
      ]);
      this.say(`${this.firstName}, já temos mais de um parecido. Qual deles é?`, rows);
      return;
    }

    // "outra cristaleira" — confirma que é novo, sem associar automaticamente
    const job = await getJob(this.ctx, decision.candidate.jobId);
    if (!job) return this.createFromMention(mention);
    this.session.flow = "confirm_new_similar";
    this.session.context.candidateJobIds = [job.id];
    this.say(`Você disse outr${furnitureArticleOf(mention.furnitureType)} ${furnitureLabel(mention.furnitureType)}. Então é um serviço novo, separado ${de(job)} que já anotamos?`, [
      [
        { text: "Sim, é outro", data: "match:no" },
        { text: "Não, é a mesma", data: "match:yes" },
      ],
    ]);
  }

  async createFromMention(mention: MentionSnapshot): Promise<void> {
    const job = await createJob(this.ctx, { actor: this.input.user.id, description: mention.text, messageId: mention.messageId });
    this.session.activeJobId = job.id;
    this.session.context.questionHistory = [];
    if (mention.photoAttachmentId) await this.ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ?", job.id, mention.photoAttachmentId);
    const res = await this.applyMention(job.id, mention);
    const notes = await this.appendNotes(job.id, mention.text);
    if (notes.length) res.added.push(...notes);
    let fresh = (await getJob(this.ctx, job.id))!;
    // catálogo mestre: tipo exato do móvel e medida de referência (hipótese, nunca medida real)
    const bedNote = await classifyFurniture(this, job.id, mention.text);
    fresh = (await getJob(this.ctx, job.id))!;
    const noted = res.added.length ? `${pick(["Anotei um serviço novo:", "Beleza, serviço novo anotado:", "Show! Anotei:"], this.seed())}\n${res.added.map((a) => `• ${a}`).join("\n")}` : "Anotei um serviço novo.";
    const intro = pick(
      ["Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.", "Vou te perguntando o resto aos pouquinhos, tá? Pode responder do jeito que for mais fácil, áudio ou texto."],
      this.seed(2),
    );
    this.say(`${noted}${bedNote ? `\n\n${bedNote}` : ""}\n\n${intro}`);
    if (res.conflict) return this.askContradiction(fresh, res.conflict);
    await this.askNext(fresh);
  }

  async continueWithJob(job: Job, mention: MentionSnapshot | undefined, opts: { quiet?: boolean } = {}): Promise<void> {
    this.session.activeJobId = job.id;
    await touchJob(this.ctx, job.id);
    if (mention?.photoAttachmentId) await this.ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ? AND job_id IS NULL", job.id, mention.photoAttachmentId);
    const res = mention ? await this.applyMention(job.id, mention) : { added: [], repeated: [], conflict: undefined };
    const fresh = (await getJob(this.ctx, job.id))!;
    if (!opts.quiet) {
      const s = summarizeJob(fresh);
      this.say(`Certo, vamos continuar com ${jobPhrase(fresh)}.${s.confirmed.length ? `\n\nO que eu já tenho anotado:\n${s.confirmed.map((c) => `• ${c}`).join("\n")}` : ""}`);
      await addJobEvent(this.ctx, job.id, "retomada", { via: this.input.kind }, this.input.user.id);
    }
    if (res.repeated.length) this.say(`Isso, já anotei: ${res.repeated.join("; ")}.`);
    if (res.added.length) this.say(`Anotei também: ${res.added.join("; ")}.`);
    if (res.conflict) return this.askContradiction(fresh, res.conflict);
    if (opts.quiet && res.repeated.length && !res.added.length) {
      const q = this.session.lastQuestion;
      if (q && !fresh.facts[q]) {
        const question = questionFor(q);
        this.say(`Quer me contar mais alguma coisa sobre ${pronounFor(fresh)}? Se não, me diga: ${question.text.charAt(0).toLowerCase()}${question.text.slice(1)}`, question.buttons);
        return;
      }
    }
    await this.askNext(fresh);
  }

  /** Aplica entidades da menção ao projeto: novo → grava; igual → repetição; diferente → conflito (pergunta). */
  async applyMention(jobId: string, m: MentionSnapshot): Promise<{ added: string[]; repeated: string[]; conflict?: { field: ProjectField; oldValue: unknown; newValue: unknown } }> {
    const added: string[] = [];
    const repeated: string[] = [];
    let conflict: { field: ProjectField; oldValue: unknown; newValue: unknown } | undefined;
    const job = (await getJob(this.ctx, jobId))!;
    const proposals: [ProjectField, unknown][] = [];
    if (m.furnitureType) {
      const existing = job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined;
      const descriptors = [...new Set([...(existing?.descriptors ?? []), ...(m.descriptors ?? [])])];
      if (!existing || existing.type === m.furnitureType) {
        // campos do catálogo (tipo exato, detalhes) são preservados: repetir o móvel não é contradição
        const catalogPart = existing ? Object.fromEntries(Object.entries(existing).filter(([k]) => ["catalogKey", "kindTerm", "kindCandidates", "attributes", "quantity"].includes(k))) : {};
        const value: FactValueMap["furniture_type"] = { ...catalogPart, ...(m.catalogKey && !catalogPart.catalogKey ? { catalogKey: m.catalogKey } : {}), type: m.furnitureType, descriptors, ...(m.doors !== undefined ? { doors: m.doors } : existing?.doors !== undefined ? { doors: existing.doors } : {}), ...(m.drawers !== undefined ? { drawers: m.drawers } : existing?.drawers !== undefined ? { drawers: existing.drawers } : {}) };
        if (existing && JSON.stringify([...existing.descriptors ?? []].sort()) !== JSON.stringify([...descriptors].sort()) || (existing && m.doors !== undefined && existing.doors !== m.doors && existing.doors === undefined)) {
          // acrescentar características não é contradição
          await setFact(this.ctx, jobId, "furniture_type", value, { actor: this.input.user.id, source: m.source, messageId: m.messageId, correction: true, changeKind: "set" });
          added.push(describeFact("furniture_type", value));
        } else proposals.push(["furniture_type", value]);
      } else proposals.push(["furniture_type", { type: m.furnitureType, descriptors: m.descriptors ?? [] }]);
    }
    if (m.techniques?.length) {
      const existing = (job.facts.techniques?.value as string[] | undefined) ?? [];
      const paintBased = ["patina", "decape", "pintura_lisa"];
      const genericPaint = m.techniques.length === 1 && m.techniques[0] === "pintura_lisa" && existing.some((t) => paintBased.includes(t));
      if (existing.length && (genericPaint || m.techniques.every((t) => existing.includes(t)))) repeated.push(describeFact("techniques", existing));
      else proposals.push(["techniques", m.techniques]);
    }
    if (m.clientName) proposals.push(["client_name", m.clientName]);
    if (m.lengthsM?.length) {
      const [a, b, c] = m.lengthsM;
      const dims: FactValueMap["dimensions"] = { height: a, ...(b ? { width: b } : {}), ...(c ? { depth: c } : {}) };
      proposals.push(["dimensions", dims]);
    } else if (m.sizeClass) proposals.push(["size_class", m.sizeClass]);
    if (m.materialStatus) proposals.push(["material_status", m.materialStatus]);
    if (m.method) proposals.push(["application_method", m.method]);
    if (m.surfaces) proposals.push(["surfaces", m.surfaces]);

    for (const [field, value] of proposals) {
      if (field === "client_name") {
        const existing = job.facts.client_name?.value as string | undefined;
        if (existing && clientMatches(existing, [], String(value)) >= 0.85) {
          repeated.push(describeFact("client_name", existing));
          continue;
        }
      }
      const r = await setFact(this.ctx, jobId, field, value as never, { actor: this.input.user.id, source: m.source, messageId: m.messageId });
      if (r.kind === "set") {
        added.push(describeFact(field, value));
        if (field === "material_status") added.push(stockExplanation(value as string));
      } else if (r.kind === "same") repeated.push(describeFact(field, value));
      else if (r.kind === "conflict" && !conflict) conflict = { field, oldValue: r.previous.value, newValue: value };
    }
    return { added, repeated, ...(conflict ? { conflict } : {}) };
  }

  async askContradiction(job: Job, c: { field: ProjectField; oldValue: unknown; newValue: unknown }): Promise<void> {
    this.session.flow = "contradiction";
    this.session.context.contradiction = c;
    const buttons: Button[][] = [
      [
        { text: `Vale o novo`, data: "fact:new" },
        { text: `Fica como estava`, data: "fact:old" },
      ],
    ];
    if (c.field === "techniques") buttons[0]!.push({ text: "Os dois", data: "fact:both" });
    this.say(`Antes eu anotei ${describeFact(c.field, c.oldValue)}. Agora entendi ${describeFact(c.field, c.newValue)}. Qual está certo?`, buttons);
    void job;
  }

  async contradictionText(text: string, nlu: NluResult): Promise<void> {
    const c = this.session.context.contradiction;
    if (!c) return this.resetToCollecting();
    const norm = normalizeText(text);
    if (/\b(novo|nova|segundo|agora|ultimo|vale o novo)\b/.test(norm) || nlu.intent === "yes") return this.onCallback("fact:new");
    if (/\b(antigo|antes|primeiro|como estava|o que estava)\b/.test(norm) || nlu.intent === "no") return this.onCallback("fact:old");
    if (/\b(os dois|ambos|as duas)\b/.test(norm) && c.field === "techniques") return this.onCallback("fact:both");
    const ans = parseAnswer(c.field, text);
    if (ans.kind === "value") {
      this.session.context.contradiction = { ...c, newValue: ans.value };
      return this.onCallback("fact:new");
    }
    // sem resposta clara: mantém o que estava e segue a conversa com a mensagem nova
    // (antes repetia "toque em..." para sempre — teste real 23/11/2026)
    delete this.session.context.contradiction;
    this.session.flow = "collecting";
    this.say(`Deixei como estava: ${describeFact(c.field, c.oldValue)}. Se quiser trocar, é só me falar. 😉`);
    return this.onText(text, false);
  }

  async resetToCollecting(): Promise<void> {
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    if (job) return this.askNext(job);
    this.session.flow = "idle";
  }

  async disambiguateText(text: string, nlu: NluResult): Promise<void> {
    const jobId = this.session.context.candidateJobIds?.[0];
    const job = jobId ? await getJob(this.ctx, jobId) : null;
    const mention = this.session.context.mention;
    if (!job || !mention) return this.resetToCollecting();
    if (this.session.context.disambiguation === "client") {
      if (nlu.intent === "dont_know") {
        this.say("Tudo bem. Vou deixar como serviço novo para não misturar. Se for o mesmo, o administrador consegue juntar depois.");
        return this.createDistinct(job.id, mention);
      }
      const ans = parseAnswer("client_name", text);
      const name = nlu.entities.clientName ?? (ans.kind === "value" ? String(ans.value) : null);
      if (!name) {
        this.say("De quem é esse móvel? Só o nome do cliente.");
        return;
      }
      mention.clientName = name;
      const candidateClient = (job.facts.client_name?.value as string | undefined) ?? job.clientName;
      if (candidateClient && clientMatches(candidateClient, [], name) >= 0.85) {
        this.session.flow = "confirm_match";
        this.say(`Então pode ser ${jobPhrase(job)}. É essa mesma?`, matchButtons(false));
        return;
      }
      return this.createDistinct(job.id, mention);
    }
    // pergunta por data
    if (nlu.intent === "yes") return this.onCallback("match:yes");
    if (nlu.intent === "no") return this.createDistinct(job.id, mention);
    this.say("É só responder sim ou não.", [
      [
        { text: "Sim", data: "match:yes" },
        { text: "Não", data: "match:no" },
      ],
    ]);
  }

  async createDistinct(otherJobId: string, mention: MentionSnapshot): Promise<void> {
    await this.createFromMention(mention);
    if (this.session.activeJobId && this.session.activeJobId !== otherJobId) {
      await recordSuspicion(this.ctx, this.session.activeJobId, otherJobId, 0.5, ["usuário indicou serviço diferente"], "conversa", "DISTINTOS", this.input.user.id);
    }
  }

  // ------------------------------------------------------- coleta de dados
  /** Campos que não fazem sentido para este móvel (ex.: "parte de dentro" numa cama). */
  skipFieldsFor(job: Job): ProjectField[] {
    const ft = (job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type;
    const skip: ProjectField[] = [];
    const type = catalogTypeSync(this, job);
    if (type ? !type.hasInterior : furnitureHasInterior(ft) === false) skip.push("surfaces");
    // escopo só é perguntado na cama (cama toda × só a cabeceira) no fluxo de um móvel
    if (ft !== "cama") skip.push("scope");
    // hipótese nominal já tratada: a medida não volta a ser perguntada (segue como estimativa)
    if (nominalSettled(this, job)) skip.push("dimensions");
    return skip;
  }

  /** Semente da variação de texto: muda a cada mensagem (estável nos testes). */
  seed(extra = 0): number {
    if (!this.ctx.config.phrasingVariety) return extra;
    let h = extra;
    for (const ch of this.input.inboundMessageId) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  }

  questionContext(job: Job, seedOffset = 0): QuestionContext {
    const ft = (job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type ?? null;
    return {
      furnitureType: ft,
      furnitureLabel: ft ? furnitureLabel(ft) : null,
      feminine: furnitureArticleOf(ft) === "a",
      condition: (job.facts.condition?.value as string | null | undefined) ?? null,
      techniques: (job.facts.techniques?.value as string[] | null | undefined) ?? [],
      clientName: (job.facts.client_name?.value as string | null | undefined) ?? job.clientName,
      seed: this.seed(seedOffset),
    };
  }

  /** Texto natural da pergunta (variação + reescrita opcional pela IA, sempre validada). */
  async questionText(job: Job, field: ProjectField, seedOffset = 0): Promise<string> {
    if (field === "material_status") {
      const keys = materialKeysForJob(job);
      const names = (await Promise.all(keys.map((key) => getMaterialByKey(this.ctx, key)))).filter(Boolean).map((m) => m!.name.toLowerCase().replace(/\s*\(.*\)$/, ""));
      const subject = humanList(names);
      const variants = [
        `E o material${subject ? ` (${subject})` : ""}: você já tem aí em casa ou vai precisar comprar? Pode ser "já tenho tudo", "tenho uma parte" ou "vou comprar".`,
        `Sobre ${subject || "o material"}: tem no estoque ou vai ter que comprar? Se for só uma parte, pode me dizer qual.`,
      ];
      return variants[this.seed(seedOffset) % variants.length]!;
    }
    const base = naturalQuestion(field, this.questionContext(job, seedOffset));
    const known = summarizeJob(job).confirmed.slice(0, 6);
    const msg = await composeMessage(this.ctx, {
      purpose: `ask_${field}`,
      fallback: base,
      question: base,
      keyTerms: keyTermsOf(base),
      facts: known,
      avoid: known,
      greet: false,
      recent: this.recentBotTexts(),
      topicEmoji: null,
      names: [this.firstName, String(job.facts.client_name?.value ?? "")].filter(Boolean),
    });
    return msg.text;
  }

  async askNext(job: Job, force?: ProjectField): Promise<void> {
    await ensureCatalog(this);
    // campo bloqueante respondido (de verdade, não "não sei" de novo) → recalcula sem passar pelo resumo
    const after = this.session.context.calcAfter;
    if (!force && after) {
      delete this.session.context.calcAfter;
      if (after.jobId === job.id && job.facts[after.field]?.status !== "unknown") {
        if (this.ack) this.say(this.ack);
        this.ack = null;
        return this.calculateAndPresent(job.id);
      }
    }
    const field = force ?? nextQuestion(job.facts, this.skipFieldsFor(job));
    this.session.context.unparsedCount = 0;
    delete this.session.context.catalogQ;
    // catálogo mestre: tipo exato, medidas na ordem do móvel e perguntas específicas (uma por vez)
    const step = force ? null : await nextCatalogStep(this, job, field);
    if (step) {
      const ack = this.ack ? `${this.ack}\n\n` : "";
      this.ack = null;
      return askCatalogStep(this, job, step, ack);
    }
    if (!field) {
      if (this.ack) this.say(this.ack);
      this.ack = null;
      this.session.flow = "confirm_calc";
      this.session.lastQuestion = null;
      this.clearPending();
      const s = summarizeJob(job);
      const unknown = Object.values(job.facts).filter((f) => f?.status === "unknown").map((f) => FIELD_LABEL[f!.field]);
      const lines = [`Pronto, ${this.firstName}! Já tenho o que preciso sobre ${jobPhrase(job)}. Dá uma conferida:`, "", ...s.confirmed.map((c) => `• ${c}`)];
      if (unknown.length) lines.push("", "Ficou pra depois (sem problema):", ...unknown.map((u) => `• ${u}`));
      lines.push("", "Tá tudo certo? Se sim, me diz \"pode calcular\" que eu faço as contas. Se quiser mudar algo, é só falar, tipo \"a altura é 1,90\".");
      this.say(lines.join("\n"), [
        [
          { text: "Pode calcular", data: "calc:yes" },
          { text: "Quero corrigir", data: "calc:fix" },
        ],
      ]);
      return;
    }
    this.session.flow = "collecting";
    this.session.lastQuestion = field;
    if (this.notesAck) {
      this.ack = this.ack ? `${this.ack}

${this.notesAck}` : this.notesAck;
      this.notesAck = null;
    }
    const preview = await this.earlyPreviewNote(job);
    if (preview) this.ack = this.ack ? `${this.ack}

${preview}` : preview;
    const hist = this.session.context.questionHistory ?? [];
    if (hist[hist.length - 1] !== field) hist.push(field);
    this.session.context.questionHistory = hist.slice(-20);
    const p = questionProgress(job.facts, this.skipFieldsFor(job));
    const ack = this.ack ? `${this.ack}\n\n` : "";
    this.ack = null;
    // linguagem natural em vez de "Pergunta 4 de 13" (o total muda conforme as respostas)
    const remaining = p.total - p.current;
    const hint = remaining === 0 ? pick(["Última coisinha: ", "E pra fechar: "], this.seed()) : remaining <= 2 ? pick(["Estamos quase lá. ", "Falta pouquinho. "], this.seed()) : "";
    this.setPending({ type: FIELD_QUESTION_TYPE[field], entity: { kind: "job", id: job.id }, field });
    this.say(`${ack}${hint}${await this.questionText(job, field)}`);
  }

  /** Observações livres do serviço (fato "details"): devolve só as novas. */
  async appendNotes(jobId: string, text: string): Promise<string[]> {
    const job = await getJob(this.ctx, jobId);
    if (!job) return [];
    const found = extractNotes(text, { clientName: (job.facts.client_name?.value as string | undefined) ?? null });
    if (!found.length) return [];
    const previous = (job.facts.details?.value as string | null | undefined) ?? null;
    const merged = mergeNotes(previous, found);
    if (!merged) return [];
    await setFact(this.ctx, jobId, "details", merged, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId, correction: true });
    const before = new Set((previous ?? "").split(/\s*;\s*/));
    return found.filter((x) => !before.has(x));
  }

  /** Material não é mais perguntado antes do orçamento: o que ele contar por conta própria vira aprendizado (só os citados). */
  async learnMaterialSource(job: Job, text: string, source: "tem_tudo" | "tem_parte" | "precisa_comprar"): Promise<void> {
    const said = Object.entries(MATERIAL_WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(normalizeText(text))).map(([, k]) => k);
    if (!said.length) return;
    await recordMaterialSourceObservation(this.ctx, { userId: this.input.user.id, jobId: job.id, messageId: this.input.inboundMessageId, materialKeys: [...new Set(said)], source });
  }

  /** "Como assim?" → explica por que pergunta e pergunta de outro jeito, sem gravar nada. */
  async explainQuestion(job: Job, field: ProjectField): Promise<void> {
    const opener = pick(["Boa pergunta! ", "Explico: ", "Faz sentido perguntar 🙂 "], this.seed(3));
    this.say(`${opener}${FIELD_EXPLANATION[field]}\n\n${await this.questionText(job, field, 1)}`);
  }

  /** Pediu o valor no meio das perguntas: dá a faixa que já dá pra saber e oferece calcular já ou continuar. */
  async offerEarlyCalc(job: Job): Promise<void> {
    const pending = nextQuestion(job.facts, this.skipFieldsFor(job));
    if (!pending) {
      this.say("Claro! Já tenho tudo, vou fazer as contas.");
      return this.calculateAndPresent(job.id);
    }
    const preview = await previewPriceRange(this.ctx, job).catch(() => null);
    if (preview) this.session.context.previewShownFor = job.id;
    const remaining = questionProgress(job.facts, this.skipFieldsFor(job));
    const left = remaining.total - remaining.current + 1;
    this.say(
      preview
        ? `Pelo que já sei, ${priceRangePhrase(preview)}. 💰

Com mais ${left === 1 ? "uma resposta" : `${left} respostas`} eu fecho o valor. Quer que eu calcule agora mesmo assim ou seguimos?`
        : `Já já te passo! 😊 Faltam ${left === 1 ? "uma coisinha" : `${left} coisinhas`} que mudam o valor. Se quiser, eu calculo agora com o que já sei (fica como estimativa).`,
      [
        [
          { text: "Calcular agora", data: "calc:yes" },
          { text: "Seguir as perguntas", data: "cmd:continue" },
        ],
      ],
    );
  }

  /** Mostra a faixa de preço uma vez, assim que ela fica confiável (custo nenhum entrando como zero). */
  async earlyPreviewNote(job: Job): Promise<string | null> {
    if (this.session.context.previewShownFor === job.id) return null;
    const preview = await previewPriceRange(this.ctx, job).catch(() => null);
    if (!preview) return null;
    this.session.context.previewShownFor = job.id;
    return `💰 Só pra você ir tendo uma ideia: pelo que já sei, ${priceRangePhrase(preview)}. Com o resto das respostas eu fecho o valor.`;
  }

  async collectingText(text: string, nlu: NluResult, resuming: boolean): Promise<void> {
    const job = await getJob(this.ctx, this.session.activeJobId!);
    if (!job) {
      this.session.flow = "idle";
      this.session.activeJobId = null;
      return this.onText(text, false);
    }
    // detalhes ditos de passagem (cor, tempo que ele estima, outro dono) nunca se perdem
    const notes = await this.appendNotes(job.id, text);
    if (notes.length) this.notesAck = `📝 Anotei também: ${notes.join("; ")}.`;
    // resposta a uma pergunta do catálogo (tipo do móvel, medidas, portas, estofado...)
    if (this.session.context.catalogQ && nlu.intent !== "correction" && (await catalogAnswer(this, job, text, nlu.intent))) return;
    const field = this.session.flow === "collecting" ? (this.session.lastQuestion ?? nextQuestion(job.facts, this.skipFieldsFor(job))) : null;

    // pergunta de volta ("como assim? cama tem dentro e fora?") → explicar, nunca gravar
    if (field && isQuestionToBot(text) && !asksForPrice(text)) return this.explainQuestion(job, field);
    // pediu o valor no meio → oferecer calcular agora
    if (asksForPrice(text)) return this.offerEarlyCalc(job);

    const backField = (this.session.context as { backField?: ProjectField }).backField;
    const correcting = nlu.intent === "correction" || !!backField || (this.session.context as { correctionMode?: boolean }).correctionMode === true;
    if (correcting) {
      delete (this.session.context as { backField?: ProjectField }).backField;
      delete (this.session.context as { correctionMode?: boolean }).correctionMode;
      const changed = await this.applyCorrection(job, text, nlu, backField ?? this.session.lastQuestion);
      if (!changed) {
        this.say("Não consegui entender o que mudar. Pode dizer, por exemplo: \"a altura é 1,90\" ou \"a cliente é a dona Ana\".");
        (this.session.context as { correctionMode?: boolean }).correctionMode = true;
        return;
      }
      return this.askNext((await getJob(this.ctx, job.id))!);
    }

    // 1) a resposta à pergunta pendente vem antes de qualquer outra leitura
    let ans: ParsedAnswer = field ? parseAnswer(field, text) : { kind: "unparsed" };
    // texto livre só é aceito como resposta quando a mensagem não fala de outra coisa
    // (móvel, técnica, material, dinheiro...) — senão vira "Mas e o valor?" gravado como pagamento
    if (ans.kind === "value" && ans.strength === "free" && (hasProjectInfo(nlu) || !["unknown", "yes", "no", "dont_know"].includes(nlu.intent) || nlu.entities.amountCents !== undefined)) {
      ans = { kind: "unparsed" };
    }
    // resposta de OUTRA pergunta dita fora de hora ("sem pressa" na pergunta do transporte,
    // "metade agora, metade na entrega" na do prazo): guarda no campo certo e volta à pergunta atual
    if (field && (ans.kind === "unparsed" || (ans.kind === "value" && ans.strength === "free"))) {
      for (const other of OUT_OF_ORDER_FIELDS) {
        if (other === field || job.facts[other]) continue;
        const o = parseAnswer(other, text);
        if (o.kind !== "value" || o.strength !== "specific") continue;
        await setFact(this.ctx, job.id, o.field, o.value as never, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId });
        this.ack = naturalAck(describeFact(o.field, o.value), this.seed(11));
        return this.askNext((await getJob(this.ctx, job.id))!);
      }
    }
    if (field && (ans.kind === "unparsed" || (ans.kind === "value" && ans.strength === "free"))) {
      const ai = await aiInterpretAnswer(this.ctx, field, naturalQuestion(field, this.questionContext(job)), text);
      if (ai) ans = ai;
    }

    // 2) só se não respondeu: outro móvel no meio da conversa ou repetição do mesmo
    if (ans.kind === "unparsed" && nlu.entities.furnitureType && nlu.intent === "new_job") {
      const currentType = (job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type;
      const sameType = !currentType || currentType === nlu.entities.furnitureType;
      const currentClient = (job.facts.client_name?.value as string | undefined) ?? null;
      const clientConflict = !!(nlu.entities.clientName && currentClient && clientMatches(currentClient, [], nlu.entities.clientName) < 0.85);
      if (!sameType || clientConflict || nlu.entities.explicitNew) {
        this.say(`Tudo bem, guardei ${jobPhrase(job)} para continuar depois.`);
        this.session.flow = "idle";
        // pelo caminho global: um pedido com vários móveis/clientes vira objetivo de orçamento, não 1 serviço
        return this.onGlobal(text, nlu);
      }
      if (resuming) {
        this.session.flow = "idle";
        return this.matchOrCreate(this.mention(text, nlu));
      }
    }

    // "já tenho o verniz" / "vou comprar lixa e massa" em qualquer momento (material não é mais perguntado
    // antes do orçamento). Só vale com um material citado: "tenho aquela cristaleira" não é estoque.
    const volunteeredMaterial =
      field !== "material_status" && ans.kind !== "value"
        ? (nlu.entities.materialStatus ?? (mentionsMaterial(text) ? specificValue(parseAnswer("material_status", text)) : undefined))
        : undefined;
    if (volunteeredMaterial) {
      const status = volunteeredMaterial as "tem_tudo" | "tem_parte" | "precisa_comprar";
      await setFact(this.ctx, job.id, "material_status", status, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId, correction: true });
      await this.learnMaterialSource(job, text, status);
      this.say(stockExplanation(status, nlu.entities.materialMention));
      return this.askNext((await getJob(this.ctx, job.id))!);
    }

    if (this.session.flow === "confirm_calc" || !field) {
      // informação extra depois do resumo
      if (hasProjectInfo(nlu)) return this.continueWithJob(job, this.mention(text, nlu), { quiet: true });
      if (nlu.intent === "no") {
        this.pause();
        return;
      }
      this.say("Quer que eu calcule o orçamento?", [
        [
          { text: "Calcular", data: "calc:yes" },
          { text: "Corrigir algo", data: "calc:fix" },
        ],
      ]);
      return;
    }

    if (ans.kind === "question") return this.explainQuestion(job, field);
    if (ans.kind === "dont_know") {
      await setFact(this.ctx, job.id, field, null, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId });
      this.ack = `${resuming ? `Continuando sobre ${jobPhrase(job)}. ` : ""}${pick(["Sem problema! Deixo isso pendente e seguimos.", "Tranquilo, fica pra depois.", "Tudo bem, anotei como pendente."], this.seed(5))}`;
      return this.askNext((await getJob(this.ctx, job.id))!);
    }
    if (ans.kind === "partial") {
      // logística: juntar com o que já se sabia
      const prev = (this.session.context as { partialLogistics?: { pickup?: boolean; delivery?: boolean } }).partialLogistics ?? {};
      const known = { ...prev, ...ans.known };
      if (known.pickup !== undefined && known.delivery !== undefined) {
        ans = { kind: "value", field: "logistics", value: { pickup: known.pickup, delivery: known.delivery }, strength: "specific" };
        delete (this.session.context as { partialLogistics?: unknown }).partialLogistics;
      } else {
        (this.session.context as { partialLogistics?: { pickup?: boolean; delivery?: boolean } }).partialLogistics = known;
        const pron = furnitureArticleOf((job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type) === "a" ? "ela" : "ele";
        this.say(
          known.pickup === false
            ? `Ah, beleza! Então você não precisa buscar, o cliente traz até você. 👍 E depois de pront${pron === "ela" ? "a" : "o"}, o cliente vem pegar ou você vai entregar?`
            : known.pickup === true
              ? "Certo, você vai buscar. E na volta, você entrega ou o cliente vem pegar?"
              : known.delivery === false
                ? "Entendi, o cliente vem buscar quando ficar pronto. E pra chegar até você: ele traz ou você vai buscar?"
                : "Certo, você entrega no final. E pra chegar até você: o cliente traz ou você vai buscar?",
        );
        return;
      }
    }
    if (ans.kind === "unparsed") {
      // "é uma cama queen" dito depois: tamanho padrão vira referência, nunca medida
      const bedNote = await classifyFurniture(this, job.id, text);
      if (bedNote) {
        this.ack = bedNote;
        return this.askNext((await getJob(this.ctx, job.id))!);
      }
      // informação nova do projeto dita fora de hora é guardada (sem repetir "já anotei" em looping)
      if (hasProjectInfo(nlu)) {
        const res = await this.applyMention(job.id, { ...this.mention(text, nlu), techniques: [] });
        if (res.conflict) return this.askContradiction((await getJob(this.ctx, job.id))!, res.conflict);
        if (res.added.length) this.ack = `Anotei também: ${res.added.join("; ")}.`;
        // só repetiu o que já sabíamos: confirmar com naturalidade e seguir (sem "não entendi")
        if (!res.added.length && res.repeated.length && !resuming) {
          this.say(`Isso, já anotei: ${res.repeated.join("; ")}. 👍

${await this.questionText(job, field, 4)}`);
          return;
        }
      }
      if (resuming) {
        this.session.flow = "resume_prompt";
        this.say(`Oi, ${this.firstName}! Da última vez estávamos falando ${de(job)}. Quer continuar?`, [
          [
            { text: "Continuar", data: "cmd:continue" },
            { text: "Outro assunto", data: "cmd:other_subject" },
          ],
        ]);
        this.session.context.deferredText = text;
        return;
      }
      const count = (this.session.context.unparsedCount ?? 0) + 1;
      this.session.context.unparsedCount = count;
      const ack = this.ack ? `${this.ack}\n\n` : "";
      this.ack = null;
      const q = questionFor(field);
      this.say(
        count === 1
          ? `${ack}${pick(["Hmm, não peguei essa parte 😅", "Desculpa, não entendi direito essa 😅", "Opa, essa eu não entendi bem."], this.seed(7))} ${FIELD_EXPLANATION[field]}\n\n${q.example ?? (await this.questionText(job, field, 2))}`
          : `${ack}Tudo bem se não souber agora: é só dizer "não sei" que eu deixo anotado e seguimos.\n\n${await this.questionText(job, field, 3)}`,
      );
      return;
    }

    // métodos: "pincel e rolo" → considera o mais demorado (seguro contra prejuízo)
    let value = ans.value;
    let methodNote: string | null = null;
    if (ans.field === "application_method") {
      const methods = findMethods(text);
      if (methods.length > 1) {
        const all = await listMethods(this.ctx);
        const slowest = methods.map((m) => all.find((x) => x.key === m)).filter(Boolean).sort((a, b) => Number(a!.speedM2PerHour) - Number(b!.speedM2PerHour))[0];
        if (slowest) {
          value = slowest.key as never;
          methodNote = `Vou considerar ${humanList(methods)}. Pra conta uso o ${slowest.key}, que é o mais demorado, pra você não sair no prejuízo.`;
        }
      }
    }

    const r = await setFact(this.ctx, job.id, ans.field, value as never, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId });
    const fresh = (await getJob(this.ctx, job.id))!;
    if (ans.field === "material_status") {
      // só registra o que foi dito: materiais citados na resposta; se a resposta foi geral, os perguntados
      const said = Object.entries(MATERIAL_WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(normalizeText(text))).map(([, k]) => k);
      await recordMaterialSourceObservation(this.ctx, {
        userId: this.input.user.id,
        jobId: job.id,
        messageId: this.input.inboundMessageId,
        materialKeys: said.length ? [...new Set(said)] : materialKeysForJob(fresh),
        source: value as "tem_tudo" | "tem_parte" | "precisa_comprar",
      });
    }
    if (r.kind === "conflict") return this.askContradiction(fresh, { field: ans.field, oldValue: r.previous.value, newValue: value });
    if (resuming) this.say(`Continuando sobre ${jobPhrase(job)}.`);
    if (r.kind === "same") this.ack = `Isso, já tinha anotado: ${describeFact(ans.field, value)}.`;
    else if (ans.field === "material_status") this.ack = stockExplanation(value as string);
    else this.ack = methodNote ?? naturalAck(describeFact(ans.field, value), this.seed(9));
    // cama com tamanho padrão dito junto ("cama de casal queen")
    const bedNote = await classifyFurniture(this, fresh.id, text);
    if (bedNote) this.ack = `${this.ack}\n\n${bedNote}`;
    // aproveita outras informações na mesma frase (sem repetir perguntas e sem trocar técnica por material)
    const extra = this.mention(text, nlu);
    delete extra.materialStatus;
    extra.techniques = ans.field === "material_status" ? [] : extra.techniques;
    if (ans.field === "client_name") delete extra.clientName;
    if (ans.field === "techniques") extra.techniques = [];
    if (ans.field === "dimensions" || ans.field === "size_class") {
      extra.lengthsM = [];
      delete extra.sizeClass;
    }
    if (ans.field === "furniture_type") delete extra.furnitureType;
    if (ans.field === "logistics" || ans.field === "deadline" || ans.field === "payment_terms") delete extra.furnitureType;
    if (hasProjectInfo({ ...nlu, entities: { ...nlu.entities, ...extra } as NluResult["entities"] })) {
      const res = await this.applyMention(job.id, extra);
      if (res.added.length) this.ack = `${this.ack}\nAnotei também: ${res.added.join("; ")}.`;
      if (res.conflict) return this.askContradiction((await getJob(this.ctx, job.id))!, res.conflict);
    }
    await this.askNext((await getJob(this.ctx, job.id))!);
  }

  sourceKind(): "telegram_text" | "telegram_voice" | "telegram_photo" {
    return this.input.kind === "voice" ? "telegram_voice" : this.input.kind === "photo" ? "telegram_photo" : "telegram_text";
  }

  /** Correção explícita: atualiza o projeto correto e preserva histórico (job_facts + job_events). */
  async applyCorrection(job: Job, text: string, nlu: NluResult, fallbackField: ProjectField | null): Promise<boolean> {
    const changes: [ProjectField, unknown][] = [];
    const e = nlu.entities;
    const norm = normalizeText(text);
    const labeled = labelDimensions(norm);
    if (!e.lengthsM.length && (labeled.height || labeled.width || labeled.depth)) {
      const dims = { ...((job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined) ?? {}) };
      if (labeled.height) dims.height = labeled.height;
      if (labeled.width) dims.width = labeled.width;
      if (labeled.depth) dims.depth = labeled.depth;
      changes.push(["dimensions", dims]);
    } else if (e.lengthsM.length) {
      const dims = { ...((job.facts.dimensions?.value as FactValueMap["dimensions"] | undefined) ?? {}) };
      if (/altura|alto|alta/.test(norm)) dims.height = e.lengthsM[0];
      else if (/largura|larga|largo/.test(norm)) dims.width = e.lengthsM[0];
      else if (/fundura|profundidade|fundo/.test(norm)) dims.depth = e.lengthsM[0];
      else {
        const [a, b, c] = e.lengthsM;
        dims.height = a;
        if (b) dims.width = b;
        if (c) dims.depth = c;
      }
      changes.push(["dimensions", dims]);
    } else if (e.sizeClass) changes.push(["size_class", e.sizeClass]);
    if (e.clientName) changes.push(["client_name", e.clientName]);
    if (e.techniques.length) changes.push(["techniques", e.techniques]);
    if (e.furnitureType) changes.push(["furniture_type", { type: e.furnitureType, descriptors: findDescriptors(text) }]);
    if (e.method) changes.push(["application_method", e.method]);
    if (e.materialStatus) changes.push(["material_status", e.materialStatus]);
    if (e.surfaces) changes.push(["surfaces", e.surfaces]);
    if (changes.length === 0 && fallbackField) {
      const ans = parseAnswer(fallbackField, text.replace(/^(corrigir|corrige|na verdade|errei|me enganei)[,:]?\s*/i, ""));
      if (ans.kind === "value") changes.push([ans.field, ans.value]);
    }
    if (changes.length === 0) return false;
    for (const [field, value] of changes) {
      const before = job.facts[field]?.value;
      await setFact(this.ctx, job.id, field, value as never, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId, correction: true });
      this.say(before !== undefined && before !== null ? `Corrigido: ${describeFact(field, value)} (antes: ${describeFact(field, before)}). Guardei o histórico.` : `Anotado: ${describeFact(field, value)}.`);
    }
    return true;
  }

  // ------------------------------------------------------------- callbacks
  async onCallback(data: string): Promise<void> {
    const [ns, action, arg] = splitData(data);
    if (ns === "cmd") return this.onCmd(action);
    if (ns === "ans") {
      if (this.session.flow === "intake") return this.intakeText(action === "nao_sei" ? "não sei" : action, await interpret(this.ctx, action));
      if (this.session.flow === "collecting" && this.session.activeJobId) return this.collectingText(`ans:${action}`, await interpret(this.ctx, action), false);
      if (this.session.flow === "disambiguate") return this.disambiguateText(action, await interpret(this.ctx, action));
      this.say(`Essa pergunta já foi respondida, está tudo anotado. ${GUIDE}`);
      return;
    }
    if (ns === "amb") {
      // botão de "que mesinha é?": só vale enquanto a pergunta está aberta (botão antigo não faz nada)
      const kind = Number(action);
      const opt = AMBIGUOUS_FURNITURE[kind]?.options[Number(arg)];
      if (this.session.flow === "intake" && (this.session.context as { ambiguousKind?: number }).ambiguousKind === kind && opt) return this.intakeText(opt.label, await interpret(this.ctx, opt.label));
      this.say(`Essa pergunta já foi respondida, está tudo anotado. ${GUIDE}`);
      return;
    }
    if (ns === "match") return this.onMatch(action, arg);
    if (ns === "fact") return this.onFact(action);
    if (ns === "calc") return this.onCalc(action);
    if (ns === "rst") return this.onRestart();
    if (ns === "exp") return this.onExpense(action, arg);
    if (ns === "pay") return this.onPayment(action, arg);
    if (ns === "prog") return this.onProgress(action);
    if (ns === "pdf") return this.onPdf(action, arg);
    if (ns === "outcome") return this.onOutcome(action, arg);
    if (ns === "job") return this.openJob(arg ?? action);
    if (ns === "photo") return this.onPhotoChoice(action, arg);
    if (ns === "adm") return this.onAdmin(action, arg);
    if (ns === "mp") return onPricingCallback(this, action, arg);
    if (ns === "qa") return onQuoteDecisionCallback(this, action, arg);
    if (ns === "dc") return onDataCollectionCallback(this, action, arg);
    if (ns === "qr") {
      if (action === "resume") return askQuoteRequestAgain(this);
      return onQuoteRequestCallback(this, action);
    }
    this.say(`Esse botão é de uma conversa antiga, então não fiz nada com ele. ${GUIDE}`);
  }

  async onCmd(action: string): Promise<void> {
    switch (action) {
      case "menu":
        return this.greet();
      case "help":
        return this.help();
      case "pause":
        return this.pause();
      case "cancel":
        return this.cancel();
      case "noop":
        this.say("Tudo bem. Quando quiser, é só me chamar.");
        return;
      case "new_quote":
        this.session.flow = "intake";
        this.session.context = { mention: { text: "", source: this.sourceKind(), descriptors: [], techniques: [], lengthsM: [], explicitNew: false, referencesExisting: false } };
        this.say(questionFor("furniture_type").text, questionFor("furniture_type").buttons);
        return;
      case "list_jobs":
        return this.listJobs();
      case "agenda":
        return this.agenda();
      case "expense":
        this.session.flow = "expense";
        this.session.context.expense = { step: "amount" };
        this.say("Quanto você gastou e com o quê? Por exemplo: \"90 reais de verniz\".");
        return;
      case "payment":
        this.session.flow = "payment";
        this.session.context.payment = { step: "amount" };
        this.say("Quanto você recebeu e de quem? Por exemplo: \"200 reais da dona Maria\".");
        return;
      case "continue": {
        const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
        if (!job) return this.greet();
        const deferred = this.session.context.deferredText;
        delete this.session.context.deferredText;
        const s = summarizeJob(job);
        if (s.confirmed.length) this.say(`Certo! Sobre ${jobPhrase(job)}, já tenho: ${s.confirmed.join("; ")}.`);
        void deferred;
        return this.askNext(job);
      }
      case "other_subject": {
        const deferred = this.session.context.deferredText;
        this.session.flow = "idle";
        this.session.context = {};
        this.session.lastQuestion = null;
        if (deferred) return this.onText(deferred, false);
        this.say(`Certo! ${GUIDE}`);
        return;
      }
    }
    this.say(GUIDE);
  }

  async onMatch(action: string, arg?: string): Promise<void> {
    const mention = this.session.context.mention;
    const candidateId = action === "pick" ? arg : this.session.context.candidateJobIds?.[0];
    if (action === "yes" || action === "pick") {
      const job = candidateId ? await getJob(this.ctx, candidateId) : null;
      if (!job) return this.resetToCollecting();
      this.session.context.candidateJobIds = [];
      return this.continueWithJob(job, mention);
    }
    if (action === "no") {
      if (!mention) return this.greet();
      const otherIds = this.session.context.candidateJobIds ?? [];
      this.session.context.candidateJobIds = [];
      await this.createFromMention(mention);
      for (const other of otherIds) {
        if (this.session.activeJobId && other !== this.session.activeJobId) {
          await recordSuspicion(this.ctx, this.session.activeJobId, other, 0.5, ["usuário indicou serviço diferente"], "conversa", "DISTINTOS", this.input.user.id);
        }
      }
      return;
    }
    if (action === "unsure") {
      const job = candidateId ? await getJob(this.ctx, candidateId) : null;
      if (!job || !mention) return this.greet();
      this.session.flow = "disambiguate";
      this.session.context.candidateJobIds = [job.id];
      if (!mention.clientName && (job.facts.client_name?.value || job.clientName)) {
        this.session.context.disambiguation = "client";
        this.say("Sem problema. Para eu não confundir: de quem é esse móvel?");
        return;
      }
      this.session.context.disambiguation = "date";
      this.say(`Sem problema. ${capitalize(jobPhrase(job))} foi anotad${furnitureArticleOf((job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type)} em ${formatDateBR(job.createdAt)}. O seu móvel já estava com você nessa data?`, [
        [
          { text: "Sim", data: "match:yes" },
          { text: "Não", data: "match:no" },
        ],
      ]);
    }
  }

  async onFact(action: string): Promise<void> {
    const c = this.session.context.contradiction;
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    if (!c || !job) return this.resetToCollecting();
    delete this.session.context.contradiction;
    if (action === "new" || action === "both") {
      const value = action === "both" ? [...new Set([...(c.oldValue as string[]), ...(c.newValue as string[])])] : c.newValue;
      await setFact(this.ctx, job.id, c.field, value as never, { actor: this.input.user.id, source: this.sourceKind(), correction: true });
      this.say(`Atualizado: ${describeFact(c.field, value)}. O valor anterior ficou guardado no histórico.`);
    } else {
      this.say(`Certo, mantive ${describeFact(c.field, c.oldValue)}.`);
    }
    await this.askNext((await getJob(this.ctx, job.id))!);
  }

  async onCalc(action: string): Promise<void> {
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    if (!job) return this.greet();
    if (action === "fix") {
      this.session.flow = "collecting";
      this.session.lastQuestion = null;
      (this.session.context as { correctionMode?: boolean }).correctionMode = true;
      this.say("O que você quer corrigir? Pode falar, por exemplo: \"a altura é 1,90\" ou \"vai ser decapê\".");
      return;
    }
    return this.calculateAndPresent(job.id);
  }

  async onPdf(action: string, quoteId?: string): Promise<void> {
    if (!quoteId) return this.greet();
    const q = await getQuote(this.ctx, quoteId);
    if (!q) {
      this.say("Não achei esse orçamento.");
      return;
    }
    const preliminary = action === "prelim";
    if (!preliminary && q.status !== "APROVADO" && q.status !== "ENVIADO") {
      this.say("Esse orçamento ainda não foi aprovado pelo administrador. Posso gerar uma estimativa NÃO DEFINITIVA, se quiser.", [[{ text: "Gerar estimativa", data: `pdf:prelim:${quoteId}` }]]);
      return;
    }
    const docs = await issueDocuments(this.ctx, quoteId, this.input.user.id, { preliminary });
    await sendDocumentToArtisan(this.ctx, docs.commercial.id, this.input.user.id, this.input.chatId);
    if (!preliminary) {
      this.say("Quando o cliente responder, me avise aqui:", [
        [
          { text: "Cliente aceitou", data: `outcome:accept:${quoteId}` },
          { text: "Cliente recusou", data: `outcome:reject:${quoteId}` },
        ],
      ]);
    }
  }

  async onOutcome(action: string, quoteId?: string): Promise<void> {
    // vários móveis fechados juntos: a resposta do cliente vale para todos (D-070)
    if (action === "acceptall" || action === "rejectall") {
      const ids = this.session.context.lastClosedQuotes ?? [];
      if (!ids.length) {
        this.say("Esse já está anotado. 🙂");
        return;
      }
      delete this.session.context.lastClosedQuotes;
      let total = 0;
      for (const id of ids) {
        const q = await markQuoteOutcome(this.ctx, id, this.input.user.id, action === "acceptall" ? "ACEITO" : "RECUSADO");
        total += q.finalPriceCents ?? q.recommendedCents ?? 0;
      }
      this.say(action === "acceptall" ? `Que bom! 🎉 Anotei que o cliente aceitou os ${ids.length} orçamentos, ${formatBRL(total)} no total.` : "Tudo bem, anotei que o cliente recusou. O histórico fica guardado.");
      return;
    }
    if (!quoteId) return;
    const q = await markQuoteOutcome(this.ctx, quoteId, this.input.user.id, action === "accept" ? "ACEITO" : "RECUSADO");
    const job = await getJob(this.ctx, q.jobId);
    if (action === "accept") {
      this.say(`Que bom! Anotei que o orçamento ${job ? de(job) : "do serviço"} foi aceito por ${formatBRL(q.finalPriceCents ?? q.recommendedCents ?? 0)}.${q.result.depositRecommendedCents ? ` Entrada recomendada: ${formatBRL(q.result.depositRecommendedCents)}.` : ""}`);
    } else {
      this.say("Tudo bem, anotei que o cliente recusou. O histórico fica guardado.");
    }
  }

  // ------------------------------------------------------------- foto
  async onPhoto(): Promise<void> {
    const photo = this.input.photo!;
    // foto de recibo/etiqueta durante a coleta de preço: guardada como evidência, valor só com confirmação
    const pricing = this.session.context.pricing;
    if (this.session.flow === "quote_material_pricing" && pricing?.current) {
      const jobId = pricing.target.kind === "job" ? pricing.target.jobId : null;
      await this.ctx.db.run("UPDATE attachments SET classification = 'recibo', job_id = COALESCE(?, job_id) WHERE id = ?", jobId, photo.attachmentId);
      const caption = this.input.text.trim();
      if (caption) return pricingText(this, caption, await interpret(this.ctx, caption));
      pricing.current.step = "ask_price";
      this.say(`Guardei a foto junto do orçamento. 📸 ${photo.visionHint ? `Pela imagem, parece: ${photo.visionHint} (isso é só uma sugestão). ` : ""}Qual é o valor que aparece nela? Pode me dizer, por exemplo: "90 reais a lata de 900 ml".`);
      return;
    }
    const existing = await this.ctx.db.first<{ job_id: string | null; id: string }>(
      "SELECT job_id, id FROM attachments WHERE sha256 = ? AND id <> ? AND job_id IS NOT NULL AND deleted_at IS NULL LIMIT 1",
      photo.hash,
      photo.attachmentId,
    );
    if (existing?.job_id) {
      const job = await getJob(this.ctx, existing.job_id);
      await this.ctx.db.run("UPDATE attachments SET deleted_at = ? WHERE id = ?", this.ctx.clock().toISOString(), photo.attachmentId);
      if (job) {
        this.say(`Essa foto eu já tinha guardado ${em(job)}.`);
        return;
      }
    }
    const caption = this.input.text.trim();
    if (caption) {
      const nlu = await interpret(this.ctx, caption);
      if (nlu.entities.furnitureType || nlu.intent === "new_job") {
        return this.newJobMention(caption, nlu, { photoHash: photo.hash, photoAttachmentId: photo.attachmentId });
      }
    }
    if (this.session.activeJobId && ["collecting", "confirm_calc"].includes(this.session.flow)) {
      const job = await getJob(this.ctx, this.session.activeJobId);
      if (job) {
        await this.ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ?", job.id, photo.attachmentId);
        this.say(`Guardei a foto ${em(job)}.${photo.visionHint ? ` (Pela foto, parece: ${photo.visionHint}. Isso é só uma sugestão.)` : ""}`);
        const q = this.session.lastQuestion;
        if (q) this.say(questionFor(q).text, questionFor(q).buttons);
        return;
      }
    }
    (this.session.context as { pendingPhoto?: string; pendingPhotoHash?: string }).pendingPhoto = photo.attachmentId;
    (this.session.context as { pendingPhotoHash?: string }).pendingPhotoHash = photo.hash;
    const jobs = await listActiveJobs(this.ctx, 5);
    const rows: Button[][] = jobs.map((j) => [{ text: capitalize(jobPhrase(j)).slice(0, 60), data: `photo:job:${j.id}` }]);
    rows.push([{ text: "É um móvel novo", data: "photo:new" }]);
    this.say(`Recebi a foto.${photo.visionHint ? ` Parece: ${photo.visionHint} (só uma sugestão).` : ""} De qual serviço ela é?`, rows);
  }

  async onPhotoChoice(action: string, jobId?: string): Promise<void> {
    const ctxPhoto = this.session.context as { pendingPhoto?: string; pendingPhotoHash?: string };
    const attId = ctxPhoto.pendingPhoto;
    if (!attId) {
      this.say("Não encontrei a foto. Pode mandar de novo?");
      return;
    }
    if (action === "job" && jobId) {
      const job = await getJob(this.ctx, jobId);
      if (!job) return;
      await this.ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ?", job.id, attId);
      delete ctxPhoto.pendingPhoto;
      delete ctxPhoto.pendingPhotoHash;
      this.session.activeJobId = job.id;
      this.say(`Guardei a foto ${em(job)}.`);
      return;
    }
    this.session.flow = "intake";
    this.session.context.mention = { text: "", source: "telegram_photo", photoHash: ctxPhoto.pendingPhotoHash ?? "", photoAttachmentId: attId, descriptors: [], techniques: [], lengthsM: [], explicitNew: false, referencesExisting: false };
    delete ctxPhoto.pendingPhoto;
    this.say(questionFor("furniture_type").text, questionFor("furniture_type").buttons);
  }

  // ------------------------------------------------------------- gastos
  async startExpense(text: string, nlu: NluResult): Promise<void> {
    const norm = normalizeText(text);
    // várias coisas numa compra só ("tinta, verniz e lixa por 300"): o total NUNCA vira preço de um material
    const mats = [...new Set([...norm.matchAll(new RegExp(`\\b(${Object.keys(MATERIAL_WORDS).join("|")})\\b`, "g"))].map((m) => m[1]!))];
    const mixed = mats.length > 1;
    const matWord = mixed ? null : nlu.entities.materialMention;
    const materialKey = matWord ? (MATERIAL_WORDS[matWord] ?? null) : null;
    const packages = extractCount(text, /^(lata|latas|galao|galoes|pote|potes|frasco|frascos|caixa|caixas)$/) ?? (/\b(uma lata|um galao|um pote|um frasco)\b/.test(norm) ? 1 : null);
    const description = mixed ? humanList(mats) : matWord ? `${matWord}${packages ? ` (${packages} emb.)` : ""}` : TRANSPORT_RE.exec(norm)?.[1] ?? text.slice(0, 80);
    const packageSize = materialKey ? parsePackageSize(text, materialKey) : null;
    this.session.flow = "expense";
    this.session.context.expense = { description, materialKey, packages, packageSize, step: "job" };
    if (nlu.entities.amountCents) this.setExpenseAmount(nlu.entities.amountCents, text);
    if (!nlu.entities.amountCents) {
      this.session.context.expense.step = "amount";
      this.say(mixed ? `Quanto deu a compra toda (${description})?` : `Quanto foi ${matWord ? `${MATERIAL_ARTICLE[matWord] ?? "o"} ${matWord}` : "esse gasto"}?`);
      return;
    }
    if (mixed) this.say(`Anotei como uma compra só de ${description}. Como o valor é do conjunto, não uso ele como preço de nenhum material sozinho.`);
    return this.askExpensePackage();
  }

  /** Valor dito com "cada"/"por lata" é por embalagem: total = unitário × embalagens (quando já sabidas). */
  setExpenseAmount(cents: number, text: string): void {
    const e = this.session.context.expense!;
    const each = /\b(cada|cada uma|cada um|a unidade|por unidade|por lata|por galao|o litro)\b/.test(normalizeText(text));
    if (each) {
      e.unitCents = cents;
      if (e.packages) e.amountCents = cents * e.packages;
      else delete e.amountCents;
    } else {
      e.amountCents = cents;
      delete e.unitCents;
    }
  }

  async askExpensePackage(): Promise<void> {
    const e = this.session.context.expense!;
    if (!e.materialKey || TRANSPORT_RE.test(normalizeText(e.description ?? ""))) return this.askExpenseJob();
    const needsSize = !["lixa", "folha_ouro"].includes(e.materialKey);
    if (!needsSize && !e.packageSize) e.packageSize = (await getMaterialByKey(this.ctx, e.materialKey))?.packageSize ?? "1";
    if (!e.packages || (needsSize && !e.packageSize)) {
      e.step = "package";
      const material = await getMaterialByKey(this.ctx, e.materialKey);
      const name = material?.name.toLowerCase() ?? e.description;
      // pergunta só o que falta (ele já disse "duas latas"? então só o tamanho)
      this.say(
        e.packages
          ? `Só para eu aprender direitinho, ${this.firstName}: ${e.packages > 1 ? `cada uma das ${e.packages} embalagens` : "a embalagem"} de ${name} era de que tamanho?\n\nPor exemplo: “900 ml” ou “3,6 litros”.`
          : `Só para eu aprender direitinho, ${this.firstName}: foram quantas embalagens de ${name} e qual era o tamanho de cada uma?\n\nPor exemplo: “1 lata de 900 ml” ou “2 galões de 3,6 litros”.`,
      );
      return;
    }
    return this.askExpenseJob();
  }

  async askExpenseJob(): Promise<void> {
    const jobs = await listActiveJobs(this.ctx, 5);
    const e = this.session.context.expense!;
    if (jobs.length === 0) {
      e.jobId = null;
      return this.confirmExpense();
    }
    e.step = "job";
    const active = this.session.activeJobId;
    const sorted = active ? [...jobs].sort((a, b) => (a.id === active ? -1 : b.id === active ? 1 : 0)) : jobs;
    const rows: Button[][] = sorted.map((j) => [{ text: capitalize(jobPhrase(j)).slice(0, 60), data: `exp:job:${j.id}` }]);
    rows.push([{ text: "Estoque geral (sem serviço)", data: "exp:job:geral" }]);
    this.say(`Esse gasto de ${formatBRL(e.amountCents!)} é para qual serviço?`, rows);
  }

  async confirmExpense(): Promise<void> {
    const e = this.session.context.expense!;
    e.step = "confirm";
    const job = e.jobId ? await getJob(this.ctx, e.jobId) : null;
    const breakdown = e.unitCents && e.packages && e.packages > 1 ? ` (${e.packages} × ${formatBRL(e.unitCents)})` : "";
    this.say(`Vou anotar: compra de ${e.description}, ${formatBRL(e.amountCents!)}${breakdown} — ${job ? `para ${jobPhrase(job)}` : "estoque geral"}.

Está certo? Pode responder "sim" ou "não".`, [
      [
        { text: "Sim, pode anotar", data: "exp:confirm" },
        { text: "Não, corrigir o valor", data: "exp:fix" },
      ],
    ]);
  }

  async expenseText(text: string, nlu: NluResult): Promise<void> {
    const e = this.session.context.expense ?? { step: "amount" as const };
    this.session.context.expense = e;
    if (e.step === "amount") {
      const amount = nlu.entities.amountCents ?? parseLooseAmount(text);
      if (!amount) {
        this.say("Não entendi o valor. Pode dizer só o número, por exemplo: 90 reais.");
        return;
      }
      // compra mista com valor de só UM item ("a tinta foi 120, o resto eu não lembro"):
      // registra só esse item; o resto fica sem valor (nunca rateado por chute)
      const n = normalizeText(text);
      const named = Object.keys(MATERIAL_WORDS).filter((w) => new RegExp(`\\b${w}\\b`).test(n));
      if (!e.materialKey && named.length === 1 && /\b(resto|outros?|outras?|demais)\b/.test(n) && /\b(nao (sei|lembro)|esqueci|sei la)\b/.test(n)) {
        const rest = (e.description ?? "").split(/,\s*|\s+e\s+/).filter((x) => x && x !== named[0]);
        e.description = named[0]!;
        e.materialKey = MATERIAL_WORDS[named[0]!] ?? null;
        this.setExpenseAmount(amount, text);
        this.say(`Certo: anoto só ${MATERIAL_ARTICLE[named[0]!] ?? "o"} ${named[0]} por ${formatBRL(amount)}.${rest.length ? ` ${capitalize(humanList(rest))} ${rest.length > 1 ? "ficam" : "fica"} sem valor por enquanto — se lembrar depois, é só me falar.` : ""}`);
        return this.askExpensePackage();
      }
      this.setExpenseAmount(amount, text);
      if (e.amountCents === undefined && !e.packages) return this.askExpensePackage();
      if (!e.description || e.description === "") {
        const mat = nlu.entities.materialMention;
        e.description = mat ?? (TRANSPORT_RE.exec(normalizeText(text))?.[1] ?? "material");
        e.materialKey = mat ? (MATERIAL_WORDS[mat] ?? null) : null;
      }
      return this.askExpensePackage();
    }
    if (e.step === "package") {
      const count = extractPackageCount(text);
      const size = e.materialKey ? parsePackageSize(text, e.materialKey) : null;
      if (count) e.packages = count;
      if (size) e.packageSize = size;
      // "foi 150 cada" dito depois: o valor anterior era por embalagem
      const lateAmount = nlu.entities.amountCents ?? parseLooseAmount(text.replace(/\d+(?:[.,]\d+)?\s*(ml|l|litros?|kg|g|folhas?)\b/gi, " "));
      if (lateAmount && /\b(cada|por lata|por galao|a unidade)\b/.test(normalizeText(text))) this.setExpenseAmount(lateAmount, text);
      // valor era "cada": agora que sabemos quantas embalagens, fecha o total
      if (e.unitCents && e.packages) e.amountCents = e.unitCents * e.packages;
      const needsSize = !!e.materialKey && !["lixa", "folha_ouro"].includes(e.materialKey);
      if (!e.packages || (needsSize && !e.packageSize)) {
        this.say(`Ainda faltou ${!e.packages ? "a quantidade de embalagens" : "o tamanho da embalagem"}. Pode me dizer, por exemplo: “1 lata de 900 ml”.`);
        return;
      }
      return this.askExpenseJob();
    }
    if (nlu.intent === "yes" && e.step === "confirm") return this.onExpense("confirm");
    if (nlu.intent === "no" && e.step === "confirm") return this.onExpense("fix");
    this.say("Use os botões acima para confirmar, ou diga \"cancelar\".");
  }

  async onExpense(action: string, arg?: string): Promise<void> {
    const e = this.session.context.expense;
    if (!e) return this.greet();
    if (action === "job") {
      e.jobId = arg === "geral" ? null : (arg ?? null);
      return this.confirmExpense();
    }
    if (action === "fix") {
      e.step = "amount";
      this.say("Sem problema. Qual é o valor certo? Por exemplo: \"90 reais\". Se quiser desistir, é só dizer \"cancelar\".");
      return;
    }
    if (action === "cancel") {
      delete this.session.context.expense;
      this.say("Tudo bem, não anotei nada.");
      return this.endSideAction();
    }
    if (action === "force") e.sequence = (e.sequence ?? 0) + 1;
    if (action !== "confirm" && action !== "force") return;
    const isTransport = TRANSPORT_RE.test(normalizeText(e.description ?? ""));
    const key = await financialIdempotencyKey(this.ctx, { userId: this.input.user.id, kind: isTransport ? "expense" : "purchase", amountCents: e.amountCents!, jobId: e.jobId ?? null, description: e.description ?? "", ...(e.sequence ? { sequence: e.sequence } : {}) });
    let result;
    if (isTransport) {
      result = await recordExpense(this.ctx, { jobId: e.jobId ?? null, category: "transporte", description: e.description ?? "transporte", amountCents: e.amountCents!, actor: this.input.user.id, idempotencyKey: key });
    } else {
      const mat = e.materialKey ? await getMaterialByKey(this.ctx, e.materialKey) : null;
      result = await recordPurchase(this.ctx, { materialId: mat?.id ?? null, description: e.description ?? "material", amountCents: e.amountCents!, packages: e.packages ?? null, jobId: e.jobId ?? null, actor: this.input.user.id, idempotencyKey: key });
      if (result.kind === "created" && e.materialKey && e.packages && e.packageSize) {
        await learnFromConfirmedPurchase(this.ctx, {
          userId: this.input.user.id,
          jobId: e.jobId ?? null,
          messageId: this.input.inboundMessageId,
          materialKey: e.materialKey,
          totalCents: e.amountCents!,
          packages: e.packages,
          packageSize: e.packageSize,
        });
      }
    }
    if (result.kind === "duplicate") {
      this.say(`Esse gasto (${e.description}, ${formatBRL(e.amountCents!)}) já está anotado hoje. Não vou lançar de novo. É um outro gasto igual?`, [
        [
          { text: "É outro gasto", data: "exp:force" },
          { text: "Não, é o mesmo", data: "exp:cancel" },
        ],
      ]);
      return;
    }
    delete this.session.context.expense;
    this.say(
      isTransport
        ? `Anotado: ${e.description}, ${formatBRL(e.amountCents!)}.`
        : `Anotado: compra de ${e.description}, ${formatBRL(e.amountCents!)}.${e.materialKey && e.packages && e.packageSize ? " Também atualizei o preço de reposição desse material com o que você confirmou. Obrigado por me ensinar! 🙂" : ""} Isso conta como dinheiro que saiu. O valor do material usado em cada serviço entra no orçamento separado, sem contar duas vezes.`,
    );
    await this.endSideAction();
  }

  // ------------------------------------------------------------- pagamentos
  async startPayment(nlu: NluResult): Promise<void> {
    this.session.flow = "payment";
    this.session.context.payment = {
      ...(nlu.entities.amountCents ? { amountCents: nlu.entities.amountCents } : {}),
      ...(nlu.entities.clientName ? { clientName: nlu.entities.clientName } : {}),
      step: nlu.entities.amountCents ? "job" : "amount",
    };
    if (!nlu.entities.amountCents) {
      this.say("Quanto você recebeu?");
      return;
    }
    return this.askPaymentJob();
  }

  async askPaymentJob(): Promise<void> {
    const p = this.session.context.payment!;
    const jobs = (await listActiveJobs(this.ctx, 50)).filter((j) => j.status !== "CANCELADO");
    let options = jobs;
    if (p.clientName) {
      options = jobs.filter((j) => {
        const c = (j.facts.client_name?.value as string | undefined) ?? j.clientName;
        return c ? clientMatches(c, [], p.clientName!) >= 0.85 : false;
      });
    }
    if (options.length === 1) {
      p.jobId = options[0]!.id;
      return this.confirmPayment();
    }
    if (options.length === 0) options = jobs;
    if (options.length === 0) {
      this.say("Ainda não tenho nenhum serviço anotado para vincular esse pagamento. Me conta primeiro sobre o serviço?");
      delete this.session.context.payment;
      this.session.flow = "idle";
      return;
    }
    p.step = "job";
    const rows: Button[][] = options.slice(0, 6).map((j) => [{ text: capitalize(jobPhrase(j)).slice(0, 60), data: `pay:job:${j.id}` }]);
    rows.push([{ text: "Cancelar", data: "pay:cancel" }]);
    this.say(`O pagamento de ${formatBRL(p.amountCents!)} é de qual serviço?`, rows);
  }

  async confirmPayment(): Promise<void> {
    const p = this.session.context.payment!;
    p.step = "confirm";
    const job = p.jobId ? await getJob(this.ctx, p.jobId) : null;
    if (!job) return this.askPaymentJob();
    const client = (job.facts.client_name?.value as string | undefined) ?? job.clientName ?? p.clientName ?? "cliente";
    this.say(`Vou anotar: recebi ${formatBRL(p.amountCents!)} de ${client}, referente ${aPrep(job)} (${job.code}).

Está certo? Pode responder "sim" ou "não".`, [
      [
        { text: "Sim, pode anotar", data: "pay:confirm" },
        { text: "Não, corrigir o valor", data: "pay:fix" },
      ],
    ]);
  }

  async paymentText(text: string, nlu: NluResult): Promise<void> {
    const p = this.session.context.payment ?? { step: "amount" as const };
    this.session.context.payment = p;
    if (p.step === "amount") {
      const amount = nlu.entities.amountCents ?? parseLooseAmount(text);
      if (!amount) {
        this.say("Não entendi o valor. Pode dizer só o número, por exemplo: 200 reais.");
        return;
      }
      p.amountCents = amount;
      if (nlu.entities.clientName) p.clientName = nlu.entities.clientName;
      return this.askPaymentJob();
    }
    if (nlu.intent === "yes" && p.step === "confirm") return this.onPayment("confirm");
    if (nlu.intent === "no" && p.step === "confirm") return this.onPayment("fix");
    this.say("Use os botões acima para confirmar, ou diga \"cancelar\".");
  }

  async onPayment(action: string, arg?: string): Promise<void> {
    const p = this.session.context.payment;
    if (!p) return this.greet();
    if (action === "job") {
      p.jobId = arg ?? null;
      return this.confirmPayment();
    }
    if (action === "fix") {
      p.step = "amount";
      this.say("Sem problema. Qual é o valor certo? Por exemplo: \"90 reais\". Se quiser desistir, é só dizer \"cancelar\".");
      return;
    }
    if (action === "cancel") {
      delete this.session.context.payment;
      this.say("Tudo bem, não anotei nada.");
      return this.endSideAction();
    }
    if (action === "force") p.sequence = (p.sequence ?? 0) + 1;
    if (action !== "confirm" && action !== "force") return;
    const key = await financialIdempotencyKey(this.ctx, { userId: this.input.user.id, kind: "payment", amountCents: p.amountCents!, jobId: p.jobId ?? null, description: "pagamento", ...(p.sequence ? { sequence: p.sequence } : {}) });
    const r = await recordPayment(this.ctx, { jobId: p.jobId!, amountCents: p.amountCents!, actor: this.input.user.id, idempotencyKey: key });
    if (r.kind === "duplicate") {
      this.say(`Já anotei hoje um pagamento de ${formatBRL(p.amountCents!)} nesse serviço. Não vou lançar de novo. É um outro pagamento?`, [
        [
          { text: "É outro pagamento", data: "pay:force" },
          { text: "Não, é o mesmo", data: "pay:cancel" },
        ],
      ]);
      return;
    }
    const jobId = p.jobId!;
    delete this.session.context.payment;
    this.session.flow = this.session.activeJobId ? "collecting" : "idle";
    const bal = await jobBalance(this.ctx, jobId);
    if (bal.contractedCents === null) {
      const q = await latestQuoteForJob(this.ctx, jobId);
      const ref = q?.finalPriceCents ?? q?.recommendedCents ?? null;
      this.say(`Anotado! Recebido até agora: ${formatBRL(bal.paidCents)}.${ref ? ` O orçamento atual é ${formatBRL(ref)}, mas ainda não foi marcado como aceito pelo cliente.` : " Ainda não temos o valor fechado desse serviço."}`);
    } else {
      this.say(`Anotado! Já recebeu ${formatBRL(bal.paidCents)} de ${formatBRL(bal.contractedCents)}. ${bal.balanceCents! > 0 ? `Falta ${formatBRL(bal.balanceCents!)}.` : "Está quitado!"}`);
    }
    await this.endSideAction();
  }

  // ------------------------------------------------------------- andamento
  async startProgress(text: string, nlu: NluResult): Promise<void> {
    const progress = nlu.entities.progress;
    // nunca presumir andamento: sem evidência explícita, não há transição
    if (!progress) return this.endSideAction();
    // andamento de uma peça que ainda está no orçamento sendo montado: não existe serviço para marcar;
    // reconhece, não cria nada e volta ao orçamento (o objetivo não se perde)
    const suspended = this.session.context.goalStack?.at(-1);
    const qrDraft = suspended?.flow === "quote_request" ? suspended.context.quoteRequest : undefined;
    if (qrDraft && !qrDraft.jobByRef && (!nlu.entities.furnitureType || qrDraft.draft.items.some((i) => i.furnitureType === nlu.entities.furnitureType))) {
      this.say(`Que bom, anotei que você já começou${nlu.entities.furnitureType ? ` ${furnitureArticleOf(nlu.entities.furnitureType)} ${furnitureLabel(nlu.entities.furnitureType)}` : ""} 👍 A peça ainda está no orçamento que estamos montando — quando virar serviço, eu registro o andamento.`);
      return this.endSideAction();
    }
    const job = await this.findJobFromMention(text, nlu);
    if (!job) return;
    if (progress === "nao_iniciado" || progress === "parado") {
      await addJobEvent(this.ctx, job.id, "andamento_informado", { progress }, this.input.user.id);
      this.say(progress === "nao_iniciado" ? `Certo, anotado que ${jobPhrase(job)} ainda não começou.` : `Certo, anotado que ${jobPhrase(job)} está parado por enquanto.`);
      return this.endSideAction();
    }
    const to: "EM_EXECUCAO" | "CONCLUIDO" | "ENTREGUE" = progress === "entregue" ? "ENTREGUE" : progress === "concluido" ? "CONCLUIDO" : "EM_EXECUCAO";
    this.setPending({ type: "job_operational_status", entity: { kind: "job", id: job.id } });
    this.session.flow = "progress_confirm";
    this.session.context.progress = { jobId: job.id, to };
    const label = { EM_EXECUCAO: "em execução", CONCLUIDO: "concluído", ENTREGUE: "entregue" }[to];
    this.say(`Vou marcar ${jobPhrase(job)} como ${label}. Confirma?`, [
      [
        { text: "Confirmar", data: "prog:confirm" },
        { text: "Cancelar", data: "cmd:cancel" },
      ],
    ]);
  }

  async onProgress(action: string): Promise<void> {
    const p = this.session.context.progress;
    if (!p || action !== "confirm") return this.cancel();
    delete this.session.context.progress;
    this.session.flow = "idle";
    let learning = false;
    try {
      const job = await transitionJob(this.ctx, p.jobId, p.to as JobStatus, this.input.user.id);
      this.say(`Pronto: ${jobPhrase(job)} agora está ${JOB_STATUS_LABEL[job.status].toLowerCase()}.`);
      if (p.to === "ENTREGUE") {
        const bal = await jobBalance(this.ctx, job.id);
        if (bal.balanceCents && bal.balanceCents > 0) this.say(`Lembrete: ainda falta receber ${formatBRL(bal.balanceCents)} desse serviço.`);
      }
      if (p.to === "CONCLUIDO") {
        learning = true;
        this.session.flow = "learning_time";
        this.session.context.learning = { jobId: job.id, step: "hours" };
        this.say(`Que ótimo! 🎉 Só mais uma curiosidade para eu aprender com o seu jeito de trabalhar: mais ou menos quantas horas de trabalho você gastou ${em(job)}?\n\nPode responder, por exemplo: “6 horas”.`);
      }
    } catch {
      const job = await getJob(this.ctx, p.jobId);
      this.say(`Não dá para mudar ${job ? jobPhrase(job) : "esse serviço"} direto para esse estado agora (está ${job ? JOB_STATUS_LABEL[job.status].toLowerCase() : "?"}).`);
    }
    if (!learning) await this.endSideAction();
  }

  async learningTimeText(text: string): Promise<void> {
    const learning = this.session.context.learning;
    if (!learning) {
      this.session.flow = "idle";
      return this.greet();
    }
    if (/\b(nao sei|não sei|nao lembro|não lembro)\b/i.test(text)) {
      delete this.session.context.learning;
      this.session.flow = "idle";
      this.say("Sem problema nenhum. Quando lembrar, pode me contar. Cada serviço me ajuda a entender melhor o seu trabalho. 🙂");
      return this.endSideAction();
    }
    const hours = parseHours(text);
    if (!hours) {
      this.say("Não consegui entender o tempo. Pode responder, por exemplo: “6 horas” ou “2 horas e meia”. Se não lembrar, pode dizer “não sei”.");
      return;
    }
    const job = await getJob(this.ctx, learning.jobId);
    if (!job) {
      delete this.session.context.learning;
      this.session.flow = "idle";
      return;
    }
    const techniques = (job.facts.techniques?.value as string[] | null | undefined) ?? [];
    await recordTechniqueTimeObservation(this.ctx, {
      userId: this.input.user.id,
      jobId: job.id,
      messageId: this.input.inboundMessageId,
      techniqueKeys: techniques,
      hours,
    });
    delete this.session.context.learning;
    this.session.flow = "idle";
    this.say(`Perfeito, anotei ${hours.replace(".", ",")} horas. Obrigado, ${this.firstName}! Vou comparar com os próximos serviços para aprender sem tirar conclusão por uma experiência só. 🧠`);
    await this.endSideAction();
  }

  /** Para consultas e andamento: encontra o projeto citado (somente leitura até confirmar). */
  async findJobFromMention(text: string, nlu: NluResult): Promise<Job | null> {
    const pm = toProjectMention(this.mention(text, nlu));
    if (!pm.furnitureType && !pm.clientName) {
      if (this.session.activeJobId) return getJob(this.ctx, this.session.activeJobId);
      await this.listJobs("De qual serviço você está falando?");
      return null;
    }
    const candidates = await loadCandidates(this.ctx);
    const d = decideMatch(pm, candidates, this.ctx.clock());
    if (d.kind === "confirm_single") return getJob(this.ctx, d.candidate.jobId);
    if (d.kind === "choose_among" || d.kind === "confirm_new_despite_similar") {
      const ids = d.kind === "choose_among" ? d.candidates.map((c) => c.jobId) : [d.candidate.jobId];
      const rows: Button[][] = [];
      for (const id of ids) {
        const j = await getJob(this.ctx, id);
        if (j) rows.push([{ text: capitalize(jobPhrase(j)).slice(0, 60), data: `job:open:${j.id}` }]);
      }
      this.say("Qual deles?", rows);
      return null;
    }
    await this.listJobs("Não achei esse serviço. É algum destes?");
    return null;
  }

  async queryStatus(text: string, nlu: NluResult): Promise<void> {
    const job = await this.findJobFromMention(text, nlu);
    if (job) await this.describeJob(job);
  }

  async describeJob(job: Job): Promise<void> {
    const s = summarizeJob(job);
    const bal = await jobBalance(this.ctx, job.id);
    const q = await latestQuoteForJob(this.ctx, job.id);
    const lines = [`${s.headline} (${job.code})`, `Situação: ${JOB_STATUS_LABEL[job.status]}`];
    if (s.confirmed.length) lines.push(`Já anotado: ${s.confirmed.join("; ")}`);
    if (s.pending.length) lines.push(`Ainda falta saber: ${s.pending.map((f) => FIELD_LABEL[f]).slice(0, 4).join("; ")}`);
    if (q) lines.push(`Orçamento: ${q.status.toLowerCase().replace(/_/g, " ")}${q.finalPriceCents ? ` — ${formatBRL(q.finalPriceCents)}` : ""}`);
    if (bal.paidCents > 0 || bal.contractedCents) lines.push(`Recebido: ${formatBRL(bal.paidCents)}${bal.balanceCents !== null ? ` — falta ${formatBRL(Math.max(0, bal.balanceCents))}` : ""}`);
    this.session.activeJobId = job.id;
    this.say(lines.join("\n"), s.pending.length ? [[{ text: "Continuar este", data: "cmd:continue" }]] : undefined);
  }

  async openJob(jobId: string): Promise<void> {
    const job = await getJob(this.ctx, jobId);
    if (!job) {
      this.say("Não achei esse serviço.");
      return;
    }
    await this.describeJob(job);
  }

  async listJobs(title = "Seus serviços:"): Promise<void> {
    const jobs = await listActiveJobs(this.ctx, 8);
    if (jobs.length === 0) {
      this.say("Ainda não tem nenhum serviço anotado. Quando pegar um móvel, é só me contar, por exemplo: \"peguei uma cômoda da dona Ana para fazer pátina\".");
      return;
    }
    const rows: Button[][] = jobs.map((j) => [{ text: `${capitalize(jobPhrase(j))} — ${JOB_STATUS_LABEL[j.status]}`.slice(0, 60), data: `job:open:${j.id}` }]);
    this.say(title, rows);
  }

  async agenda(): Promise<void> {
    const jobs = await listJobs2(this.ctx);
    if (jobs.length === 0) {
      this.say("Agenda vazia por enquanto.");
      return;
    }
    const lines = ["Sua agenda:"];
    for (const j of jobs) {
      const deadline = j.facts.deadline?.value as string | undefined;
      lines.push(`• ${capitalize(jobPhrase(j))} — ${JOB_STATUS_LABEL[j.status].toLowerCase()}${deadline && deadline !== "sem prazo" ? ` (prazo: ${deadline})` : ""}`);
    }
    this.say(lines.join("\n"));
  }

  // ------------------------------------------------------------- admin
  async onAdmin(action: string, quoteId?: string): Promise<void> {
    if (this.input.user.role !== "ADMIN") {
      this.say("Essa opção não está disponível.");
      return;
    }
    if (action === "approve_confirm" && quoteId) {
      this.session.flow = "idle";
      delete this.session.context.adminAction;
      const q = await approveQuote(this.ctx, quoteId, this.input.user.id, { finalPriceCents: null });
      this.say(`Aprovado: ${q.finalPriceCents ? formatBRL(q.finalPriceCents) : ""}. O artesão será avisado.`);
      return;
    }
    await this.cancel();
  }
}


/** Texto-guia: mostra o caminho com exemplos concretos, sem botões. */
const GUIDE = [
  "Você pode me contar, por exemplo:",
  "• um móvel novo: \"peguei uma cadeira do seu João para pintar\"",
  "• um gasto: \"gastei 90 reais em verniz\"",
  "• um pagamento: \"a dona Maria me pagou 200 reais\"",
  "• ou perguntar: \"quais serviços eu tenho?\"",
].join("\n");

/** Nomes curtos e claros de cada informação, para resumos e pendências. */
/** Tipo de pergunta pendente para cada campo do fluxo de um serviço. */
const FIELD_QUESTION_TYPE: Record<ProjectField, PendingQuestionType> = {
  furniture_type: "furniture_type",
  techniques: "service_type",
  client_name: "client_identity",
  condition: "item_condition",
  dimensions: "item_dimensions",
  size_class: "item_dimensions",
  surfaces: "service_scope",
  details: "job_field",
  repairs: "job_field",
  subcontract: "job_field",
  logistics: "logistics",
  material_status: "material_source",
  application_method: "application_method",
  deadline: "job_field",
  payment_terms: "job_field",
  scope: "service_scope",
};

const FIELD_LABEL: Record<ProjectField, string> = {
  furniture_type: "qual é o móvel",
  techniques: "qual trabalho vai ser feito",
  client_name: "de quem é o móvel",
  condition: "como o móvel está",
  dimensions: "o tamanho do móvel",
  size_class: "o tamanho do móvel",
  surfaces: "se é só por fora ou por dentro também",
  details: "os detalhes especiais",
  repairs: "se precisa de conserto",
  subcontract: "se alguma parte vai para outro profissional",
  logistics: "se precisa buscar ou entregar",
  material_status: "se você já tem o material",
  application_method: "se vai usar pincel, rolo ou pistola",
  deadline: "o prazo combinado",
  payment_terms: "como o cliente vai pagar",
  scope: "se é só o tampo ou a peça inteira",
};

/** "Pergunta 3 de 11": deixa claro quanto falta (previsibilidade). */
/** Bloqueio do cálculo que o artesão consegue resolver respondendo uma pergunta. */
const BLOCKER_FIELD: Record<string, ProjectField> = { METHOD_REQUIRED: "application_method", AREA_UNKNOWN: "dimensions", TECHNIQUE_UNKNOWN: "techniques" };
export function blockingField(job: Job, blockers: readonly { code: string; ref?: string }[]): ProjectField | null {
  for (const b of blockers) {
    const field = BLOCKER_FIELD[b.code];
    // técnica com ref = técnica não cadastrada (ajuste do administrador, não pergunta)
    if (!field || (b.code === "TECHNIQUE_UNKNOWN" && b.ref)) continue;
    if (job.facts[field]?.status !== "confirmed") return field;
  }
  return null;
}

function priceRangePhrase(p: PriceRangePreview): string {
  const value = p.minCents === p.maxCents ? `deve ficar por volta de ${formatBRL(p.minCents)}` : `deve ficar entre ${formatBRL(p.minCents)} e ${formatBRL(p.maxCents)}`;
  return `${value}${p.withoutTransport ? " (sem contar frete)" : ""}`;
}

function mentionsMaterial(text: string): boolean {
  const n = normalizeText(text);
  return Object.keys(MATERIAL_WORDS).some((w) => n.split(/[^a-z0-9]+/).includes(w));
}

function specificValue(a: ParsedAnswer): string | undefined {
  return a.kind === "value" && a.strength === "specific" ? String(a.value) : undefined;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!;
}

function questionProgress(facts: Job["facts"], baseSkip: ProjectField[] = []): { current: number; total: number } {
  let remaining = 0;
  const skip: ProjectField[] = [...baseSkip];
  let f = nextQuestion(facts, skip);
  while (f && remaining < 30) {
    remaining++;
    skip.push(f);
    f = nextQuestion(facts, skip);
  }
  const answered = QUESTION_ORDER.filter((field) => {
    if (OPTIONAL_FIELDS.includes(field)) return false;
    if (field === "dimensions") return !!(facts.dimensions || facts.size_class);
    return !!facts[field];
  }).length;
  return { current: answered + 1, total: answered + remaining };
}

const TECHNIQUE_MATERIALS: Record<string, string[]> = {
  pintura_lisa: ["lixa", "fundo_preparador", "tinta_esmalte"],
  patina: ["lixa", "fundo_preparador", "tinta_base_patina", "betume_patina"],
  decape: ["lixa", "tinta_esmalte"],
  folha_ouro: ["cola_mordente", "folha_ouro"],
  verniz: ["verniz"],
  cera: ["cera"],
  restauracao: ["lixa", "massa_madeira"],
};

function materialKeysForJob(job: Job): string[] {
  const techniques = (job.facts.techniques?.value as string[] | null | undefined) ?? [];
  return [...new Set(techniques.flatMap((key) => TECHNIQUE_MATERIALS[key] ?? []))];
}

function humanList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function extractPackageCount(text: string): number | null {
  return (
    extractCount(text, /^(lata|latas|galao|galoes|litro|litros|pote|potes|frasco|frascos|caixa|caixas|pacote|pacotes|embalagem|embalagens)$/) ??
    (/\b(uma|um)\s+(lata|galao|pote|frasco|caixa|pacote|embalagem)\b/.test(normalizeText(text)) ? 1 : null)
  );
}

/** Converte ml/L ou g/kg para a unidade base cadastrada (L ou kg). */
function parsePackageSize(text: string, materialKey: string): string | null {
  const norm = normalizeText(text).replace(/,/g, ".");
  const m = /(\d+(?:\.\d+)?)\s*(ml|mililitros?|l|litros?|g|gramas?|kg|quilos?)\b/.exec(norm);
  if (!m) return null;
  let value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2]!;
  const liquid = !["massa_madeira", "cera"].includes(materialKey);
  if (liquid && /^(ml|mililitro)/.test(unit)) value /= 1000;
  if (!liquid && /^(g|grama)/.test(unit)) value /= 1000;
  return String(Number(value.toFixed(4)));
}

async function listJobs2(ctx: Ctx): Promise<Job[]> {
  return (await listActiveJobs(ctx, 20)).filter((j) => ACTIVE_JOB_STATUSES.includes(j.status));
}

function splitData(data: string): [string, string, string | undefined] {
  const [ns = "", action = "", ...rest] = data.split(":");
  return [ns, action, rest.length ? rest.join(":") : undefined];
}

function matchButtons(withUnsure = true): Button[][] {
  const row: Button[] = [
    { text: "Sim, é essa", data: "match:yes" },
    { text: "Não, é outro serviço", data: "match:no" },
  ];
  return withUnsure ? [row, [{ text: "Não tenho certeza", data: "match:unsure" }]] : [row];
}

function toProjectMention(m: MentionSnapshot): ProjectMention {
  return {
    text: m.text,
    descriptors: m.descriptors ?? [],
    techniques: m.techniques ?? [],
    ...(m.furnitureType ? { furnitureType: m.furnitureType } : {}),
    ...(m.clientName ? { clientName: m.clientName } : {}),
    ...(m.photoHash ? { photoHash: m.photoHash } : {}),
    explicitNew: !!m.explicitNew,
    referencesExisting: !!m.referencesExisting,
  };
}

function hasProjectInfo(nlu: NluResult): boolean {
  const e = nlu.entities;
  return !!(e.furnitureType || e.techniques.length || e.clientName || e.lengthsM.length || e.sizeClass || e.materialStatus || e.method || e.surfaces);
}

/** Contrações: "a cristaleira…" → "da cristaleira…" / "na cristaleira…" / "à cristaleira…". */
function de(job: Job): string {
  return `d${jobPhrase(job)}`;
}
function em(job: Job): string {
  return `n${jobPhrase(job)}`;
}
function aPrep(job: Job): string {
  const p = jobPhrase(job);
  return p.startsWith("a ") ? `à ${p.slice(2)}` : `ao ${p.slice(2)}`;
}

function furnitureArticleOf(type: string | null | undefined): "a" | "o" {
  return type && ["cristaleira", "comoda", "mesa", "cadeira", "estante", "penteadeira", "poltrona", "cama", "escrivaninha", "sapateira", "moldura", "porta"].includes(type) ? "a" : "o";
}

function pronounFor(job: Job): string {
  const t = (job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type;
  return furnitureArticleOf(t) === "a" ? "ela" : "ele";
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function stockExplanation(status: string, material?: string): string {
  const what = material ? `o ${material}` : "o material";
  if (status === "tem_tudo")
    return `Ótimo, você não precisa comprar agora. Vou incluir o valor d${what.slice(0, 1) === "o" ? "o" : "a"}${what.slice(1)} usado no orçamento, porque ele tem custo de reposição.`;
  if (status === "tem_parte") return "Certo: compra só do que faltar. O material que você já tem também entra no orçamento pelo valor de reposição.";
  return "Certo, vamos considerar a compra do material.";
}

/** Valor solto ("90", "1.000", "85,90"): parser único pt-BR, sem ponto flutuante ("1.000" era lido como R$ 1). */
function parseLooseAmount(text: string): number | null {
  return parseBareAmountCents(text);
}

function parseHours(text: string): string | null {
  const norm = normalizeText(text).replace(/,/g, ".");
  const numeric = /(\d+(?:\.\d+)?)\s*(?:h|hora|horas)\b/.exec(norm);
  if (numeric) {
    let value = Number(numeric[1]);
    if (/\b(e meia|e meio)\b/.test(norm)) value += 0.5;
    return value > 0 && value <= 500 ? String(value) : null;
  }
  const words: Record<string, number> = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12 };
  const word = /\b(uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|doze)\s+horas?\b/.exec(norm);
  if (!word) return null;
  const value = words[word[1]!]! + (/\b(e meia|e meio)\b/.test(norm) ? 0.5 : 0);
  return String(value);
}

function friendlyDomainError(err: DomainError): string {
  return `Não consegui fazer isso agora: ${err.message}`;
}

export async function handleConversation(ctx: Ctx, input: EngineInput): Promise<OutgoingMessage[]> {
  return new Conversation(ctx, input).run();
}

export { techniquesLabel };

/**
 * Descrição curta de um móvel sem nome: o trecho "peça diferente", "móvel antigo" (até 3 palavras
 * depois do substantivo, parando em "que/da/do/pra..."), nunca a frase inteira.
 */
function unknownPieceDescription(text: string): string[] {
  const m = /\b(m[oó]vel|pe[cç]a|neg[oó]cio|treco)((?:\s+(?!(?:que|da|do|de|das|dos|pra|para|pro|com|e|na|no|aqui|ai|ali)\b)[a-zà-ú-]+){0,3})/i.exec(text);
  const phrase = m ? `${m[1]}${m[2]}`.trim().toLowerCase() : "";
  return phrase.split(/\s+/).length > 1 ? [phrase] : findDescriptors(text);
}
