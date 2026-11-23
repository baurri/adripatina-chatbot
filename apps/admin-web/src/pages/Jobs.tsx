import { useState } from "react";
import { api, formatBRL, formatDate, newIdempotencyKey, parseBRLToCents } from "../api";
import { Badge, Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: "Em orçamento",
  AGUARDANDO_INICIO: "Aguardando início",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  MESCLADO: "Mesclado",
};

export function Jobs() {
  const [status, setStatus] = useState("ORCAMENTO,AGUARDANDO_INICIO,EM_EXECUCAO,CONCLUIDO");
  const { data, error, loading, reload } = useLoad(() => api<{ rows: { id: string; code: string; title: string; status: string; clientName: string | null; contractedCents: number | null; lastInteractionAt: string | null; pending: string[] }[] }>(`/jobs?status=${status}`), [status]);
  const [desc, setDesc] = useState("");
  const { run, message, busy } = useAction();
  return (
    <>
      <h1>Serviços</h1>
      <div className="form-row">
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ORCAMENTO,AGUARDANDO_INICIO,EM_EXECUCAO,CONCLUIDO">Ativos</option>
            <option value="ENTREGUE">Entregues</option>
            <option value="CANCELADO">Cancelados</option>
            <option value="MESCLADO">Mesclados</option>
          </select>
        </Field>
        <Field label="Novo serviço (descrição)">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: cômoda da dona Ana, decapê" />
        </Field>
        <button disabled={busy || desc.trim().length < 3} onClick={() => run(() => api("/jobs", { method: "POST", body: { description: desc } }), "Serviço criado.").then(() => (setDesc(""), reload()))}>
          Criar
        </button>
      </div>
      <Notice message={message} />
      <Loading error={error} loading={loading} />
      {data && (
        <Table
          rows={data.rows}
          columns={[
            { header: "Código", cell: (r) => <a href={`#/servicos/${r.id}`}>{r.code}</a> },
            { header: "Serviço", cell: (r) => r.title },
            { header: "Situação", cell: (r) => STATUS_LABEL[r.status] ?? r.status },
            { header: "Contratado", cell: (r) => formatBRL(r.contractedCents), className: "num" },
            { header: "Pendências", cell: (r) => (r.pending.length ? <Badge tone="warn">{r.pending.length}</Badge> : <Badge tone="ok">0</Badge>) },
            { header: "Última conversa", cell: (r) => formatDate(r.lastInteractionAt) },
          ]}
        />
      )}
    </>
  );
}

interface JobDetailData {
  job: { id: string; code: string; title: string; status: string; description: string; contractedCents: number | null; facts: Record<string, { value: unknown; status: string; source: string; updatedAt: string }> };
  summary: { headline: string; confirmed: string[]; pending: string[] };
  facts: { field: string; value_json: string; status: string; source: string; change_kind: string; created_at: string; superseded_at: string | null }[];
  events: { type: string; payload_json: string; reason: string | null; created_at: string }[];
  quotes: { id: string; version: number; status: string; floor_cents: number | null; recommended_cents: number | null; final_price_cents: number | null }[];
  payments: { id: string; amount_cents: number; kind: string; paid_at: string; reference: string | null }[];
  purchases: { id: string; description: string; amount_cents: number; purchased_at: string }[];
  expenses: { id: string; description: string; amount_cents: number; category: string; spent_at: string }[];
  subcontracts: { id: string; scope: string; cost_cents: number | null; confirmed: number; lead_days: number | null }[];
  messages: { direction: string; kind: string; text: string | null; created_at: string }[];
  economics: { contractedCents: number | null; receivedCents: number; balanceCents: number | null; materialConsumptionCents: number; purchaseCashCents: number; expensesCents: number; economicResultBeforeOwnLaborCents: number | null; cashFlowCents: number };
  overrides: { extraLabor: { description: string; hours: string }[]; specificExpenses: { description: string; amountCents: number; category: string }[]; specificRisk: { pct: string; reason: string } | null; areaM2Override: string | null; excludedMaterials?: string[] };
}

