import { useEffect, useState } from "react";
import { api } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Quotes, QuoteDetail } from "./pages/Quotes";
import { Jobs, JobDetail } from "./pages/Jobs";
import { Catalog } from "./pages/Catalog";
import { FurnitureCatalog } from "./pages/FurnitureCatalog";
import { Settings } from "./pages/Settings";
import { Duplicates } from "./pages/Duplicates";
import { Reports } from "./pages/Reports";
import { Admin } from "./pages/Admin";
import { Clients } from "./pages/Clients";
import { Conversations } from "./pages/Conversations";
import { Proactive } from "./pages/Proactive";

const NAV: [string, string][] = [
  ["#/", "Painel"],
  ["#/orcamentos", "Orçamentos"],
  ["#/servicos", "Serviços"],
  ["#/clientes", "Clientes"],
  ["#/catalogo", "Materiais e estoque"],
  ["#/moveis", "Catálogo de móveis"],
  ["#/duplicidades", "Duplicidades"],
  ["#/relatorios", "Relatórios"],
  ["#/conversas", "Conversas e aprendizado"],
  ["#/coleta", "Coleta proativa"],
  ["#/configuracoes", "Configurações"],
  ["#/administracao", "Usuários, auditoria e IA"],
];

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    api<{ name: string; email: string }>("/me").then(setMe, (e: Error) => setAuthError(e.message));
  }, []);

  const [, section, id] = hash.split("/");
  let page;
  switch (section) {
    case "orcamentos":
      page = id ? <QuoteDetail id={id} /> : <Quotes />;
      break;
    case "servicos":
      page = id ? <JobDetail id={id} /> : <Jobs />;
      break;
    case "clientes":
      page = <Clients />;
      break;
    case "catalogo":
      page = <Catalog />;
      break;
    case "moveis":
      page = <FurnitureCatalog />;
      break;
    case "duplicidades":
      page = <Duplicates />;
      break;
    case "relatorios":
      page = <Reports />;
      break;
    case "conversas":
      page = <Conversations />;
      break;
    case "coleta":
      page = <Proactive />;
      break;
    case "configuracoes":
      page = <Settings />;
      break;
    case "administracao":
      page = <Admin />;
      break;
    default:
      page = <Dashboard />;
  }

  return (
    <div className="layout">
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">adripatina</span>
          <span className="brand-sub">painel administrativo</span>
        </div>
        <nav aria-label="Menu principal">
          <ul>
            {NAV.map(([href, label]) => (
              <li key={href}>
                <a href={href} aria-current={(href === "#/" ? hash === "#/" || hash === "" : hash.startsWith(href)) ? "page" : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="who">{me ? `${me.name}` : authError ? "Não autenticado" : "…"}</p>
      </aside>
      <main id="conteudo" tabIndex={-1}>
        {authError ? (
          <div className="card">
            <h1>Acesso restrito</h1>
            <p role="alert">{authError}</p>
            <p>Entre pelo Cloudflare Access com uma conta administradora autorizada.</p>
          </div>
        ) : (
          page
        )}
      </main>
    </div>
  );
}
