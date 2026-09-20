// =============================================================================
// Types — the shared contract between the election agents:
//   DemographicAgent + AntiIncumbencyAgent → VoterAgent → ElectionAgent
// =============================================================================

/** Explicit voter block data for a constituency (any block may be omitted). */
export interface VoterData {
  totalVoters: number;
  women: number;
  men: number;
  youth: number;
  urban: number;
  rural: number;
}

/** Incumbent-party record feeding the Anti-Incumbency Agent. */
export interface IncumbentData {
  partyId: string;
  governmentPerformance?: number;      // 0-100 satisfaction
  previousElectionPerformance?: number; // 0-100
  governmentAgeDays?: number;
  majorScandals?: number;
  corruptionLevel?: number;           // 0-100
  unemployment?: number;              // 0-100 (higher = worse)
  inflation?: number;                 // 0-100 (higher = worse)
  publicServices?: number;            // 0-100 satisfaction
  welfarePerformance?: number;        // 0-100 satisfaction
  localIssuesSeverity?: number;       // 0-100 (higher = worse)
}

export interface CandidateInput {
  key: string;
  partyId: string;
  candidatePopularity?: number;  // 0-100
  campaignStrength?: number;     // 0-100
}

export interface ConstituencyInput {
  id: string;
  seed?: string;
  stateId?: string;
  totalVoters?: number;
  voterData?: Partial<VoterData>;
  parties: string[];
  candidates: CandidateInput[];
  partyStrength?: Record<string, number>;    // 0-100
  allianceEffect?: Record<string, number>;   // 0-100
  tacticalVoting?: Record<string, number>;   // 0-100
  localIssues?: number;                       // 0-100 severity
  incumbent?: IncumbentData;
}

export interface DemographicResult {
  groups: VoterData;
  /** Aggregated -N..+N vote effect per party from voter blocks. */
  partyEffects: Record<string, number>;
  /** Per-party preference (0-100) within each voter block. */
  breakdown: Record<string, Record<string, number>>;
}

export interface AntiIncumbencyResult {
  incumbentPartyId: string;
  /** Negative = goodwill, positive = anti-incumbency drag; clamped to range. */
  score: number;
  factors: Record<string, number>;
}

export interface VoterResult {
  totalVoters: number;
  votesCast: number;
  turnoutPct: number;
  partyVotes: Record<string, number>;
  candidateVotes: Record<string, number>;
}

export interface ElectionWeights {
  partyStrength: number;
  candidatePopularity: number;
  governmentPerformance: number;
  antiIncumbency: number;
  campaignStrength: number;
  localIssues: number;
  demographicEffect: number;
  allianceEffect: number;
  tacticalVoting: number;
}

export const DEFAULT_WEIGHTS: ElectionWeights = {
  partyStrength: 1.0,
  candidatePopularity: 0.2,
  governmentPerformance: 0.15,
  antiIncumbency: 0.15,
  campaignStrength: 0.15,
  localIssues: 0.1,
  demographicEffect: 0.1,
  allianceEffect: 0.1,
  tacticalVoting: 0.05,
};

export interface CandidateAudit {
  key: string;
  partyId: string;
  weightedScore: number;
  factors: Record<string, number>;
  votes: number;
  sharePct: number;
}

export interface ConstituencyResult {
  constituencyId: string;
  stateId?: string;
  ok: boolean;
  error?: string;
  winnerKey?: string;
  winnerPartyId?: string;
  totalVoters: number;
  votesCast: number;
  turnoutPct: number;
  candidateVotes: Record<string, number>;
  partyVotes: Record<string, number>;
  audit: {
    demographic: DemographicResult;
    antiIncumbency: AntiIncumbencyResult | null;
    candidates: CandidateAudit[];
  };
}