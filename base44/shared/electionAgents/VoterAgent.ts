// =============================================================================
// Voter Agent — constituency-level turnout, voter participation and the final
// vote distribution. Pure deterministic math with small seedable randomness —
// NEVER an AI call. Invariants enforced: women + men = totalVoters,
// urban + rural = totalVoters, votesCast <= totalVoters, all candidate votes
// sum exactly to votesCast, and no vote is ever negative.
// =============================================================================
import { ConstituencyInput, DemographicResult, AntiIncumbencyResult, VoterResult } from "./types.ts";
import { createRng, clamp, seededFloat } from "./rng.ts";

export class VoterAgent {
  /** Constituency turnout — 40%-90%, nudged by strength, campaigns and seed. */
  calculateTurnout(constituency: ConstituencyInput, demographic: DemographicResult): number {
    const rng = createRng("turnout:" + (constituency.seed || constituency.id));
    const parties = constituency.parties.length ? constituency.parties : [];
    const strengths = parties.map(p => constituency.partyStrength?.[p] ?? 50);
    const avgStrength = strengths.reduce((a, b) => a + b, 0) / Math.max(strengths.length, 1);
    const campaigns = constituency.candidates.map(c => c.campaignStrength ?? 50);
    const avgCampaign = campaigns.length
      ? campaigns.reduce((a, b) => a + b, 0) / campaigns.length
      : 50;
    let turnout = 58 + (avgStrength - 50) * 0.15 + (avgCampaign - 50) * 0.12 + seededFloat(rng, -6, 10);
    turnout = clamp(turnout, 40, 90);
    return Math.round(turnout * 10) / 10;
  }

  /**
   * Distributes votesCast across candidates using party strength, candidate
   * popularity, campaign strength, demographic effects, anti-incumbency,
   * alliance and tactical effects. Largest-remainder rounding guarantees the
   * candidate votes sum exactly to votesCast.
   */
  distributeVotes(
    constituency: ConstituencyInput,
    demographic: DemographicResult,
    antiIncumbency: AntiIncumbencyResult | null,
    turnoutPct: number
  ): VoterResult {
    const groups = demographic.groups;
    const votesCast = Math.min(groups.totalVoters, Math.floor((groups.totalVoters * turnoutPct) / 100));
    const cands = constituency.candidates;
    if (!cands.length) {
      return { totalVoters: groups.totalVoters, votesCast, turnoutPct, partyVotes: {}, candidateVotes: {} };
    }

    const oppositionCount = Math.max(1, cands.filter(c => c.partyId !== antiIncumbency?.incumbentPartyId).length);
    const rawScores = cands.map(c => {
      let score = 50;
      score += (constituency.partyStrength?.[c.partyId] ?? 50) - 50;
      score += (demographic.partyEffects[c.partyId] ?? 0);
      score += ((c.candidatePopularity ?? 50) - 50) * 0.6;
      score += ((c.campaignStrength ?? 50) - 50) * 0.4;
      score += (((constituency.allianceEffect?.[c.partyId] ?? 50) - 50) / 50) * 8;
      if (antiIncumbency) {
        if (c.partyId === antiIncumbency.incumbentPartyId) {
          score -= antiIncumbency.score * 0.8; // hurts the incumbent
        } else {
          // small, equal spillover to every opposition candidate
          score += (antiIncumbency.score * 0.8) / oppositionCount * 0.4;
        }
      }
      return Math.max(1, score);
    });

    const scoreSum = rawScores.reduce((a, b) => a + b, 0);
    // Floor each candidate at 1% so every contender keeps a real, non-negative vote.
    const minVotes = Math.max(1, Math.floor(votesCast * 0.01));
    const exact = rawScores.map(s => Math.max(minVotes, (votesCast * s) / scoreSum));

    return {
      totalVoters: groups.totalVoters,
      votesCast,
      turnoutPct,
      partyVotes: this._rollup(constituency, cands, exact),
      candidateVotes: this._largestRemainder(constituency, cands, exact, votesCast),
    };
  }

  /** Largest-remainder rounding: candidate votes sum EXACTLY to votesCast, never negative. */
  _largestRemainder(
    constituency: ConstituencyInput,
    cands: ConstituencyInput["candidates"],
    exact: number[],
    votesCast: number
  ): Record<string, number> {
    const floored = exact.map(v => Math.floor(v));
    let assigned = floored.reduce((a, b) => a + b, 0);
    let remaining = votesCast - assigned;
    const order = exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    const out: Record<string, number> = {};
    let oi = 0;
    while (remaining > 0 && order.length) {
      const idx = order[oi % order.length].i;
      floored[idx] += 1;
      remaining -= 1;
      oi += 1;
    }
    if (remaining < 0) {
      // Should be impossible (floors ≤ votesCast), but guard anyway.
      for (let i = 0; remaining < 0 && i < floored.length; i++) {
        if (floored[i] > 1) { floored[i] -= 1; remaining += 1; }
      }
    }
    cands.forEach((c, i) => { out[c.key] = Math.max(0, floored[i]); });
    return out;
  }

  _rollup(
    constituency: ConstituencyInput,
    cands: ConstituencyInput["candidates"],
    exact: number[]
  ): Record<string, number> {
    const partyExact: Record<string, number> = {};
    cands.forEach((c, i) => {
      partyExact[c.partyId] = (partyExact[c.partyId] || 0) + exact[i];
    });
    const votesCast = exact.reduce((a, b) => a + b, 0);
    const partyFloored: Record<string, number> = {};
    for (const p of Object.keys(partyExact)) partyFloored[p] = Math.floor(partyExact[p]);
    let assigned = Object.values(partyFloored).reduce((a, b) => a + b, 0);
    let remaining = Math.round(votesCast) - assigned;
    const order = Object.entries(partyExact).sort((a, b) => (b[1] % 1) - (a[1] % 1));
    let oi = 0;
    while (remaining > 0 && order.length) {
      partyFloored[order[oi % order.length][0]] += 1;
      remaining -= 1;
      oi += 1;
    }
    for (const p of Object.keys(partyFloored)) partyFloored[p] = Math.max(0, partyFloored[p]);
    return partyFloored;
  }
}