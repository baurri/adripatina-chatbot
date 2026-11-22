import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { formatBRL, formatDateBR } from "@adripatina/shared";
import type { CommercialQuoteDoc, InternalQuoteDoc, RenderedPdf } from "./types.js";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

/** Fontes padrão do PDF usam WinAnsi: normaliza caracteres sem suporte. */
export function toWinAnsi(input: string): string {
  const map: Record<string, string> = {
    "≤": "<=", "≥": ">=", "→": "->", "←": "<-", "×": "x", "−": "-", " ": " ", " ": " ",
    "“": '"', "”": '"', "‘": "'", "’": "'",
  };
  let out = "";
  for (const ch of input.normalize("NFC")) {
    if (map[ch] !== undefined) out += map[ch];
    else {
      const code = ch.codePointAt(0)!;
      // Latin-1 + alguns símbolos WinAnsi (—, –, •, …, €)
      if (code <= 0xff || "—–•…€".includes(ch)) out += ch;
      else out += "?";
    }
  }
  return out;
}

function hexToRgb(hex: string | null | undefined, fallback: RGB): RGB {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return fallback;
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

class Writer {
  page!: PDFPage;
  y = 0;
  readonly text: string[] = [];
  constructor(
    readonly doc: PDFDocument,
    readonly fonts: { regular: PDFFont; bold: PDFFont; serif: PDFFont; serifItalic: PDFFont },
    readonly colors: { primary: RGB; accent: RGB; ink: RGB; muted: RGB },
    readonly onNewPage: (w: Writer) => void,
  ) {}

  newPage(): void {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
    this.onNewPage(this);
  }

  ensure(height: number): void {
    if (this.y - height < MARGIN + 30) this.newPage();
  }

  draw(str: string, x: number, y: number, size: number, font: PDFFont, color: RGB = this.colors.ink): void {
    const s = toWinAnsi(str);
    this.text.push(s);
    this.page.drawText(s, { x, y, size, font, color });
  }

  wrap(str: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = toWinAnsi(str).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  paragraph(str: string, opts: { size?: number; font?: PDFFont; indent?: number; color?: RGB; gap?: number } = {}): void {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.fonts.regular;
    const indent = opts.indent ?? 0;
    const lines = this.wrap(str, font, size, A4[0] - 2 * MARGIN - indent);
    for (const l of lines) {
      this.ensure(size + 4);
      this.draw(l, MARGIN + indent, this.y, size, font, opts.color);
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 2;
  }

  heading(str: string): void {
    this.ensure(34);
    this.y -= 8;
    this.draw(str.toUpperCase(), MARGIN, this.y, 9.5, this.fonts.bold, this.colors.primary);
    this.y -= 5;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4[0] - MARGIN, y: this.y },
      thickness: 0.6,
      color: this.colors.accent,
    });
    this.y -= 14;
  }

  bullets(items: string[]): void {
    for (const item of items) {
      this.ensure(16);
      this.draw("•", MARGIN + 4, this.y, 10.5, this.fonts.regular, this.colors.accent);
      this.paragraph(item, { indent: 16, gap: 0 });
    }
    this.y -= 2;
  }
}

async function embedImage(doc: PDFDocument, img: { bytes: Uint8Array; mime: string }) {
  return img.mime === "image/png" ? doc.embedPng(img.bytes) : doc.embedJpg(img.bytes);
}

function setNeutralMetadata(doc: PDFDocument, title: string, date: Date): void {
  // metadados neutros: nada de custos, versões de fórmula ou nomes de arquivos internos
  doc.setTitle(toWinAnsi(title), { showInWindowTitleBar: true });
  doc.setAuthor("adripatina");
  doc.setSubject(toWinAnsi(title));
  doc.setCreator("adripatina");
  doc.setProducer("adripatina");
  doc.setKeywords([]);
  doc.setLanguage("pt-BR");
  doc.setCreationDate(date);
  doc.setModificationDate(date);
}

