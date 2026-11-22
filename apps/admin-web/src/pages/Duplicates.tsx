import { useState } from "react";
import { api, formatDate } from "../api";
import { Badge, Field, Notice, Section, Table, useAction, useLoad } from "../ui";

interface Suspicion {
  id: string;
  job_a_id: string;
  job_b_id: string;
  a_title: string;
  b_title: string;
  a_code: string;
  b_code: string;
  score: number;
  reasons: string[];
  origin: string;
  created_at: string;
}

export function Duplicates() {
  const [status, setStatus] = useState("ABERTA");
  const list = useLoad(() => api<{ rows: Suspicion[] }>(`/duplicates?status=${status}`), [status]);
  const merges = useLoad(() => api<{ rows: { id: string; source_code: string; target_code: string; reason: string; merged_at: string; undone_at: string | null }[] }>("/merges"));
  const { run, message, busy } = useAction();
  const [reason, setReason] = useState<Record<string, string>>({});

  return (
    <>
      <h1>Duplicidades</h1>
      <p className="muted">
        Suspeitas vêm da conversa (o artesão disse "é outro serviço") e da varredura automática. Nada é mesclado sem decisão sua. Mesclar preserva pagamentos, documentos e mensagens, e pode ser desfeito.
      </p>
      <Notice message={message} />
      <div className="form-row">
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ABERTA">Abertas</option>
            <option value="DISTINTOS">Marcadas como distintas</option>
            <option value="MESCLADOS">Mescladas</option>
          </select>
        </Field>
        <button className="secondary" disabled={busy} onClick={() => run(() => api("/duplicates/scan", { method: "POST", body: {} }), "Varredura concluída.").then(() => list.reload())}>
          Procurar duplicidades agora
        </button>
      </div>
      <Section title="Suspeitas">
        <Table
          rows={list.data?.rows ?? []}
          empty="Nenhuma suspeita."
          columns={[
            { header: "Projeto A", cell: (s) => <a href={`#/servicos/${s.job_a_id}`}>{s.a_code} — {s.a_title}</a> },
            { header: "Projeto B", cell: (s) => <a href={`#/servicos/${s.job_b_id}`}>{s.b_code} — {s.b_title}</a> },
            { header: "Semelhança", cell: (s) => <Badge tone={s.score >= 0.7 ? "warn" : "neutral"}>{Math.round(s.score * 100)}%</Badge> },
            { header: "Motivos", cell: (s) => s.reasons.join(", ") },
            { header: "Origem", cell: (s) => `${s.origin} · ${formatDate(s.created_at)}` },
            {
              header: "Decisão",
              cell: (s) =>
                status === "ABERTA" ? (
                  <div className="stack">
                    <button className="small secondary" onClick={() => run(() => api(`/duplicates/${s.id}/distinct`, { method: "POST", body: {} }), "Marcados como distintos.").then(() => list.reload())}>São diferentes</button>
                    <input aria-label="Motivo da mesclagem" placeholder="Motivo da mesclagem" value={reason[s.id] ?? ""} onChange={(e) => setReason({ ...reason, [s.id]: e.target.value })} />
                    <button className="small" disabled={(reason[s.id] ?? "").length < 3} onClick={() => run(() => api("/duplicates/merge", { method: "POST", body: { sourceJobId: s.job_b_id, targetJobId: s.job_a_id, reason: reason[s.id] } }), `${s.b_code} mesclado em ${s.a_code}.`).then(() => (list.reload(), merges.reload()))}>
                      Mesclar {s.b_code} → {s.a_code}
                    </button>
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Section>
      <Section title="Mesclagens realizadas">
        <Table
          rows={merges.data?.rows ?? []}
          empty="Nenhuma mesclagem."
          columns={[
            { header: "De → Para", cell: (m) => `${m.source_code} → ${m.target_code}` },
            { header: "Motivo", cell: (m) => m.reason },
            { header: "Quando", cell: (m) => formatDate(m.merged_at) },
            {
              header: "",
              cell: (m) =>
                m.undone_at ? (
                  <span className="muted">desfeita em {formatDate(m.undone_at)}</span>
                ) : (
                  <button className="small secondary" onClick={() => run(() => api(`/merges/${m.id}/undo`, { method: "POST", body: {} }), "Mesclagem desfeita.").then(() => merges.reload())}>
                    Desfazer
                  </button>
                ),
            },
          ]}
        />
      </Section>
    </>
  );
}
