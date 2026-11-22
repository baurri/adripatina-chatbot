import { useState } from "react";
import { api, formatBRL, formatDate, parseBRLToCents } from "../api";
import { Badge, Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

interface QuoteRow {
  id: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  version: number;
  status: string;
  floorCents: number | null;
  recommendedCents: number | null;
  finalPriceCents: number | null;
  confidence: string | null;
  definitiveAllowed: boolean;
  blockers: number;
  updatedAt: string;
}

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral"> = {
  AGUARDANDO_REVISAO: "warn",
  APROVADO: "ok",
  ENVIADO: "ok",
  ACEITO: "ok",
  RECUSADO: "danger",
  CANCELADO: "danger",
};

export function Quotes() {
  const [status, setStatus] = useState("AGUARDANDO_REVISAO");
  const { data, error, loading } = useLoad(() => api<{ rows: QuoteRow[] }>(`/quotes${status ? `?status=${status}` : ""}`), [status]);
  return (
    <>
      <h1>Orçamentos</h1>
      <Field label="Filtrar por situação">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {["ESTIMATIVA", "AGUARDANDO_REVISAO", "APROVADO", "ENVIADO", "ACEITO", "RECUSADO", "EXPIRADO", "CANCELADO"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      <Loading error={error} loading={loading} />
      {data && (
        <Table
          rows={data.rows}
          columns={[
            { header: "Serviço", cell: (r) => <a href={`#/orcamentos/${r.id}`}>{r.jobCode} — {r.jobTitle}</a> },
            { header: "Versão", cell: (r) => r.version, className: "num" },
            { header: "Situação", cell: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ").toLowerCase()}</Badge> },
            { header: "Piso", cell: (r) => formatBRL(r.floorCents), className: "num" },
            { header: "Recomendado", cell: (r) => formatBRL(r.recommendedCents), className: "num" },
            { header: "Bloqueios", cell: (r) => (r.blockers ? <Badge tone="danger">{r.blockers}</Badge> : <Badge tone="ok">0</Badge>) },
            { header: "Atualizado", cell: (r) => formatDate(r.updatedAt) },
          ]}
        />
      )}
    </>
  );
}

interface QuoteDetailData {
  quote: {
    id: string;
    jobId: string;
    version: number;
    status: string;
    rowVersion: number;
    floorCents: number | null;
    recommendedCents: number | null;
    finalPriceCents: number | null;
    definitiveAllowed: boolean;
    result: {
      confidence: string;
      blockers: { code: string; message: string }[];
      warnings: { code: string; message: string }[];
      gaps?: { code: string; message: string }[];
      hourlyRate: { minCentsPerHour: string; idealCentsPerHour: string; productiveHours: string };
      labor: { lines: { label: string; hours: string; dryingHours: string; dedupedFrom: string[] }[]; totalHours: string; minCents: number; idealCents: number };
      materials: {
        lines: { name: string; quantity: string; unit: string; consumptionCostCents: number | null; inventoryUsed: string; packagesToBuy: number; purchaseCashOutlayCents: number | null; historicalCostOfInventoryUsedCents: number | null; priceStale: boolean }[];
        consumptionCostCents: number;
        purchaseCashOutlayCents: number;
        historicalCostOfInventoryUsedCents: number;
      };
      subcontracts: { lines: { description: string; totalCents: number | null; confirmed: boolean }[]; totalCents: number };
      expenses: { totalCents: number };
      risk: { pct: string; reason: string | null; minCents: number };
      markup: { pct: string; cents: number };
      taxes: { configured: boolean; ratePct: string };
      depositRecommendedCents: number | null;
      leadTime: { workingDays: number; activeHours: string; dryingHours: string };
      formula: string[];
      engineVersion: string;
      areaM2: string | null;
    };
  };
}

export function QuoteDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => api<QuoteDetailData>(`/quotes/${id}`), [id]);
  const docs = useLoad(() => api<{ rows: { id: string; number: string; docVersion: number; kind: string; preliminary: boolean; createdAt: string; filename: string }[] }>(`/quotes/${id}/documents`), [id]);
  const users = useLoad(() => api<{ rows: { id: string; role: string; displayName: string; telegramChatId: string | null }[] }>("/users"));
  const { run, message, busy } = useAction();
  const [price, setPrice] = useState("");
  const [belowFloor, setBelowFloor] = useState(false);
  const [uncalibrated, setUncalibrated] = useState(false);
  const [justification, setJustification] = useState("");

  if (!data) return <Loading error={error} loading={loading} />;
  const q = data.quote;
  const r = q.result;
  const priceCents = price ? parseBRLToCents(price) : null;
  const artisans = (users.data?.rows ?? []).filter((u) => u.role === "ARTESAO" && u.telegramChatId);

  return (
    <>
      <p>
        <a href="#/orcamentos">← Orçamentos</a> · <a href={`#/servicos/${q.jobId}`}>Abrir serviço</a>
      </p>
      <h1>
        Orçamento v{q.version} <Badge tone={STATUS_TONE[q.status] ?? "neutral"}>{q.status.replace(/_/g, " ").toLowerCase()}</Badge>
      </h1>
      <Notice message={message} />
      <div className="stats">
        <div className="stat"><span className="stat-label">Piso (hora mínima)</span><strong className="stat-value">{formatBRL(q.floorCents)}</strong></div>
        <div className="stat"><span className="stat-label">Recomendado</span><strong className="stat-value">{formatBRL(q.recommendedCents)}</strong></div>
        <div className="stat"><span className="stat-label">Preço final</span><strong className="stat-value">{formatBRL(q.finalPriceCents)}</strong></div>
        <div className="stat"><span className="stat-label">Confiança</span><strong className="stat-value">{r.confidence}</strong></div>
        <div className="stat"><span className="stat-label">Entrada recomendada</span><strong className="stat-value">{formatBRL(r.depositRecommendedCents)}</strong></div>
        <div className="stat"><span className="stat-label">Prazo estimado</span><strong className="stat-value">{r.leadTime.workingDays} dias úteis</strong></div>
      </div>

      {(r.blockers.length > 0 || (r.gaps ?? []).length > 0 || r.warnings.length > 0) && (
        <Section title="Bloqueios, pendências e alertas">
          <ul className="alerts">
            {r.blockers.map((b, i) => <li key={`b${i}`} className="danger">{b.message}</li>)}
            {(r.gaps ?? []).map((g, i) => <li key={`g${i}`} className="danger">{g.message}</li>)}
            {r.warnings.map((w, i) => <li key={`w${i}`} className="warn">{w.message}</li>)}
          </ul>
        </Section>
      )}

      <Section title="Aprovação administrativa">
        <div className="form-grid">
          <Field label="Preço final (opcional)" hint="Vazio = recomendado. Abaixo do piso exige exceção justificada.">
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={formatBRL(q.recommendedCents)} />
          </Field>
          <Field label="Justificativa (obrigatória para exceções)">
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />
          </Field>
          <label className="check"><input type="checkbox" checked={belowFloor} onChange={(e) => setBelowFloor(e.target.checked)} /> Autorizar preço abaixo do piso</label>
          <label className="check"><input type="checkbox" checked={uncalibrated} onChange={(e) => setUncalibrated(e.target.checked)} /> Autorizar parâmetros não calibrados</label>
        </div>
        {priceCents !== null && q.floorCents !== null && priceCents < q.floorCents && <p className="notice error">Atenção: {formatBRL(priceCents)} está abaixo do piso ({formatBRL(q.floorCents)}). Pode gerar prejuízo.</p>}
        <div className="actions">
          <button disabled={busy || (price !== "" && priceCents === null)} onClick={() => run(() => api(`/quotes/${id}/approve`, { method: "POST", body: { finalPriceCents: priceCents, approveBelowFloor: belowFloor, approveUncalibrated: uncalibrated, justification } }), "Orçamento aprovado.").then((ok) => ok && reload())}>
            Aprovar
          </button>
          <button className="secondary" disabled={busy} onClick={() => run(() => api(`/quotes/${id}/recalculate`, { method: "POST", body: {} }), "Recalculado.").then(() => reload())}>
            Recalcular
          </button>
          <button className="secondary" disabled={busy} onClick={() => run(() => api(`/quotes/${id}/issue`, { method: "POST", body: { preliminary: true } }), "Estimativa preliminar gerada.").then(() => docs.reload())}>
            Gerar estimativa (não definitiva)
          </button>
          <button disabled={busy || (q.status !== "APROVADO" && q.status !== "ENVIADO")} onClick={() => run(() => api(`/quotes/${id}/issue`, { method: "POST", body: { preliminary: false } }), "Proposta definitiva gerada.").then(() => docs.reload())}>
            Gerar proposta definitiva
          </button>
          {q.status === "ENVIADO" && (
            <>
              <button className="secondary" onClick={() => run(() => api(`/quotes/${id}/outcome`, { method: "POST", body: { outcome: "ACEITO" } }), "Marcado como aceito.").then(() => reload())}>Cliente aceitou</button>
              <button className="secondary" onClick={() => run(() => api(`/quotes/${id}/outcome`, { method: "POST", body: { outcome: "RECUSADO" } }), "Marcado como recusado.").then(() => reload())}>Cliente recusou</button>
            </>
          )}
        </div>
      </Section>

      <Section title="Documentos">
        <Table
          rows={docs.data?.rows ?? []}
          empty="Nenhum documento emitido."
          columns={[
            { header: "Número", cell: (d) => `${d.number} v${d.docVersion}` },
            { header: "Tipo", cell: (d) => (d.kind === "INTERNO" ? <Badge tone="danger">interno — confidencial</Badge> : d.preliminary ? <Badge tone="warn">estimativa</Badge> : <Badge tone="ok">proposta</Badge>) },
            { header: "Emitido", cell: (d) => formatDate(d.createdAt) },
            { header: "Baixar", cell: (d) => <a href={`/api/v1/admin/documents/${d.id}/download`}>{d.filename}</a> },
            {
              header: "Enviar ao artesão",
              cell: (d) =>
                d.kind === "COMERCIAL" ? (
                  artisans.length ? (
                    artisans.map((a) => (
                      <button key={a.id} className="secondary small" onClick={() => run(() => api(`/quotes/${id}/send-to-artisan`, { method: "POST", body: { documentId: d.id, artisanUserId: a.id } }), `Enviado para ${a.displayName} no Telegram.`).then(() => reload())}>
                        {a.displayName}
                      </button>
                    ))
                  ) : (
                    <span className="muted">artesão ainda sem chat</span>
                  )
                ) : (
                  <span className="muted">nunca enviado</span>
                ),
            },
          ]}
        />
      </Section>

      <Section title="Memória de cálculo (interno)">
        <p className="muted">
          Área considerada: {r.areaM2 ?? "—"} m² · Hora mínima {formatBRL(Math.round(Number(r.hourlyRate.minCentsPerHour)))}/h · Hora ideal {formatBRL(Math.round(Number(r.hourlyRate.idealCentsPerHour)))}/h · {r.hourlyRate.productiveHours} h produtivas/mês · motor {r.engineVersion}
        </p>
        <h3>Mão de obra ({r.labor.totalHours} h ativas)</h3>
        <Table rows={r.labor.lines} columns={[{ header: "Etapa", cell: (l) => l.label }, { header: "Horas", cell: (l) => l.hours, className: "num" }, { header: "Secagem (h, fora da mão de obra)", cell: (l) => l.dryingHours, className: "num" }, { header: "Deduplicada de", cell: (l) => l.dedupedFrom.join(", ") || "—" }]} />
        <h3>Materiais — consumo valorizado × compra</h3>
        <Table
          rows={r.materials.lines}
          columns={[
            { header: "Material", cell: (m) => <>{m.name} {m.priceStale && <Badge tone="warn">preço antigo</Badge>}</> },
            { header: "Consumo", cell: (m) => `${m.quantity} ${m.unit}`, className: "num" },
            { header: "Custo de consumo", cell: (m) => (m.consumptionCostCents === null ? <Badge tone="danger">sem preço</Badge> : formatBRL(m.consumptionCostCents)), className: "num" },
            { header: "Do estoque", cell: (m) => m.inventoryUsed, className: "num" },
            { header: "Comprar", cell: (m) => `${m.packagesToBuy} emb. (${formatBRL(m.purchaseCashOutlayCents)})`, className: "num" },
            { header: "Custo histórico do estoque", cell: (m) => formatBRL(m.historicalCostOfInventoryUsedCents), className: "num" },
          ]}
        />
        <p>
          Consumo total (entra no preço): <strong>{formatBRL(r.materials.consumptionCostCents)}</strong> · Desembolso de compra (caixa): <strong>{formatBRL(r.materials.purchaseCashOutlayCents)}</strong>
        </p>
        <h3>Terceiros, despesas, risco, markup e tributos</h3>
        <ul>
          {r.subcontracts.lines.map((s, i) => <li key={i}>{s.description}: {formatBRL(s.totalCents)} {s.confirmed ? "" : <Badge tone="danger">sem cotação</Badge>}</li>)}
          <li>Despesas específicas: {formatBRL(r.expenses.totalCents)}</li>
          <li>Risco específico: {r.risk.pct}% {r.risk.reason ?? ""}</li>
          <li>Markup sobre custo (somente recomendado): {r.markup.pct}% = {formatBRL(r.markup.cents)}</li>
          <li>Tributos: {r.taxes.configured ? `${r.taxes.ratePct}%` : "não configurados"}</li>
        </ul>
        <details>
          <summary>Fórmulas</summary>
          <ol>{r.formula.map((f, i) => <li key={i}><code>{f}</code></li>)}</ol>
        </details>
      </Section>
    </>
  );
}