export async function renderCommercialQuote(q: CommercialQuoteDoc): Promise<RenderedPdf> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const colors = {
    primary: hexToRgb(q.business.primaryColor, rgb(0.29, 0.22, 0.17)), // marrom madeira
    accent: hexToRgb(q.business.accentColor, rgb(0.72, 0.56, 0.3)), // dourado envelhecido
    ink: rgb(0.13, 0.13, 0.13),
    muted: rgb(0.42, 0.42, 0.42),
  };
  const logo = q.business.logo ? await embedImage(doc, q.business.logo) : null;

  const title = q.preliminary ? `Estimativa preliminar ${q.number}` : `Proposta ${q.number}`;
  const w = new Writer(doc, fonts, colors, (wr) => {
    const p = wr.page;
    // faixa superior com a marca
    p.drawRectangle({ x: 0, y: A4[1] - 92, width: A4[0], height: 92, color: colors.primary });
    let brandX = MARGIN;
    if (logo) {
      const scale = 54 / logo.height;
      p.drawImage(logo, { x: MARGIN, y: A4[1] - 74, width: logo.width * scale, height: 54 });
      brandX += logo.width * scale + 12;
    }
    wr.draw(q.business.name || "adripatina", brandX, A4[1] - 52, 30, fonts.serifItalic, rgb(1, 1, 1));
    wr.draw(q.business.tagline || "pintura e restauração de móveis", brandX, A4[1] - 72, 10, fonts.regular, rgb(0.93, 0.88, 0.78));
    const right = `${q.preliminary ? "ESTIMATIVA" : "PROPOSTA"} ${q.number}`;
    wr.draw(right, A4[0] - MARGIN - fonts.bold.widthOfTextAtSize(toWinAnsi(right), 10), A4[1] - 48, 10, fonts.bold, rgb(1, 1, 1));
    const ver = `versão ${q.version}`;
    wr.draw(ver, A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(ver, 9), A4[1] - 62, 9, fonts.regular, rgb(0.93, 0.88, 0.78));
    if (q.preliminary) {
      p.drawRectangle({ x: 0, y: A4[1] - 112, width: A4[0], height: 20, color: rgb(0.98, 0.93, 0.8) });
      const warn = "ESTIMATIVA PRELIMINAR — NÃO DEFINITIVA — valores sujeitos a confirmação";
      wr.draw(warn, MARGIN, A4[1] - 106, 9, fonts.bold, rgb(0.55, 0.3, 0.05));
      p.drawText(toWinAnsi("NÃO DEFINITIVA"), {
        x: 120,
        y: 300,
        size: 64,
        font: fonts.bold,
        color: rgb(0.85, 0.75, 0.6),
        opacity: 0.18,
        rotate: degrees(35),
      });
    }
    wr.y = A4[1] - (q.preliminary ? 140 : 124);
  });

  w.newPage();

  // Identificação
  const issued = formatDateBR(q.issuedAt);
  const valid = formatDateBR(q.validUntil);
  w.draw("Cliente", MARGIN, w.y, 9, fonts.bold, colors.muted);
  w.draw("Emissão", 330, w.y, 9, fonts.bold, colors.muted);
  w.draw("Válida até", 440, w.y, 9, fonts.bold, colors.muted);
  w.y -= 14;
  w.draw(q.client.name, MARGIN, w.y, 12, fonts.bold);
  w.draw(issued, 330, w.y, 11, fonts.regular);
  w.draw(valid, 440, w.y, 11, fonts.regular);
  w.y -= 26;

  w.heading("Móvel");
  w.paragraph(q.furniture.description, { size: 11.5 });

  if (q.photos.length > 0) {
    const imgs = await Promise.all(q.photos.slice(0, 3).map((p) => embedImage(doc, p)));
    const boxW = (A4[0] - 2 * MARGIN - (imgs.length - 1) * 10) / imgs.length;
    const boxH = 150;
    w.ensure(boxH + 10);
    let x = MARGIN;
    for (const img of imgs) {
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      w.page.drawImage(img, { x: x + (boxW - iw) / 2, y: w.y - ih, width: iw, height: ih });
      x += boxW + 10;
    }
    w.y -= boxH + 10;
  }

  if (q.scope.length) {
    w.heading("Serviços incluídos");
    w.bullets(q.scope);
  }
  if (q.finishes.length) {
    w.heading("Acabamento");
    w.bullets(q.finishes);
  }

  w.heading("Investimento");
  for (const line of q.lines) {
    w.ensure(18);
    w.draw(line.label, MARGIN, w.y, 10.5, fonts.regular);
    const amt = formatBRL(line.amountCents);
    w.draw(amt, A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(amt, 10.5), w.y, 10.5, fonts.regular);
    w.y -= 16;
  }
  w.ensure(44);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 30, width: A4[0] - 2 * MARGIN, height: 36, color: rgb(0.97, 0.95, 0.91), borderColor: colors.accent, borderWidth: 0.8 });
  w.draw(q.preliminary ? "Valor estimado" : "Valor total", MARGIN + 12, w.y - 17, 12, fonts.bold, colors.primary);
  const total = formatBRL(q.totalCents);
  w.draw(total, A4[0] - MARGIN - 12 - fonts.bold.widthOfTextAtSize(total, 16), w.y - 18, 16, fonts.bold, colors.primary);
  w.y -= 46;

  w.heading("Prazo e condições");
  w.paragraph(`Prazo estimado: ${q.deadlineText}`);
  w.paragraph(`Pagamento: ${q.paymentTerms}`);
  if (q.depositCents !== null && q.depositCents > 0) w.paragraph(`Entrada para início do serviço: ${formatBRL(q.depositCents)}`);
  w.paragraph(`Esta proposta é válida até ${valid}.`);

  if (q.exclusions.length) {
    w.heading("Não incluso");
    w.bullets(q.exclusions);
  }
  if (q.notes.length) {
    w.heading("Observações");
    w.bullets(q.notes);
  }

  if (q.showAcceptance && !q.preliminary) {
    w.ensure(90);
    w.heading("Aceite");
    w.y -= 26;
    w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: 300, y: w.y }, thickness: 0.6, color: colors.muted });
    w.page.drawLine({ start: { x: 340, y: w.y }, end: { x: A4[0] - MARGIN, y: w.y }, thickness: 0.6, color: colors.muted });
    w.y -= 12;
    w.draw("Assinatura do cliente", MARGIN, w.y, 9, fonts.regular, colors.muted);
    w.draw("Data", 340, w.y, 9, fonts.regular, colors.muted);
    w.y -= 10;
  }

  // rodapé com contatos (somente se fornecidos) e paginação
  const contacts = [q.business.phone, q.business.email, q.business.instagram, q.business.city, q.business.document].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    w.page = p;
    p.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: A4[0] - MARGIN, y: 42 }, thickness: 0.4, color: colors.accent });
    if (contacts.length) w.draw(contacts.join("  •  "), MARGIN, 28, 8.5, fonts.regular, colors.muted);
    const pg = `${q.number} — página ${i + 1} de ${pages.length}`;
    w.draw(pg, A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(toWinAnsi(pg), 8.5), 28, 8.5, fonts.regular, colors.muted);
  });

  setNeutralMetadata(doc, title, new Date(q.issuedAt));
  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, renderedText: w.text, pageCount: pages.length };
}

