import { useState } from "react";
import { api, formatDate } from "../api";
import { Badge, Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

type Range = { min: number; max: number };
type DimValue = number | Range;
interface Preset {
  key: string;
  label: string;
  dimensionKind: string;
  shape?: string;
  widthCm?: DimValue;
  lengthCm?: DimValue;
  depthCm?: DimValue;
  heightCm?: DimValue;
  diameterCm?: DimValue;
  isMarketReference: boolean;
  isStandardized: boolean;
  requiresConfirmation: boolean;
  autoSuggest: boolean;
  sourceKey: string;
  note?: string;
}
interface FurnitureType {
  key: string;
  name: string;
  category: string;
  aliases: string[];
  legacyKey: string | null;
  dimensionPolicy: string;
  measurementSchema: string;
  parts: string[];
  typicalRanges: Record<string, Range>;
  presets: Preset[];
  requiredQuoteFields: string[];
  optionalQuoteFields: string[];
  hasInterior: boolean;
  outdoor: boolean;
  upholstered: string;
  description: string;
  sourceKey: string;
  sourceKind: string | null;
  active: boolean;
}
interface Source {
  key: string;
  kind: string;
  title: string;
  url: string | null;
  note: string;
}

const CATEGORY: Record<string, string> = {
  quarto: "Quarto",
  jantar: "Jantar e copa",
  estar: "Estar e TV",
  escritorio: "Escritório",
  cozinha: "Cozinha e serviço",
  banheiro: "Banheiro",
  externo: "Área externa",
  infantil: "Infantil",
  antigo: "Antigos e decorativos",
  outro: "Outros",
};
const POLICY: Record<string, string> = {
  market_reference: "referência de mercado (confirmar)",
  usual_range: "faixa usual",
  variable: "variável: medir",
  custom: "sob medida: medir sempre",
};
const SCHEMA: Record<string, string> = {
  width_length: "largura × comprimento",
  length_width_height: "comprimento × largura × altura",
  diameter_height: "diâmetro × altura",
  side_height: "lado × altura",
  width_depth_height: "largura × profundidade × altura",
  width_height: "largura × altura",
  length_depth_thickness: "comprimento × profundidade × espessura",
  open_closed: "fechada e aberta",
  two_sides_depth: "dois lados × profundidade",
  per_module: "por módulo/peça",
  unknown: "a definir",
};
const SOURCE_KIND: Record<string, string> = {
  regulatory: "regulatória",
  standard: "norma técnica",
  academic_reference: "referência acadêmica",
  manufacturer_reference: "fabricante",
  retailer_reference: "varejista",
  market_reference: "mercado",
  internal_observation: "observação interna",
};
const FIELD: Record<string, string> = {
  dimensions: "medidas",
  work_scope: "escopo (inteiro / tampo / cabeceira)",
  shape: "formato",
  quantity: "quantidade",
  drawers_count: "nº de gavetas",
  doors_count: "nº de portas",
  door_type: "porta de abrir ou correr",
  interior_scope: "por dentro / por fora",
  modules: "módulos",
  extension: "medida aberta (extensão)",
  mattress_size: "tamanho do colchão",
  headboard_footboard: "cabeceira / peseira",
  upholstery_scope: "madeira / estofado",
  upholstery_condition: "estado do estofado",
  seats_count: "lugares",
  armrests: "braços",
  cane: "palhinha",
  exposure: "exposição ao tempo",
  moisture_pests: "umidade / cupim",
  top_material: "material do tampo",
  mirror_glass: "espelho / vidro",
  disassembled: "desmontado",
  hardware: "ferragens",
  wall_mounted: "fixado na parede",
  base_type: "tipo de base",
};

const dim = (v: DimValue | undefined) => (v === undefined ? null : typeof v === "number" ? `${v}` : `${v.min}–${v.max}`);
function presetText(p: Preset): string {
  const parts = [dim(p.widthCm), dim(p.lengthCm), dim(p.depthCm), dim(p.heightCm)].filter(Boolean);
  const size = p.diameterCm !== undefined ? `Ø ${dim(p.diameterCm)}` : parts.join(" × ");
  const what = p.dimensionKind === "mattress" ? "colchão" : p.dimensionKind === "top" ? "tampo" : "peça";
  return `${p.label}: ${what} ${size} cm`;
}

export function FurnitureCatalog() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("1");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(
    () => api<{ rows: FurnitureType[]; total: number; source: string; sources: Source[] }>(`/furniture-types?q=${encodeURIComponent(q)}&category=${category}&active=${active}`),
    [q, category, active],
  );
  const decisions = useLoad(() => api<{ rows: { created_at: string; purpose: string; success: number; fallback_used: number | null; confidence: number | null; latency_ms: number; decision: unknown }[]; note?: string }>("/ai-decisions?limit=30"));
  const { run, message, busy } = useAction();
  const rows = list.data?.rows ?? [];
  const current = rows.find((r) => r.key === selected) ?? null;

  return (
    <>
      <h1>Catálogo de móveis</h1>
      <p className="muted">
        Tipos que o bot reconhece, com apelidos, partes, perguntas específicas e medidas de referência. Medidas de referência são <strong>hipóteses</strong>: o bot pede a medida real e mostra a hipótese no orçamento.
      </p>
      <Notice message={message} />
      <Section
        title={`Tipos (${rows.length} de ${list.data?.total ?? "…"})`}
        actions={
          <button type="button" className="secondary" disabled={busy} onClick={() => run(() => api("/furniture-types/sync", { method: "POST" }).then(list.reload), "Catálogo sincronizado (nada foi sobrescrito).")}>
            Sincronizar catálogo
          </button>
        }
      >
        <div className="row">
          <Field label="Buscar">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex.: mesinha, guarda-roupa, queen" />
          </Field>
          <Field label="Categoria">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Situação">
            <select value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="1">Ativos</option>
              <option value="0">Inativos</option>
              <option value="">Todos</option>
            </select>
          </Field>
        </div>
        <Loading error={list.error} loading={list.loading} />
        <Table
          rows={rows}
          empty="Nenhum tipo encontrado."
          columns={[
            {
              header: "Tipo",
              cell: (t) => (
                <button type="button" className="link" onClick={() => setSelected(t.key === selected ? null : t.key)}>
                  {t.name}
                </button>
              ),
            },
            { header: "Categoria", cell: (t) => CATEGORY[t.category] ?? t.category },
            { header: "Medidas", cell: (t) => POLICY[t.dimensionPolicy] ?? t.dimensionPolicy },
            { header: "Apelidos", cell: (t) => t.aliases.slice(0, 4).join(", ") + (t.aliases.length > 4 ? "…" : "") },
            { header: "Situação", cell: (t) => (t.active ? <Badge tone="ok">ativo</Badge> : <Badge tone="warn">inativo</Badge>) },
          ]}
        />
      </Section>

      {current && <TypeEditor key={current.key} t={current} sources={list.data?.sources ?? []} onSaved={list.reload} />}

      <Section title="Decisões recentes da IA">
        <p className="muted">O que a IA interpretou ou escreveu e se o sistema aceitou. Prompts e dados pessoais não ficam guardados aqui.</p>
        <Loading error={decisions.error} loading={decisions.loading} />
        {decisions.data?.note && <p className="muted">{decisions.data.note}</p>}
        <Table
          rows={decisions.data?.rows ?? []}
          empty="Nenhuma chamada registrada."
          columns={[
            { header: "Quando", cell: (d) => formatDate(d.created_at) },
            { header: "Objetivo", cell: (d) => d.purpose },
            { header: "Resultado", cell: (d) => (d.success ? <Badge tone="ok">aceito</Badge> : <Badge tone="warn">recusado / reserva</Badge>) },
            { header: "Confiança", cell: (d) => (d.confidence === null ? "—" : `${Math.round(d.confidence * 100)}%`) },
            { header: "Decisão", cell: (d) => <code className="small">{JSON.stringify(d.decision ?? {}).slice(0, 140)}</code> },
          ]}
        />
      </Section>
    </>
  );
}

