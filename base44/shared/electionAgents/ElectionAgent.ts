// =============================================================================
// Election Agent — combines every factor with configurable weights:
// Party Strength, Candidate Popularity, Government Performance, Anti-Incumbency,
// Campaign Strength, Local Issues, Demographic Effect, Alliance Effect and
// Tactical Voting (defaults: 1.00 / 0.20 / 0.15 / 0.15 / 0.15 / 0.10 / 0.10 /
// 0.10 / 0.05). Produces the final, fully auditable constituency result from
// the Voter Agent's distribution. The anti-incumbency score is only one factor
// here — it never decides the winner by itself.
// =============================================================================
import {
  ConstituencyInput, DemographicResult, AntiIncumbencyResult, VoterResult,
  ElectionWeights, DEFAULT_WEIGHTS, CandidateAudit,
} from "./types.ts";
import { clamp, round2 } from "./rng.ts";

export class ElectionAgent {
  weights: ElectionWeights;

  constructor(weights?: Partial<ElectionWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  }

  combine(
    constituency: ConstituencyInput,
    demographic: DemographicResult,
    antiIncumbency: AntiIncumbencyResult | null,
    voterResult: VoterResult
  ) {
    const w = this.weights;
    const incumbentPartyId = antiIncumbency?.incumbentPartyId ?? null;
    const govPerf = clamp(constituency.incumbent?.governmentPerformance ?? 50, 0, 100);
    const localSeverity = clamp(constituency.localIssues ?? 45, 0, 100);

    const audits: CandidateAudit[] = [];
    for (const c of constituency.candidates) {
      const isIncumbent = c.partyId === incumbentPartyId;
      const factors: Record<string, number> = {
        partyStrength: clamp(constituency.partyStrength?.[c.partyId] ?? 50, 0, 100) - 50,
        candidatePopularity: clamp(c.candidatePopularity ?? 50, 0, 100) - 50,
        governmentPerformance: isIncumbent ? govPerf - 50 : -(govPerf - 50),
        antiIncumbency: isIncumbent
          ? (antiIncumbency?.score ?? 0)
          : -((antiIncumbency?.score ?? 0) * 0.3),
        campaignStrength: clamp(c.campaignStrength ?? 50, 0, 100) - 50,
        localIssues: isIncumbent ? -(localSeverity - 40) * 0.5 : (localSeverity - 40) * 0.4,
        demographicEffect: demographic.partyEffects[c.partyId] ?? 0,
        allianceEffect: clamp(constituency.allianceEffect?.[c.partyId] ?? 50, 0, 100) - 50,
        tacticalVoting: clamp(constituency.tacticalVoting?.[c.partyId] ?? 50, 0, 100) - 50,
        turnout: voterResult.turnoutPct - 58,
      };

      const weightedScore = round2(
        factors.partyStrength * w.partyStrength +
        factors.candidatePopularity * w.candidatePopularity +
        factors.governmentPerformance * w.governmentPerformance +
        factors.antiIncumbency * w.antiIncumbency +
        factors.campaignStrength * w.campaignStrength +
        factors.localIssues * w.localIssues +
        factors.demographicEffect * w.demographicEffect +
        factors.allianceEffect * w.allianceEffect +
        factors.tacticalVoting * w.tacticalVoting +
        factors.turnout * 0.05
      );

      audits.push({
        key: c.key,
        partyId: c.partyId,
        weightedScore,
        factors,
        votes: voterResult.candidateVotes[c.key] ?? 0,
        sharePct: 0,
      });
    }

    // Blend the Voter Agent's mechanical distribution with the weighted scores.
    // weightedScore nudges the share (capped at ±40%) but never flips totals.
    const blended = constituency.candidates.map((c, i) => {
      const baseVotes = voterResult.candidateVotes[c.key] ?? 0;
      const nudge = 1 + clamp(audits[i].weightedScore / 400, -0.4, 0.4);
      return Math.max(1, baseVotes * nudge);
    });
    const blendSum = blended.reduce((a, b) => a + b, 0) || 1;

    // Final votes via largest remainder so Σ votes = votesCast exactly.
    const votesCast = voterResult.votesCast;
    const exactFinal = blended.map(v => (votesCast * v) / blendSum);
    const floors = exactFinal.map(v => Math.floor(v));
    let assigned = floors.reduce((a, b) => a + b, 0);
    let remaining = votesCast - assigned;
    const order = exactFinal.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
    let oi = 0;
    while (remaining > 0 && order.length) {
      floors[order[oi % order.length].i] += 1;
      remaining -= 1;
      oi += 1;
    }

    const candidateVotes: Record<string, number> = {};
    const partyVotes: Record<string, number> = {};
    constituency.candidates.forEach((c, i) => {
      const votes = Math.max(0, floors[i]);
      candidateVotes[c.key] = votes;
      partyVotes[c.partyId] = (partyVotes[c.partyId] || 0) + votes;
      audits[i].votes = votes;
      audits[i].sharePct = round2((votes / Math.max(votesCast, 1)) * 100);
    });

    let winnerKey = constituency.candidates[0]?.key ?? "";
    let winnerVotes = -1;
    for (const c of constituency.candidates) {
      const v = candidateVotes[c.key] ?? 0;
      if (v > winnerVotes) { winnerVotes = v; winnerKey = c.key; }
    }

    return {
      winnerKey,
      winnerPartyId: constituency.candidates.find(c => c.key === winnerKey)?.partyId ?? "",
      votesCast,
      candidateVotes,
      partyVotes,
      audit: { demographic, antiIncumbency, candidates: audits },
    };
  }
}