export function JobDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => api<JobDetailData>(`/jobs/${id}`), [id]);
  const { run, message, busy } = useAction();
  const [pay, setPay] = useState("");
  const [payKey] = useState(newIdempotencyKey);
  const [purchase, setPurchase] = useState({ description: "", amount: "" });
  const [expense, setExpense] = useState({ description: "", amount: "", category: "transporte" });
  const [sub, setSub] = useState({ scope: "", cost: "", logistics: "", confirmed: false, leadDays: "" });
  const [extra, setExtra] = useState({ description: "", hours: "" });
  const [transport, setTransport] = useState("");
  const [risk, setRisk] = useState({ pct: "", reason: "" });

  if (!data) return <Loading error={error} loading={loading} />;
  const { job, economics: e, overrides } = data;

  const saveOverrides = (patch: Partial<JobDetailData["overrides"]>) => run(() => api(`/jobs/${id}/pricing-overrides`, { method: "PATCH", body: { ...overrides, ...patch } }), "Ajustes salvos. Recalcule o orçamento.").then(() => reload());

  return (
    <>
      <p><a href="#/servicos">← Serviços</a></p>
      <h1>{job.code} — {data.summary.headline}</h1>
      <p><Badge>{STATUS_LABEL[job.status] ?? job.status}</Badge></p>
      <Notice message={message} />

      <div className="stats">
        <div className="stat"><span className="stat-label">Contratado</span><strong className="stat-value">{formatBRL(e.contractedCents)}</strong></div>
        <div className="stat"><span className="stat-label">Recebido</span><strong className="stat-value">{formatBRL(e.receivedCents)}</strong></div>
        <div className="stat"><span className="stat-label">Saldo</span><strong className="stat-value">{formatBRL(e.balanceCents)}</strong></div>
        <div className="stat"><span className="stat-label">Materiais consumidos (reposição)</span><strong className="stat-value">{formatBRL(e.materialConsumptionCents)}</strong></div>
        <div className="stat"><span className="stat-label">Compras (caixa)</span><strong className="stat-value">{formatBRL(e.purchaseCashCents)}</strong></div>
        <div className="stat"><span className="stat-label">Resultado antes da mão de obra própria</span><strong className="stat-value">{formatBRL(e.economicResultBeforeOwnLaborCents)}</strong></div>
      </div>

      <Section title="Ações">
        <div className="actions">
          {["EM_EXECUCAO", "CONCLUIDO", "ENTREGUE", "CANCELADO"].map((to) => (
            <button key={to} className="secondary" disabled={busy} onClick={() => run(() => api(`/jobs/${id}/transition`, { method: "POST", body: { to } }), "Situação atualizada.").then(() => reload())}>
              Marcar como {STATUS_LABEL[to]?.toLowerCase()}
            </button>
          ))}
          <button disabled={busy} onClick={() => run(() => api("/quotes/draft", { method: "POST", body: { jobId: id } }), "Orçamento calculado.").then(() => reload())}>
            Calcular orçamento
          </button>
        </div>
      </Section>

      <Section title="Memória do projeto (fatos confirmados)">
        <ul>{data.summary.confirmed.map((c, i) => <li key={i}>{c}</li>)}</ul>
        {data.summary.pending.length > 0 && <p className="warn">Pendências: {data.summary.pending.join(", ")}</p>}
        <details>
          <summary>Histórico de fatos e correções ({data.facts.length})</summary>
          <Table rows={data.facts} columns={[{ header: "Campo", cell: (f) => f.field }, { header: "Valor", cell: (f) => <code>{f.value_json}</code> }, { header: "Tipo", cell: (f) => f.change_kind }, { header: "Origem", cell: (f) => f.source }, { header: "Quando", cell: (f) => formatDate(f.created_at) }, { header: "Substituído", cell: (f) => (f.superseded_at ? formatDate(f.superseded_at) : "vigente") }]} />
        </details>
      </Section>

      <Section title="Orçamentos">
        <Table rows={data.quotes} empty="Sem orçamento ainda." columns={[{ header: "Versão", cell: (q) => <a href={`#/orcamentos/${q.id}`}>v{q.version}</a> }, { header: "Situação", cell: (q) => q.status }, { header: "Piso", cell: (q) => formatBRL(q.floor_cents), className: "num" }, { header: "Recomendado", cell: (q) => formatBRL(q.recommended_cents), className: "num" }, { header: "Final", cell: (q) => formatBRL(q.final_price_cents), className: "num" }]} />
      </Section>

      <Section title="Ajustes de precificação (admin)">
        <p className="muted">Horas extras (consertos), transporte e risco específico. O motor calcula; nada é adicionado em duplicidade.</p>
        <ul>
          {overrides.extraLabor.map((x, i) => <li key={i}>{x.description}: {x.hours} h</li>)}
          {overrides.specificExpenses.map((x, i) => <li key={`e${i}`}>{x.description}: {formatBRL(x.amountCents)} ({x.category})</li>)}
          {overrides.specificRisk && <li>Risco: {overrides.specificRisk.pct}% — {overrides.specificRisk.reason}</li>}
        </ul>
        <div className="form-row">
          <Field label="Conserto/etapa extra"><input value={extra.description} onChange={(ev) => setExtra({ ...extra, description: ev.target.value })} /></Field>
          <Field label="Horas"><input inputMode="decimal" value={extra.hours} onChange={(ev) => setExtra({ ...extra, hours: ev.target.value.replace(",", ".") })} /></Field>
          <button className="secondary" disabled={!extra.description || !/^\d+(\.\d+)?$/.test(extra.hours)} onClick={() => saveOverrides({ extraLabor: [...overrides.extraLabor, extra] }).then(() => setExtra({ description: "", hours: "" }))}>Adicionar horas</button>
        </div>
        <div className="form-row">
          <Field label="Transporte (R$)"><input inputMode="decimal" value={transport} onChange={(ev) => setTransport(ev.target.value)} /></Field>
          <button className="secondary" disabled={parseBRLToCents(transport) === null} onClick={() => saveOverrides({ specificExpenses: [...overrides.specificExpenses, { description: "Transporte", amountCents: parseBRLToCents(transport)!, category: "transporte" }] }).then(() => setTransport(""))}>Adicionar transporte</button>
        </div>
        <div className="form-row">
          <Field label="Risco específico (%)"><input inputMode="decimal" value={risk.pct} onChange={(ev) => setRisk({ ...risk, pct: ev.target.value.replace(",", ".") })} /></Field>
          <Field label="Motivo concreto"><input value={risk.reason} onChange={(ev) => setRisk({ ...risk, reason: ev.target.value })} /></Field>
          <button className="secondary" disabled={!/^\d+(\.\d+)?$/.test(risk.pct) || risk.reason.length < 3} onClick={() => saveOverrides({ specificRisk: risk })}>Salvar risco</button>
          {overrides.specificRisk && <button className="secondary" onClick={() => saveOverrides({ specificRisk: null })}>Remover risco</button>}
        </div>
      </Section>

      <Section title="Terceiros (cotações)">
        <Table rows={data.subcontracts} empty="Nenhum terceiro." columns={[{ header: "Escopo", cell: (s) => s.scope }, { header: "Custo", cell: (s) => formatBRL(s.cost_cents), className: "num" }, { header: "Prazo", cell: (s) => (s.lead_days ? `${s.lead_days} dias` : "—") }, { header: "Confirmado", cell: (s) => (s.confirmed ? <Badge tone="ok">sim</Badge> : <Badge tone="danger">não</Badge>) }]} />
        <div className="form-row">
          <Field label="Escopo"><input value={sub.scope} onChange={(ev) => setSub({ ...sub, scope: ev.target.value })} /></Field>
          <Field label="Custo (R$)"><input inputMode="decimal" value={sub.cost} onChange={(ev) => setSub({ ...sub, cost: ev.target.value })} /></Field>
          <Field label="Logística (R$)"><input inputMode="decimal" value={sub.logistics} onChange={(ev) => setSub({ ...sub, logistics: ev.target.value })} /></Field>
          <Field label="Prazo (dias)"><input inputMode="numeric" value={sub.leadDays} onChange={(ev) => setSub({ ...sub, leadDays: ev.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={sub.confirmed} onChange={(ev) => setSub({ ...sub, confirmed: ev.target.checked })} /> Cotação confirmada</label>
          <button className="secondary" disabled={sub.scope.length < 2} onClick={() => run(() => api(`/jobs/${id}/subcontracts`, { method: "POST", body: { scope: sub.scope, costCents: sub.cost ? parseBRLToCents(sub.cost) : null, logisticsCents: parseBRLToCents(sub.logistics) ?? 0, leadDays: sub.leadDays ? Number(sub.leadDays) : null, confirmed: sub.confirmed } }), "Cotação registrada.").then(() => reload())}>Registrar</button>
        </div>
      </Section>

      <Section title="Financeiro do serviço">
        <div className="form-row">
          <Field label="Pagamento recebido (R$)"><input inputMode="decimal" value={pay} onChange={(ev) => setPay(ev.target.value)} /></Field>
          <button disabled={busy || parseBRLToCents(pay) === null} onClick={() => run(() => api(`/jobs/${id}/payments`, { method: "POST", body: { amountCents: parseBRLToCents(pay) }, idempotencyKey: payKey }), "Pagamento registrado.").then(() => (setPay(""), reload()))}>Registrar pagamento</button>
        </div>
        <div className="form-row">
          <Field label="Compra (descrição)"><input value={purchase.description} onChange={(ev) => setPurchase({ ...purchase, description: ev.target.value })} /></Field>
          <Field label="Valor (R$)"><input inputMode="decimal" value={purchase.amount} onChange={(ev) => setPurchase({ ...purchase, amount: ev.target.value })} /></Field>
          <button className="secondary" disabled={busy || purchase.description.length < 2 || parseBRLToCents(purchase.amount) === null} onClick={() => run(() => api(`/jobs/${id}/purchases`, { method: "POST", body: { description: purchase.description, amountCents: parseBRLToCents(purchase.amount) } }), "Compra registrada.").then(() => (setPurchase({ description: "", amount: "" }), reload()))}>Registrar compra</button>
        </div>
        <div className="form-row">
          <Field label="Despesa (descrição)"><input value={expense.description} onChange={(ev) => setExpense({ ...expense, description: ev.target.value })} /></Field>
          <Field label="Categoria">
            <select value={expense.category} onChange={(ev) => setExpense({ ...expense, category: ev.target.value })}>
              <option value="transporte">Transporte</option>
              <option value="embalagem">Embalagem</option>
              <option value="estacionamento">Estacionamento</option>
              <option value="outros">Outros</option>
            </select>
          </Field>
          <Field label="Valor (R$)"><input inputMode="decimal" value={expense.amount} onChange={(ev) => setExpense({ ...expense, amount: ev.target.value })} /></Field>
          <button className="secondary" disabled={busy || expense.description.length < 2 || parseBRLToCents(expense.amount) === null} onClick={() => run(() => api(`/jobs/${id}/expenses`, { method: "POST", body: { description: expense.description, category: expense.category, amountCents: parseBRLToCents(expense.amount) } }), "Despesa registrada.").then(() => (setExpense({ description: "", amount: "", category: "transporte" }), reload()))}>Registrar despesa</button>
        </div>
        <h3>Pagamentos</h3>
        <Table rows={data.payments} empty="Nenhum pagamento." columns={[{ header: "Data", cell: (p) => formatDate(p.paid_at) }, { header: "Tipo", cell: (p) => p.kind }, { header: "Valor", cell: (p) => formatBRL(p.kind === "ESTORNO" ? -p.amount_cents : p.amount_cents), className: "num" }, { header: "Referência", cell: (p) => p.reference ?? "—" }]} />
        <h3>Compras e despesas</h3>
        <Table rows={[...data.purchases.map((p) => ({ d: p.purchased_at, t: `Compra: ${p.description}`, v: p.amount_cents })), ...data.expenses.map((x) => ({ d: x.spent_at, t: `${x.category}: ${x.description}`, v: x.amount_cents }))]} empty="Nenhum gasto." columns={[{ header: "Data", cell: (r) => formatDate(r.d) }, { header: "Descrição", cell: (r) => r.t }, { header: "Valor", cell: (r) => formatBRL(r.v), className: "num" }]} />
      </Section>

      <Section title="Linha do tempo">
        <Table rows={data.events} columns={[{ header: "Quando", cell: (ev) => formatDate(ev.created_at) }, { header: "Evento", cell: (ev) => ev.type }, { header: "Detalhes", cell: (ev) => <code>{ev.payload_json}</code> }, { header: "Motivo", cell: (ev) => ev.reason ?? "" }]} />
      </Section>

      <Section title="Conversas vinculadas">
        <ul className="chat">
          {data.messages.map((m, i) => (
            <li key={i} className={m.direction}>
              <small>{formatDate(m.created_at)} · {m.kind}</small>
              <p>{m.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
