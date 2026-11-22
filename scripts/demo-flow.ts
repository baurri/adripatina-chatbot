/**
 * Demonstração ponta a ponta com dados FICTÍCIOS, 100% local (SQLite em memória,
 * Telegram e R2 simulados — nenhuma chamada externa). Mostra a conversa, o
 * orçamento e grava o PDF comercial em out/.
 *
 * Uso: pnpm demo
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness, ADMIN_TG } from "../apps/worker/test/harness.js";
import { approveQuote } from "../apps/worker/src/services/quotes.js";
import { processOutbox } from "../apps/worker/src/services/outbox.js";
import type { SentRecord } from "../apps/worker/src/telegram/client.js";

const here = dirname(fileURLToPath(import.meta.url));

function show(who: string, text: string) {
  console.info(`\n\x1b[36m${who}:\x1b[0m ${text}`);
}
function bot(records: SentRecord[]) {
  for (const r of records) {
    if (r.kind === "document") console.info(`\x1b[33m  bot → [PDF] ${r.filename}\x1b[0m`);
    else console.info(`\x1b[32m  bot:\x1b[0m ${r.text}${r.buttons ? `\n       [${r.buttons.flat().map((b) => b.text).join("] [")}]` : ""}`);
  }
}

async function main() {
  const h = await createHarness();
  await h.send("/start", ADMIN_TG);
  const say = async (text: string) => (show("Adriano", text), bot(await h.send(text)));
  const tap = async (data: string, label: string) => (show("Adriano (botão)", label), bot(await h.click(data)));

  await say("Peguei uma cristaleira da dona Maria para fazer pátina");
  await tap("ans:bom", "Bom");
  await say("1,80 de altura, 1 metro de largura e 40 de fundura");
  await tap("ans:externa", "Só por fora");
  await tap("ans:nao", "Não precisa (consertos)");
  await tap("ans:nao", "Não (terceiros)");
  await say("já tenho um pouco da tinta, tenho uma parte");
  await tap("ans:pincel", "Pincel");
  await tap("ans:nenhum", "Não (frete)");
  await tap("ans:sem_prazo", "Sem prazo");
  await tap("ans:entrada_entrega", "Entrada + resto na entrega");

  console.info("\n\x1b[35m[Administrador cadastra preços FICTÍCIOS de teste e revisa os parâmetros]\x1b[0m");
  await h.calibrateAndPrice();
  await tap("calc:yes", "Calcular");
  const q = (await h.ctx.db.first<{ id: string }>("SELECT id FROM quotes"))!;
  await approveQuote(h.ctx, q.id, h.adminId, {});
  h.telegram.clear();
  await processOutbox(h.ctx);
  bot(h.telegram.sent.filter((s) => s.chatId === "1001"));
  await tap(`pdf:issue:${q.id}`, "Gerar PDF");
  const doc = h.telegram.sent.find((s) => s.kind === "document")!;
  const outDir = join(here, "../out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, doc.filename!), doc.bytes!);
  console.info(`\n\x1b[33mPDF comercial salvo em out/${doc.filename}\x1b[0m`);

  await tap(`outcome:accept:${q.id}`, "Cliente aceitou");
  await say("A dona Maria pagou duzentos reais");
  await tap("pay:confirm", "Confirmar");
  await say("como está a cristaleira da dona Maria?");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
