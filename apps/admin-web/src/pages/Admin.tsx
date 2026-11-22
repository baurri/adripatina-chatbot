import { useState } from "react";
import { api, formatDate } from "../api";
import { Badge, Field, Notice, Section, Table, useAction, useLoad } from "../ui";

export function Admin() {
  const users = useLoad(() => api<{ rows: { id: string; role: string; displayName: string; telegramUserId: string | null; adminEmail: string | null; active: boolean; telegramChatId: string | null }[] }>("/users"));
  const auditLog = useLoad(() => api<{ rows: { id: string; actor: string; action: string; entity_type: string; entity_id: string | null; created_at: string; after_json: string | null }[] }>("/audit-events?limit=100"));
  const ai = useLoad(() => api<{ rows: { day: string; task: string; model: string; requests: number; ok: number; neurons: number; cost_usd_micros: number }[]; dailyLimit: number; aiEnabled: boolean; note: string }>("/ai-usage"));
  const approvals = useLoad(() => api<{ rows: { id: string; kind: string; status: string; justification: string | null; decided_by: string | null; created_at: string }[] }>("/approvals"));
  const { run, message, busy } = useAction();
  const [form, setForm] = useState({ role: "ARTESAO", displayName: "", telegramUserId: "", adminEmail: "" });

  return (
    <>
      <h1>Usuários, auditoria e IA</h1>
      <Notice message={message} />
      <Section title="Usuários autorizados">
        <p className="muted">O acesso ao bot é por <strong>ID numérico do Telegram</strong> (nunca por @usuário). O painel usa o e-mail autenticado pelo Cloudflare Access.</p>
        <Table
          rows={users.data?.rows ?? []}
          columns={[
            { header: "Nome", cell: (u) => u.displayName },
            { header: "Papel", cell: (u) => <Badge tone={u.role === "ADMIN" ? "warn" : "neutral"}>{u.role}</Badge> },
            { header: "Telegram ID", cell: (u) => u.telegramUserId ?? "—" },
            { header: "E-mail (painel)", cell: (u) => u.adminEmail ?? "—" },
            { header: "Chat iniciado", cell: (u) => (u.telegramChatId ? "sim" : "não") },
            {
              header: "Ativo",
              cell: (u) => (
                <button className="small secondary" onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), "Atualizado.").then(() => users.reload())}>
                  {u.active ? "Ativo — desativar" : "Inativo — ativar"}
                </button>
              ),
            },
          ]}
        />
        <div className="form-row">
          <Field label="Papel">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ARTESAO">Artesão</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </Field>
          <Field label="Nome"><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
          <Field label="Telegram ID (numérico)"><input inputMode="numeric" value={form.telegramUserId} onChange={(e) => setForm({ ...form, telegramUserId: e.target.value.replace(/\D/g, "") })} /></Field>
          {form.role === "ADMIN" && <Field label="E-mail do Access"><input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></Field>}
          <button disabled={busy || form.displayName.length < 2} onClick={() => run(() => api("/users", { method: "POST", body: { role: form.role, displayName: form.displayName, telegramUserId: form.telegramUserId || null, adminEmail: form.adminEmail || null } }), "Usuário criado.").then(() => users.reload())}>
            Adicionar
          </button>
        </div>
      </Section>

      <Section title="Aprovações e exceções">
        <Table rows={approvals.data?.rows ?? []} empty="Nenhuma." columns={[{ header: "Quando", cell: (a) => formatDate(a.created_at) }, { header: "Tipo", cell: (a) => a.kind }, { header: "Situação", cell: (a) => a.status }, { header: "Justificativa", cell: (a) => a.justification ?? "—" }]} />
      </Section>

      <Section title="Uso de IA (estimativa)">
        <p className="muted">
          IA {ai.data?.aiEnabled ? <Badge tone="ok">ligada</Badge> : <Badge>desligada</Badge>} · teto operacional diário: {ai.data?.dailyLimit} requisições. {ai.data?.note}
        </p>
        <Table rows={ai.data?.rows ?? []} empty="Nenhum uso registrado." columns={[{ header: "Dia", cell: (r) => r.day }, { header: "Tarefa", cell: (r) => r.task }, { header: "Modelo", cell: (r) => r.model }, { header: "Requisições", cell: (r) => `${r.ok}/${r.requests}`, className: "num" }, { header: "Neurons (est.)", cell: (r) => r.neurons, className: "num" }, { header: "US$ (est.)", cell: (r) => (r.cost_usd_micros / 1_000_000).toFixed(4), className: "num" }]} />
      </Section>

      <Section title="Auditoria (últimos 100 eventos)">
        <Table rows={auditLog.data?.rows ?? []} columns={[{ header: "Quando", cell: (a) => formatDate(a.created_at) }, { header: "Ação", cell: (a) => a.action }, { header: "Entidade", cell: (a) => `${a.entity_type} ${a.entity_id?.slice(0, 8) ?? ""}` }, { header: "Detalhes", cell: (a) => <code className="clip">{a.after_json ?? ""}</code> }]} />
      </Section>
    </>
  );
}
