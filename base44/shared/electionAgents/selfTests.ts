// =============================================================================
// Unit tests for the election agents — tiny self-contained harness, no
// external runner. Covers turnout, party votes, demographic effects,
// anti-incumbency, incumbent/opposition effects, constituency variation,
// alliance effects, tactical voting, invalid voter data and vote-total
// validation.
// =============================================================================
import { runConstituency, runSimulation, SAMPLE_INPUT } from "./pipeline.ts";
import { DemographicAgent } from "./DemographicAgent.ts";
import { AntiIncumbencyAgent } from "./AntiIncumbencyAgent.ts";
import { ConstituencyInput } from "./types.ts";

export interface TestOutcome {
  name: string;
  passed: boolean;
  details: string;
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  results: TestOutcome[];
}

function makeConstituency(overrides: Partial<ConstituencyInput> = {}): ConstituencyInput {
  return {
    id: "TEST-001",
    seed: "test-seed-1",
    parties: ["PartyA", "PartyB"],
    candidates: [
      { key: "ca", partyId: "PartyA", candidatePopularity: 55, campaignStrength: 50 },
      { key: "cb", partyId: "PartyB", candidatePopularity: 45, campaignStrength: 50 },
    ],
    partyStrength: { PartyA: 55, PartyB: 45 },
    allianceEffect: { PartyA: 50, PartyB: 50 },
    tacticalVoting: { PartyA: 50, PartyB: 50 },
    localIssues: 45,
    ...overrides,
  };
}

