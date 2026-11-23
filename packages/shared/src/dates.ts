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
export function extractDateMention(text: string, now: Date): DateMention | null {
  const norm = normalizeText(text);
  const today = localParts(now);
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
    return { expression: m[0], isoDate: addDaysIso(today.iso, diff), ambiguous: ambiguous && !nextWeek };
  }
  return null;
}

/** AAAA-MM-DD → DD/MM/AAAA */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
