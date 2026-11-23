import { useState } from "react";
import { api, formatBRL, formatDate, parseBRLToCents } from "../api";
import { Badge, Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

interface Material {
  id: string;
  key: string;
  name: string;
  unit: string;
  packageSize: string;
  replacementPriceCents: number | null;
  priceUpdatedAt: string | null;
  yieldM2PerUnitPerCoat: string | null;
  lossPct: string;
  calibrated: boolean;
  origin: string;
}

const ORIGIN_LABEL: Record<string, string> = {
  telegram_quote_confirmed: "Preço informado pelo artesão no Telegram, durante um orçamento",
  telegram_confirmed: "Preço aprendido de uma compra informada no Telegram",
  admin: "Cadastrado pelo administrador",
  demo_only: "Valor de demonstração (sem preço real)",
};

function MaterialRow({ m, onSaved }: { m: Material; onSaved: () => void }) {
  const [price, setPrice] = useState(m.replacementPriceCents !== null ? (m.replacementPriceCents / 100).toFixed(2).replace(".", ",") : "");
  const [yieldV, setYield] = useState(m.yieldM2PerUnitPerCoat ?? "");
  const [loss, setLoss] = useState(m.lossPct);
  const [pkg, setPkg] = useState(m.packageSize);
  const [calibrated, setCalibrated] = useState(m.calibrated);
  const { run, message, busy } = useAction();
  const cents = price ? parseBRLToCents(price) : null;
  return (
    <tr>
      <td>
        {m.name} <small className="muted">({m.key})</small> {m.origin === "demo_only" && <Badge tone="warn">demo</Badge>}
        <br />
        <small className="muted">{ORIGIN_LABEL[m.origin] ?? m.origin}</small>
        <Notice message={message} />
      </td>
      <td><input aria-label={`Embalagem de ${m.name}`} size={5} value={pkg} onChange={(e) => setPkg(e.target.value.replace(",", "."))} /> {m.unit}</td>
      <td><input aria-label={`Preço de ${m.name}`} size={8} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="sem preço" /></td>
      <td>{formatDate(m.priceUpdatedAt)}</td>
      <td><input aria-label={`Rendimento de ${m.name}`} size={6} value={yieldV} onChange={(e) => setYield(e.target.value.replace(",", "."))} placeholder="—" /></td>
      <td><input aria-label={`Perda de ${m.name}`} size={4} value={loss} onChange={(e) => setLoss(e.target.value.replace(",", "."))} /></td>
      <td><input type="checkbox" aria-label={`${m.name} calibrado`} checked={calibrated} onChange={(e) => setCalibrated(e.target.checked)} /></td>
      <td>
        <button
          className="small"
          disabled={busy || (price !== "" && cents === null)}
          onClick={() =>
            run(
              () =>
                api(`/materials/${m.id}`, {
                  method: "PATCH",
                  body: { replacementPriceCents: cents, yieldM2PerUnitPerCoat: yieldV || null, lossPct: loss, packageSize: pkg, calibrated },
                }),
              "Salvo",
            ).then((ok) => ok && onSaved())
          }
        >
          Salvar
        </button>
      </td>
    </tr>
  );
}

export function Catalog() {
  const mats = useLoad(() => api<{ rows: Material[] }>("/materials"));
  const inv = useLoad(() => api<{ rows: { materialId: string; name: string; unit: string; quantity: string; avgHistoricalUnitCostCents: string | null; low: boolean }[] }>("/inventory"));
  const techs = useLoad(() => api<{ rows: { id: string; key: string; name: string; calibrated: boolean; version: number; origin: string; steps: unknown[] }[] }>("/techniques"));
  const methods = useLoad(() => api<{ rows: { id: string; name: string; speedM2PerHour: string; lossPct: string; setupHours: string; cleanupHours: string; calibrated: boolean }[] }>("/methods"));
  const { run, message, busy } = useAction();
  const [mov, setMov] = useState({ materialId: "", kind: "ENTRADA", quantity: "", cost: "" });
  const [recipe, setRecipe] = useState<{ id: string; text: string } | null>(null);

  return (
    <>
      <h1>Materiais, estoque e técnicas</h1>
      <p className="notice warn">
        Valores marcados como <strong>demo</strong> ou <strong>não calibrados</strong> são hipóteses. Propostas definitivas ficam bloqueadas até você cadastrar preços reais e revisar os parâmetros.
        Material em estoque nunca é gratuito: o orçamento usa sempre o <strong>preço atual de reposição</strong>.
      </p>
      <Notice message={message} />
      <Section title="Materiais (preço de reposição da embalagem)">
        <Loading error={mats.error} loading={mats.loading} />
        {mats.data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Material</th><th>Embalagem</th><th>Preço (R$)</th><th>Atualizado</th><th>Rend. m²/un/demão</th><th>Perda %</th><th>Calibrado</th><th></th></tr>
              </thead>
              <tbody>{mats.data.rows.map((m) => <MaterialRow key={m.id} m={m} onSaved={mats.reload} />)}</tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Estoque estimado">
        <Table
          rows={inv.data?.rows ?? []}
          columns={[
            { header: "Material", cell: (r) => <>{r.name} {r.low && <Badge tone="warn">baixo</Badge>}</> },
            { header: "Quantidade", cell: (r) => `${r.quantity} ${r.unit}`, className: "num" },
            { header: "Custo histórico médio (controle)", cell: (r) => (r.avgHistoricalUnitCostCents ? `${formatBRL(Math.round(Number(r.avgHistoricalUnitCostCents)))}/${r.unit}` : "—"), className: "num" },
          ]}
        />
        <div className="form-row">
          <Field label="Material">
            <select value={mov.materialId} onChange={(e) => setMov({ ...mov, materialId: e.target.value })}>
              <option value="">Escolha…</option>
              {(mats.data?.rows ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select value={mov.kind} onChange={(e) => setMov({ ...mov, kind: e.target.value })}>
              <option value="ENTRADA">Entrada (já tinha / sobra)</option>
              <option value="AJUSTE">Ajuste (+/−)</option>
            </select>
          </Field>
          <Field label="Quantidade"><input value={mov.quantity} onChange={(e) => setMov({ ...mov, quantity: e.target.value.replace(",", ".") })} /></Field>
          <Field label="Custo histórico unitário (R$, opcional)"><input value={mov.cost} onChange={(e) => setMov({ ...mov, cost: e.target.value })} /></Field>
          <button
            disabled={busy || !mov.materialId || !/^-?\d+(\.\d+)?$/.test(mov.quantity)}
            onClick={() =>
              run(() => api("/inventory/movements", { method: "POST", body: { materialId: mov.materialId, kind: mov.kind, quantity: mov.quantity, historicalUnitCostCents: mov.cost ? String(parseBRLToCents(mov.cost) ?? "") || null : null } }), "Estoque atualizado.").then(() => (setMov({ materialId: "", kind: "ENTRADA", quantity: "", cost: "" }), inv.reload()))
            }
          >
            Registrar
          </button>
        </div>
      </Section>

      <Section title="Métodos de aplicação">
        <Table
          rows={methods.data?.rows ?? []}
          columns={[
            { header: "Método", cell: (m) => m.name },
            { header: "Velocidade m²/h", cell: (m) => m.speedM2PerHour, className: "num" },
            { header: "Perda %", cell: (m) => m.lossPct, className: "num" },
            { header: "Preparo h", cell: (m) => m.setupHours, className: "num" },
            { header: "Limpeza h", cell: (m) => m.cleanupHours, className: "num" },
            {
              header: "Calibrado",
              cell: (m) => (
                <button className="small secondary" onClick={() => run(() => api(`/methods/${m.id}`, { method: "PATCH", body: { calibrated: !m.calibrated } })).then(() => methods.reload())}>
                  {m.calibrated ? "Sim — desmarcar" : "Não — marcar revisado"}
                </button>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Técnicas (receitas)">
        <Table
          rows={techs.data?.rows ?? []}
          columns={[
            { header: "Técnica", cell: (t) => <>{t.name} {t.origin === "demo_only" && <Badge tone="warn">demo</Badge>}</> },
            { header: "Versão", cell: (t) => t.version, className: "num" },
            { header: "Etapas", cell: (t) => t.steps.length, className: "num" },
            { header: "Calibrada", cell: (t) => (t.calibrated ? <Badge tone="ok">sim</Badge> : <Badge tone="danger">não</Badge>) },
            {
              header: "",
              cell: (t) => (
                <>
                  <button className="small secondary" onClick={() => setRecipe({ id: t.id, text: JSON.stringify(t.steps, null, 2) })}>Editar receita</button>{" "}
                  <button className="small secondary" onClick={() => run(() => api(`/techniques/${t.id}`, { method: "PATCH", body: { calibrated: !t.calibrated } })).then(() => techs.reload())}>{t.calibrated ? "Desmarcar" : "Marcar revisada"}</button>
                </>
              ),
            },
          ]}
        />
        {recipe && (
          <div>
            <Field label="Receita (JSON validado no servidor)">
              <textarea rows={16} value={recipe.text} onChange={(e) => setRecipe({ ...recipe, text: e.target.value })} className="mono" />
            </Field>
            <button
              onClick={() => {
                let steps: unknown;
                try {
                  steps = JSON.parse(recipe.text);
                } catch {
                  return run(async () => {
                    throw new Error("JSON inválido");
                  });
                }
                return run(() => api(`/techniques/${recipe.id}`, { method: "PATCH", body: { steps } }), "Receita salva (nova versão).").then((ok) => ok && (setRecipe(null), techs.reload()));
              }}
            >
              Salvar receita
            </button>{" "}
            <button className="secondary" onClick={() => setRecipe(null)}>Cancelar</button>
          </div>
        )}
      </Section>
    </>
  );
}
