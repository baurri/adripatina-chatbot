import type { Harness } from "../harness.js";
import { createJob, setFact } from "../../src/repos/jobs.js";

/** Serviço já anotado (como se tivesse nascido pela conversa): móvel, cliente e técnica. */
async function seedJob(h: Harness, type: string, client: string, techniques: string[]): Promise<string> {
  const job = await createJob(h.ctx, { actor: h.artisanId, description: `${type} da ${client}` });
  const opts = { actor: h.artisanId, source: "telegram_text" as const };
  await setFact(h.ctx, job.id, "furniture_type", { type, descriptors: [] } as never, opts);
  await setFact(h.ctx, job.id, "client_name", client as never, opts);
  if (techniques.length) await setFact(h.ctx, job.id, "techniques", techniques as never, opts);
  return job.id;
}

/**
 * Cenários da avaliação, tirados das conversas reais (Adriano 23/11; administrador 22–24/11) e
 * dos usos do dia a dia. O "brief" é o que é verdade no caso; o Adriano simulado conta do jeito
 * dele. As conferências olham o banco no fim (o que tinha que ficar anotado).
 */

export interface Check {
  ok: boolean;
  name: string;
  detail?: string;
}

export interface Scenario {
  id: string;
  title: string;
  opening: string;
  brief: string;
  quirks?: string;
  goal: string;
  maxTurns?: number;
  setup?: (h: Harness, api: (method: string, path: string, body?: unknown) => Promise<{ status: number; json: Record<string, unknown> | null }>) => Promise<void>;
  checks: (h: Harness) => Promise<Check[]>;
}

interface JobRow {
  id: string;
  status: string;
  facts: Record<string, { value: unknown } | undefined>;
}

async function jobs(h: Harness): Promise<JobRow[]> {
  const rows = await h.ctx.db.all<{ id: string; status: string; facts_json: string }>("SELECT id, status, facts_json FROM jobs WHERE status <> 'CANCELADO' ORDER BY created_at");
  return rows.map((r) => ({ id: r.id, status: r.status, facts: JSON.parse(r.facts_json || "{}") }));
}

const v = (j: JobRow | undefined, f: string): unknown => j?.facts[f]?.value;
/** peças: soma da quantidade de cada serviço (peças iguais podem ficar num serviço só) */
const pieces = (js: JobRow[]) => js.reduce((acc, j) => acc + Number((v(j, "furniture_type") as { quantity?: number } | undefined)?.quantity ?? 1), 0);
const has = (x: unknown, re: RegExp) => re.test(JSON.stringify(x ?? ""));
const check = (ok: boolean, name: string, detail?: unknown): Check => ({ ok, name, ...(ok || detail === undefined ? {} : { detail: JSON.stringify(detail).slice(0, 200) }) });

async function quoteStatuses(h: Harness): Promise<string[]> {
  return (await h.ctx.db.all<{ status: string }>("SELECT status FROM quotes")).map((r) => r.status);
}

