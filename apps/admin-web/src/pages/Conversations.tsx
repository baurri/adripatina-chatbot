import { useEffect, useRef, useState } from "react";
import { api, formatDate } from "../api";
import { Badge, Field, Loading, Section, useLoad } from "../ui";

interface MessageRow {
  id: string;
  direction: "in" | "out";
  kind: string;
  text: string | null;
  intent: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  user_id: string | null;
  display_name: string | null;
  role: string | null;
  job_code: string | null;
  job_title: string | null;
  display_text?: string | null;
  contextual_intent?: string | null;
  route?: string | null;
}
interface LearningRow {
  id: string;
  kind: string;
  entity_key: string;
  data_json: string;
  status: string;
  created_at: string;
  display_name: string | null;
  job_code: string | null;
  confidence?: number;
  origin?: string | null;
  source_text?: string | null;
  message_text?: string | null;
}

interface UserRow {
  id: string;
  role: "ADMIN" | "ARTESAO";
  displayName: string;
  active: boolean;
}

const brl = (cents: unknown) => (typeof cents === "number" ? `R$ ${(cents / 100).toFixed(2).replace(".", ",")}` : "—");

const ROUTE_LABEL: Record<string, string> = {
  universal: "comando",
  expected_confirmation: "confirmação esperada",
  pending_answer: "resposta à pergunta",
  active_goal: "continuação do objetivo",
  interruption: "interrupção (objetivo suspenso)",
  global: "nova intenção",
  fallback: "não entendido",
};

