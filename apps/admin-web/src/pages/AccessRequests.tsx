import { useState } from "react";
import { api, formatDate } from "../api";
import { Field, Notice, Section, useAction, useLoad } from "../ui";

interface AccessRequest {
  id: string;
  telegram_user_id: string;
  first_name: string | null;
  username: string | null;
  attempts: number;
  first_seen_at: string;
  last_seen_at: string;
}
interface UserRow {
  id: string;
  role: string;
  displayName: string;
  adminEmail: string | null;
  telegramUserId: string | null;
  active: boolean;
}

function RequestCard({ req, linkable, onDone }: { req: AccessRequest; linkable: UserRow[]; onDone: () => void }) {
  const [choice, setChoice] = useState<string>("new:ARTESAO");
  const [name, setName] = useState(req.first_name ?? "");
  const { run, message, busy } = useAction();
  const isLink = choice.startsWith("link:");
  const approve = () => {
    const body = isLink ? { mode: "link", userId: choice.slice(5) } : { mode: "new", role: choice.slice(4), displayName: name.trim() };
    return run(() => api(`/access-requests/${req.id}/approve`, { method: "POST", body }), "Acesso liberado. A pessoa vai receber um aviso no Telegram.").then((ok) => ok && onDone());
  };
  return (
    <div className="request">
      <p>
        <strong>{req.first_name ?? "Sem nome"}</strong> {req.username && <span className="muted">(@{req.username})</span>}
        <br />
        <small className="muted">
          Telegram ID {req.telegram_user_id} · {req.attempts} {req.attempts === 1 ? "mensagem" : "mensagens"} · última em {formatDate(req.last_seen_at)}
        </small>
      </p>
      <div className="form-row">
        <Field label="Quem é essa pessoa?">
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="new:ARTESAO">Novo artesão (ex.: Adriano)</option>
            <option value="new:ADMIN">Novo administrador</option>
            {linkable.map((u) => (
              <option key={u.id} value={`link:${u.id}`}>
                Sou eu / já cadastrado: {u.displayName}
                {u.adminEmail ? ` (${u.adminEmail})` : ""}
              </option>
            ))}
          </select>
        </Field>
        {!isLink && (
          <Field label="Nome que o bot vai usar">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Adriano" />
          </Field>
        )}
        <button disabled={busy || (!isLink && name.trim().length < 2)} onClick={approve}>
          Liberar acesso
        </button>
        <button className="secondary" disabled={busy} onClick={() => run(() => api(`/access-requests/${req.id}/reject`, { method: "POST", body: {} }), "Pedido recusado.").then((ok) => ok && onDone())}>
          Recusar
        </button>
      </div>
      <Notice message={message} />
    </div>
  );
}

export function AccessRequests({ onChange }: { onChange?: () => void }) {
  const reqs = useLoad(() => api<{ rows: AccessRequest[] }>("/access-requests"));
  const users = useLoad(() => api<{ rows: UserRow[] }>("/users"));
  const linkable = (users.data?.rows ?? []).filter((u) => u.active && !u.telegramUserId);
  const done = () => {
    reqs.reload();
    users.reload();
    onChange?.();
  };
  return (
    <Section title="Pedidos de acesso ao bot">
      <p className="muted">
        Quando alguém manda mensagem para o bot sem estar cadastrado, aparece aqui. Ninguém entra sem a sua aprovação. Para se cadastrar, a pessoa só precisa mandar "oi" para o bot.
      </p>
      {(reqs.data?.rows ?? []).length === 0 ? (
        <p className="muted">Nenhum pedido pendente.</p>
      ) : (
        reqs.data!.rows.map((r) => <RequestCard key={r.id} req={r} linkable={linkable} onDone={done} />)
      )}
    </Section>
  );
}
