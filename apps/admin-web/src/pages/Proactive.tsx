import { useState } from "react";
import { api, formatBRL } from "../api";
import { Badge, Field, Notice, Section, Stat, Table, useAction, useLoad } from "../ui";

interface RequestRow {
  id: string;
  user_id: string;
  display_name: string | null;
  need_kind: string;
  kind_label: string;
  entity_type: string;
  entity_label: string;
  reason: string;
  priority: number;
  priority_locked: number;
  priority_reasons: string[];
  status: string;
  status_label: string;
  origin: string;
  question_text: string | null;
  answer_text: string | null;
  expected_format: string | null;
  attempts: number;
  close_reason: string | null;
  result: Record<string, unknown> | null;
  created_at_br: string | null;
  last_sent_at_br: string | null;
  next_allowed_at_br: string | null;
  resolved_at_br: string | null;
}

interface Settings {
  enabled: boolean;
  pausedUntil: string | null;
  windowStart: string;
  windowEnd: string;
  allowedWeekdays: number[];
  maxPerDay: number;
  maxPerWeek: number;
  minIntervalHours: number;
  maxAttempts: number;
  snoozeDays: number;
  dontKnowCooldownDays: number;
  showButtons: boolean;
  useAiPhrasing: boolean;
  validity: { priceDays: number; stockDays: number; completedJobDays: number };
  kinds: Record<string, boolean>;
}

interface SettingsResponse {
  settings: Settings;
  mode: "off" | "dry_run" | "live";
  kindLabels: Record<string, string>;
  lastRuns: { run_key: string; status: string; started_at: string; result_json: string | null }[];
}

interface DryRun {
  mode: string;
  users: {
    name: string;
    gate: { ok: boolean; label?: string };
    ranked: { kind: string; label: string; score: number; reasons: string[] }[];
    selected: { label: string; score: number; message: string; expectedUpdate: string } | null;
  }[];
}

