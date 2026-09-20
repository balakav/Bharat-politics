// =============================================================================
// Pipeline — wires the agents together:
//   DemographicAgent + AntiIncumbencyAgent → VoterAgent → ElectionAgent
//   → Constituency Result → (caller aggregates) State / National Result.
// Includes sample input/output for testing. Deterministic end to end.
// =============================================================================
import {
  ConstituencyInput, ConstituencyResult, ElectionWeights, VoterData,
} from "./types.ts";
import { DemographicAgent } from "./DemographicAgent.ts";
import { AntiIncumbencyAgent } from "./AntiIncumbencyAgent.ts";
import { VoterAgent } from "./VoterAgent.ts";
import { ElectionAgent } from "./ElectionAgent.ts";
import { createRng, seededInt } from "./rng.ts";

const demographicAgent = new DemographicAgent();
const voterAgent = new VoterAgent();

/** Full pipeline for one constituency. Returns an auditable result. */
export function runConstituency(
  constituency: ConstituencyInput,
  weights?: Partial<ElectionWeights>,
  antiIncumbencyRange?: { min: number; max: number }
): ConstituencyResult {
  try {
    if (!constituency || !Array.isArray(constituency.candidates) || constituency.candidates.length === 0) {
      return _error(constituency, "constituency must have at least one candidate");
    }
    if (constituency.candidates.some(c => !c || !c.key || !c.partyId)) {
      return _error(constituency, "every candidate needs a key and a partyId");
    }
    const seen = new Set<string>();
    for (const c of constituency.candidates) {
      if (seen.has(c.key)) return _error(constituency, "duplicate candidate key: " + c.key);
      seen.add(c.key);
    }

    // 1) Demographic Agent (validates / synthesizes voter blocks first).
    const groups: VoterData = demographicAgent.buildVoterData(constituency);
    const validationErrors = demographicAgent.validateVoterData(groups);
    if (validationErrors.length > 0) {
      return _error(constituency, "invalid voter data: " + validationErrors.join("; "));
    }
    const demographic = demographicAgent.calculate(constituency, groups);

    // 2) Anti-Incumbency Agent.
    const antiIncumbencyAgent = new AntiIncumbencyAgent(antiIncumbencyRange);
    const antiIncumbency = constituency.incumbent
      ? antiIncumbencyAgent.calculate(constituency.incumbent)
      : null;

    // 3) Voter Agent.
    const turnoutPct = voterAgent.calculateTurnout(constituency, demographic);
    const voterResult = voterAgent.distributeVotes(constituency, demographic, antiIncumbency, turnoutPct);
    if (voterResult.votesCast > voterResult.totalVoters) {
      return _error(constituency, "votesCast exceeded totalVoters");
    }

    // 4) Election Agent — final weighted result.
    const electionAgent = new ElectionAgent(weights);
    const localIssues = constituency.localIssues ??
      seededInt(createRng("issues:" + (constituency.seed || constituency.id)), 25, 65);
    const final = electionAgent.combine(
      { ...constituency, localIssues },
      demographic,
      antiIncumbency,
      voterResult
    );

    const candidateSum = Object.values(final.candidateVotes).reduce((a, b) => a + b, 0);
    if (candidateSum !== voterResult.votesCast) {
      return _error(constituency, "vote total validation failed: " + candidateSum + " != " + voterResult.votesCast);
    }
    for (const v of Object.values(final.candidateVotes)) {
      if (v < 0) return _error(constituency, "negative votes produced");
    }

    return {
      constituencyId: constituency.id,
      stateId: constituency.stateId,
      ok: true,
      winnerKey: final.winnerKey,
      winnerPartyId: final.winnerPartyId,
      totalVoters: voterResult.totalVoters,
      votesCast: voterResult.votesCast,
      turnoutPct: voterResult.turnoutPct,
      candidateVotes: final.candidateVotes,
      partyVotes: final.partyVotes,
      audit: final.audit,
    };
  } catch (e) {
    return _error(constituency, "simulation failed: " + (e && (e as Error).message ? (e as Error).message : String(e)));
  }
}

