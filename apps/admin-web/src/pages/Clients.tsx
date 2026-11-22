import { useState } from "react";
import { api, formatDate } from "../api";
import { Field, Loading, Notice, Section, Table, useAction, useLoad } from "../ui";

export function Clients() {
  const { data, error, loading, reload } = useLoad(() => api<{ rows: { id: string; name: string; aliases: string[]; phone: string | null; notes: string | null; created_at: string }[] }>("/clients"));
  const { run, message, busy } = useAction();
  const [form, setForm] = useState({ name: "", aliases: "", phone: "" });
  const [aliasEdit, setAliasEdit] = useState<Record<string, string>>({});
  return (
    <>
      <h1>Clientes</h1>
      <p className="muted">Guarde só o necessário (LGPD). Apelidos ajudam o bot a reconhecer o mesmo cliente ("dona Maria", "Maria da rua 7").</p>
      <Notice message={message} />
      <Section title="Novo cliente">
        <div className="form-row">
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Apelidos (separados por vírgula)"><input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} /></Field>
          <Field label="Contato (opcional)"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <button disabled={busy || form.name.trim().length < 2} onClick={() => run(() => api("/clients", { method: "POST", body: { name: form.name, aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean), phone: form.phone || null } }), "Cliente criado.").then(() => (setForm({ name: "", aliases: "", phone: "" }), reload()))}>
            Salvar
          </button>
        </div>
      </Section>
      <Loading error={error} loading={loading} />
      <Table
        rows={data?.rows ?? []}
        columns={[
          { header: "Nome", cell: (c) => c.name },
          {
            header: "Apelidos",
            cell: (c) => (
              <span className="form-row">
                <input aria-label={`Apelidos de ${c.name}`} value={aliasEdit[c.id] ?? c.aliases.join(", ")} onChange={(e) => setAliasEdit({ ...aliasEdit, [c.id]: e.target.value })} />
                <button className="small secondary" onClick={() => run(() => api(`/clients/${c.id}`, { method: "PATCH", body: { aliases: (aliasEdit[c.id] ?? "").split(",").map((s) => s.trim()).filter(Boolean) } }), "Apelidos salvos.").then(() => reload())}>Salvar</button>
              </span>
            ),
          },
          { header: "Contato", cell: (c) => c.phone ?? "—" },
          { header: "Desde", cell: (c) => formatDate(c.created_at) },
        ]}
      />
    </>
  );
}