function learningText(row: LearningRow): string {
  try {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    if (row.kind === "MATERIAL_PRICE_QUOTE" || (row.kind === "MATERIAL_PURCHASE" && data.newPriceCents !== undefined)) {
      const conf = data.confidence === "media" ? " (valor aproximado)" : "";
      return `${row.entity_key}: ${brl(data.previousPriceCents)} → ${brl(data.newPriceCents)} por embalagem de ${String(data.newPackageSize)} ${String(data.unit ?? "")}${conf} — ${row.kind === "MATERIAL_PRICE_QUOTE" ? "informado durante um orçamento" : "aprendido de uma compra"}`;
    }
    if (row.kind === "QUOTE_REQUEST") {
      const items = (data.items as { description: string; quantity: number }[] | undefined) ?? [];
      return `Pedido de orçamento: ${items.map((i) => `${i.quantity}× ${i.description}`).join(", ")} — clientes: ${((data.clients as string[]) ?? []).join(", ") || "—"}`;
    }
    if (row.kind === "MATERIAL_PURCHASE") {
      const cents = Number(data.replacementPriceCents ?? 0);
      return `${row.entity_key}: ${Number(data.packages)} embalagem(ns) de ${String(data.packageSize)} — preço de reposição R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
    }
    if (row.kind === "MATERIAL_SOURCE") return `${row.entity_key}: ${String(data.source).replaceAll("_", " ")}`;
    return `${row.entity_key}: ${row.data_json}`;
  } catch {
    return `${row.entity_key}: ${row.data_json}`;
  }
}

function maskDateBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function dateBRToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function MessageDetail({ id }: { id: string }) {
  const d = useLoad(
    () =>
      api<{
        routing: Record<string, unknown> | null;
        changes: { action: string; entity_type: string; created_at: string }[];
        learned: { kind: string; entity_key: string }[];
        prices: { name: string; price_cents: number; previous_price_cents: number | null }[];
      }>(`/conversations/${id}`),
    [id],
  );
  if (!d.data) return <Loading error={d.error} loading={d.loading} />;
  const r = d.data.routing as {
    rawIntent?: string;
    rawConfidence?: number;
    contextualIntent?: string;
    route?: string;
    reason?: string;
    activeGoal?: string | null;
    pendingQuestion?: string | null;
    flow?: string;
    entities?: unknown;
  } | null;
  return (
    <div className="msg-detail">
      {r ? (
        <ul>
          <li>Intenção bruta: <code>{r.rawIntent}</code> ({Math.round((r.rawConfidence ?? 0) * 100)}%)</li>
          <li>Intenção no contexto: <code>{r.contextualIntent}</code></li>
          <li>Decisão: <strong>{ROUTE_LABEL[r.route ?? ""] ?? r.route}</strong> — {r.reason}</li>
          <li>Fluxo: {r.flow} · objetivo ativo: {r.activeGoal ?? "nenhum"} · pergunta pendente: {r.pendingQuestion ?? "nenhuma"}</li>
          <li>Entidades: <code>{JSON.stringify(r.entities)}</code></li>
        </ul>
      ) : (
        <p className="muted">Sem decisão de roteamento registrada (mensagem do bot, botão ou anterior à auditoria).</p>
      )}
      {d.data.changes.length > 0 && <p>Alterações: {d.data.changes.map((c) => `${c.action} (${c.entity_type})`).join(", ")}</p>}
      {d.data.prices.length > 0 && <p>Preços: {d.data.prices.map((p) => `${p.name}: ${brl(p.previous_price_cents)} → ${brl(p.price_cents)}`).join("; ")}</p>}
      {d.data.learned.length > 0 && <p>Aprendido: {d.data.learned.map((l) => `${l.kind} ${l.entity_key}`).join(", ")}</p>}
    </div>
  );
}

function TechniqueLearning() {
  const t = useLoad(() => api<{ rows: { technique: string; samples: number; avgHoursPerJob: string }[]; note: string }>("/learning/techniques"));
  if (!t.data || t.data.rows.length === 0) return null;
  return (
    <Section title="Tempo por técnica (sugestões, não aplicadas)">
      <p className="muted">{t.data.note}</p>
      <ul className="learning-list">
        {t.data.rows.map((r) => (
          <li key={r.technique}>
            <strong>{r.technique}</strong>: {r.samples} {r.samples === 1 ? "serviço" : "serviços"}, média de {r.avgHoursPerJob.replace(".", ",")} h por serviço
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Conversations() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const users = useLoad(() => api<{ rows: UserRow[] }>("/users"));
  const defaultApplied = useRef(false);
  const defaultArtisanId =
    users.data?.rows.find((u) => u.active && u.role === "ARTESAO" && /\badriano\b/i.test(u.displayName))?.id ??
    users.data?.rows.find((u) => u.active && u.role === "ARTESAO")?.id ??
    "";
  useEffect(() => {
    if (!defaultApplied.current && users.data) {
      setUserId(defaultArtisanId);
      defaultApplied.current = true;
    }
  }, [users.data, defaultArtisanId]);
  const fromIso = dateBRToIso(from);
  const toIso = dateBRToIso(to);
  const invalidDate = (from !== "" && !fromIso) || (to !== "" && !toIso) || (!!fromIso && !!toIso && fromIso > toIso);
  const query = () => {
    const params = new URLSearchParams({ limit: "300" });
    if (userId) params.set("userId", userId);
    if (fromIso) params.set("from", fromIso);
    if (toIso) params.set("to", toIso);
    return params.toString();
  };
  const messages = useLoad(() => api<{ rows: MessageRow[] }>(`/conversations?${query()}`), [userId, from, to]);
  const learning = useLoad(() => api<{ rows: LearningRow[] }>(`/learning-observations?${query()}`), [userId, from, to]);
  const rows = [...(messages.data?.rows ?? [])].reverse();
  const selectedUser = users.data?.rows.find((u) => u.id === userId);
  return (
    <>
      <h1>Conversas e aprendizado</h1>
      <p className="muted">Área restrita ao administrador. Aqui você acompanha o que o bot entendeu, perguntou e aprendeu.</p>
      <Section title="Filtros">
        <div className="form-row conversation-filters">
          <Field label="Usuário">
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos os usuários</option>
              {(users.data?.rows ?? []).map((u) => <option key={u.id} value={u.id}>{u.role === "ADMIN" ? "Administrador" : "Artesão"} - {u.displayName}{u.active ? "" : " (inativo)"}</option>)}
            </select>
          </Field>
          <Field label="Data inicial"><input inputMode="numeric" value={from} placeholder="DD/MM/AAAA" maxLength={10} onChange={(e) => setFrom(maskDateBR(e.target.value))} /></Field>
          <Field label="Data final"><input inputMode="numeric" value={to} placeholder="DD/MM/AAAA" maxLength={10} onChange={(e) => setTo(maskDateBR(e.target.value))} /></Field>
          <button className="secondary filter-clear" disabled={userId === defaultArtisanId && !from && !to} onClick={() => { setUserId(defaultArtisanId); setFrom(""); setTo(""); }}>Limpar filtros</button>
        </div>
        <Loading error={users.error} loading={users.loading} />
        {invalidDate && <p className="notice error" role="alert">Informe datas válidas no formato DD/MM/AAAA. A data inicial não pode ser posterior à final.</p>}
        <p className="muted">Os filtros são aplicados tanto às conversas quanto ao aprendizado do bot.{selectedUser ? ` Exibindo apenas ${selectedUser.displayName}.` : ""}</p>
      </Section>
      <Section title={`Histórico de conversa${selectedUser ? ` — ${selectedUser.displayName}` : ""}`}>
        <Loading error={messages.error} loading={messages.loading} />
        <ol className="chat conversation-log">
          {rows.map((m) => (
            <li className={m.direction} key={m.id}>
              <small className="muted">{formatDate(m.created_at)} · {m.direction === "in" ? m.display_name ?? "Usuário" : "Bot"} · {m.kind}{m.job_code ? ` · ${m.job_code}` : ""}</small>
              <p>{m.display_text ?? m.text ?? `[${m.kind} sem texto]`}</p>
              {m.intent && (
                <small>
                  <Badge>{m.contextual_intent ?? m.intent}{m.confidence !== null ? ` ${Math.round(m.confidence * 100)}%` : ""}</Badge>
                  {m.route ? <> <Badge>{ROUTE_LABEL[m.route] ?? m.route}</Badge></> : null}
                </small>
              )}
              {m.direction === "in" && (
                <button className="small secondary" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                  {openId === m.id ? "Ocultar detalhes" : "Por que o bot respondeu assim?"}
                </button>
              )}
              {openId === m.id && <MessageDetail id={m.id} />}
            </li>
          ))}
        </ol>
        {!messages.loading && rows.length === 0 && <p className="muted">Nenhuma conversa registrada.</p>}
      </Section>
      <Section title={`O que o bot aprendeu${selectedUser ? ` com ${selectedUser.displayName}` : ""}`}>
        <Loading error={learning.error} loading={learning.loading} />
        <ul className="learning-list">
          {(learning.data?.rows ?? []).map((row) => (
            <li key={row.id}>
              <strong>{learningText(row)}</strong>
              <br />
              <small className="muted">
                {formatDate(row.created_at)} · {row.display_name ?? "Sistema"}{row.job_code ? ` · ${row.job_code}` : ""} · {row.status === "APLICADO" ? "aplicado" : row.status.toLowerCase()}
                {typeof row.confidence === "number" && row.confidence < 1 ? ` · confiança ${Math.round(row.confidence * 100)}%` : ""}
              </small>
              {(row.source_text || row.message_text) && (
                <>
                  <br />
                  <small>Fala original: {row.source_text ?? row.message_text}</small>
                </>
              )}
            </li>
          ))}
        </ul>
        {!learning.loading && (learning.data?.rows ?? []).length === 0 && <p className="muted">O aprendizado começará conforme as conversas acontecerem.</p>}
      </Section>
      <TechniqueLearning />
    </>
  );
}

