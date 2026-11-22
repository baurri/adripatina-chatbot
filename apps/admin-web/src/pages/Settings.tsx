import { useEffect, useState } from "react";
import { api, formatBRL, formatDate } from "../api";
import { Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

type Params = Record<string, unknown> & {
  incomeMinCents: number;
  incomeIdealCents: number;
  fixedCostsCents: number;
  reservePct: string;
  availableHoursPerMonth: string;
  productivityPct: string;
  hoursPerWorkday: string;
  commercialMarkupPct: string;
  taxRatePct: string;
  taxConfigured: boolean;
  subcontractCoordinationPct: string;
  stalePriceDays: number;
  depositPct: string;
  quoteValidityDays: number;
  requireAdminReview: boolean;
};
type Business = Record<string, unknown> & { name: string; tagline: string | null; phone: string | null; email: string | null; instagram: string | null; city: string | null; document: string | null; defaultExclusions: string[]; defaultNotes: string[]; showAcceptance: boolean; showCommercialBreakdown: boolean };

const NUM_FIELDS: [keyof Params, string, string][] = [
  ["reservePct", "Reserva geral (%)", "Já embutida na hora; nunca somada de novo por serviço."],
  ["availableHoursPerMonth", "Horas disponíveis/mês", "Base regular: 6 h/dia, seg–sex. Sábado não entra."],
  ["productivityPct", "Aproveitamento produtivo (%)", ""],
  ["hoursPerWorkday", "Horas por dia (prazo)", ""],
  ["commercialMarkupPct", "Markup sobre custo total (%)", "Aplicado só ao preço recomendado. 0 = sem margem extra."],
  ["taxRatePct", "Alíquota efetiva (%)", "Só vale se 'tributos configurados' estiver marcado."],
  ["subcontractCoordinationPct", "Taxa de coordenação de terceiros (%)", ""],
  ["depositPct", "Entrada recomendada (%)", ""],
];

export function Settings() {
  const { data, error, loading, reload } = useLoad(() => api<{ id: string; params: Params; business: Business; origin: string; effectiveFrom: string }>("/settings"));
  const history = useLoad(() => api<{ rows: { id: string; origin: string; created_at: string; is_active: number }[] }>("/settings/history"));
  const [params, setParams] = useState<Params | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const { run, message, busy } = useAction();
  useEffect(() => {
    if (data) {
      setParams(data.params);
      setBiz(data.business);
    }
  }, [data]);
  if (!params || !biz) return <Loading error={error} loading={loading} />;
  const reais = (cents: number) => (cents / 100).toFixed(2);
  const toCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

  return (
    <>
      <h1>Configurações</h1>
      <p className="muted">Cada alteração cria uma nova versão. Orçamentos e PDFs já emitidos não mudam. Origem atual: {data?.origin} · desde {formatDate(data?.effectiveFrom)}</p>
      <Notice message={message} />
      <Section title="Metas e custos (PROVISÓRIOS — validar)">
        <div className="form-grid">
          <Field label="Renda líquida mínima (R$/mês)"><input inputMode="decimal" value={reais(params.incomeMinCents)} onChange={(e) => setParams({ ...params, incomeMinCents: toCents(e.target.value) })} /></Field>
          <Field label="Renda ideal (R$/mês)"><input inputMode="decimal" value={reais(params.incomeIdealCents)} onChange={(e) => setParams({ ...params, incomeIdealCents: toCents(e.target.value) })} /></Field>
          <Field label="Custos fixos da oficina (R$/mês)"><input inputMode="decimal" value={reais(params.fixedCostsCents)} onChange={(e) => setParams({ ...params, fixedCostsCents: toCents(e.target.value) })} /></Field>
          {NUM_FIELDS.map(([k, label, hint]) => (
            <Field key={String(k)} label={label} hint={hint}>
              <input inputMode="decimal" value={String(params[k])} onChange={(e) => setParams({ ...params, [k]: e.target.value.replace(",", ".") })} />
            </Field>
          ))}
          <Field label="Preço desatualizado após (dias)"><input inputMode="numeric" value={params.stalePriceDays} onChange={(e) => setParams({ ...params, stalePriceDays: Number(e.target.value) || 1 })} /></Field>
          <Field label="Validade da proposta (dias)"><input inputMode="numeric" value={params.quoteValidityDays} onChange={(e) => setParams({ ...params, quoteValidityDays: Number(e.target.value) || 1 })} /></Field>
          <label className="check"><input type="checkbox" checked={params.taxConfigured} onChange={(e) => setParams({ ...params, taxConfigured: e.target.checked })} /> Tributos configurados conforme enquadramento real</label>
          <label className="check"><input type="checkbox" checked={params.requireAdminReview} onChange={(e) => setParams({ ...params, requireAdminReview: e.target.checked })} /> Revisão administrativa obrigatória (recomendado no início)</label>
        </div>
        <p className="muted">
          Hora mínima estimada: {formatBRL(Math.round(((params.incomeMinCents + params.fixedCostsCents) * (1 + Number(params.reservePct) / 100)) / (Number(params.availableHoursPerMonth) * Number(params.productivityPct) / 100)))} · ideal:{" "}
          {formatBRL(Math.round(((params.incomeIdealCents + params.fixedCostsCents) * (1 + Number(params.reservePct) / 100)) / (Number(params.availableHoursPerMonth) * Number(params.productivityPct) / 100)))} (prévia; o cálculo oficial é feito no servidor)
        </p>
      </Section>
      <Section title="Identidade comercial (aparece no PDF somente se preenchida)">
        <div className="form-grid">
          {(["name", "tagline", "phone", "email", "instagram", "city", "document"] as const).map((k) => (
            <Field key={k} label={{ name: "Nome (grafia oficial)", tagline: "Frase", phone: "Telefone", email: "E-mail", instagram: "Instagram", city: "Cidade", document: "CPF/CNPJ (opcional)" }[k]}>
              <input value={(biz[k] as string | null) ?? ""} onChange={(e) => setBiz({ ...biz, [k]: e.target.value || null })} />
            </Field>
          ))}
          <Field label="Itens não inclusos (um por linha)"><textarea rows={3} value={biz.defaultExclusions.join("\n")} onChange={(e) => setBiz({ ...biz, defaultExclusions: e.target.value.split("\n").filter(Boolean) })} /></Field>
          <Field label="Observações padrão (uma por linha)"><textarea rows={3} value={biz.defaultNotes.join("\n")} onChange={(e) => setBiz({ ...biz, defaultNotes: e.target.value.split("\n").filter(Boolean) })} /></Field>
          <label className="check"><input type="checkbox" checked={biz.showAcceptance} onChange={(e) => setBiz({ ...biz, showAcceptance: e.target.checked })} /> Campo de aceite/assinatura</label>
          <label className="check"><input type="checkbox" checked={biz.showCommercialBreakdown} onChange={(e) => setBiz({ ...biz, showCommercialBreakdown: e.target.checked })} /> Mostrar valores por categoria (sem custos internos)</label>
        </div>
      </Section>
      <button disabled={busy} onClick={() => run(() => api("/settings", { method: "PATCH", body: { params, business: { ...biz, name: biz.name || "adripatina" } } }), "Nova versão de configuração salva.").then(() => (reload(), history.reload()))}>
        Salvar nova versão
      </button>
      <Section title="Histórico de versões">
        <Table rows={history.data?.rows ?? []} columns={[{ header: "Quando", cell: (r) => formatDate(r.created_at) }, { header: "Origem", cell: (r) => r.origin }, { header: "Ativa", cell: (r) => (r.is_active ? "sim" : "") }]} />
      </Section>
    </>
  );
}
