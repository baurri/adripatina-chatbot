import type { Harness } from "../harness.js";
import { setFact } from "../../src/repos/jobs.js";
import { check, common, has, jobs, pieces, seedJob, v, type Scenario } from "./scenarios.js";

/**
 * Do jeito REAL do Adriano (conversa de 24/11 no Telegram, nomes trocados): ele ESCREVE, em mensagens
 * curtas, um dado por mensagem; medidas com ponto ("1.30 x 60"); "pincel e rolo de espuma"; preço de
 * material por embalagem; várias peças de um cliente e outro cliente na mesma conversa.
 */
const ADRIANO_TYPING =
  "Escreve SEMPRE (nunca áudio), mensagens curtas, um dado por mensagem, sem pontuação caprichada. Medidas com ponto: '1.30 x 60'. Responde só o que foi perguntado. Se o bot perguntar algo que ele já disse, responde seco repetindo.";

async function lastProposalPieces(h: Harness): Promise<number> {
  const s = await h.ctx.db.first<{ snapshot_json: string }>(
    "SELECT s.snapshot_json FROM quote_snapshots s JOIN quote_documents d ON d.snapshot_id = s.id AND d.kind = 'COMERCIAL' ORDER BY s.created_at DESC LIMIT 1",
  );
  if (!s) return 0;
  const ids = await h.ctx.db.all<{ id: string }>("SELECT id FROM quotes WHERE ? LIKE '%' || id || '%'", s.snapshot_json);
  return ids.length;
}