async function docs(h: Harness): Promise<number> {
  return (await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM quote_documents WHERE kind = 'COMERCIAL'"))!.n;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "real-adriano-roberto-jo",
    title: "Conversa real do Adriano: mesinha + 2 móveis do Seu Roberto e da Dona Jo",
    opening: "conte o pedido do jeito que o Adriano contou de verdade (terça vai pegar um trabalho do seu Roberto e da Dona Jo, mesinha de centro para lixar e passar verniz, e outros dois móveis que é só o tampo; quer saber quanto cobrar).",
    brief:
      "Terça vai buscar. Clientes: Seu Roberto e Dona Jo, que são um casal (um cliente só). Peças: uma mesinha de centro (lixar inteira e passar verniz; o tampo está um pouco danificado, precisa acertar os detalhes) e dois aparadores (só o tampo, lixar e envernizar; estão melhores). Medidas: mesinha redonda com 80 cm de diâmetro e 45 de altura; cada aparador tem o tampo 1,20 por 40. Vai usar pincel. Já tem o verniz. Ele mesmo busca e entrega. Acha que leva 3 a 5 dias e o material dá uns 70 reais.",
    quirks: "No começo diz 'outros dois móveis' sem dizer quais; quando perguntado, fala 'duas aparadoras'. Responde o estado de todas as peças de uma vez.",
    goal: "Receber o valor sugerido e concordar com ele.",
    checks: async (h) => {
      const js = await jobs(h);
      return [
        check(pieces(js) === 3, "3 peças (mesinha + 2 aparadores)", js.map((j) => v(j, "furniture_type"))),
        check(pieces(js.filter((j) => has(v(j, "furniture_type"), /aparador/))) === 2, "2 aparadores reconhecidos", js.map((j) => v(j, "furniture_type"))),
        check(js.every((j) => has(v(j, "techniques"), /verniz/)), "técnica verniz em todos"),
        check(js.every((j) => has(v(j, "client_name"), /Roberto|Jo/)), "cliente Seu Roberto/Dona Jo"),
        // conta PEÇAS (um serviço com quantidade 2 vale pelos dois aparadores)
        check(pieces(js.filter((j) => has(v(j, "furniture_type"), /aparador/) && has(v(j, "scope"), /tampo/))) >= 2, "aparadores só no tampo", js.map((j) => [v(j, "furniture_type"), v(j, "scope")])),
        check(js.every((j) => v(j, "dimensions") || v(j, "size_class")), "medida/porte de todas as peças"),
        check((await quoteStatuses(h)).length === js.length, "orçamento calculado para todos os serviços", await quoteStatuses(h)),
      ];
    },
  },
  {
    id: "admin-mesinha-criados",
    title: "Administrador: mesinha + 2 criados-mudos, medidas todas de uma vez",
    opening: "peça o orçamento de uma mesinha de centro com tampo um pouco danificado (lixar, acertar detalhes, envernizar) e mais dois móveis só o tampo; diga que vai demorar 3 a 5 dias e que o material dá uns 70 reais.",
    brief:
      "Cliente: Dona Carla. Peças: mesinha de centro (inteira; lixar, acertar detalhes, envernizar) e dois criados-mudos (só o tampo, lixar e envernizar). Estado: só precisa lixar e acertar uns detalhes em todos. Medidas: a mesinha é redonda com 2 metros de largura; os criados-mudos têm 80 cm de largura e 40 de altura (os dois iguais). Pincel e uma faca pra raspar. Já tem o material. A cliente deixa e busca depois de pronto. Prazo, se perguntarem: começa semana que vem e leva uns 5 dias.",
    quirks: "Quando perguntarem medidas, fala as de TODAS as peças numa frase só. Escreve 'já trnho' com erro. Responde a logística com 'a cliente deixa em casa e busca depois de pronto'.",
    goal: "Receber o valor e pedir 10% de desconto.",
    checks: async (h) => {
      const js = await jobs(h);
      return [
        check(pieces(js) === 3, "3 peças", js.map((j) => v(j, "furniture_type"))),
        check(pieces(js.filter((j) => has(v(j, "furniture_type"), /criado|cabeceira/))) === 2, "2 criados-mudos", js.map((j) => v(j, "furniture_type"))),
        check(js.every((j) => has(v(j, "client_name"), /Carla/)), "cliente Dona Carla"),
        check(js.every((j) => v(j, "dimensions")), "medidas das 3 peças", js.map((j) => v(j, "dimensions"))),
        check(js.every((j) => has(v(j, "logistics"), /"pickup":false/) && has(v(j, "logistics"), /"delivery":false/)), "sem frete (cliente traz e busca)", js.map((j) => v(j, "logistics"))),
        check((await docs(h)) >= 1, "PDF gerado após o desconto"),
      ];
    },
  },
  {
    id: "admin-comoda-carla",
    title: "Cômoda da Dona Carla (pátina), gavetão, correção e logística do cliente",
    opening: "conte por áudio que chegou uma cômoda da dona Carla para patinar, uns 80 por 1 metro.",
    brief:
      "Uma cômoda da Dona Carla, pátina. Medidas: 1 metro de altura por 80 cm de largura. Tem 4 gavetas e 1 gavetão. Está boazinha. Só por fora. Sem consertos. Pincel, e também usa estilete pra raspar. A cliente traz e busca quando estiver pronta.",
    quirks: "Depois de responder 'pincel', manda outra mensagem: 'vou aplicar com pincel e estilete pra raspar'. Responde a logística de um jeito enrolado ('ele vai trazer e buscar qdo estiver pronta').",
    goal: "Chegar ao valor sugerido e concordar.",
    checks: async (h) => {
      const js = await jobs(h);
      const j = js[0];
      const ft = v(j, "furniture_type") as { attributes?: { drawers_count?: number }; drawers?: number } | undefined;
      return [
        check(js.length === 1, "1 serviço", js.length),
        check(has(v(j, "furniture_type"), /comoda/), "cômoda"),
        check(has(v(j, "techniques"), /patina/), "pátina"),
        check((ft?.attributes?.drawers_count ?? ft?.drawers) === 5, "5 gavetas (4 + gavetão)", ft),
        check(has(v(j, "details"), /gavet[aã]o/i), "gavetão nas observações", v(j, "details")),
        check(has(v(j, "details"), /estilete/i), "estilete nas observações", v(j, "details")),
        check(has(v(j, "application_method"), /pincel/), "pincel"),
        check(has(v(j, "logistics"), /"pickup":false/) && has(v(j, "logistics"), /"delivery":false/), "sem frete", v(j, "logistics")),
        check(has(v(j, "dimensions"), /"1"/) && has(v(j, "dimensions"), /0\.8/), "medidas 1 m × 0,8 m", v(j, "dimensions")),
      ];
    },
  },
  {
    id: "abreu-isa-casal",
    title: "Mesa de cabeceira do Seu Abreu e da Dona Isa (casal), cor e tempo estimado",
    opening: "pergunte se dá pra fazer um orçamento novo, é o móvel do seu Abreu e da dona Isa, uma mesa de cabeceira.",
    brief:
      "Uma mesa de cabeceira do Seu Abreu e da Dona Isa (casal, um cliente). Vai lixar e pintar de azul marinho. Está boa. Tamanho médio (não sabe a medida). Só por fora. Sem consertos. Pincel. Acha que leva de 3 a 5 dias. Não precisa buscar nem entregar.",
    quirks: "No meio da conversa pergunta 'e aí, vc tá bem?'. Diz a cor e o tempo de passagem, sem ser perguntado.",
    goal: "Chegar ao valor e concordar.",
    checks: async (h) => {
      const js = await jobs(h);
      const j = js[0];
      return [
        check(js.length === 1, "1 serviço (casal = 1 cliente)", js.length),
        check(has(v(j, "details"), /azul marinho/i), "cor azul marinho anotada", v(j, "details")),
        check(has(v(j, "details"), /3 a 5 dias/), "tempo estimado anotado", v(j, "details")),
        check(has(v(j, "details"), /Isa|Abreu/) || has(v(j, "client_name"), /Isa/), "segundo dono não se perdeu"),
        check(!!v(j, "size_class") || !!v(j, "dimensions"), "porte médio usado"),
      ];
    },
  },
  {
    id: "licele-cama",
    title: "Cama queen da Dona Licele (medida do colchão é só referência)",
    opening: "diga que queria registrar o móvel da dona Licele (sem dizer qual é ainda).",
    brief: "Uma cama queen da Dona Licele. Vai lixar e envernizar a cama inteira (cabeceira e peseira). Está com uns riscos. Não sabe a medida da estrutura, só que é queen. Pincel. Não precisa de frete.",
    quirks: "Começa sem dizer o móvel; só depois diz 'é uma cama queen'.",
    goal: "Ver o valor (pode ser estimativa) e concordar.",
    checks: async (h) => {
      const js = await jobs(h);
      const j = js[0];
      return [
        check(js.length === 1, "1 serviço", js.length),
        check(has(v(j, "furniture_type"), /cama/), "cama"),
        check(has(v(j, "client_name"), /Licele/), "Dona Licele"),
        check(has(v(j, "techniques"), /verniz/), "verniz"),
      ];
    },
  },
  {
    id: "preco-material-solvente",
    title: "Preço de material na hora do orçamento: 'duas latas por 150' e 'não uso solvente'",
    opening: "conte que pegou uma mesa da dona Ana para envernizar.",
    brief:
      "Mesa da Dona Ana, envernizar. Está boa. 1 metro por 60 cm de tampo, 75 de altura. Só por fora. Sem conserto. Pincel. Sem frete. Quando perguntarem o preço do verniz: comprou duas latas de 900 ml por 150 reais no total. Solvente ele NÃO usa nesse trabalho. Não usa outro material além dos perguntados.",
    goal: "Informar os preços, chegar ao valor e concordar.",
    setup: async (h) => {
      await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL WHERE key IN ('verniz','solvente')");
    },
    checks: async (h) => {
      const vz = await h.ctx.db.first<{ p: number | null; s: string }>("SELECT replacement_price_cents p, package_size s FROM materials WHERE key = 'verniz'");
      const sv = await h.ctx.db.first<{ p: number | null }>("SELECT replacement_price_cents p FROM materials WHERE key = 'solvente'");
      const job = await h.ctx.db.first<{ summary_json: string }>("SELECT summary_json FROM jobs LIMIT 1");
      return [
        check(vz?.p === 7500, "verniz = R$ 75 por lata (150 ÷ 2)", vz),
        check(vz?.s === "0.9", "embalagem 900 ml", vz),
        check(sv?.p === null, "solvente continua sem preço (não usa)", sv),
        check(has(job?.summary_json, /excludedMaterials.*solvente/), "solvente fora deste orçamento", job?.summary_json),
        check((await quoteStatuses(h)).length >= 1, "orçamento calculado"),
      ];
    },
  },
  {
    id: "pagamento-gasto",
    title: "Pagamento e gasto no dia a dia",
    opening: "conte que a dona Maria pagou duzentos reais da cristaleira.",
    brief: "Existe o serviço da cristaleira da Dona Maria. Ela pagou 200 reais hoje (entrada). Depois ele também conta que gastou 90 reais em verniz numa loja hoje.",
    quirks: "Fala os valores por extenso às vezes.",
    goal: "Registrar o pagamento de 200 e o gasto de 90, confirmando quando pedirem.",
    setup: async (h) => {
      await seedJob(h, "cristaleira", "Dona Maria", ["patina"]);
    },
    checks: async (h) => {
      const pay = await h.ctx.db.first<{ n: number; s: number | null }>("SELECT COUNT(*) n, SUM(amount_cents) s FROM payments");
      const exp = await h.ctx.db.first<{ n: number; s: number | null }>("SELECT COUNT(*) n, (SELECT COALESCE(SUM(amount_cents),0) FROM purchases WHERE voided_at IS NULL) + (SELECT COALESCE(SUM(amount_cents),0) FROM expenses) s FROM purchases");
      return [check(pay?.s === 20000, "pagamento de R$ 200", pay), check(exp?.s === 9000, "gasto de R$ 90", exp)];
    },
  },
  {
    id: "andamento-nao-andamento",
    title: "Andamento: 'comecei' muda; 'quando ficar pronta ela busca' não muda",
    opening: "conte que começou a cristaleira da dona Maria hoje.",
    brief: "Existe o serviço da cristaleira da Dona Maria (ainda sem técnica definida). Hoje ele começou a lixar. Depois comenta que quando ficar pronta a Dona Maria vem buscar (isso NÃO é andamento).",
    goal: "Registrar que começou; o comentário sobre buscar não deve marcar como pronto.",
    setup: async (h) => {
      await seedJob(h, "cristaleira", "Dona Maria", []);
    },
    checks: async (h) => {
      const j = await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs LIMIT 1");
      return [check(j?.status === "EM_EXECUCAO", "serviço em execução (não concluído)", j)];
    },
  },
  {
    id: "fora-do-roteiro",
    title: "Fora do roteiro: oi, teste de áudio, conversa social e recomeçar",
    opening: "mande só 'oi'. Depois teste se o áudio está funcionando.",
    brief: "Ele quer testar o bot: manda oi, testa o áudio, pergunta se o bot está bem, começa um orçamento de uma cadeira do seu João para pintar, e no meio diz que quer começar de novo.",
    goal: "Testar o comportamento social e o recomeçar; termina depois de recomeçar.",
    maxTurns: 12,
    checks: async (h) => {
      const all = await h.ctx.db.all<{ status: string; facts_json: string }>("SELECT status, facts_json FROM jobs");
      const chairs = all.filter((j) => /cadeira/.test(j.facts_json));
      return [check(chairs.length > 0 && chairs.every((j) => j.status === "CANCELADO"), "o serviço da cadeira foi cancelado ao recomeçar", chairs.map((c) => c.status))];
    },
  },
  {
    id: "correcoes",
    title: "Correções do jeito dele no meio do orçamento",
    opening: "conte que pegou uma cômoda da dona Ana pra pintar de branco.",
    brief: "Cômoda, pintura branca. A cliente na verdade é a Dona Bia (ele corrige no meio: 'na verdade a cliente é a dona Bia'). Está boa. 90 de altura, 1 metro de largura, 45 de fundura. Só por fora. Sem conserto. Primeiro diz pincel, depois corrige: 'errei, é rolo'. Sem frete.",
    goal: "Chegar ao valor com os dados corrigidos e concordar.",
    checks: async (h) => {
      const js = await jobs(h);
      const j = js[0];
      return [
        check(js.length === 1, "1 serviço", js.length),
        check(has(v(j, "client_name"), /Bia/), "cliente corrigida para Dona Bia", v(j, "client_name")),
        check(has(v(j, "application_method"), /rolo/), "método corrigido para rolo", v(j, "application_method")),
        check(has(v(j, "details"), /branc/i), "cor branca anotada", v(j, "details")),
      ];
    },
  },
  {
    id: "edileuza-prazo",
    title: "Mesa da Dona Edileuza: 'pegar o serviço' não é buscar a peça, método em aberto, prazo do Adriano",
    opening: "conte por áudio: 'amanhã eu tenho um serviço para pegar lá na casa da dona Edileuza e do seu Crayson, uma mesa de centro e outros dois móveis, é pra lixar, fazer uns ajustes e pintar'. Por enquanto só fale da mesa de centro.",
    brief:
      "Mesa de centro da Dona Edileuza e do Seu Crayson, pintura. Tamanho médio (não sabe as medidas). Só precisa passar massa e lixar, sem conserto. Só por fora. Peça inteira. Não sabe ainda se vai de pincel ou rolo; se sugerirem pincel, aceita. Os clientes trazem e buscam a mesa (ele vai lá amanhã só pra ver). Preços se perguntarem: lixa 10 reais o pacote com 10 folhas; fundo preparador 100 reais a lata de 5 litros; tinta 50 reais a lata de 2 litros; thinner 15 reais a lata de 500 ml. Prazo: consegue começar daqui a 2 meses, e aí fica pronto em uma semana.",
    quirks: "Responde curtinho. Se o bot disser que ele vai buscar a mesa, reclama: 'eu não disse que ia buscar'. Quando vier o valor, pede 59 reais de desconto. Só fala do prazo se perguntarem.",
    goal: "Fechar o orçamento com o desconto e receber o PDF.",
    checks: async (h) => {
      const js = await jobs(h);
      const j = js.find((x) => has(v(x, "furniture_type"), /mesa/));
      const said = h.telegram.sent.map((s) => s.text ?? "").join("\n");
      return [
        check(!!j, "mesa de centro anotada"),
        check(!said.split(/(?<=[.!?\n])/).some((x) => /voc[eê] (vai )?busca|voc[eê] vai pegar a mesa/i.test(x) && !x.includes("?")), "não afirmou que ele vai buscar a peça"),
        check(!has(v(j, "logistics"), /"pickup":true/), "não anotou que ele busca", v(j, "logistics")),
        check(has(v(j, "deadline"), /2 meses/), "prazo dele anotado (2 meses)", v(j, "deadline")),
        check(/foto/i.test(said), "pediu foto"),
        check(!/\bsistema\b|marca[cç][aã]o/i.test(said), "sem falar de sistema/marcação"),
        check((await docs(h)) >= 1, "PDF gerado"),
      ];
    },
  },
  {
    id: "decisao-valor",
    title: "Decisão do valor: desconto abaixo do mínimo e depois acréscimo de frete",
    opening: "peça o orçamento de um aparador do seu Luiz pra envernizar.",
    brief: "Aparador do Seu Luiz, verniz. Está bom. 1,20 de largura, 40 de fundura, 80 de altura. Inteiro. Sem conserto. Pincel. O próprio Adriano vai buscar o aparador na casa do Seu Luiz e depois entregar; esse frete custa 60 reais e ele quer cobrar.",
    quirks: "Quando vier o valor, primeiro pede um desconto grande (metade do valor); quando avisarem do prejuízo, desiste e diz pra acrescentar 60 reais do frete.",
    goal: "Fechar o valor com o frete acrescentado e receber o PDF.",
    checks: async (h) => [check((await docs(h)) >= 1, "PDF gerado"), check((await quoteStatuses(h)).some((s) => ["ENVIADO", "APROVADO", "ACEITO", "RECUSADO"].includes(s)), "orçamento fechado", await quoteStatuses(h))],
  },
  {
    id: "consulta",
    title: "Consultas: quais serviços eu tenho e quanto falta receber",
    opening: "pergunte quais serviços ele tem.",
    brief: "Ele tem dois serviços anotados: cristaleira da Dona Maria e mesa do Seu João. Quer saber quais são e quanto a Dona Maria ainda deve (ela não pagou nada ainda).",
    goal: "Ver a lista de serviços e a situação da Dona Maria.",
    maxTurns: 8,
    setup: async (h) => {
      await seedJob(h, "cristaleira", "Dona Maria", ["patina"]);
      await seedJob(h, "mesa", "Seu João", ["verniz"]);
    },
    checks: async () => [],
  },
];