function _error(constituency: ConstituencyInput | undefined, message: string): ConstituencyResult {
  return {
    constituencyId: constituency?.id || "unknown",
    stateId: constituency?.stateId,
    ok: false,
    error: message,
    totalVoters: 0,
    votesCast: 0,
    turnoutPct: 0,
    candidateVotes: {},
    partyVotes: {},
    audit: { demographic: { groups: { totalVoters: 0, women: 0, men: 0, youth: 0, urban: 0, rural: 0 }, partyEffects: {}, breakdown: {} }, antiIncumbency: null, candidates: [] },
  };
}

/** Runs many constituencies and aggregates a state/national-level result. */
export function runSimulation(
  constituencies: ConstituencyInput[],
  weights?: Partial<ElectionWeights>,
  antiIncumbencyRange?: { min: number; max: number }
) {
  const results = (constituencies || []).map(c => runConstituency(c, weights, antiIncumbencyRange));
  const partySeats: Record<string, number> = {};
  for (const r of results) {
    if (r.ok && r.winnerPartyId) partySeats[r.winnerPartyId] = (partySeats[r.winnerPartyId] || 0) + 1;
  }
  const failures = results.filter(r => !r.ok).length;
  return {
    status: failures === 0 ? "success" : failures === results.length ? "error" : "partial",
    total: results.length,
    failed: failures,
    partySeats,
    constituencies: results.map(r => ({
      constituencyId: r.constituencyId,
      stateId: r.stateId,
      ok: r.ok,
      error: r.error,
      winnerKey: r.winnerKey,
      winnerPartyId: r.winnerPartyId,
      totalVoters: r.totalVoters,
      votesCast: r.votesCast,
      turnoutPct: r.turnoutPct,
      candidateVotes: r.candidateVotes,
      partyVotes: r.partyVotes,
      audit: r.audit,
    })),
  };
}

// ---- Sample input / output for testing ---------------------------------------

export const SAMPLE_INPUT = {
  weights: {
    partyStrength: 1.0, candidatePopularity: 0.2, governmentPerformance: 0.15,
    antiIncumbency: 0.15, campaignStrength: 0.15, localIssues: 0.1,
    demographicEffect: 0.1, allianceEffect: 0.1, tacticalVoting: 0.05,
  },
  constituencies: [
    {
      id: "Hastinapura LS 001", stateId: "HAS", seed: "HAS-LS-001",
      parties: ["Bharat Progress Party", "People's Unity Party", "Democratic Progress Party"],
      candidates: [
        { key: "cand-1", partyId: "Bharat Progress Party", candidatePopularity: 62, campaignStrength: 58 },
        { key: "cand-2", partyId: "People's Unity Party", candidatePopularity: 48, campaignStrength: 52 },
        { key: "cand-3", partyId: "Democratic Progress Party", candidatePopularity: 55, campaignStrength: 60 },
      ],
      partyStrength: { "Bharat Progress Party": 58, "People's Unity Party": 42, "Democratic Progress Party": 50 },
      allianceEffect: { "Bharat Progress Party": 55, "People's Unity Party": 50, "Democratic Progress Party": 62 },
      tacticalVoting: { "Bharat Progress Party": 55, "People's Unity Party": 45, "Democratic Progress Party": 52 },
      localIssues: 58,
      incumbent: {
        partyId: "Bharat Progress Party", governmentPerformance: 44,
        previousElectionPerformance: 55, governmentAgeDays: 210,
        majorScandals: 1, corruptionLevel: 55, unemployment: 52,
        inflation: 48, publicServices: 44, welfarePerformance: 58, localIssuesSeverity: 58,
      },
    },
    {
      id: "Cheralam AC 014", stateId: "CHE", seed: "CHE-AC-014",
      parties: ["People's Unity Party", "Democratic Progress Party"],
      candidates: [
        { key: "cand-4", partyId: "People's Unity Party", candidatePopularity: 51, campaignStrength: 47 },
        { key: "cand-5", partyId: "Democratic Progress Party", candidatePopularity: 57, campaignStrength: 66 },
      ],
      partyStrength: { "People's Unity Party": 46, "Democratic Progress Party": 60 },
      allianceEffect: { "People's Unity Party": 50, "Democratic Progress Party": 50 },
      tacticalVoting: { "People's Unity Party": 50, "Democratic Progress Party": 58 },
      localIssues: 38,
    },
  ],
};

/** Runs the sample input so callers get matching sample output. */
export function runSample() {
  const sim = runSimulation(SAMPLE_INPUT.constituencies, SAMPLE_INPUT.weights);
  return { input: SAMPLE_INPUT, output: sim };
}