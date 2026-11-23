import { useState } from "react";
import { api, formatDate } from "../api";
import { Badge, Loading, Section, useLoad } from "../ui";

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

export function Conversations() {
  const [onlyAdriano, setOnlyAdriano] = useState(true);
  const messages = useLoad(() => api<{ rows: MessageRow[] }>("/conversations?limit=300"));
  const learning = useLoad(() => api<{ rows: LearningRow[] }>("/learning-observations?limit=100"));
  const rows = (messages.data?.rows ?? []).filter((m) => !onlyAdriano || m.role === "ARTESAO").reverse();
  return (
    <>
      <h1>Conversas e aprendizado</h1>
      <p className="muted">Área restrita ao administrador. Aqui você acompanha o que o bot entendeu, perguntou e aprendeu.</p>
      <Section
        title="Histórico de conversa"
        actions={
          <label className="check"><input type="checkbox" checked={onlyAdriano} onChange={(e) => setOnlyAdriano(e.target.checked)} /> Mostrar somente o artesão</label>
        }
      >
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
      <Section title="O que o bot aprendeu">
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

