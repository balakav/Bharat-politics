
import { base44 } from "@/api/base44Client";

// Central election-results source: ONE cached loader that every screen reads
// from (Assembly, Past Results, Election Data, Parliament), so results are
// identical everywhere. A 30s TTL keeps all screens consistent while sparing
// the API rate limit.

const TTL = 30000;
const cache = new Map();

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  const data = await loader();
  cache.set(key, { data, expires: Date.now() + TTL });
  return data;
}

export function invalidateResultsCache() { cache.clear(); }

// All completed Bharat elections (national + state), newest first.
export async function getCompletedElections() {
  return cached("elections:completed", async () => {
    const all = await base44.entities.Election.filter({ results_declared: true });
    return all
      .filter(e => e.election_type === "national" || e.state_id)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  });
}

// Latest completed election of a type ("vidhan_sabha" / "national") for a state.
export async function getCompletedElection(type, stateId = "") {
  const all = await getCompletedElections();
  return all.find(e => e.election_type === type && (!stateId || e.state_id === stateId)) || null;
}

// Winning candidatures of a completed election.
export async function getElectionWinners(electionId) {
  return cached("winners:" + electionId, () =>
    base44.entities.Candidature.filter({ election_id: electionId, result: "won" }, undefined, 1000));
}

// { election, winners } for a state assembly.
export async function getAssemblyResults(stateId) {
  const election = await getCompletedElection("vidhan_sabha", stateId);
  if (!election) return { election: null, winners: [] };
  return { election, winners: await getElectionWinners(election.id) };
}

// { election, winners } for the national Lok Sabha.
export async function getNationalResults() {
  const election = await getCompletedElection("national");
  if (!election) return { election: null, winners: [] };
  return { election, winners: await getElectionWinners(election.id) };
}

// Permanent election records (winners archive).
export async function getElectionRecords() {
  return cached("records", () => base44.entities.ElectionRecord.list("-election_date", 1000));
}