import { normalizeText } from "./text.js";

const TZ = "America/Sao_Paulo";
const WEEKDAYS: [RegExp, number][] = [
  [/\bdomingo\b/, 0],
  [/\bsegunda(?:-feira| feira)?\b/, 1],
  [/\bterca(?:-feira| feira)?\b/, 2],
  [/\bquarta(?:-feira| feira)?\b/, 3],
  [/\bquinta(?:-feira| feira)?\b/, 4],
  [/\bsexta(?:-feira| feira)?\b/, 5],
  [/\bsabado\b/, 6],
];

export interface DateMention {
  /** trecho original normalizado, ex.: "terca-feira" */
  expression: string;
  /** AAAA-MM-DD no fuso de São Paulo */
  isoDate: string;
  /** a expressão pode significar hoje ou daqui a 7 dias — confirmar com o usuário */
  ambiguous: boolean;
}

/** Data local (AAAA-MM-DD) e dia da semana em America/Sao_Paulo. */
function localParts(now: Date): { iso: string; weekday: number } {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  return { iso, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

/**
 * Interpreta "hoje", "amanhã", "depois de amanhã" e dias da semana.
 * Regra: dia da semana = próxima ocorrência a partir de amanhã; se o dia citado
 * for o próprio dia de hoje, marca ambiguidade (pode ser hoje ou a semana que vem).
 */
function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31/02 não existe
  return dt.toISOString().slice(0, 10);
}

/** "05/12", "5/12/2026", "dia 5": data numérica. Data no passado fica marcada como ambígua. */
function numericDate(raw: string, norm: string, todayIso: string): DateMention | null {
  const [ty, tm, td] = todayIso.split("-").map(Number) as [number, number, number];
  // a "/" some na normalização: procura no texto original
  const full = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/.exec(raw);
  if (full) {
    const d = Number(full[1]);
    const m = Number(full[2]);
    let y = full[3] ? Number(full[3].length === 2 ? `20${full[3]}` : full[3]) : ty;
    let iso = validIso(y, m, d);
    if (!iso) return null;
    let ambiguous = false;
    if (iso < todayIso) {
      if (!full[3]) {
        y += 1; // "05/01" dito em dezembro = janeiro do ano que vem, mas confirmar
        iso = validIso(y, m, d);
        if (!iso) return null;
      }
      ambiguous = true;
    }
    return { expression: full[0], isoDate: iso, ambiguous };
  }
  const dia = /\bdia (\d{1,2})\b(?!\s*(?:\/|de (?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)))/.exec(norm);
  if (dia) {
    const d = Number(dia[1]);
    let y = ty;
    let m = tm;
    if (d < td) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    const iso = validIso(y, m, d);
    if (!iso) return null;
    // "dia 5" sem mês: próximo dia 5; se virou o mês seguinte, vale confirmar
    return { expression: dia[0], isoDate: iso, ambiguous: d < td };
  }
  return null;
}

export function extractDateMention(text: string, now: Date): DateMention | null {
  const norm = normalizeText(text);
  const today = localParts(now);
  const numeric = numericDate(text, norm, today.iso);
  if (numeric) return numeric;
  if (/\bdepois de amanha\b/.test(norm)) return { expression: "depois de amanhã", isoDate: addDaysIso(today.iso, 2), ambiguous: false };
  if (/\bamanha\b/.test(norm)) return { expression: "amanhã", isoDate: addDaysIso(today.iso, 1), ambiguous: false };
  if (/\bhoje\b/.test(norm)) return { expression: "hoje", isoDate: today.iso, ambiguous: false };
  for (const [re, wd] of WEEKDAYS) {
    const m = re.exec(norm);
    if (!m) continue;
    let diff = (wd - today.weekday + 7) % 7;
    const ambiguous = diff === 0;
    if (diff === 0) diff = 7;
    const nextWeek = /\b(que vem|proxima semana|semana que vem)\b/.test(norm);
    if (nextWeek && diff < 7) diff += 7;
    // "terça que vem" dito no fim de semana pode ser a próxima terça (daqui a 2 dias) ou a outra:
    // a data calculada é a da semana seguinte, mas fica marcada para confirmar quando faltam ≤ 3 dias
    const soon = nextWeek && diff - 7 <= 3;
    return { expression: m[0], isoDate: addDaysIso(today.iso, diff), ambiguous: (ambiguous && !nextWeek) || soon };
  }
  return null;
}

/** AAAA-MM-DD → DD/MM/AAAA */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