function TypeEditor({ t, sources, onSaved }: { t: FurnitureType; sources: Source[]; onSaved: () => void }) {
  const { run, message, busy } = useAction();
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description);
  const [alias, setAlias] = useState("");
  const source = sources.find((s) => s.key === t.sourceKey);
  return (
    <Section title={`Editar: ${t.name}`}>
      <Notice message={message} />
      <div className="row">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Chave (estável)">
          <input value={t.key} readOnly />
        </Field>
      </div>
      <Field label="Descrição / observação">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => run(() => api(`/furniture-types/${t.key}`, { method: "PATCH", body: { displayName: name, description } }).then(onSaved), "Salvo.")}>
          Salvar
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => run(() => api(`/furniture-types/${t.key}`, { method: "PATCH", body: { active: !t.active } }).then(onSaved), t.active ? "Tipo inativado (não aparece mais como sugestão)." : "Tipo reativado.")}>
          {t.active ? "Inativar" : "Reativar"}
        </button>
      </div>

      <h3>Medidas</h3>
      <p>
        Ordem: <strong>{SCHEMA[t.measurementSchema] ?? t.measurementSchema}</strong> · Política: {POLICY[t.dimensionPolicy] ?? t.dimensionPolicy}
      </p>
      {Object.keys(t.typicalRanges).length > 0 && (
        <p>
          Faixas usuais:{" "}
          {Object.entries(t.typicalRanges)
            .map(([k, r]) => `${k.replace("Cm", "")} ${r.min}–${r.max} cm`)
            .join(" · ")}
        </p>
      )}
      {t.presets.length > 0 && (
        <ul>
          {t.presets.map((p) => (
            <li key={p.key}>
              {presetText(p)} {p.requiresConfirmation ? <Badge tone="warn">confirmar</Badge> : <Badge>sugerível</Badge>} {p.isStandardized ? <Badge tone="ok">norma</Badge> : <Badge>referência de mercado</Badge>}
              {p.note ? <span className="muted"> — {p.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Origem: {source ? `${source.title} (${SOURCE_KIND[source.kind] ?? source.kind})` : t.sourceKey}
        {source?.url ? (
          <>
            {" "}
            ·{" "}
            <a href={source.url} target="_blank" rel="noreferrer">
              abrir fonte
            </a>
          </>
        ) : null}
      </p>

      <h3>Perguntas que o bot faz para este tipo</h3>
      <p>{t.requiredQuoteFields.map((f) => FIELD[f] ?? f).join(" · ") || "—"}</p>
      {t.optionalQuoteFields.length > 0 && <p className="muted">Opcionais: {t.optionalQuoteFields.map((f) => FIELD[f] ?? f).join(" · ")}</p>}

      <h3>Partes</h3>
      <p>{t.parts.join(", ") || "—"}</p>

      <h3>Apelidos</h3>
      <p>
        {t.aliases.map((a) => (
          <span key={a} className="chip">
            {a}{" "}
            <button type="button" className="link" aria-label={`Remover ${a}`} disabled={busy} onClick={() => run(() => api(`/furniture-types/${t.key}/aliases/deactivate`, { method: "POST", body: { alias: a } }).then(onSaved), "Apelido removido.")}>
              ×
            </button>
          </span>
        ))}
      </p>
      <div className="row">
        <Field label="Novo apelido">
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ex.: criado" />
        </Field>
        <button
          type="button"
          disabled={busy || alias.trim().length < 2}
          onClick={() =>
            run(
              () =>
                api(`/furniture-types/${t.key}/aliases`, { method: "POST", body: { alias } }).then(() => {
                  setAlias("");
                  onSaved();
                }),
              "Apelido adicionado.",
            )
          }
        >
          Adicionar
        </button>
      </div>
    </Section>
  );
}
