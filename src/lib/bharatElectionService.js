
// =============================================================================
// Bharatvarsha election service — admin-driven lifecycle for all 21 states.
// Single reusable engine: create → open voting → declare results. No per-state
// code; everything is driven by bharatStates config + the Election entity.
// =============================================================================
import { bharat01 } from "@/api/bharat01Client";
import {
  getStateById, generateAssemblyConstituencies, generateLokSabhaConstituencies,
  BHARAT_STATES, NATION,
} from "@/lib/bharatStates";
import { generateAIName } from "@/lib/gameData";

// ---- Constituency resolution (data-driven, never hardcoded) -----------------

export function getConstituenciesForElection(election) {
  if (!election?.state_id) return [];
  const state = getStateById(election.state_id);
  if (!state) return [];
  let names = [];
  if (election.election_type === "vidhan_sabha") names = generateAssemblyConstituencies(state).map(c => c.name);
  else if (election.election_type === "lok_sabha") names = generateLokSabhaConstituencies(state).map(c => c.name);
  else return [];
  // By-election: only the vacated constituency is contested.
  if (election.cycle_key === "by_election") {
    return names.filter(n => election.title.includes(n));
  }
  return names;
}

// All 21 states' Lok Sabha constituencies — used by the national election.
export function getNationalConstituencies() {
  const all = [];
  for (const s of BHARAT_STATES) {
    for (const c of generateLokSabhaConstituencies(s)) all.push({ name: c.name, state_id: s.id, state_name: s.name });
  }
  return all;
}

export function getPositionForElection(electionType) {
  if (electionType === "vidhan_sabha") return "MLA";
  if (electionType === "lok_sabha" || electionType === "national") return "MP";
  return "Member";
}

export function getGovernmentHeadTitle(electionType) {
  if (electionType === "vidhan_sabha") return "Chief Minister";
  if (electionType === "lok_sabha" || electionType === "national") return "Prime Minister";
  return "Leader";
}

// ---- Admin lifecycle --------------------------------------------------------

export async function createElection(stateId, electionType) {
  const state = getStateById(stateId);
  if (!state) throw new Error("Unknown state: " + stateId);
  const isLokSabha = electionType === "lok_sabha";
  const seats = isLokSabha ? state.lokSabhaSeats : state.assemblySeats;
  const majority = isLokSabha ? Math.floor(state.lokSabhaSeats / 2) + 1 : state.assemblyMajority;
  const title = `${state.name} ${isLokSabha ? "Lok Sabha" : "Assembly"} Election`;
  const existing = await bharat01.entities.Election.filter({ state_id: stateId, election_type: electionType, results_declared: false });
  if (existing.length > 0) return existing[0];
  return await bharat01.entities.Election.create({
    election_type: electionType,
    title,
    state_id: stateId,
    state_name: state.name,
    status: "campaign",
    campaign_start: new Date().toISOString(),
    total_seats: seats,
    majority_mark: majority,
    results_declared: false,
  });
}

export async function createNationalElection() {
  const existing = await bharat01.entities.Election.filter({ election_type: "national", results_declared: false });
  if (existing.length > 0) return existing[0];
  return await bharat01.entities.Election.create({
    election_type: "national",
    title: `${NATION.name} General Election (Lok Sabha)`,
    state_id: "",
    state_name: NATION.name,
    status: "campaign",
    campaign_start: new Date().toISOString(),
    total_seats: NATION.lokSabhaSeats,
    majority_mark: NATION.lokSabhaMajority,
    results_declared: false,
  });
}

// Admin by-election: one vacated constituency (MLA or MP seat) goes back to
// the polls as a standalone single-seat election.
export async function createByElection(stateId, electionType, constituency) {
  const state = getStateById(stateId);
  if (!state) throw new Error("Unknown state: " + stateId);
  if (!constituency) throw new Error("Constituency is required");
  const existing = await bharat01.entities.Election.filter({ state_id: stateId, election_type: electionType, results_declared: false });
  const already = existing.find(e => e.cycle_key === "by_election" && e.title.includes(constituency));
  if (already) return already;
  return await bharat01.entities.Election.create({
    election_type: electionType,
    title: `${state.name} By-Election — ${constituency}`,
    cycle_key: "by_election",
    state_id: stateId,
    state_name: state.name,
    status: "campaign",
    campaign_start: new Date().toISOString(),
    total_seats: 1,
    majority_mark: 1,
    results_declared: false,
  });
}