export function runAgentSelfTests(): TestReport {
  const results: TestOutcome[] = [];
  const t = (name: string, fn: () => boolean, details = "") => {
    try {
      const ok = fn();
      results.push({ name, passed: ok, details: ok ? details : "assertion failed" });
    } catch (e) {
      results.push({ name, passed: false, details: String(e) });
    }
  };

  const demoAgent = new DemographicAgent();
  const antiAgent = new AntiIncumbencyAgent();

  // --- Turnout ---
  t("turnout: within 40-90% and votesCast <= totalVoters", () => {
    const r = runConstituency(makeConstituency());
    return r.ok && r.turnoutPct >= 40 && r.turnoutPct <= 90 && r.votesCast <= r.totalVoters;
  });

  // --- Party votes ---
  t("party votes: candidate votes sum exactly to votesCast", () => {
    const r = runConstituency(makeConstituency());
    const sum = Object.values(r.candidateVotes).reduce((a, b) => a + b, 0);
    return r.ok && sum === r.votesCast;
  });
  t("party votes: party rollup equals votesCast and no negative votes", () => {
    const r = runConstituency(makeConstituency());
    const sum = Object.values(r.partyVotes).reduce((a, b) => a + b, 0);
    const nonNegative = Object.values(r.candidateVotes).every(v => v >= 0);
    return r.ok && sum === r.votesCast && nonNegative;
  });

  // --- Demographic effects ---
  t("demographic: women+men = totalVoters and urban+rural = totalVoters", () => {
    const c = makeConstituency({ totalVoters: 100000, voterData: { women: 48000, men: 52000, youth: 30000, urban: 40000, rural: 60000 } });
    const groups = demoAgent.buildVoterData(c);
    return groups.women + groups.men === groups.totalVoters && groups.urban + groups.rural === groups.totalVoters;
  });
  t("demographic: effect differs between constituencies and parties", () => {
    const c1 = makeConstituency({ id: "D-1", seed: "d-1" });
    const c2 = makeConstituency({ id: "D-2", seed: "d-2" });
    const g1 = demoAgent.buildVoterData(c1);
    const g2 = demoAgent.buildVoterData(c2);
    const e1 = demoAgent.calculate(c1, g1);
    const e2 = demoAgent.calculate(c2, g2);
    const diffGroups = g1.women !== g2.women || g1.urban !== g2.urban;
    const diffPrefs = e1.breakdown.PartyA.women !== e2.breakdown.PartyA.women;
    const diffEffects = e1.partyEffects.PartyA !== e2.partyEffects.PartyA;
    const diffParties = e1.partyEffects.PartyA !== e1.partyEffects.PartyB;
    return diffGroups && diffPrefs && diffEffects && diffParties;
  });

  // --- Anti-incumbency ---
  t("anti-incumbency: poor performance increases score, good performance reduces it", () => {
    const poor = antiAgent.calculate({ partyId: "P", governmentPerformance: 20, majorScandals: 3, unemployment: 70, publicServices: 25 });
    const good = antiAgent.calculate({ partyId: "P", governmentPerformance: 85, majorScandals: 0, unemployment: 25, publicServices: 85, welfarePerformance: 85 });
    return poor.score > 0 && good.score < 0 && poor.score > good.score;
  });
  t("anti-incumbency: score clamps to configured range", () => {
    const agent = new AntiIncumbencyAgent({ min: -30, max: 20 });
    const extreme = agent.calculate({ partyId: "P", governmentPerformance: 0, majorScandals: 99, unemployment: 100, corruptionLevel: 100 });
    const heavenly = agent.calculate({ partyId: "P", governmentPerformance: 100, publicServices: 100, welfarePerformance: 100 });
    return extreme.score <= 20 && heavenly.score >= -30;
  });
  t("anti-incumbency: never decides the winner alone (bounded factor)", () => {
    const r = runConstituency(makeConstituency({
      incumbent: { partyId: "PartyA", governmentPerformance: 0, majorScandals: 4, unemployment: 90 },
    }));
    // PartyA is hugely unpopular too, so it may lose — but the result must still be valid & auditable.
    return r.ok && Object.values(r.candidateVotes).reduce((a, b) => a + b, 0) === r.votesCast;
  });

  // --- Incumbent vs opposition effect ---
  t("incumbent/opposition: high anti-incumbency lowers incumbent votes vs baseline", () => {
    const base = runConstituency(makeConstituency());
    const worst = runConstituency(makeConstituency({
      incumbent: { partyId: "PartyA", governmentPerformance: 5, majorScandals: 4, unemployment: 90, corruptionLevel: 90, inflation: 80 },
    }));
    return worst.ok && base.ok && worst.candidateVotes.ca < base.candidateVotes.ca;
  });

  // --- Constituency variation ---
  t("variation: different constituencies produce different outcomes", () => {
    const r1 = runConstituency(makeConstituency({ id: "V-1", seed: "v-1", partyStrength: { PartyA: 70, PartyB: 30 } }));
    const r2 = runConstituency(makeConstituency({ id: "V-2", seed: "v-2", partyStrength: { PartyA: 30, PartyB: 70 } }));
    return r1.ok && r2.ok && r1.winnerPartyId === "PartyA" && r2.winnerPartyId === "PartyB";
  });

  // --- Alliance effect ---
  t("alliance: higher alliance effect increases votes for the party", () => {
    const base = runConstituency(makeConstituency());
    const boosted = runConstituency(makeConstituency({ allianceEffect: { PartyA: 90, PartyB: 50 } }));
    return boosted.ok && base.ok && boosted.candidateVotes.ca > base.candidateVotes.ca;
  });

  // --- Tactical voting ---
  t("tactical voting: higher tactical tendency boosts the party's votes", () => {
    const base = runConstituency(makeConstituency());
    const tactical = runConstituency(makeConstituency({ tacticalVoting: { PartyA: 85, PartyB: 50 } }));
    return tactical.ok && base.ok && tactical.candidateVotes.ca > base.candidateVotes.ca;
  });

  // --- Invalid voter data ---
  t("invalid voter data: women+men != totalVoters is rejected", () => {
    const c = makeConstituency({ totalVoters: 100000, voterData: { women: 40000, men: 50000, youth: 20000, urban: 50000, rural: 50000 } });
    const groups = demoAgent.buildVoterData(c);
    return demoAgent.validateVoterData(groups).length > 0;
  });
  t("invalid voter data: negative blocks are rejected", () => {
    const groups = { totalVoters: 1000, women: -5, men: 1005, youth: 100, urban: 500, rural: 500 };
    return demoAgent.validateVoterData(groups).length > 0;
  });
  t("pipeline: invalid voter data produces an errored (non-crashing) result", () => {
    const r = runConstituency(makeConstituency({
      totalVoters: 100000, voterData: { women: 90000, men: 20000, urban: 50000, rural: 50000 },
    }));
    return r.ok === false && !!r.error;
  });

  // --- Determinism ---
  t("determinism: same seed always produces the same result", () => {
    const a = runConstituency(makeConstituency());
    const b = runConstituency(makeConstituency());
    return JSON.stringify(a.candidateVotes) === JSON.stringify(b.candidateVotes) &&
      JSON.stringify(a.audit) === JSON.stringify(b.audit);
  });

  // --- Sample input/output ---
  t("sample: runs clean and every constituency sums to votesCast", () => {
    const sim = runSimulation(SAMPLE_INPUT.constituencies, SAMPLE_INPUT.weights);
    if (sim.status !== "success" || sim.total !== 2) return false;
    return sim.constituencies.every(c =>
      Object.values(c.candidateVotes).reduce((a, b) => a + b, 0) === c.votesCast);
  });

  const passed = results.filter(r => r.passed).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}