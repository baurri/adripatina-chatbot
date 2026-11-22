import { formatBRL, localDateKey } from "@adripatina/shared";
import { JOB_STATUS_LABEL } from "@adripatina/domain";
import type { Ctx } from "../context.js";
import type { OutgoingMessage } from "../ports.js";
import type { User } from "../repos/users.js";
import { getJobByCode, listActiveJobs } from "../repos/jobs.js";
import { latestQuoteForJob, listQuotes } from "../services/quotes.js";
import { listMaterials } from "../repos/catalog.js";
import { dashboardSummary } from "../services/reports.js";

/**
 * Comandos administrativos no Telegram. Leitura direta; alterações pedem
 * confirmação explícita (botão) e ficam auditadas. Operações complexas
 * (abaixo do piso, parâmetros) são feitas no painel autenticado.
 */
export async function handleAdminCommand(ctx: Ctx, admin: User, raw: string): Promise<{ messages: OutgoingMessage[]; pendingApproval?: string }> {
  const [cmdRaw, ...args] = raw.trim().split(/\s+/);
  const cmd = cmdRaw!.toLowerCase().replace(/@.*/, "");
  const msg = (text: string, buttons?: OutgoingMessage["buttons"]): OutgoingMessage => (buttons ? { text, buttons } : { text });
  switch (cmd) {
    case "/admin": {
      const s = await dashboardSummary(ctx);
      return {
        messages: [
          msg(
            [
              "Resumo administrativo:",
              `• Orçamentos aguardando revisão: ${s.quotesAwaitingReview}`,
              `• Serviços ativos: ${s.activeJobs} (atrasados: ${s.overdueJobs})`,
              `• A receber: ${formatBRL(s.receivablesCents)}`,
              `• Recebido no mês: ${formatBRL(s.monthReceivedCents)}`,
              `• Compras/gastos no mês: ${formatBRL(s.monthSpentCents)}`,
              `• Suspeitas de duplicidade abertas: ${s.openDuplicates}`,
              `• Materiais sem preço: ${s.materialsWithoutPrice}`,
            ].join("\n"),
          ),
        ],
      };
    }
    case "/pendentes": {
      const quotes = await listQuotes(ctx, "AGUARDANDO_REVISAO");
      if (quotes.length === 0) return { messages: [msg("Nenhum orçamento aguardando revisão.")] };
      return {
        messages: quotes.slice(0, 10).map((q) =>
          msg(
            `${q.jobCode} — ${q.jobTitle}\nPiso: ${q.floorCents !== null ? formatBRL(q.floorCents) : "—"} | Recomendado: ${q.recommendedCents !== null ? formatBRL(q.recommendedCents) : "—"} | Confiança: ${q.confidence}\n${q.result.blockers.length ? `Bloqueios: ${q.result.blockers.map((b) => b.message).join(" ")}` : "Sem bloqueios."}\nPara aprovar pelo preço recomendado: /aprovar ${q.jobCode}`,
          ),
        ),
      };
    }
    case "/servicos": {
      const jobs = await listActiveJobs(ctx, 20);
      return { messages: [msg(jobs.length ? jobs.map((j) => `${j.code} — ${j.title} — ${JOB_STATUS_LABEL[j.status]}`).join("\n") : "Nenhum serviço ativo.")] };
    }
    case "/caixa": {
      const s = await dashboardSummary(ctx);
      return {
        messages: [
          msg(`Caixa do mês (${localDateKey(ctx.clock()).slice(0, 7)}):\nEntradas: ${formatBRL(s.monthReceivedCents)}\nSaídas (compras + despesas): ${formatBRL(s.monthSpentCents)}\nSaldo: ${formatBRL(s.monthReceivedCents - s.monthSpentCents)}\n(Material de estoque usado não é saída de caixa.)`),
        ],
      };
    }
    case "/alertas": {
      const s = await dashboardSummary(ctx);
      const lines = ["Alertas:"];
      if (s.materialsWithoutPrice) lines.push(`• ${s.materialsWithoutPrice} materiais sem preço de reposição (bloqueiam propostas).`);
      if (s.stalePrices) lines.push(`• ${s.stalePrices} preços desatualizados.`);
      if (s.uncalibratedTechniques) lines.push(`• ${s.uncalibratedTechniques} técnicas NÃO CALIBRADAS.`);
      if (s.overdueJobs) lines.push(`• ${s.overdueJobs} serviços atrasados.`);
      if (s.openDuplicates) lines.push(`• ${s.openDuplicates} suspeitas de duplicidade para revisar no painel.`);
      if (s.lowStock) lines.push(`• ${s.lowStock} materiais com estoque baixo.`);
      if (lines.length === 1) lines.push("Nenhum alerta.");
      return { messages: [msg(lines.join("\n"))] };
    }
    case "/custos": {
      const mats = await listMaterials(ctx);
      return {
        messages: [
          msg(
            mats
              .map((m) => `${m.name}: ${m.replacementPriceCents !== null ? `${formatBRL(m.replacementPriceCents)} / ${m.packageSize} ${m.unit}` : "SEM PREÇO"}${m.calibrated ? "" : " (não calibrado)"}`)
              .join("\n"),
          ),
        ],
      };
    }
    case "/aprovar": {
      const code = args[0];
      if (!code) return { messages: [msg("Use: /aprovar S-0001")] };
      const job = await getJobByCode(ctx, code);
      const q = job ? await latestQuoteForJob(ctx, job.id) : null;
      if (!job || !q) return { messages: [msg("Não encontrei orçamento para esse código.")] };
      if (q.status !== "AGUARDANDO_REVISAO" && q.status !== "ESTIMATIVA") return { messages: [msg(`Esse orçamento está ${q.status}.`)] };
      if (q.result.blockers.length || (q.result.gaps ?? []).length) {
        return { messages: [msg(`Há pendências/bloqueios. Exceções (abaixo do piso, parâmetros não calibrados) só pelo painel, com justificativa:\n${[...q.result.blockers.map((b) => b.message), ...(q.result.gaps ?? []).map((g) => g.message)].join("\n")}`)] };
      }
      return {
        messages: [
          msg(`Aprovar ${job.code} — ${job.title} pelo valor recomendado de ${formatBRL(q.recommendedCents ?? 0)}?`, [
            [
              { text: "Sim, aprovar", data: `adm:approve_confirm:${q.id}` },
              { text: "Cancelar", data: "cmd:cancel" },
            ],
          ]),
        ],
        pendingApproval: q.id,
      };
    }
    case "/ajuda_admin":
    default:
      return {
        messages: [
          msg(
            [
              "Comandos do administrador:",
              "/admin — resumo",
              "/pendentes — orçamentos aguardando revisão",
              "/servicos — serviços ativos",
              "/caixa — entradas e saídas do mês",
              "/alertas — pendências importantes",
              "/custos — preços de materiais",
              "/aprovar S-0001 — aprovar pelo recomendado (pede confirmação)",
              "Exceções, parâmetros e mesclagens: use o painel web.",
            ].join("\n"),
          ),
        ],
      };
  }
}
