import { api, formatBRL } from "../api";
import { Loading, Section, Stat, Table, useLoad } from "../ui";

interface Summary {
  quotesAwaitingReview: number;
  activeJobs: number;
  overdueJobs: number;
  receivablesCents: number;
  monthReceivedCents: number;
  monthSpentCents: number;
  monthPurchasesCents: number;
  monthExpensesCents: number;
  openDuplicates: number;
  materialsWithoutPrice: number;
  stalePrices: number;
  uncalibratedTechniques: number;
  lowStock: number;
  pendingApprovals: number;
}

export function Dashboard() {
  const { data, error, loading } = useLoad(() => api<{ summary: Summary; cashflow: { month: string; receivedCents: number; purchasesCents: number; expensesCents: number; netCents: number }[] }>("/dashboard/summary"));
  return (
    <>
      <h1>Painel</h1>
      <Loading error={error} loading={loading} />
      {data && (
        <>
          <div className="stats">
            <Stat label="Orçamentos para revisar" value={data.summary.quotesAwaitingReview} tone={data.summary.quotesAwaitingReview ? "warn" : undefined} />
            <Stat label="Serviços ativos" value={data.summary.activeJobs} />
            <Stat label="Atrasados" value={data.summary.overdueJobs} tone={data.summary.overdueJobs ? "danger" : undefined} />
            <Stat label="A receber" value={formatBRL(data.summary.receivablesCents)} />
            <Stat label="Recebido no mês" value={formatBRL(data.summary.monthReceivedCents)} />
            <Stat label="Saídas no mês" value={formatBRL(data.summary.monthSpentCents)} />
          </div>
          <Section title="Alertas">
            <ul className="alerts">
              {data.summary.materialsWithoutPrice > 0 && <li className="danger">{data.summary.materialsWithoutPrice} materiais sem preço de reposição — propostas definitivas ficam bloqueadas. <a href="#/catalogo">Cadastrar preços</a></li>}
              {data.summary.uncalibratedTechniques > 0 && <li className="warn">{data.summary.uncalibratedTechniques} técnicas com parâmetros NÃO CALIBRADOS. <a href="#/catalogo">Revisar</a></li>}
              {data.summary.stalePrices > 0 && <li className="warn">{data.summary.stalePrices} preços desatualizados.</li>}
              {data.summary.openDuplicates > 0 && <li className="warn">{data.summary.openDuplicates} suspeitas de duplicidade. <a href="#/duplicidades">Revisar</a></li>}
              {data.summary.lowStock > 0 && <li>{data.summary.lowStock} materiais com estoque baixo.</li>}
              {data.summary.pendingApprovals > 0 && <li>{data.summary.pendingApprovals} aprovações pendentes. <a href="#/orcamentos">Ver</a></li>}
            </ul>
          </Section>
          <Section title="Caixa — últimos meses">
            <p className="muted">Entradas e saídas efetivas. Material de estoque consumido não é saída de caixa.</p>
            <Table
              rows={data.cashflow}
              columns={[
                { header: "Mês", cell: (r) => r.month },
                { header: "Recebido", cell: (r) => formatBRL(r.receivedCents), className: "num" },
                { header: "Compras", cell: (r) => formatBRL(r.purchasesCents), className: "num" },
                { header: "Despesas", cell: (r) => formatBRL(r.expensesCents), className: "num" },
                { header: "Saldo", cell: (r) => formatBRL(r.netCents), className: "num" },
              ]}
            />
          </Section>
        </>
      )}
    </>
  );
}