export async function setElectionStatus(electionId, status) {
  return await bharat01.entities.Election.update(electionId, { status });
}

// ---- AI candidate generation (national parties, not TN) ---------------------

function makeAICandidate(election, constituency, party, index) {
  const suffix = Date.now().toString(36).toUpperCase() + index;
  return {
    election_id: election.id,
    election_type: election.election_type,
    player_id: 'AI_' + suffix + Math.random().toString(36).substring(2, 5).toUpperCase(),
    player_name: generateAIName(),
    party_name: party.name,
    party_short: party.short_name,
    party_id: party.id,
    constituency,
    seat_type: 'general',
    manifesto: 'Committed to the development of ' + constituency,
    campaign_budget: 0,
    result: 'pending',
    ticket_status: 'approved',
    ticket_number: 'AI-' + suffix,
    registration_number: 'AI-' + suffix + Math.random().toString(36).substring(2, 4).toUpperCase(),
  };
}

// AI candidates only stand under parties ACTUALLY participating in this
// election — never static/preset party names. If no party has registered,
// the AI candidates stand as Independents.
function generateAIForConstituency(election, constituency, count, participatingParties) {
  const pool = (participatingParties && participatingParties.length > 0)
    ? [...participatingParties].sort(() => Math.random() - 0.5)
    : [{ id: "", name: "Independent", short_name: "IND" }];
  const shuffled = pool.slice(0, count);
  return shuffled.map((p, i) => makeAICandidate(election, constituency, p, i));
}

// ---- Result declaration (the reusable counting engine) ----------------------

