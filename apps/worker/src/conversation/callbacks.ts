/**
 * Tradução de callbacks técnicos (botões) para texto compreensível no painel.
 * O valor técnico continua disponível nos detalhes de depuração.
 */
const LABELS: Record<string, string> = {
  "match:yes": "confirmou que é o mesmo serviço",
  "match:no": "disse que é outro serviço",
  "match:unsure": "não tem certeza se é o mesmo serviço",
  "match:pick": "escolheu um dos serviços parecidos",
  "fact:new": "escolheu a informação nova",
  "fact:old": "manteve a informação anterior",
  "fact:both": "escolheu as duas informações",
  "prog:confirm": "confirmou a mudança de andamento do serviço",
  "calc:yes": "pediu para calcular o orçamento",
  "calc:fix": "quis corrigir algo antes do cálculo",
  "exp:confirm": "confirmou o registro do gasto",
  "exp:fix": "quis corrigir o valor do gasto",
  "exp:cancel": "desistiu do registro do gasto",
  "exp:force": "disse que é outro gasto igual",
  "exp:job": "escolheu a que serviço o gasto pertence",
  "pay:confirm": "confirmou o registro do pagamento",
  "pay:fix": "quis corrigir o valor do pagamento",
  "pay:cancel": "desistiu do registro do pagamento",
  "pay:force": "disse que é outro pagamento igual",
  "pay:job": "escolheu a que serviço o pagamento pertence",
  "pdf:issue": "pediu o PDF da proposta",
  "pdf:prelim": "pediu uma estimativa não definitiva",
  "outcome:accept": "informou que o cliente aceitou",
  "outcome:reject": "informou que o cliente recusou",
  "mp:ok": "confirmou o preço do material",
  "mp:fix": "quis corrigir o preço informado",
  "mp:fixprice": "quis corrigir o valor do material",
  "mp:fixsize": "quis corrigir o tamanho da embalagem",
  "mp:later": "deixou o preço para depois",
  "mp:photo": "vai mandar foto do recibo/etiqueta",
  "mp:estimate": "pediu estimativa sem o material sem preço",
  "mp:admin": "pediu ajuda ao administrador com o preço",
  "mp:resume": "pediu para continuar o orçamento",
  "mp:retry": "pediu para tentar recalcular de novo",
  "mp:cancel": "cancelou o orçamento",
  "qr:owner_yes": "confirmou de quem é cada peça",
  "qr:owner_no": "corrigiu de quem é cada peça",
  "qr:review_yes": "confirmou o resumo dos móveis",
  "qr:review_no": "quis corrigir o resumo dos móveis",
  "qr:group_split": "escolheu um orçamento para cada cliente",
  "qr:group_all": "escolheu um orçamento só, tudo junto",
  "qr:resume": "pediu para continuar o orçamento",
  "cmd:continue": "pediu para continuar de onde parou",
  "cmd:other_subject": "disse que é outro assunto",
  "cmd:pause": "pediu para continuar depois",
  "cmd:cancel": "cancelou",
  "cmd:new_quote": "tocou em novo orçamento",
  "cmd:list_jobs": "pediu a lista de serviços",
  "cmd:expense": "tocou em registrar gasto",
  "cmd:payment": "tocou em registrar pagamento",
  "cmd:noop": "disse que ainda não",
  "adm:approve_confirm": "administrador confirmou a aprovação",
  "photo:job": "escolheu o serviço da foto",
  "photo:new": "disse que a foto é de um móvel novo",
  "job:open": "abriu um serviço da lista",
};

export function humanizeCallback(data: string | null | undefined, who = "Usuário"): string {
  if (!data) return `${who} tocou em um botão`;
  const [ns, action, value] = data.split(":");
  if (ns === "ans") return `${who} respondeu pelo botão: ${(action ?? "").replace(/_/g, " ")}`;
  const label = LABELS[`${ns}:${action}`];
  if (label) return `${who} ${label}`;
  void value;
  return `${who} tocou em um botão`;
}