export const REAL: Scenario[] = [
  {
    id: "real2-valdir-3pecas-texto",
    title: "Real (texto curto): 3 peças do Seu Valdir, só tampo em duas, um PDF único",
    opening: "escreva 'Boa noite' e, na mensagem seguinte, que são três peças do seu Valdir.",
    brief:
      "Cliente: Seu Valdir. (1) Mesinha de centro: lixar e envernizar a mesa INTEIRA, por dentro também; tampo com trincos na folha (lixar e massinha F12 pra acertos); medida do tampo 1.30 x 60, uns 45 de altura. (2) Rack de TV: só o tampo, 1.50 x 80, riscos e manchas, o resto do móvel tá bom. (3) Aparador da sala com 4 gavetas e 2 portas: só o tampo, 1.20 x 50, tampo manchado. Nos tampos: só lixar e envernizar, só por fora. Pincel e rolo de espuma em tudo. O cliente entrega e depois busca. Material, se perguntarem: verniz 60 reais a lata de 1/4; água raz 25 reais o litro; lixa avulsa 2 reais a folha (não compra pacote). Prazo: consegue começar a partir de terça; tudo junto leva uns 5 dias. No fim quer UM PDF só com as 3 peças.",
    quirks: `${ADRIANO_TYPING} Primeiro diz só os nomes das peças e as medidas numa mensagem; os outros dados só quando perguntarem. Quando o valor vier, pede 'consegue fazer um único PDF com as peças do seu Valdir'.`,
    goal: "Um PDF único com as 3 peças do Seu Valdir, com prazo.",
    maxTurns: 26,
    checks: async (h) => {
      const js = await jobs(h);
      const tampo = js.filter((j) => has(v(j, "scope"), /tampo/));
      const last = await lastProposalPieces(h);
      return [
        check(pieces(js) >= 3, "3 peças anotadas", js.map((j) => v(j, "furniture_type"))),
        check(tampo.length >= 2, "rack e aparador só no tampo", js.map((j) => v(j, "scope"))),
        check(js.every((j) => has(v(j, "client_name"), /Valdir/)), "cliente Seu Valdir em todas"),
        check(js.every((j) => v(j, "logistics") !== undefined && v(j, "logistics") !== null), "transporte anotado (cliente leva e busca)", js.map((j) => v(j, "logistics"))),
        check(last >= 3, "PDF único com as 3 peças", last),
        check(js.every((j) => has(v(j, "deadline"), /In[ií]cio|Pronto/)), "prazo no PDF", js.map((j) => v(j, "deadline"))),
      ];
    },
  },
  {
    id: "real2-neide-pomba",
    title: "Real (texto curto): peça decorativa (pomba com raios), pintura, pelas horas, material que ele já tem",
    opening: "escreva que da dona Neide seria uma peça decorativa, uma pomba com raios de sol.",
    brief:
      "Dona Neide. Pomba decorativa de madeira com raios de sol. Trabalho: uma pintura — a pomba cinza com os raios dourados. Está em bom estado, inteira. Tamanho médio, não tem as medidas. Se pedirem foto: diz que só tem uma foto de referência, bem parecida. Acha que leva umas três horas. Já tem as tintas, mas vai gastar uns 40 reais de material. O cliente traz e busca. Prazo: consegue começar de imediato e leva uns três dias.",
    quirks: `${ADRIANO_TYPING} Na PRIMEIRA pergunta do material, responde só 'eu tenho as tintas'. Se o bot perguntar o valor de novo (explicando que entra pra repor), responde 'uns 40 reais'.`,
    goal: "Valor com o material incluído e o PDF.",
    checks: async (h) => {
      const q = await h.ctx.db.first<{ result_json: string }>("SELECT result_json FROM quotes ORDER BY created_at DESC LIMIT 1");
      const r = q ? (JSON.parse(q.result_json) as { materials?: { consumptionCostCents?: number }; expenses?: { totalCents?: number } }) : null;
      const mat = (r?.materials?.consumptionCostCents ?? 0) + (r?.expenses?.totalCents ?? 0);
      return [...(await common(h, /pomba/i)), check(mat >= 4000, "material de 40 reais entrou na conta", mat)];
    },
  },
  {
    id: "real2-prazo-so-duracao",
    title: "Real: 'consigo começar e fica pronto em dois dias' (sem dizer quando): o bot pergunta a partir de quando",
    opening: "escreva que tem um aparador do seu Ivo pra envernizar só o tampo, 1.20 x 50.",
    brief:
      "Aparador do Seu Ivo: envernizar só o tampo, 1.20 x 50, tampo manchado, resto bom. Só por fora. Pincel e rolo de espuma. O cliente entrega e depois busca. Material: verniz 60 reais lata de 1/4; lixa avulsa 2 reais a folha. Prazo: na primeira vez que perguntarem, responde EXATAMENTE 'sim consigo começar e fica pronto em dois dias'. Se perguntarem a partir de quando: 'a partir de terça'.",
    quirks: ADRIANO_TYPING,
    goal: "PDF com prazo completo (início + duração).",
    checks: async (h) => {
      const js = await jobs(h);
      return [...(await common(h, /aparador/i)), check(js.some((j) => has(v(j, "deadline"), /In[ií]cio:.*ter[cç]a/i)), "prazo com início (terça) + duração", js.map((j) => v(j, "deadline")))];
    },
  },
  {
    id: "real2-fila",
    title: "Fila cheia: o bot propõe o início pela fila (2 serviços aceitos até 15/12)",
    opening: "escreva que chegou uma cômoda da dona Lia pra patinar e que ela quer saber o valor e quando fica pronta.",
    brief:
      "Cômoda da Dona Lia, pátina. 90 x 45 x 85 de altura, 4 gavetas, só por fora, bom estado, sem conserto, pincel. A cliente traz e busca. Material se perguntarem: tinta 80 reais o galão de 3,6 L; lixa avulsa 2 reais a folha. Prazo: se o bot sugerir uma data de início pela fila, CONCORDA ('pode ser') e diz que leva uns 4 dias. Se não sugerir, diz 'não sei, tenho uns serviços na frente'.",
    quirks: ADRIANO_TYPING,
    goal: "PDF com prazo que respeita a fila.",
    setup: async (h) => {
      const a = await seedJob(h, "rack", "Seu Ari", ["verniz"]);
      const b = await seedJob(h, "mesa", "Dona Rosa", ["pintura"]);
      const opts = { actor: h.artisanId, source: "telegram_text" as const };
      await setFact(h.ctx, a, "deadline", "Início: já · cerca de 5 dias de trabalho · previsão de entrega: por volta de 02/12/2026" as never, opts);
      await setFact(h.ctx, b, "deadline", "Início: 03/12 · cerca de 1 semana de trabalho · previsão de entrega: por volta de 15/12/2026" as never, opts);
      await h.ctx.db.run("UPDATE jobs SET status = 'EM_EXECUCAO' WHERE id = ?", a);
      await h.ctx.db.run("UPDATE jobs SET status = 'AGUARDANDO_INICIO' WHERE id = ?", b);
    },
    checks: async (h) => {
      const js = (await jobs(h)).filter((j) => j.status === "ORCAMENTO");
      const said = h.telegram.sent.map((s) => s.text ?? "").join("\n");
      return [
        ...(await common(h, /c[oô]moda/i)),
        check(/1[56]\/12/.test(said), "bot propôs o início pela fila (15–16/12)", said.match(/.{0,80}1[56]\/12.{0,40}/)?.[0]),
        check(js.some((j) => has(v(j, "deadline"), /1[6-9]\/12|2[0-9]\/12/)), "prazo do PDF depois da fila", js.map((j) => v(j, "deadline"))),
      ];
    },
  },
];
