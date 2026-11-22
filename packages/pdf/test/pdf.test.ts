import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { findConfidentialTerms, renderCommercialQuote, renderInternalQuote, type CommercialQuoteDoc } from "../src/index.js";

// PNG 1×1 válido
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"),
  (c) => c.charCodeAt(0),
);

export function sampleDoc(over: Partial<CommercialQuoteDoc> = {}): CommercialQuoteDoc {
  return {
    number: "AP-2026-0001",
    version: 1,
    issuedAt: "2026-11-22T12:00:00Z",
    validUntil: "2026-12-07T12:00:00Z",
    preliminary: false,
    business: { name: "adripatina" },
    client: { name: "Cliente Fictícia" },
    furniture: { description: "Cristaleira antiga em madeira, duas portas de vidro" },
    scope: ["Lixamento e preparação", "Pátina em tom creme", "Verniz de proteção"],
    finishes: ["Pátina provençal", "Verniz acetinado"],
    lines: [
      { label: "Serviços", amountCents: 90000 },
      { label: "Materiais e insumos", amountCents: 20000 },
    ],
    totalCents: 110000,
    deadlineText: "15 dias úteis após a aprovação",
    paymentTerms: "entrada e restante na entrega",
    depositCents: 44000,
    exclusions: ["Troca de vidros", "Ferragens novas"],
    notes: ["Cores conferidas pessoalmente antes do início."],
    photos: [{ bytes: PNG, mime: "image/png" }],
    showAcceptance: true,
    ...over,
  };
}

/** Extrai todo o texto legível do PDF (streams descomprimidos + strings hex/literais). */
function pdfPlainText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  let out = raw;
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    try {
      out += "\n" + inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
    } catch {
      /* stream não comprimido */
    }
  }
  // decodifica strings hexadecimais <...>
  out = out.replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex: string) => {
    const h = hex.replace(/\s/g, "");
    if (h.length % 2 !== 0) return "";
    let s = "";
    for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
    // UTF-16BE (metadados)
    if (s.startsWith("þÿ")) {
      let u = "";
      for (let i = 2; i + 1 < s.length; i += 2) u += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
      return u;
    }
    return s;
  });
  return out;
}

describe("PDF comercial", () => {
  it("aceite 20: tem número, versão, validade, escopo, preço, condições e marca", async () => {
    const r = await renderCommercialQuote(sampleDoc());
    const text = r.renderedText.join("\n");
    expect(text).toContain("adripatina");
    expect(text).toContain("AP-2026-0001");
    expect(text).toContain("versão 1");
    expect(text).toContain("07/12/2026");
    expect(text).toContain("Pátina em tom creme");
    expect(text).toContain("R$ 1.100,00");
    expect(text).toContain("Pagamento: entrada e restante na entrega");
    expect(r.pageCount).toBeGreaterThanOrEqual(1);
    const loaded = await PDFDocument.load(r.bytes, { updateMetadata: false });
    expect(loaded.getTitle()).toBe("Proposta AP-2026-0001");
  });

  it("aceite 19: não contém termos confidenciais, nem em metadados", async () => {
    const r = await renderCommercialQuote(sampleDoc());
    expect(findConfidentialTerms(r.renderedText)).toEqual([]);
    const plain = pdfPlainText(r.bytes).toLowerCase();
    for (const term of ["markup", "margem", "lucro", "fornecedor", "estoque", "hora técnica", "pricing-", "custo"]) {
      expect(plain).not.toContain(term);
    }
    const loaded = await PDFDocument.load(r.bytes, { updateMetadata: false });
    expect(loaded.getAuthor()).toBe("adripatina");
    expect(loaded.getProducer()).toBe("adripatina");
    expect(loaded.getKeywords() ?? "").toBe("");
  });

  it("estimativa preliminar é rotulada como NÃO DEFINITIVA", async () => {
    const r = await renderCommercialQuote(sampleDoc({ preliminary: true }));
    expect(r.renderedText.join(" ")).toContain("NÃO DEFINITIVA");
  });

  it("não inventa contatos: rodapé só com dados fornecidos", async () => {
    const r = await renderCommercialQuote(sampleDoc());
    expect(r.renderedText.join(" ")).not.toMatch(/CNPJ|@|\(\d{2}\)/);
    const r2 = await renderCommercialQuote(sampleDoc({ business: { name: "adripatina", phone: "(11) 90000-0000" } }));
    expect(r2.renderedText.join(" ")).toContain("(11) 90000-0000");
  });

  it("é determinístico para o mesmo snapshot (permite hash estável)", async () => {
    const a = await renderCommercialQuote(sampleDoc());
    const b = await renderCommercialQuote(sampleDoc());
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  it("muitos itens quebram página com segurança", async () => {
    const r = await renderCommercialQuote(sampleDoc({ scope: Array.from({ length: 80 }, (_, i) => `Etapa ${i + 1} do serviço`) }));
    expect(r.pageCount).toBeGreaterThan(1);
  });
});

describe("PDF interno", () => {
  it("é marcado como confidencial", async () => {
    const r = await renderInternalQuote({
      number: "AP-2026-0001",
      version: 1,
      generatedAt: "2026-11-22T12:00:00Z",
      title: "Memória de cálculo",
      sections: [{ heading: "Custos", rows: [["Custo de reposição", "R$ 60,00"]] }],
    });
    expect(r.renderedText.join(" ")).toContain("CONFIDENCIAL");
  });
});
