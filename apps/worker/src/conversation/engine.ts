import {
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
import { nextQuestion, type FactValueMap, type JobStatus, type ProjectField, JOB_STATUS_LABEL, ACTIVE_JOB_STATUSES } from "@adripatina/domain";
import { extractCount, formatBRL, formatDateBR, normalizeText } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { interpret } from "../ai/service.js";
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
import { linkMessageToJob, loadSession, saveSession, type MentionSnapshot, type Session } from "../repos/sessions.js";
import type { User } from "../repos/users.js";
import { financialIdempotencyKey, recordExpense, recordPayment, recordPurchase } from "../repos/finance.js";
import { getActiveSettings, getMaterialByKey } from "../repos/catalog.js";
import { recordSuspicion } from "../services/duplicates.js";
import {
  approveQuote,
  artisanQuoteSummary,
  calculateQuote,
  DomainError,
  getQuote,
  issueDocuments,
  latestQuoteForJob,
  markQuoteOutcome,
  sendDocumentToArtisan,
  submitForReview,
} from "../services/quotes.js";
import { handleAdminCommand } from "./admin-commands.js";

export interface EngineInput {
  user: User;
  chatId: string;
  kind: "text" | "voice" | "photo" | "callback";
  text: string;
  inboundMessageId: string;
  photo?: { attachmentId: string; hash: string; visionHint?: string | null };
}

const RESUME_GAP_HOURS = 6;

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
const TRANSPORT_RE = /\b(gasolina|combustivel|frete|uber|taxi|estacionamento|pedagio|onibus|carreto)\b/;

class Conversation {
  readonly out: OutgoingMessage[] = [];
  session!: Session;
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

  async run(): Promise<OutgoingMessage[]> {
    this.session = await loadSession(this.ctx, this.input.user.id);
    const gapHours = (this.ctx.clock().getTime() - new Date(this.session.lastActivityAt).getTime()) / 3_600_000;
    const resuming = gapHours >= RESUME_GAP_HOURS;

    // confirmações financeiras/associações antigas expiram: nada é gravado sem confirmação recente
    if (resuming && ["expense", "payment", "confirm_match", "choose_match", "confirm_new_similar", "disambiguate", "progress_confirm", "admin_confirm"].includes(this.session.flow)) {
      const wasFinance = this.session.flow === "expense" || this.session.flow === "payment";
      this.session.flow = this.session.activeJobId ? "collecting" : "idle";
      this.session.context = { questionHistory: this.session.context.questionHistory ?? [] };
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
  async onText(text: string, resuming: boolean): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) {
      const handled = await this.onSlashCommand(trimmed);
      if (handled) return;
    }
    const nlu = await interpret(this.ctx, trimmed);
    await this.ctx.db.run("UPDATE conversation_messages SET intent = ?, confidence = ? WHERE id = ?", nlu.intent, nlu.confidence, this.input.inboundMessageId);

    // comandos universais
    switch (nlu.intent) {
      case "menu":
      case "greeting":
        return this.greet();
      case "help":
        return this.help();
      case "cancel":
        return this.cancel();
      case "pause":
        return this.pause();
    }

    const flow = this.session.flow;
    if (flow === "expense") return this.expenseText(trimmed, nlu);
    if (flow === "payment") return this.paymentText(trimmed, nlu);
    if (flow === "contradiction") return this.contradictionText(trimmed, nlu);
    if (["confirm_match", "choose_match", "confirm_new_similar"].includes(flow)) {
      if (nlu.intent === "yes") return this.onCallback(flow === "confirm_new_similar" ? "match:no" : "match:yes");
      if (nlu.intent === "no") return this.onCallback(flow === "confirm_new_similar" ? "match:yes" : "match:no");
      if (nlu.intent === "dont_know") return this.onCallback("match:unsure");
    }
    if (flow === "disambiguate") return this.disambiguateText(trimmed, nlu);
    if (flow === "progress_confirm" || flow === "admin_confirm") {
      if (nlu.intent === "yes") return this.onCallback(flow === "progress_confirm" ? "prog:confirm" : `adm:approve_confirm:${this.session.context.adminAction?.quoteId ?? ""}`);
      if (nlu.intent === "no") return this.cancel();
    }
    if (flow === "confirm_calc" && nlu.intent === "yes") return this.onCallback("calc:yes");

    // intenções que trocam de assunto com segurança
    if (nlu.intent === "register_expense" && nlu.confidence >= 0.7) return this.startExpense(trimmed, nlu);
    if (nlu.intent === "register_payment" && nlu.confidence >= 0.7) return this.startPayment(nlu);
    if (nlu.intent === "list_jobs") return this.listJobs();
    if (nlu.intent === "agenda") return this.agenda();
    if (nlu.intent === "query_status") return this.queryStatus(trimmed, nlu);
    if (nlu.intent === "job_progress") return this.startProgress(trimmed, nlu);
    if (nlu.intent === "back") return this.back();

    // dentro de um projeto
    if ((flow === "collecting" || flow === "confirm_calc") && this.session.activeJobId) {
      return this.collectingText(trimmed, nlu, resuming);
    }
    if (flow === "intake") return this.intakeText(trimmed, nlu);

    if (nlu.intent === "new_job" || nlu.entities.furnitureType) return this.newJobMention(trimmed, nlu);

    // sem fluxo: informações soltas sobre o último projeto
    if (this.session.activeJobId && hasProjectInfo(nlu)) {
      const job = await getJob(this.ctx, this.session.activeJobId);
      if (job) {
        this.session.flow = "confirm_match";
        this.session.context.mention = this.mention(trimmed, nlu);
        this.session.context.candidateJobIds = [job.id];
        this.say(`${this.firstName}, isso é sobre ${jobPhrase(job)}?`, matchButtons());
        return;
      }
    }
    if (nlu.intent === "yes" || nlu.intent === "no") {
      this.say("Certo. Como posso ajudar agora?", MAIN_MENU);
      return;
    }
    this.say("Não entendi bem. O que você quer fazer?", MAIN_MENU);
  }

  private mention(text: string, nlu: NluResult, extra: Partial<MentionSnapshot> = {}): MentionSnapshot {
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
      this.cancel();
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
    const job = this.session.activeJobId ? await getJob(this.ctx, this.session.activeJobId) : null;
    const pending = job && ["collecting", "confirm_calc"].includes(this.session.flow) ? nextQuestion(job.facts) : null;
    if (job && pending) {
      this.session.flow = "resume_prompt";
      this.say(`Oi, ${this.firstName}! Da última vez estávamos falando ${de(job)}. Faltava: ${questionFor(pending).text.toLowerCase()} Quer continuar?`, [
        [
          { text: "Continuar", data: "cmd:continue" },
          { text: "Outro assunto", data: "cmd:other_subject" },
        ],
      ]);
      return;
    }
    this.say(`Oi, ${this.firstName}! Pode me mandar um áudio ou escrever. Por exemplo: "peguei uma cômoda da dona Ana para fazer pátina". Ou escolha uma opção:`, MAIN_MENU);
  }

  help(): void {
    this.say(
      [
        "Eu anoto seus serviços e calculo os orçamentos para você.",
        "• Pode falar por áudio ou escrever, do seu jeito.",
        "• Eu faço uma pergunta de cada vez. Se não souber, toque em \"Não sei\".",
        "• Para mudar algo, diga \"corrigir\" ou \"na verdade é...\".",
        "• \"Voltar\" volta para a pergunta anterior; \"cancelar\" desiste do que estamos fazendo; \"continuar depois\" guarda tudo.",
        "• Gastos: \"gastei 90 reais num verniz\". Pagamentos: \"a dona Ana pagou 200\".",
        "Nada é apagado sem você confirmar.",
      ].join("\n"),
      MAIN_MENU,
    );
  }

  cancel(): void {
    const hadJob = !!this.session.activeJobId;
    this.session.flow = "idle";
    this.session.context = {};
    this.session.lastQuestion = null;
    this.say(hadJob ? "Tudo bem, parei por aqui. Nada foi apagado — o que já anotamos continua guardado." : "Tudo bem, cancelei. Nada foi registrado.", MAIN_MENU);
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
  async newJobMention(text: string, nlu: NluResult, extra: Partial<MentionSnapshot> = {}): Promise<void> {
    const mention = this.mention(text, nlu, extra);
    if (!mention.furnitureType && !mention.photoHash) {
      // ainda não sabemos o móvel: perguntar antes de cadastrar
      this.session.flow = "intake";
      this.session.context.mention = mention;
      const q = questionFor("furniture_type");
      this.say(`Vamos lá. ${q.text}`, q.buttons);
      return;
    }
    await this.matchOrCreate(mention);
  }

  async intakeText(text: string, nlu: NluResult): Promise<void> {
    const m = this.session.context.mention ?? this.mention(text, nlu);
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
    if (!m.furnitureType) {
      if (ans.kind === "dont_know") {
        this.say("Sem problema. Me conta como é o móvel, do seu jeito (por exemplo: \"um armário de cozinha\").");
        return;
      }
      this.say("Não entendi qual é o móvel. Pode dizer só o nome? Por exemplo: cristaleira, cômoda, cadeira.");
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
    const fresh = (await getJob(this.ctx, job.id))!;
    const noted = res.added.length ? `Anotei: ${res.added.join("; ")}.` : "Anotei um serviço novo.";
    this.say(`${noted}`);
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
      this.say(`Certo, continuando com ${jobPhrase(fresh)}.${s.confirmed.length ? ` Já tenho: ${s.confirmed.join("; ")}.` : ""}`);
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
        const value: FactValueMap["furniture_type"] = { type: m.furnitureType, descriptors, ...(m.doors !== undefined ? { doors: m.doors } : existing?.doors !== undefined ? { doors: existing.doors } : {}), ...(m.drawers !== undefined ? { drawers: m.drawers } : existing?.drawers !== undefined ? { drawers: existing.drawers } : {}) };
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
    this.say("Só para eu não errar: toque em \"Vale o novo\" ou \"Fica como estava\".", [
      [
        { text: "Vale o novo", data: "fact:new" },
        { text: "Fica como estava", data: "fact:old" },
      ],
    ]);
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
  async askNext(job: Job): Promise<void> {
    const field = nextQuestion(job.facts);
    this.session.context.unparsedCount = 0;
    if (!field) {
      this.session.flow = "confirm_calc";
      this.session.lastQuestion = null;
      const s = summarizeJob(job);
      const unknown = Object.values(job.facts).filter((f) => f?.status === "unknown").map((f) => questionFor(f!.field).text.replace(/\?$/, "").toLowerCase());
      const lines = [`Resumo ${de(job)}:`, ...s.confirmed.map((c) => `• ${c}`)];
      if (unknown.length) lines.push("", "Ficou pendente:", ...unknown.map((u) => `• ${u}`));
      lines.push("", "Posso calcular o orçamento?");
      this.say(lines.join("\n"), [
        [
          { text: "Calcular", data: "calc:yes" },
          { text: "Corrigir algo", data: "calc:fix" },
        ],
        [{ text: "Continuar depois", data: "cmd:pause" }],
      ]);
      return;
    }
    this.session.flow = "collecting";
    this.session.lastQuestion = field;
    const hist = this.session.context.questionHistory ?? [];
    if (hist[hist.length - 1] !== field) hist.push(field);
    this.session.context.questionHistory = hist.slice(-20);
    const q = questionFor(field);
    this.say(q.text, q.buttons);
  }

  async collectingText(text: string, nlu: NluResult, resuming: boolean): Promise<void> {
    const job = await getJob(this.ctx, this.session.activeJobId!);
    if (!job) {
      this.session.flow = "idle";
      this.session.activeJobId = null;
      return this.onText(text, false);
    }

    // outro móvel no meio da conversa → pausa este e verifica o novo
    if (nlu.entities.furnitureType && nlu.intent === "new_job") {
      const currentType = (job.facts.furniture_type?.value as FactValueMap["furniture_type"] | undefined)?.type;
      const sameType = !currentType || currentType === nlu.entities.furnitureType;
      const currentClient = (job.facts.client_name?.value as string | undefined) ?? null;
      const clientConflict = !!(nlu.entities.clientName && currentClient && clientMatches(currentClient, [], nlu.entities.clientName) < 0.85);
      if (!sameType || clientConflict || nlu.entities.explicitNew) {
        this.say(`Tudo bem, guardei ${jobPhrase(job)} para continuar depois.`);
        this.session.flow = "idle";
        return this.newJobMention(text, nlu);
      }
      // depois de um intervalo, confirmar antes de associar; na mesma conversa, repetição = continuidade
      if (resuming) {
        this.session.flow = "idle";
        return this.matchOrCreate(this.mention(text, nlu));
      }
      return this.continueWithJob(job, this.mention(text, nlu), { quiet: true });
    }

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

    if (nlu.entities.materialStatus && this.session.lastQuestion !== "material_status") {
      // "já tenho o verniz" em qualquer momento
      const r = await setFact(this.ctx, job.id, "material_status", nlu.entities.materialStatus, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId, correction: true });
      void r;
      this.say(stockExplanation(nlu.entities.materialStatus, nlu.entities.materialMention));
      return this.askNext((await getJob(this.ctx, job.id))!);
    }

    const field = this.session.lastQuestion;
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

    const ans = parseAnswer(field, text);
    if (ans.kind === "dont_know") {
      await setFact(this.ctx, job.id, field, null, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId });
      this.say(resuming ? `Continuando sobre ${jobPhrase(job)}. Sem problema, deixo isso pendente.` : "Sem problema, deixo isso pendente.");
      return this.askNext((await getJob(this.ctx, job.id))!);
    }
    if (ans.kind === "unparsed") {
      // talvez tenha falado de outras coisas do projeto
      if (hasProjectInfo(nlu)) return this.continueWithJob(job, this.mention(text, nlu), { quiet: true });
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
      const q = questionFor(field);
      this.say(count === 1 ? `Não entendi bem. ${q.example ?? q.text}` : `Tudo bem se não souber agora — é só tocar em "Não sei". ${q.text}`, q.buttons);
      return;
    }
    const r = await setFact(this.ctx, job.id, ans.field, ans.value as never, { actor: this.input.user.id, source: this.sourceKind(), messageId: this.input.inboundMessageId });
    const fresh = (await getJob(this.ctx, job.id))!;
    if (r.kind === "conflict") return this.askContradiction(fresh, { field: ans.field, oldValue: r.previous.value, newValue: ans.value });
    if (resuming) this.say(`Continuando sobre ${jobPhrase(job)}.`);
    if (r.kind === "same") this.say(`Isso, já tinha anotado: ${describeFact(ans.field, ans.value)}.`);
    if (ans.field === "material_status") this.say(stockExplanation(ans.value as string));
    // aproveita outras informações na mesma frase (sem repetir perguntas)
    const extra = this.mention(text, nlu);
    delete extra.materialStatus;
    if (ans.field === "client_name") delete extra.clientName;
    if (ans.field === "techniques") extra.techniques = [];
    if (ans.field === "dimensions" || ans.field === "size_class") {
      extra.lengthsM = [];
      delete extra.sizeClass;
    }
    if (ans.field === "furniture_type") delete extra.furnitureType;
    if (hasProjectInfo({ ...nlu, entities: { ...nlu.entities, ...extra } as NluResult["entities"] })) {
      const res = await this.applyMention(job.id, extra);
      if (res.added.length) this.say(`Anotei também: ${res.added.join("; ")}.`);
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
      this.say("Essa pergunta já foi respondida. Como posso ajudar?", MAIN_MENU);
      return;
    }
    if (ns === "match") return this.onMatch(action, arg);
    if (ns === "fact") return this.onFact(action);
    if (ns === "calc") return this.onCalc(action);
    if (ns === "exp") return this.onExpense(action, arg);
    if (ns === "pay") return this.onPayment(action, arg);
    if (ns === "prog") return this.onProgress(action);
    if (ns === "pdf") return this.onPdf(action, arg);
    if (ns === "outcome") return this.onOutcome(action, arg);
    if (ns === "job") return this.openJob(arg ?? action);
    if (ns === "photo") return this.onPhotoChoice(action, arg);
    if (ns === "adm") return this.onAdmin(action, arg);
    this.say("Esse botão não é mais válido. Como posso ajudar?", MAIN_MENU);
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
        this.say("Certo. O que você quer fazer?", MAIN_MENU);
        return;
      }
    }
    this.say("Como posso ajudar?", MAIN_MENU);
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
    const quote = await calculateQuote(this.ctx, job.id, this.input.user.id);
    this.say(`Orçamento ${de(job)}:\n${artisanQuoteSummary(quote)}`);
    if (!quote.result.computable) {
      this.session.flow = "collecting";
      return this.askNext(job);
    }
    const settings = await getActiveSettings(this.ctx);
    if (settings.params.requireAdminReview || !quote.definitiveAllowed) {
      await submitForReview(this.ctx, quote.id, this.input.user.id);
      this.session.flow = "idle";
      this.say("Mandei para o administrador revisar. Assim que aprovar, eu te aviso para gerar o PDF.", [[{ text: "Gerar estimativa (não definitiva)", data: `pdf:prelim:${quote.id}` }]]);
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
    const matWord = nlu.entities.materialMention;
    const materialKey = matWord ? (MATERIAL_WORDS[matWord] ?? null) : null;
    const packages = extractCount(text, /^(lata|latas|galao|galoes|pote|potes|frasco|frascos|caixa|caixas)$/) ?? (/\b(uma lata|um galao|um pote|um frasco)\b/.test(norm) ? 1 : null);
    const description = matWord ? `${matWord}${packages ? ` (${packages} emb.)` : ""}` : TRANSPORT_RE.exec(norm)?.[1] ?? text.slice(0, 80);
    this.session.flow = "expense";
    this.session.context.expense = {
      ...(nlu.entities.amountCents ? { amountCents: nlu.entities.amountCents } : {}),
      description,
      materialKey,
      packages,
      step: "job",
    };
    if (!nlu.entities.amountCents) {
      this.session.context.expense.step = "amount";
      this.say(`Quanto foi ${matWord ? `o ${matWord}` : "esse gasto"}?`);
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
    this.say(`Vou anotar: compra de ${e.description}, ${formatBRL(e.amountCents!)} — ${job ? `para ${jobPhrase(job)}` : "estoque geral"}. Confirma?`, [
      [
        { text: "Confirmar", data: "exp:confirm" },
        { text: "Corrigir valor", data: "exp:fix" },
      ],
      [{ text: "Cancelar", data: "exp:cancel" }],
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
      e.amountCents = amount;
      if (!e.description || e.description === "") {
        const mat = nlu.entities.materialMention;
        e.description = mat ?? (TRANSPORT_RE.exec(normalizeText(text))?.[1] ?? "material");
        e.materialKey = mat ? (MATERIAL_WORDS[mat] ?? null) : null;
      }
      return this.askExpenseJob();
    }
    if (nlu.intent === "yes" && e.step === "confirm") return this.onExpense("confirm");
    if (nlu.intent === "no" && e.step === "confirm") return this.onExpense("cancel");
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
      this.say("Qual é o valor certo?");
      return;
    }
    if (action === "cancel") {
      delete this.session.context.expense;
      this.session.flow = this.session.activeJobId ? "collecting" : "idle";
      this.say("Tudo bem, não anotei nada.");
      return;
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
    this.session.flow = this.session.activeJobId ? "collecting" : "idle";
    this.say(
      isTransport
        ? `Anotado: ${e.description}, ${formatBRL(e.amountCents!)}.`
        : `Anotado: compra de ${e.description}, ${formatBRL(e.amountCents!)}. Isso conta como dinheiro que saiu. O valor do material usado em cada serviço entra no orçamento separado, sem contar duas vezes.`,
    );
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
    this.say(`Vou anotar: recebi ${formatBRL(p.amountCents!)} de ${client}, referente ${aPrep(job)} (${job.code}). Confirma?`, [
      [
        { text: "Confirmar", data: "pay:confirm" },
        { text: "Corrigir valor", data: "pay:fix" },
      ],
      [{ text: "Cancelar", data: "pay:cancel" }],
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
    if (nlu.intent === "no" && p.step === "confirm") return this.onPayment("cancel");
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
      this.say("Qual é o valor certo?");
      return;
    }
    if (action === "cancel") {
      delete this.session.context.payment;
      this.session.flow = this.session.activeJobId ? "collecting" : "idle";
      this.say("Tudo bem, não anotei nada.");
      return;
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
  }

  // ------------------------------------------------------------- andamento
  async startProgress(text: string, nlu: NluResult): Promise<void> {
    const to: "EM_EXECUCAO" | "CONCLUIDO" | "ENTREGUE" = nlu.entities.progress === "entregue" ? "ENTREGUE" : nlu.entities.progress === "concluido" ? "CONCLUIDO" : "EM_EXECUCAO";
    const job = await this.findJobFromMention(text, nlu);
    if (!job) return;
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
    try {
      const job = await transitionJob(this.ctx, p.jobId, p.to as JobStatus, this.input.user.id);
      this.say(`Pronto: ${jobPhrase(job)} agora está ${JOB_STATUS_LABEL[job.status].toLowerCase()}.`);
      if (p.to === "ENTREGUE") {
        const bal = await jobBalance(this.ctx, job.id);
        if (bal.balanceCents && bal.balanceCents > 0) this.say(`Lembrete: ainda falta receber ${formatBRL(bal.balanceCents)} desse serviço.`);
      }
    } catch {
      const job = await getJob(this.ctx, p.jobId);
      this.say(`Não dá para mudar ${job ? jobPhrase(job) : "esse serviço"} direto para esse estado agora (está ${job ? JOB_STATUS_LABEL[job.status].toLowerCase() : "?"}).`);
    }
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
    if (s.pending.length) lines.push(`Falta: ${s.pending.map((f) => questionFor(f).text.replace(/\?.*$/, "").toLowerCase()).slice(0, 4).join("; ")}`);
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
      this.say("Ainda não há serviços anotados. Me conte sobre um móvel que você pegou!", MAIN_MENU);
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
    this.cancel();
  }
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

function parseLooseAmount(text: string): number | null {
  const m = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)/.exec(text);
  if (!m) return null;
  const raw = m[1]!;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function friendlyDomainError(err: DomainError): string {
  return `Não consegui fazer isso agora: ${err.message}`;
}

export async function handleConversation(ctx: Ctx, input: EngineInput): Promise<OutgoingMessage[]> {
  return new Conversation(ctx, input).run();
}

export { techniquesLabel };