export async function declareResults(electionId) {
  const el = await bharat01.entities.Election.get(electionId);
  if (el.results_declared) return { alreadyDeclared: true, election: el };

  // Build the constituency list for this election.
  let constituencyList;
  if (el.election_type === "national") {
    constituencyList = getNationalConstituencies(); // [{name, state_id, state_name}]
  } else {
    const names = getConstituenciesForElection(el);
    const state = getStateById(el.state_id);
    constituencyList = names.map(n => ({ name: n, state_id: el.state_id, state_name: el.state_name || state?.name }));
  }

  // Existing player candidatures.
  const existingCands = await bharat01.entities.Candidature.filter({ election_id: el.id }, '-votes_received', 5000);
  const registeredConstituencies = new Set(existingCands.map(c => c.constituency));
  // By-election: contest only the vacated constituency (the one with registered candidates).
  if (el.cycle_key === "by_election") {
    constituencyList = constituencyList.filter(c => registeredConstituencies.has(c.name));
  }

  // The parties participating in this election (from the registered
  // candidatures) — AI candidates only stand under these parties.
  const participatingParties = [];
  const seenParties = new Set();
  for (const c of existingCands) {
    if (c.party_id && c.party_name && !seenParties.has(c.party_id)) {
      seenParties.add(c.party_id);
      participatingParties.push({ id: c.party_id, name: c.party_name, short_name: c.party_short || "" });
    }
  }
  // Generate AI candidates for every constituency without a registered candidate.
  const aiCandidates = [];
  let aiIndex = 0;
  for (const con of constituencyList) {
    if (!registeredConstituencies.has(con.name)) {
      const cands = generateAIForConstituency(el, con.name, 2, participatingParties);
      for (const c of cands) aiCandidates.push({ ...c, _state_id: con.state_id, _state_name: con.state_name });
      aiIndex++;
    }
  }
  for (let i = 0; i < aiCandidates.length; i += 400) {
    const batch = aiCandidates.slice(i, i + 400).map(({ _state_id, _state_name, ...rest }) => rest);
    await bharat01.entities.Candidature.bulkCreate(batch);
  }

  const allCandidates = await bharat01.entities.Candidature.filter({ election_id: el.id }, '-votes_received', 5000);

  // Vote bonuses: development projects, public votes, alliance campaigns.
  const allProjects = await bharat01.entities.DevelopmentProject.list('-created_date', 5000);
  const publicVoteCounts = {};
  try {
    const publicVotes = await bharat01.entities.PublicVote.filter({ election_id: el.id });
    for (const pv of publicVotes) publicVoteCounts[pv.candidature_id] = (publicVoteCounts[pv.candidature_id] || 0) + 1;
  } catch (e) {}
  const alliancePartyBonus = {};
  try {
    const alliances = await bharat01.entities.Alliance.list();
    const allCamps = await bharat01.entities.Campaign.list('-created_date', 5000);
    for (const ac of allCamps.filter(c => c.alliance_id)) {
      const alliance = alliances.find(a => a.id === ac.alliance_id);
      if (!alliance) continue;
      for (const partyName of (alliance.member_party_names || [])) {
        alliancePartyBonus[partyName] = (alliancePartyBonus[partyName] || 0) + (ac.impact || 0);
      }
    }
  } catch (e) {}

  // Anti-incumbency from VALIDATED protests: every approved protest against
  // the ruling party at this election's scope reduces its candidates' votes.
  const elIsNational = el.election_type === "national";
  const protestPenalty = {};
  try {
    const approved = await bharat01.entities.Protest.filter({ status: "approved" });
    for (const pr of approved) {
      const inScope = elIsNational ? pr.scope === "national" : (pr.scope === "state" && pr.state_id === el.state_id);
      if (!inScope || !pr.target_party_name) continue;
      protestPenalty[pr.target_party_name] = (protestPenalty[pr.target_party_name] || 0) + (pr.impact || 5);
    }
  } catch (e) {}

  // Group by constituency and compute votes + winner.
  const groups = {};
  for (const c of allCandidates) {
    if (!groups[c.constituency]) groups[c.constituency] = [];
    groups[c.constituency].push(c);
  }

  const allUpdates = [];
  const allWinners = [];
  for (const [constituency, groupCands] of Object.entries(groups)) {
    const totalVotes = 30000 + Math.floor(Math.random() * 40000);
    const baseVote = totalVotes / groupCands.length;
    const withVotes = groupCands.map(c => {
      const variation = baseVote * 0.8;
      const devProjects = allProjects.filter(p => p.player_id === c.player_id && p.constituency === c.constituency);
      const devBonus = devProjects.reduce((sum, p) => sum + (p.impact || 0), 0);
      const devMultiplier = 1 + Math.min(devBonus / 100, 0.5);
      const allianceBonus = alliancePartyBonus[c.party_name] || 0;
      const allianceMultiplier = 1 + Math.min(allianceBonus / 100, 0.3);
      const publicVoteBonus = (publicVoteCounts[c.id] || 0) * 500;
      const protestHit = protestPenalty[c.party_name] || 0;
      const protestMultiplier = Math.max(0.6, 1 - protestHit / 100);
      const votes = Math.max(100, Math.floor((baseVote + (Math.random() - 0.3) * variation) * devMultiplier * allianceMultiplier * protestMultiplier) + publicVoteBonus);
      return { ...c, votes_received: votes };
    });
    const groupWinner = withVotes.reduce((a, b) => (a.votes_received > b.votes_received ? a : b));
    allWinners.push(groupWinner);
    for (const c of withVotes) {
      allUpdates.push({ id: c.id, votes_received: c.votes_received, result: c.id === groupWinner.id ? 'won' : 'lost' });
    }
  }

  for (let i = 0; i < allUpdates.length; i += 400) {
    await bharat01.entities.Candidature.bulkUpdate(allUpdates.slice(i, i + 400));
  }

  await bharat01.entities.Election.update(el.id, { status: "completed", results_declared: true });

  // Update player profiles (winners/losers) — AI candidates skipped.
  for (const winner of allWinners) {
    if (!winner.player_id || winner.player_id.startsWith('AI_')) continue;
    const profiles = await bharat01.entities.PlayerProfile.filter({ player_id: winner.player_id });
    if (profiles.length > 0) {
      const p = profiles[0];
      await bharat01.entities.PlayerProfile.update(p.id, {
        elections_won: (p.elections_won || 0) + 1,
        position_held: getPositionForElection(el.election_type),
        salary_multiplier: (p.salary_multiplier || 1) * 2,
      });
    }
  }
  for (const c of allCandidates) {
    const u = allUpdates.find(u => u.id === c.id);
    if (!u || u.result === 'won') continue;
    if (!c.player_id || c.player_id.startsWith('AI_')) continue;
    const loserProfiles = await bharat01.entities.PlayerProfile.filter({ player_id: c.player_id });
    if (loserProfiles.length > 0) {
      await bharat01.entities.PlayerProfile.update(loserProfiles[0].id, { position_held: "None" });
    }
  }

  // Save permanent ElectionRecords (state-aware, no duplicates for this cycle).
  const todayStr = new Date().toISOString().split('T')[0];
  await bharat01.entities.ElectionRecord.deleteMany({ election_id: el.id });
  const recordsToCreate = [];
  for (const winner of allWinners) {
    const groupCands = groups[winner.constituency] || [];
    const sorted = [...groupCands].sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
    const runnerUp = sorted[1];
    const conMeta = constituencyList.find(c => c.name === winner.constituency);
    recordsToCreate.push({
      election_type: el.election_type,
      election_title: el.title,
      election_id: el.id,
      election_date: todayStr,
      state_id: conMeta?.state_id || el.state_id || "",
      state_name: conMeta?.state_name || el.state_name || "",
      position_title: getPositionForElection(el.election_type),
      winner_name: winner.player_name,
      winner_party: winner.party_name || 'Independent',
      winner_party_short: winner.party_short || 'IND',
      winner_is_ai: (winner.player_id || '').startsWith('AI_'),
      winner_player_id: winner.player_id || '',
      constituency: winner.constituency,
      seat_type: winner.seat_type || 'general',
      winner_votes: winner.votes_received || 0,
      runner_up_name: runnerUp?.player_name || '',
      runner_up_party: runnerUp?.party_name || '',
      runner_up_votes: runnerUp?.votes_received || 0,
      vote_margin: (winner.votes_received || 0) - (runnerUp?.votes_received || 0),
    });
  }
  for (let i = 0; i < recordsToCreate.length; i += 400) {
    await bharat01.entities.ElectionRecord.bulkCreate(recordsToCreate.slice(i, i + 400));
  }

  // Government formation news + Government record.
  const partyCounts = {};
  for (const winner of allWinners) {
    const party = winner.party_name || 'Independent';
    partyCounts[party] = (partyCounts[party] || 0) + 1;
  }
  const majorityMark = el.majority_mark || 0;
  const sortedParties = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);
  const topParty = sortedParties[0];
  let govStatus = "hung";
  let rulingParty = topParty?.[0] || "Unknown";
  let rulingSeats = topParty?.[1] || 0;
  if (rulingSeats >= majorityMark) {
    govStatus = "majority";
  } else if (sortedParties.length > 1 && (sortedParties[0][1] + sortedParties[1][1]) >= majorityMark) {
    govStatus = "coalition";
    rulingParty = `${sortedParties[0][0]} + ${sortedParties[1][0]}`;
    rulingSeats = sortedParties[0][1] + sortedParties[1][1];
  }

  const isNational = el.election_type === "national";
  const scopeState = !isNational && el.state_id ? getStateById(el.state_id) : null;
  const scopeName = isNational ? NATION.name : (el.state_name || scopeState?.name || "Bharat");
  await bharat01.entities.NewsItem.create({
    title: `🏆 ${rulingParty} ${govStatus === "majority" ? "wins absolute majority" : govStatus === "coalition" ? "forms coalition" : "leads in hung house"} with ${rulingSeats} seats`,
    content: `${scopeName}: ${rulingParty} has ${rulingSeats} seats in the ${el.title}. Majority mark: ${majorityMark}. ${govStatus === "majority" ? "Government formation confirmed." : govStatus === "coalition" ? "Coalition government to be formed." : "Hung — no party crossed the majority mark."}`,
    category: "tv99",
    source: "TV99 Bharat",
    related_type: "election_result",
    related_id: el.id,
  });

  // Government formation is ADMIN-DRIVEN now: after results, no government forms
  // automatically. The admin sends a Formation Request to the winning / single
  // largest party (Admin → Formation tab), and that party's president proves
  // majority (own seats or an alliance) at /formation-requests before the
  // Government record is created. Fallback: President's Rule (admin action).

  return {
    election: { ...el, status: "completed", results_declared: true },
    totalConstituencies: allWinners.length,
    partyCounts,
    majorityMark,
    govStatus,
    rulingParty,
    rulingSeats,
  };
}