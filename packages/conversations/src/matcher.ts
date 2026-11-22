import { jaccard, normalizePersonName, similarity, tokenize } from "@adripatina/shared";
import { descriptorsConflict } from "./vocabulary.js";

/**
 * Deduplicação semântica de projetos — regras DETERMINÍSTICAS.
 * A IA pode, no máximo, sugerir atributos extraídos; a decisão é deste módulo
 * e SEMPRE termina em confirmação humana quando há suspeita relevante.
 */

export interface CandidateProject {
  jobId: string;
  code: string;
  clientName: string | null;
  clientAliases: string[];
  furnitureType: string | null;
  descriptors: string[];
  techniques: string[];
  photoHashes: string[];
  status: string;
  createdAt: string;
  lastInteractionAt: string | null;
  text: string;
}

export interface ProjectMention {
  clientName?: string;
  furnitureType?: string;
  descriptors: string[];
  techniques: string[];
  photoHash?: string;
  text: string;
  explicitNew?: boolean;
  referencesExisting?: boolean;
}

export interface MatchScore {
  jobId: string;
  score: number;
  reasons: string[];
  conflicts: string[];
}

export type MatchDecision =
  | { kind: "none" }
  | { kind: "confirm_single"; strength: "forte" | "possivel"; candidate: MatchScore }
  | { kind: "choose_among"; candidates: MatchScore[] }
  | { kind: "confirm_new_despite_similar"; candidate: MatchScore };

export const STRONG_THRESHOLD = 0.7;
export const POSSIBLE_THRESHOLD = 0.4;

const CLOSED = new Set(["ENTREGUE", "CANCELADO"]);

export function clientMatches(a: string, aliases: readonly string[], b: string): number {
  const nb = normalizePersonName(b);
  let best = 0;
  for (const name of [a, ...aliases]) {
    const na = normalizePersonName(name);
    if (!na || !nb) continue;
    if (na === nb) return 1;
    // primeiro nome igual ("maria" vs "maria aparecida")
    const fa = na.split(" ")[0]!;
    const fb = nb.split(" ")[0]!;
    if (fa === fb) best = Math.max(best, 0.9);
    best = Math.max(best, similarity(na, nb));
  }
  return best;
}

export function scoreCandidate(m: ProjectMention, c: CandidateProject, now: Date): MatchScore {
  let score = 0;
  const reasons: string[] = [];
  const conflicts: string[] = [];
  let multiplier = 1;

  if (m.photoHash && c.photoHashes.includes(m.photoHash)) {
    score += 0.6;
    reasons.push("mesma foto");
  }

  if (m.furnitureType && c.furnitureType) {
    if (m.furnitureType === c.furnitureType) {
      score += 0.4;
      reasons.push("mesmo tipo de móvel");
    } else {
      conflicts.push("tipo de móvel diferente");
      multiplier *= 0.2;
    }
  }

  if (m.clientName && c.clientName) {
    const sim = clientMatches(c.clientName, c.clientAliases, m.clientName);
    if (sim >= 0.85) {
      score += 0.35;
      reasons.push("mesmo cliente");
    } else if (sim < 0.6) {
      conflicts.push("cliente diferente");
      multiplier *= 0.3;
    }
  }

  if (m.techniques.length > 0 && c.techniques.some((t) => m.techniques.includes(t))) {
    score += 0.1;
    reasons.push("mesma técnica");
  }

  const descOverlap = m.descriptors.filter((d) => c.descriptors.includes(d)).length;
  if (descOverlap > 0) {
    score += Math.min(0.1, 0.05 * descOverlap);
    reasons.push("mesmas características");
  }
  if (descriptorsConflict(m.descriptors, c.descriptors)) {
    score -= 0.15;
    conflicts.push("características diferentes");
  }

  const textSim = jaccard(tokenize(m.text), tokenize(c.text));
  score += 0.1 * textSim;

  if (!CLOSED.has(c.status) && c.status !== "MESCLADO") {
    score += 0.05;
  }
  const last = new Date(c.lastInteractionAt ?? c.createdAt);
  const ageDays = (now.getTime() - last.getTime()) / 86_400_000;
  if (ageDays <= 90) score += 0.05;
  if (CLOSED.has(c.status) && ageDays > 60) multiplier *= 0.5;
  if (m.referencesExisting) score += 0.05;

  return { jobId: c.jobId, score: Math.max(0, Math.min(1, score * multiplier)), reasons, conflicts };
}

/**
 * Decide o que perguntar. Nunca devolve "criar automaticamente" quando há
 * suspeita ≥ POSSIBLE_THRESHOLD; nunca mescla ou associa sem confirmação.
 */
export function decideMatch(m: ProjectMention, candidates: readonly CandidateProject[], now: Date): MatchDecision {
  const scored = candidates
    .filter((c) => c.status !== "MESCLADO")
    .map((c) => scoreCandidate(m, c, now))
    .filter((s) => s.score >= POSSIBLE_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { kind: "none" };
  if (m.explicitNew) return { kind: "confirm_new_despite_similar", candidate: scored[0]! };
  const strong = scored.filter((s) => s.score >= STRONG_THRESHOLD);
  // vários candidatos fortes ou parecidos (ex.: duas cristaleiras da mesma cliente) → perguntar qual
  if (strong.length > 1) return { kind: "choose_among", candidates: strong.slice(0, 4) };
  const close = scored.filter((s) => scored[0]!.score - s.score < 0.1);
  if (close.length > 1) return { kind: "choose_among", candidates: close.slice(0, 4) };
  return { kind: "confirm_single", strength: strong.length > 0 ? "forte" : "possivel", candidate: scored[0]! };
}