interface Detail {
  request: RequestRow;
  events: { id: string; label: string; actor: string; created_at_br: string; data: Record<string, unknown> }[];
  messages: { id: string; direction: string; display_text: string; created_at_br: string }[];
  learned: { kind: string; entity_key: string; data_json: string; status: string }[];
  prices: { name: string; price_cents: number; previous_price_cents: number | null; package_size: string; is_estimate: number }[];
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const STATUS_FILTERS: [string, string][] = [
  ["pending", "Somente pendentes"],
  ["", "Todas"],
  ["queued", "Na fila"],
  ["waiting_response,sent", "Aguardando resposta"],
  ["partially_answered,waiting_confirmation", "Respondidas em parte"],
  ["snoozed", "Adiadas"],
  ["resolved", "Concluídas"],
  ["cancelled,expired", "Canceladas/expiradas"],
  ["failed", "Falhas"],
];

function tone(status: string): "neutral" | "ok" | "warn" | "danger" {
  if (status === "resolved") return "ok";
  if (status === "failed") return "danger";
  if (["waiting_response", "sent", "partially_answered", "waiting_confirmation"].includes(status)) return "warn";
  return "neutral";
}

export function Proactive() {
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const qs = new URLSearchParams({ ...(status === "pending" ? { pending: "1" } : status ? { status } : {}), ...(kind ? { kind } : {}), ...(entity ? { entity } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const list = useLoad(() => api<{ rows: RequestRow[]; counts: Record<string, number>; kindLabels: Record<string, string> }>(`/proactive/requests?${qs}`), [qs]);
  const cfg = useLoad(() => api<SettingsResponse>("/proactive/settings"));
  const detail = useLoad(() => (selected ? api<Detail>(`/proactive/requests/${selected}`) : Promise.resolve(null)), [selected]);
  const { run, message, busy } = useAction();
  const s = cfg.data?.settings;
  const counts = list.data?.counts ?? {};

  const save = (patch: Partial<Settings>) => run(() => api("/proactive/settings", { method: "PUT", body: patch }), "Configuração salva.").then(() => cfg.reload());
  const act = (id: string, body: Record<string, unknown>, ok: string) => run(() => api(`/proactive/requests/${id}/action`, { method: "POST", body }), ok).then(() => {
    list.reload();
    detail.reload();
  });

  return (
    <>
      <h1>Coleta proativa</h1>
      <p className="muted">
        O bot percebe dados que faltam (preços, estoque, tempos reais) e pergunta ao Adriano uma coisa de cada vez, no horário permitido. Dados confiáveis são salvos direto; esta página é para acompanhar e intervir quando precisar.
      </p>
      <Notice message={message} />

      <div className="stats">
        <Stat label="Na fila" value={counts.queued ?? 0} />
        <Stat label="Aguardando resposta" value={(counts.waiting_response ?? 0) + (counts.sent ?? 0)} tone="warn" />
        <Stat label="Respondidas em parte" value={(counts.partially_answered ?? 0) + (counts.waiting_confirmation ?? 0)} />
        <Stat label="Adiadas" value={counts.snoozed ?? 0} />
        <Stat label="Concluídas" value={counts.resolved ?? 0} />
        <Stat label="Falhas" value={counts.failed ?? 0} tone={(counts.failed ?? 0) > 0 ? "danger" : undefined} />
      </div>

      <Section
        title="Comunicação proativa"
        actions={
          <button className="secondary" disabled={busy} onClick={() => run(async () => setDry(await api<DryRun>("/proactive/dry-run", { method: "POST", body: {} })), "Simulação pronta (nada foi enviado).")}>
            Simular agora
          </button>
        }
      >
        {s && (
          <div className="stack">
            <p>
              Situação: {s.enabled ? <Badge tone="ok">ligada</Badge> : <Badge>desligada</Badge>}{" "}
              {s.pausedUntil && new Date(s.pausedUntil) > new Date() ? <Badge tone="warn">pausada até {new Date(s.pausedUntil).toLocaleDateString("pt-BR")}</Badge> : null}{" "}
              <span className="muted">Modo do ambiente: {cfg.data?.mode === "live" ? "envio real" : cfg.data?.mode === "dry_run" ? "somente simulação" : "desligado"}</span>
            </p>
            <div className="form-row">
              <button disabled={busy} onClick={() => save({ enabled: !s.enabled })}>{s.enabled ? "Desligar coleta" : "Ligar coleta"}</button>
              <button className="secondary" disabled={busy} onClick={() => save({ pausedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() })}>Pausar 7 dias</button>
              {s.pausedUntil && <button className="secondary" disabled={busy} onClick={() => save({ pausedUntil: null })}>Retomar</button>}
            </div>
            <div className="form-row">
              <Field label="Início"><input type="time" defaultValue={s.windowStart} onBlur={(e) => e.target.value !== s.windowStart && save({ windowStart: e.target.value })} /></Field>
              <Field label="Fim"><input type="time" defaultValue={s.windowEnd} onBlur={(e) => e.target.value !== s.windowEnd && save({ windowEnd: e.target.value })} /></Field>
              <Field label="Por dia"><input type="number" min={0} max={10} defaultValue={s.maxPerDay} onBlur={(e) => save({ maxPerDay: Number(e.target.value) })} /></Field>
              <Field label="Por semana"><input type="number" min={0} max={30} defaultValue={s.maxPerWeek} onBlur={(e) => save({ maxPerWeek: Number(e.target.value) })} /></Field>
              <Field label="Intervalo mínimo (h)"><input type="number" min={0} max={168} defaultValue={s.minIntervalHours} onBlur={(e) => save({ minIntervalHours: Number(e.target.value) })} /></Field>
            </div>
            <div className="form-row">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className="check">
                  <input type="checkbox" checked={s.allowedWeekdays.includes(i)} onChange={(e) => save({ allowedWeekdays: e.target.checked ? [...s.allowedWeekdays, i].sort() : s.allowedWeekdays.filter((x) => x !== i) })} /> {d}
                </label>
              ))}
            </div>
            <div className="form-row">
              {Object.entries(s.kinds).map(([k, on]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={on} onChange={(e) => save({ kinds: { ...s.kinds, [k]: e.target.checked } })} /> {cfg.data?.kindLabels[k] ?? k}
                </label>
              ))}
            </div>
            <div className="form-row">
              <Field label="Validade do preço (dias)"><input type="number" defaultValue={s.validity.priceDays} onBlur={(e) => save({ validity: { ...s.validity, priceDays: Number(e.target.value) } })} /></Field>
              <Field label="Validade do estoque (dias)"><input type="number" defaultValue={s.validity.stockDays} onBlur={(e) => save({ validity: { ...s.validity, stockDays: Number(e.target.value) } })} /></Field>
              <label className="check"><input type="checkbox" checked={s.showButtons} onChange={(e) => save({ showButtons: e.target.checked })} /> Mostrar botões rápidos ("Não sei", "Pergunte depois")</label>
              <label className="check"><input type="checkbox" checked={s.useAiPhrasing} onChange={(e) => save({ useAiPhrasing: e.target.checked })} /> IA pode variar a frase de contexto</label>
            </div>
          </div>
        )}
      </Section>

      {dry && (
        <Section title="Simulação (nada foi enviado nem gravado)">
          {dry.users.map((u) => (
            <div key={u.name} className="stack">
              <p>
                <strong>{u.name}</strong> — {u.gate.ok ? "poderia receber agora" : `não enviaria agora: ${u.gate.label}`}
              </p>
              {u.selected ? (
                <>
                  <pre className="bubble">{u.selected.message}</pre>
                  <p className="muted">Atualização esperada: {u.selected.expectedUpdate}</p>
                </>
              ) : (
                <p className="muted">Nenhuma necessidade relevante.</p>
              )}
              <Table rows={u.ranked} columns={[{ header: "Dado", cell: (r) => r.label }, { header: "Pontos", cell: (r) => r.score }, { header: "Motivos", cell: (r) => r.reasons.join(" · ") }]} />
            </div>
          ))}
        </Section>
      )}

      <Section title="Solicitações">
        <div className="form-row">
          <Field label="Situação">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de dado">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(list.data?.kindLabels ?? {}).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Item"><input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="ex.: verniz" /></Field>
          <Field label="De"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Até"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Table
          rows={list.data?.rows ?? []}
          empty="Nenhuma solicitação."
          columns={[
            { header: "Dado", cell: (r) => <a href="#/coleta" onClick={(e) => { e.preventDefault(); setSelected(r.id); }}>{r.kind_label}: {r.entity_label}</a> },
            { header: "Situação", cell: (r) => <Badge tone={tone(r.status)}>{r.status_label}</Badge> },
            { header: "Prioridade", cell: (r) => <span title={r.priority_reasons.join("\n")}>{r.priority}{r.priority_locked ? " (fixa)" : ""}</span> },
            { header: "Usuário", cell: (r) => r.display_name ?? "—" },
            { header: "Tentativas", cell: (r) => r.attempts },
            { header: "Criada", cell: (r) => r.created_at_br ?? "—" },
            { header: "Último envio", cell: (r) => r.last_sent_at_br ?? "—" },
            { header: "Próximo contato", cell: (r) => r.next_allowed_at_br ?? "—" },
          ]}
        />
      </Section>

      {detail.data && (
        <Section title={`${detail.data.request.kind_label}: ${detail.data.request.entity_label}`} actions={<button className="small secondary" onClick={() => setSelected(null)}>Fechar</button>}>
          <div className="stack">
            <p>
              <Badge tone={tone(detail.data.request.status)}>{detail.data.request.status_label}</Badge> · origem: {detail.data.request.origin === "quote_blocker" ? "orçamento travado" : detail.data.request.origin === "proactive_job" ? "análise automática" : detail.data.request.origin}
              {detail.data.request.close_reason ? ` · ${detail.data.request.close_reason}` : ""}
            </p>
            <p><strong>Por que perguntar:</strong> {detail.data.request.priority_reasons.join(" · ")}</p>
            <p><strong>Dado esperado:</strong> {detail.data.request.expected_format ?? "—"}</p>
            {detail.data.request.question_text && <pre className="bubble">{detail.data.request.question_text}</pre>}
            {detail.data.request.answer_text && <p><strong>Resposta:</strong> {detail.data.request.answer_text}</p>}
            {detail.data.request.result && <p><strong>Atualização aplicada:</strong> {JSON.stringify(detail.data.request.result)}</p>}
            <div className="form-row">
              <button className="small secondary" disabled={busy} onClick={() => act(detail.data!.request.id, { action: "snooze", days: 7 }, "Adiada por 7 dias.")}>Adiar 7 dias</button>
              <button className="small secondary" disabled={busy} onClick={() => act(detail.data!.request.id, { action: "cancel" }, "Cancelada.")}>Cancelar</button>
              <button className="small secondary" disabled={busy} onClick={() => act(detail.data!.request.id, { action: "reopen" }, "Reaberta.")}>Reabrir</button>
              <button className="small secondary" disabled={busy} onClick={() => act(detail.data!.request.id, { action: "priority", priority: detail.data!.request.priority + 20 }, "Prioridade aumentada.")}>Aumentar prioridade</button>
              <button className="small secondary" disabled={busy} onClick={() => act(detail.data!.request.id, { action: "mute" }, "Não vou mais perguntar sobre esse item.")}>Não perguntar mais sobre o item</button>
            </div>
            <Table rows={detail.data.events} columns={[{ header: "Quando", cell: (e) => e.created_at_br }, { header: "O que aconteceu", cell: (e) => e.label }, { header: "Quem", cell: (e) => (e.actor === "proactive_job" ? "análise automática" : e.actor === "bot" ? "bot" : e.actor) }]} />
            <Table rows={detail.data.messages} empty="Sem mensagens." columns={[{ header: "Quando", cell: (m) => m.created_at_br }, { header: "De", cell: (m) => (m.direction === "in" ? "Adriano" : "Bot") }, { header: "Mensagem", cell: (m) => <span className="pre">{m.display_text}</span> }]} />
            {detail.data.prices.length > 0 && (
              <Table rows={detail.data.prices} columns={[{ header: "Material", cell: (p) => p.name }, { header: "Antes", cell: (p) => formatBRL(p.previous_price_cents) }, { header: "Agora", cell: (p) => `${formatBRL(p.price_cents)}${p.is_estimate ? " (aproximado)" : ""}` }, { header: "Embalagem", cell: (p) => p.package_size }]} />
            )}
            {detail.data.learned.length > 0 && (
              <Table rows={detail.data.learned} columns={[{ header: "Aprendizado", cell: (l) => l.kind }, { header: "Item", cell: (l) => l.entity_key }, { header: "Dados", cell: (l) => l.data_json }, { header: "Situação", cell: (l) => l.status }]} />
            )}
          </div>
        </Section>
      )}
    </>
  );
}
