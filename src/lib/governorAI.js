
import { base44 } from "@/api/base44Client";
import { getStateById, NATION } from "@/lib/bharatStates";
import { generateAIName } from "@/lib/gameData";
import { getGameConfig, getCurrentGameTime } from "@/lib/gameTime";
import { logAction } from "@/lib/audit";

// Governor AI — automated government formation (spec #6/#7).
// Runs AFTER results are declared. Idempotent: skips if ministers already exist.
// Process: invite largest party → prove majority → else coalition with allies +
// next parties → else next largest → else President's Rule (3 in-game days).

const CABINET_PORTFOLIOS = ["Finance", "Home", "Education", "Health", "Infrastructure", "Agriculture"];

function headTitleFor(electionType) {
  if (electionType === "vidhan_sabha") return "Chief Minister";
  if (electionType === "lok_sabha" || electionType === "national") return "Prime Minister";
  return "Leader";
}

export async function runGovernorAI(electionId) {
  const el = await base44.entities.Election.get(electionId);
  if (!el || !el.results_declared) throw new Error("Election not yet completed");
  const isNational = el.election_type === "national";
  const scope = isNational ? "national" : "state";

  const existingGovs = await base44.entities.Government.filter({ election_id: electionId });
  const gov = existingGovs[0];
  if (!gov) throw new Error("No government record — declare results first");

  // Idempotent
  const existingMinisters = await base44.entities.Minister.filter({ government_id: gov.id });
  if (existingMinisters.length > 0) return { alreadyFormed: true, government: gov };

  const config = await getGameConfig();
  const gameTime = (await getCurrentGameTime()).toISOString();

  // Seat counts per party from won candidatures
  const winners = await base44.entities.Candidature.filter({ election_id: electionId, result: "won" }, "-votes_received", 5000);
  const partySeats = {};
  const partyWinners = {};
  for (const w of winners) {
    const p = w.party_name || "Independent";
    partySeats[p] = (partySeats[p] || 0) + 1;
    (partyWinners[p] = partyWinners[p] || []).push(w);
  }
  const sortedParties = Object.entries(partySeats).sort((a, b) => b[1] - a[1]);
  const majorityMark = el.majority_mark || 0;

  let alliances = [];
  try { alliances = await base44.entities.Alliance.list(); } catch (e) {}

  // Governor AI: try each party in order, prove majority alone or via coalition.
  let formed = null;
  const attemptLog = [];
  for (let i = 0; i < sortedParties.length; i++) {
    const [partyName, seats] = sortedParties[i];
    if (seats >= majorityMark) {
      formed = { type: "majority", rulingParties: [partyName], seats, invitedParty: partyName };
      attemptLog.push(`${partyName} invited (${seats} seats) — proven absolute majority.`);
      break;
    }
    // Coalition: alliance partners first, then next largest parties sequentially
    const allyNames = alliances
      .filter(a => (a.member_party_names || []).includes(partyName))
      .flatMap(a => a.member_party_names || [])
      .filter(n => n !== partyName);
    const coalition = [partyName];
    let coalitionSeats = seats;
    for (const ally of allyNames) {
      if (coalitionSeats >= majorityMark) break;
      if (!coalition.includes(ally) && partySeats[ally]) { coalition.push(ally); coalitionSeats += partySeats[ally]; }
    }
    for (let j = i + 1; j < sortedParties.length && coalitionSeats < majorityMark; j++) {
      const [np, ns] = sortedParties[j];
      if (!coalition.includes(np)) { coalition.push(np); coalitionSeats += ns; }
    }
    if (coalitionSeats >= majorityMark) {
      formed = { type: "coalition", rulingParties: coalition, seats: coalitionSeats, invitedParty: partyName };
      attemptLog.push(`${partyName} invited; coalition with ${coalition.slice(1).join(", ")} (${coalitionSeats} seats) — majority proven.`);
      break;
    }
    attemptLog.push(`${partyName} invited (${seats} seats) — failed to prove majority.`);
  }

  const stateObj = !isNational && el.state_id ? getStateById(el.state_id) : null;
  const scopeName = isNational ? NATION.name : (el.state_name || stateObj?.name || "Bharat");

  // ---- President's Rule (no party/coalition proved majority) ----
  if (!formed) {
    const duration = config.president_rule_duration_days || 3;
    const ends = new Date(new Date(gameTime).getTime() + duration * 24 * 3600 * 1000).toISOString();
    await base44.entities.PresidentRule.create({
      state_id: isNational ? "" : (el.state_id || ""),
      state_name: scopeName,
      started_game_time: gameTime,
      ends_game_time: ends,
      duration_days: duration,
      status: "active",
      reason: "No party or coalition could prove majority (Governor AI).",
    });
    await base44.entities.Government.update(gov.id, {
      is_active: false,
      head_player_name: "President's Rule",
      head_player_id: "",
      party_name: "President's Rule",
      coalition_parties: [],
      cabinet: JSON.stringify({ status: "presidents_rule", majority_mark: majorityMark, total_seats: winners.length }),
    });
    await base44.entities.NewsItem.create({
      title: `🏛️ President's Rule imposed in ${scopeName}`,
      content: `Governor AI: no party or coalition proved majority in the ${el.title}. President's Rule activated for ${duration} in-game days.`,
      category: "breaking", source: "TV99 Bharat", related_type: "presidents_rule", related_id: electionId,
    });
    logAction({
      actor_id: "governor_ai", actor_name: "Governor AI", actor_role: "governor_ai",
      action: "presidents_rule_started", scope, scope_id: el.state_id || "",
      related_entity: "Election", related_id: electionId, details: attemptLog.join(" "),
    });
    return { status: "presidents_rule", scopeName, majorityMark, partySeats, attemptLog };
  }

  // ---- Form government: appoint CM/PM, Speaker, cabinet ministers ----
  const headTitle = headTitleFor(el.election_type);
  const rulingWinners = formed.rulingParties.flatMap(p => partyWinners[p] || []);
  const realRuling = rulingWinners.filter(w => w.player_id && !w.player_id.startsWith("AI_")).sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
  const cm = realRuling[0] || rulingWinners.sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0))[0] || { player_name: generateAIName(), player_id: "AI_CM", party_name: formed.rulingParties[0] };

  const stateIdField = isNational ? "" : (el.state_id || "");
  const ministersToCreate = [
    { scope, state_id: stateIdField, government_id: gov.id, player_id: cm.player_id || "", player_name: cm.player_name, portfolio: "General Administration", position: isNational ? "pm" : "cm", party_id: cm.party_id || "", party_name: cm.party_name || formed.rulingParties[0], appointed_game_time: gameTime, is_active: true },
    { scope, state_id: stateIdField, government_id: gov.id, player_id: "AI_SPEAKER", player_name: generateAIName(), portfolio: "Speaker", position: "speaker", party_id: "", party_name: formed.rulingParties[0], appointed_game_time: gameTime, is_active: true },
  ];

  // Cabinet: real winners first, then AI, one per portfolio
  const remaining = rulingWinners.filter(w => (w.player_id || "") !== (cm.player_id || ""));
  const pool = [...remaining.filter(w => w.player_id && !w.player_id.startsWith("AI_")), ...remaining.filter(w => !w.player_id || w.player_id.startsWith("AI_"))];
  for (let k = 0; k < CABINET_PORTFOLIOS.length && k < pool.length; k++) {
    const w = pool[k];
    ministersToCreate.push({
      scope, state_id: stateIdField, government_id: gov.id, player_id: w.player_id || "", player_name: w.player_name,
      portfolio: CABINET_PORTFOLIOS[k], position: isNational ? "union_minister" : "minister",
      party_id: w.party_id || "", party_name: w.party_name || formed.rulingParties[0], appointed_game_time: gameTime, is_active: true,
    });
  }

  await base44.entities.Minister.bulkCreate(ministersToCreate);

  await base44.entities.Government.update(gov.id, {
    head_player_id: cm.player_id || "",
    head_player_name: cm.player_name,
    head_title: headTitle,
    party_name: formed.rulingParties.join(" + "),
    coalition_parties: formed.type === "coalition" ? formed.rulingParties : [],
    cabinet: JSON.stringify({ status: formed.type, total_seats: formed.seats, majority_mark: majorityMark, assembly_total: winners.length, portfolios: ministersToCreate.length }),
    is_active: true,
  });

  await base44.entities.NewsItem.create({
    title: `🏛️ ${cm.player_name} sworn in as ${headTitle} of ${scopeName}`,
    content: `Governor AI invited ${formed.invitedParty}. ${formed.type === "majority" ? "Absolute majority government" : "Coalition government"} with ${formed.seats} seats. ${ministersToCreate.length} ministers sworn in.`,
    category: "breaking", source: "TV99 Bharat", related_type: "government_formed", related_id: electionId,
  });
  logAction({
    actor_id: "governor_ai", actor_name: "Governor AI", actor_role: "governor_ai",
    action: "government_formed", scope, scope_id: el.state_id || "",
    related_entity: "Government", related_id: gov.id,
    details: `${headTitle}: ${cm.player_name} (${formed.rulingParties.join(" + ")}) — ${formed.seats}/${majorityMark}`,
  });

  return { status: formed.type, scopeName, headTitle, cm: cm.player_name, rulingParties: formed.rulingParties, seats: formed.seats, majorityMark, attemptLog, ministers: ministersToCreate.length };
}