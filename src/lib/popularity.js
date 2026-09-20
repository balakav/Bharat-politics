
import { base44 } from "@/api/base44Client";
import { getCurrentGameTime } from "./gameTime";

// Popularity engine (spec #18). Computes popularity scores (0–100) for
// governments, parties, ministers from in-game factors: budget performance,
// development activity, scandals (investigations), and election strength.

function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

// Government popularity: base 50, adjusted by budget AI score, development
// projects, and active investigations against government members.
export async function recomputeGovernmentPopularity(scope, stateId = "") {
  const govs = await base44.entities.Government.filter({ type: scope === "national" ? "national" : "state", is_active: true });
  const gov = govs.find(g => scope === "national" ? g.type === "national" : g.state_id === stateId) || govs[0];
  if (!gov) return null;

  let score = 50;
  const factors = [];

  // Budget performance (latest approved budget ai_score)
  const budgets = await base44.entities.Budget.filter({ scope, state_id: stateId });
  const approved = budgets.filter(b => b.status === "approved").sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
  if (approved) {
    const adj = ((approved.ai_score || 50) - 50) / 2;
    score += adj;
    factors.push(`Budget score ${approved.ai_score}%`);
  }

  // Development projects in scope (more = better, capped)
  try {
    const projects = await base44.entities.DevelopmentProject.list("-created_date", 500);
    const scopedProjects = projects.filter(p => scope === "national" ? !p.state_id : p.state_id === stateId);
    score += Math.min(10, scopedProjects.length);
    factors.push(`${scopedProjects.length} development projects`);
  } catch (e) {}

  // Scandals: active investigations against government members reduce popularity
  const ministers = await base44.entities.Minister.filter({ government_id: gov.id, is_active: true });
  let scandals = 0;
  for (const m of ministers) {
    const invs = await base44.entities.Investigation.filter({ target_player_id: m.player_id });
    if (invs.some(i => i.status === "open" || i.status === "under_investigation" || i.status === "proven")) scandals++;
  }
  score -= scandals * 8;
  if (scandals) factors.push(`${scandals} scandals`);

  score = clamp(score);
  const now = (await getCurrentGameTime()).toISOString();

  // Trend vs previous
  const prev = await base44.entities.PopularityScore.filter({ scope: "government", target_id: gov.id });
  const prevScore = prev[0]?.score || 50;
  const trend = score > prevScore + 1 ? "up" : score < prevScore - 1 ? "down" : "stable";

  const data = {
    scope: "government", target_id: gov.id, target_name: gov.party_name,
    state_id: stateId, score, trend, factors: factors.join("; "), updated_game_time: now,
  };
  if (prev.length > 0) {
    return await base44.entities.PopularityScore.update(prev[0].id, data);
  }
  return await base44.entities.PopularityScore.create(data);
}

// Party popularity: derived from recent election seat share.
export async function recomputePartyPopularity(partyName, scope = "national", stateId = "") {
  const records = await base44.entities.ElectionRecord.filter({ election_type: scope === "national" ? "national" : "vidhan_sabha" });
  const scoped = records.filter(r => scope === "national" ? true : r.state_id === stateId);
  const total = scoped.length || 1;
  const partySeats = scoped.filter(r => (r.winner_party || "").includes(partyName) || (r.winner_party_short || "") === partyName).length;
  const seatShare = partySeats / total;
  const score = clamp(30 + seatShare * 70);
  const now = (await getCurrentGameTime()).toISOString();
  const prev = await base44.entities.PopularityScore.filter({ scope: "party", target_id: partyName });
  const prevScore = prev[0]?.score || 50;
  const trend = score > prevScore + 1 ? "up" : score < prevScore - 1 ? "down" : "stable";
  const data = {
    scope: "party", target_id: partyName, target_name: partyName,
    state_id: stateId, score, trend, factors: `${partySeats}/${total} seats`, updated_game_time: now,
  };
  if (prev.length > 0) return await base44.entities.PopularityScore.update(prev[0].id, data);
  return await base44.entities.PopularityScore.create(data);
}