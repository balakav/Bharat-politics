// =============================================================================
// Demographic Agent — builds/validates constituency voter blocks (women, men,
// youth, urban, rural) and computes per-party demographic vote effects.
// Synthesizes missing values deterministically from the seed, but NEVER
// silently "fixes" explicitly supplied invalid data — validateVoterData
// rejects that instead. All math is deterministic and seedable; no AI calls.
// =============================================================================
import { ConstituencyInput, VoterData, DemographicResult } from "./types.ts";
import { createRng, seededFloat, clamp, round2 } from "./rng.ts";

export class DemographicAgent {
  /**
   * Builds the voter block set: keeps every explicitly supplied value as-is
   * and deterministically synthesizes the missing ones. Invariants hold only
   * when the input is consistent — that's what validateVoterData checks.
   */
  buildVoterData(constituency: ConstituencyInput): VoterData {
    const rng = createRng("demo:" + (constituency.seed || constituency.id));
    const total = constituency.totalVoters ?? 100000;

    // Synthesize missing values, but NEVER silently "fix" explicitly supplied
    // (possibly invalid) data — that is what validateVoterData rejects.
    let women = constituency.voterData?.women;
    let men = constituency.voterData?.men;
    if (women === undefined && men === undefined) {
      women = Math.floor(total * seededFloat(rng, 0.44, 0.52));
      men = total - women;
    } else if (women === undefined) {
      women = total - men;
    } else if (men === undefined) {
      men = total - women;
    }

    const youth = constituency.voterData?.youth ?? Math.floor(total * seededFloat(rng, 0.25, 0.45));

    let urban = constituency.voterData?.urban;
    let rural = constituency.voterData?.rural;
    if (urban === undefined && rural === undefined) {
      urban = Math.floor(total * seededFloat(rng, 0.2, 0.8));
      rural = total - urban;
    } else if (urban === undefined) {
      urban = total - rural;
    } else if (rural === undefined) {
      rural = total - urban;
    }

    return { totalVoters: total, women, men, youth, urban, rural };
  }

  /** Returns a list of invariant violations; empty list = valid. */
  validateVoterData(groups: VoterData): string[] {
    const errors: string[] = [];
    if (!groups || typeof groups.totalVoters !== "number" || groups.totalVoters <= 0) {
      errors.push("totalVoters must be a positive number");
      return errors;
    }
    for (const field of ["women", "men", "youth", "urban", "rural"] as const) {
      const v = groups[field];
      if (typeof v !== "number" || isNaN(v)) errors.push(field + " must be a number");
      else if (v < 0) errors.push(field + " cannot be negative");
    }
    if (errors.length) return errors;
    if (groups.women + groups.men !== groups.totalVoters) {
      errors.push("women + men must equal totalVoters");
    }
    if (groups.urban + groups.rural !== groups.totalVoters) {
      errors.push("urban + rural must equal totalVoters");
    }
    if (groups.youth > groups.totalVoters) {
      errors.push("youth cannot exceed totalVoters");
    }
    return errors;
  }

  /**
   * Computes per-party, per-block preferences (0-100) from party strength with
   * deterministic seed jitter, then aggregates a -N..+N party vote effect
   * weighted by each block's share of the electorate.
   */
  calculate(constituency: ConstituencyInput, groups: VoterData): DemographicResult {
    const rng = createRng("prefs:" + (constituency.seed || constituency.id));
    const total = groups.totalVoters;
    const parties = constituency.parties.length
      ? constituency.parties
      : Array.from(new Set(constituency.candidates.map(c => c.partyId)));

    const breakdown: Record<string, Record<string, number>> = {};
    const partyEffects: Record<string, number> = {};

    for (const party of parties) {
      const base = clamp(constituency.partyStrength?.[party] ?? 50, 0, 100);
      const blocks = ["women", "men", "youth", "urban", "rural"] as const;
      const prefs: Record<string, number> = {};
      for (const b of blocks) {
        prefs[b] = round2(clamp(base + seededFloat(rng, -8, 8), 5, 95));
      }
      breakdown[party] = prefs;

      // Weight each block's deviation by its share of the electorate
      // (youth overlaps the adult blocks, so it carries a reduced weight).
      const effect =
        (groups.women / total) * (prefs.women - 50) +
        (groups.men / total) * (prefs.men - 50) +
        (groups.youth / total) * 0.3 * (prefs.youth - 50) +
        (groups.urban / total) * (prefs.urban - 50) +
        (groups.rural / total) * (prefs.rural - 50);
      partyEffects[party] = round2(effect);
    }

    return { groups, partyEffects, breakdown };
  }
}