// ---------------------------------------------------------------- cenários diversos (23/11/2026)
// Peças e trabalhos fora do comum: o bot precisa anotar o que ele falou, chegar num valor e no PDF.

async function common(h: Harness, piece: RegExp): Promise<Check[]> {
  const js = await jobs(h);
  const said = h.telegram.sent.map((s) => s.text ?? "").filter((x) => !x.startsWith("🎧")).join("\n");
  const stuck = said.match(/.{0,60}(sistema|marca[cç][aã]o|reconhe[cç]o|n[aã]o consigo).{0,60}/i)?.[0];
  return [
    check(js.length >= 1 && js.some((j) => piece.test(JSON.stringify(j.facts))), "peça anotada com o nome que ele usou", js.map((j) => JSON.stringify(j.facts).slice(0, 160))),
    check((await quoteStatuses(h)).length >= 1, "chegou num valor", await quoteStatuses(h)),
    check((await docs(h)) >= 1, "PDF gerado"),
    check(!stuck, "sem travar nem falar de sistema", stuck),
  ];
}

const factsText = async (h: Harness) => JSON.stringify((await jobs(h)).map((j) => j.facts));

export const DIVERSE: Scenario[] = [
  {
    id: "div-guarda-roupa-decape",
    title: "Decapê num guarda-roupa grande, por dentro e por fora, com frete",
    opening: "conte por áudio que a dona Rita quer fazer decapê num guarda-roupa antigo.",
    brief: "Guarda-roupa da Dona Rita, decapê. 2 portas e 3 gavetas. 1,80 m de altura, 1,20 de largura, 55 de fundura. Por dentro e por fora. Uma dobradiça solta (conserto, ele acha que leva 1 hora). Pincel. Ele busca e entrega, frete de 80 reais. Prazo: começa daqui a 1 mês, leva umas 2 semanas. Preços se perguntarem: invente preços razoáveis de loja (ex.: removedor 60 reais o litro).",
    goal: "Chegar ao valor, concordar e receber o PDF.",
    checks: (h) => common(h, /guarda/),
  },
  {
    id: "div-estatua-folha-ouro",
    title: "Folha de ouro numa estátua de santo (peça que não é móvel)",
    opening: "conte que o seu Jorge trouxe uma estátua de madeira de Santo Antônio pra aplicar folha de ouro no manto.",
    brief: "Estátua de madeira de Santo Antônio do Seu Jorge, uns 60 cm de altura. Folha de ouro só no manto (uma parte). Tem um dedinho lascado pra arrumar com massa. Ele aplica com pincel. O cliente traz e busca. Prazo: daqui a 3 semanas. Preços se perguntarem: caderno de folha de ouro com 25 folhas 120 reais; cola mordente 40 reais o frasco de 100 ml. Acha que leva umas 6 horas de trabalho.",
    goal: "Chegar a um valor e receber o PDF.",
    checks: (h) => common(h, /est[aá]tua|santo/i),
  },
  {
    id: "div-faqueiro-veludo",
    title: "Encapar faqueiro com veludo (trabalho que não é pintura)",
    opening: "conte que a dona Lúcia quer encapar por dentro um faqueiro com veludo vinho.",
    brief: "Faqueiro (caixa de talheres) da Dona Lúcia, 40 por 30 cm e 8 de altura. Encapar o interior com veludo vinho. Por fora está bom, não mexe. Ele acha que leva umas 4 horas. Material: meio metro de veludo por 35 reais e uma cola de contato de 20 reais. Ela traz e busca. Prazo: semana que vem.",
    quirks: "Se perguntarem pincel/rolo/pistola, diz que não é pintura, é colar o tecido.",
    goal: "Chegar a um valor e receber o PDF.",
    checks: (h) => common(h, /faqueiro/i),
  },
  {
    id: "div-cadeiras-palhinha",
    title: "6 cadeiras: verniz + palhinha terceirizada",
    opening: "conte que a dona Neide tem 6 cadeiras iguais pra envernizar e trocar a palhinha do assento.",
    brief: "6 cadeiras iguais da Dona Neide. Envernizar (só por fora, inteiras). A palhinha do assento ele não faz: manda pro Seu Zé, que cobra 90 reais por cadeira. Estão boas, só gastas. Pincel. Ele busca e entrega, frete 100 reais. Prazo: daqui a 2 meses. Medidas: cadeira normal, tamanho médio.",
    goal: "Chegar ao valor com a palhinha incluída e receber o PDF.",
    checks: async (h) => [...(await common(h, /cadeira/i)), check(/palhinha|z[eé]/i.test(await factsText(h)), "palhinha/terceirizado anotado")],
  },
  {
    id: "div-porta-macica",
    title: "Porta de entrada maciça, dos dois lados, tirar verniz velho",
    opening: "conte que o seu Paulo quer reformar a porta de entrada de madeira maciça.",
    brief: "Porta de entrada maciça do Seu Paulo, 2,10 de altura por 90 cm. Tirar o verniz velho (decapê) e envernizar de novo, dos dois lados. Estado: verniz descascando, madeira boa. Pincel. Ele busca e leva de volta, frete 120. Prazo: daqui a 1 mês.",
    goal: "Chegar ao valor e receber o PDF.",
    checks: (h) => common(h, /porta/i),
  },
  {
    id: "div-oratorio-cupim",
    title: "Oratório com cupim: restauração + pátina + detalhes em folha de ouro",
    opening: "conte que a dona Cida trouxe um oratório antigo com cupim.",
    brief: "Oratório antigo da Dona Cida, 50 de altura, 30 de largura, 20 de fundura. Tem cupim: precisa tratar e restaurar (ele acha 3 horas de conserto). Depois pátina por fora e uns detalhes em folha de ouro nos frisos. Por dentro também (tem o nicho). Pincel. Ela traz e busca. Prazo: 1 mês.",
    goal: "Chegar ao valor e receber o PDF.",
    checks: (h) => common(h, /orat[oó]rio/i),
  },
  {
    id: "div-bandeja-flores",
    title: "Pintura artística à mão numa bandeja (técnica fora da lista)",
    opening: "conte que a dona Bete quer que você pinte flores à mão numa bandeja de madeira.",
    brief: "Bandeja de madeira da Dona Bete, 45 por 30 cm. Pintar fundo branco e flores à mão (pintura artística). Ele acha que leva umas 5 horas por causa dos detalhes. Usa tinta acrílica que ele já tem, só precisa de um verniz spray de 30 reais. Pincel. Ela traz e busca. Prazo: 10 dias.",
    goal: "Chegar a um valor e receber o PDF.",
    checks: (h) => common(h, /bandeja/i),
  },
  {
    id: "div-comoda-puxadores",
    title: "Cômoda: pintura lisa + troca de puxadores comprados",
    opening: "conte que a dona Vera quer pintar uma cômoda de branco e trocar os puxadores.",
    brief: "Cômoda da Dona Vera, pintura lisa branca. 4 gavetas. 90 de largura, 80 de altura, 45 de fundura. Só por fora. Está boa. Rolo. Trocar os 8 puxadores: ele compra puxadores novos a 15 reais cada (120 no total) e quer cobrar isso. Ela traz e busca. Prazo: daqui a 3 semanas.",
    goal: "Chegar ao valor com os puxadores incluídos e receber o PDF.",
    checks: async (h) => [...(await common(h, /c[oô]moda/i)), check(/puxador/i.test(await factsText(h)), "puxadores anotados")],
  },
  {
    id: "div-banco-jardim",
    title: "Banco de jardim (fica no tempo) com verniz marítimo",
    opening: "conte que o seu Antônio quer envernizar um banco de jardim que fica no sol e na chuva.",
    brief: "Banco de madeira de jardim do Seu Antônio, 1,50 de comprimento, 45 de fundura, 85 de altura com encosto. Verniz marítimo (fica exposto ao tempo). Está meio cinza do sol, precisa lixar bem, sem conserto. Pincel. Ele busca e entrega, frete 70. Prazo: daqui a 2 semanas.",
    goal: "Chegar ao valor e receber o PDF.",
    checks: (h) => common(h, /banco/i),
  },
  {
    id: "div-bau-e-espelho",
    title: "Duas peças diferentes: baú (pátina) e moldura de espelho redonda (folha de ouro)",
    opening: "conte que a dona Fátima tem um baú pra patinar e uma moldura de espelho redonda pra dourar.",
    brief: "Dona Fátima. (1) Baú: pátina azul envelhecida, 80 x 45 x 50 de altura, por dentro e por fora, bom estado, pincel. (2) Moldura de espelho redonda, 80 cm de diâmetro, folha de ouro na moldura toda, bom estado, pincel. Ela traz e busca as duas. Prazo: as duas daqui a 1 mês.",
    goal: "Chegar ao valor das duas e receber o PDF.",
    checks: async (h) => [...(await common(h, /ba[uú]/i)), check(/moldura|espelho/i.test(await factsText(h)), "moldura anotada")],
  },
];

// usados pelos cenários reais (real-scenarios.ts)
export { check, common, has, jobs, pieces, seedJob, v };
