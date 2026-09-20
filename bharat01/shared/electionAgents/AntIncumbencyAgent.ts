// =============================================================================
// Anti-Incumbency Agent — turns the incumbent government's track record into
// a signed drag/goodwill score. Pure deterministic weighted math (no AI):
// poor performance, scandals, unemployment and inflation push the score up
// (anti-incumbency), good governance pushes it below zero. The score is
// clamped to a configurable range and is only ONE weighted factor in the
// Election Agent — it can never decide a winner by itself.
// =============================================================================
import { IncumbentData, AntiIncumbencyResult } from "./types.ts";
import { createRng, seededFloat, clamp, round2 } from "./rng.ts";

export class AntiIncumbencyAgent {
  range: { min: number; max: number };

  constructor(range?: { min: number; max: number }) {
    this.range = range || { min: -20, max: 60 };
  }

  calculate(incumbent: IncumbentData): AntiIncumbencyResult {
    const perf = incumbent.governmentPerformance ?? 50;
    const prevPerf = incumbent.previousElectionPerformance ?? 50;
    const ageDays = incumbent.governmentAgeDays ?? 0;
    const scandals = incumbent.majorScandals ?? 0;
    const corruption = incumbent.corruptionLevel ?? 50;
    const unemployment = incumbent.unemployment ?? 50;
    const inflation = incumbent.inflation ?? 50;
    const services = incumbent.publicServices ?? 50;
    const welfare = incumbent.welfarePerformance ?? 50;
    const localSeverity = incumbent.localIssuesSeverity ?? 50;

    // Satisfaction gaps (positive = public is unhappy).
    const factors: Record<string, number> = {
      governmentPerformance: round2(50 - perf),
      previousElectionPerformance: round2(50 - prevPerf),
      governmentFatigue: round2(Math.min(ageDays, 365) / 365 * 5),
      majorScandals: scandals * 5,
      corruptionLevel: round2(corruption - 50),
      unemployment: round2(unemployment - 50),
      inflation: round2(inflation - 50),
      publicServices: round2(50 - services),
      welfarePerformance: round2(50 - welfare),
      localIssuesSeverity: round2(localSeverity - 50),
    };

    // Deterministic small jitter keyed on the incumbent's identity.
    const jitter = seededFloat(
      createRng("anti:" + incumbent.partyId + ":" + ageDays),
      -3,
      3
    );

    const raw =
      factors.governmentPerformance * 0.35 +
      factors.previousElectionPerformance * 0.1 +
      factors.governmentFatigue +
      factors.majorScandals +
      factors.corruptionLevel * 0.2 +
      factors.unemployment * 0.15 +
      factors.inflation * 0.1 +
      factors.publicServices * 0.2 +
      factors.welfarePerformance * 0.1 +
      factors.localIssuesSeverity * 0.1 +
      jitter;

    const score = round2(clamp(raw, this.range.min, this.range.max));
    return { incumbentPartyId: incumbent.partyId, score, factors };
  }
}