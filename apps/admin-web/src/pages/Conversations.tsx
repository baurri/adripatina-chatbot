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
}

interface UserRow {
  id: string;
  role: "ADMIN" | "ARTESAO";
  displayName: string;
  active: boolean;
}

function learningText(row: LearningRow): string {
  try {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
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

export function Conversations() {
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
              <p>{m.text || `[${m.kind} sem texto]`}</p>
              {m.intent && <small><Badge>{m.intent}{m.confidence !== null ? ` ${Math.round(m.confidence * 100)}%` : ""}</Badge></small>}
            </li>
          ))}
        </ol>
        {!messages.loading && rows.length === 0 && <p className="muted">Nenhuma conversa registrada.</p>}
      </Section>
      <Section title={`O que o bot aprendeu${selectedUser ? ` com ${selectedUser.displayName}` : ""}`}>
        <Loading error={learning.error} loading={learning.loading} />
        <ul className="learning-list">
          {(learning.data?.rows ?? []).map((row) => (
            <li key={row.id}><strong>{learningText(row)}</strong><br /><small className="muted">{formatDate(row.created_at)} · {row.display_name ?? "Sistema"}{row.job_code ? ` · ${row.job_code}` : ""} · {row.status}</small></li>
          ))}
        </ul>
        {!learning.loading && (learning.data?.rows ?? []).length === 0 && <p className="muted">O aprendizado começará conforme as conversas acontecerem.</p>}
      </Section>
    </>
  );
}

