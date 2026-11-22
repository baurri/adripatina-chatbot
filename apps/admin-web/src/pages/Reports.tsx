import { api, formatBRL } from "../api";
import { Section, Table, useLoad } from "../ui";

export function Reports() {
  const cash = useLoad(() => api<{ rows: { month: string; receivedCents: number; purchasesCents: number; expensesCents: number; netCents: number }[] }>("/reports/cashflow"));
  const prof = useLoad(() =>
    api<{ rows: { code: string; title: string; status: string; contracted_cents: number | null; received_cents: number; consumption_cents: number; expenses_cents: number; purchases_cents: number; estimated_hours: string | null; actual_hours: number | null }[] }>("/reports/profitability"),
  );
  return (
    <>
      <h1>Relatórios</h1>
      <Section title="Fluxo de caixa" actions={<a href="/api/v1/admin/reports/cashflow?format=csv">Exportar CSV</a>}>
        <p className="muted">Caixa considera entradas e saídas efetivas. Consumo de material do estoque não é saída de caixa.</p>
        <Table
          rows={cash.data?.rows ?? []}
          columns={[
            { header: "Mês", cell: (r) => r.month },
            { header: "Recebido", cell: (r) => formatBRL(r.receivedCents), className: "num" },
            { header: "Compras", cell: (r) => formatBRL(r.purchasesCents), className: "num" },
            { header: "Despesas", cell: (r) => formatBRL(r.expensesCents), className: "num" },
            { header: "Saldo", cell: (r) => formatBRL(r.netCents), className: "num" },
          ]}
        />
      </Section>
      <Section title="Rentabilidade: estimado × realizado" actions={<a href="/api/v1/admin/reports/profitability?format=csv">Exportar CSV</a>}>
        <p className="muted">
          Resultado econômico = contratado − materiais consumidos (reposição) − despesas. A diferença remunera a mão de obra do artesão e a reserva. Compras aparecem separadas (caixa) e não são somadas ao consumo.
        </p>
        <Table
          rows={prof.data?.rows ?? []}
          columns={[
            { header: "Serviço", cell: (r) => `${r.code} — ${r.title}` },
            { header: "Situação", cell: (r) => r.status },
            { header: "Contratado", cell: (r) => formatBRL(r.contracted_cents), className: "num" },
            { header: "Recebido", cell: (r) => formatBRL(r.received_cents), className: "num" },
            { header: "Consumo", cell: (r) => formatBRL(r.consumption_cents), className: "num" },
            { header: "Despesas", cell: (r) => formatBRL(r.expenses_cents), className: "num" },
            { header: "Compras (caixa)", cell: (r) => formatBRL(r.purchases_cents), className: "num" },
            { header: "Resultado", cell: (r) => (r.contracted_cents === null ? "—" : formatBRL(r.contracted_cents - r.consumption_cents - r.expenses_cents)), className: "num" },
            { header: "Horas est./reais", cell: (r) => `${r.estimated_hours ?? "—"} / ${r.actual_hours ?? "—"}`, className: "num" },
          ]}
        />
      </Section>
    </>
  );
}