export async function renderInternalQuote(q: InternalQuoteDoc): Promise<RenderedPdf> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const colors = { primary: rgb(0.45, 0.05, 0.05), accent: rgb(0.7, 0.2, 0.2), ink: rgb(0.1, 0.1, 0.1), muted: rgb(0.4, 0.4, 0.4) };
  const w = new Writer(doc, fonts, colors, (wr) => {
    wr.draw("DOCUMENTO INTERNO — CONFIDENCIAL — NÃO ENVIAR AO CLIENTE", MARGIN, A4[1] - 40, 10, fonts.bold, colors.primary);
    wr.draw(`${q.title} • ${q.number} v${q.version} • ${formatDateBR(q.generatedAt)}`, MARGIN, A4[1] - 56, 9, fonts.regular, colors.muted);
    wr.y = A4[1] - 80;
  });
  w.newPage();
  for (const s of q.sections) {
    w.heading(s.heading);
    for (const [k, v] of s.rows) {
      const lines = w.wrap(v, fonts.regular, 9.5, 280);
      w.ensure(lines.length * 13 + 2);
      w.draw(k, MARGIN, w.y, 9.5, fonts.bold);
      for (const l of lines) {
        w.draw(l, 265, w.y, 9.5, fonts.regular);
        w.y -= 13;
      }
    }
  }
  setNeutralMetadata(doc, `Interno ${q.number}`, new Date(q.generatedAt));
  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, renderedText: w.text, pageCount: doc.getPageCount() };
}
