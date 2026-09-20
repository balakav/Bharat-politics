
import { bharat01 } from "@/api/bharat01Client";
import { getCurrentGameTime } from "./gameTime";
import { logAction } from "./audit";

// Enforcement Directorate AI (spec #15). Monitors player assets vs declared
// income. Disproportionate assets → Investigation → if proven → CourtCase.

// Expected net worth baseline: starting coins + a per-election-won allowance.
function expectedNetWorth(profile) {
  return 1000000000 + (profile.elections_won || 0) * 5000000 + (profile.properties_owned || 0) * 50000000;
}

export async function openInvestigation(targetPlayerId, targetName, reason, scope = "national", stateId = "", actor) {
  // Skip if an open investigation already exists for this target.
  const all = await bharat01.entities.Investigation.filter({ target_player_id: targetPlayerId });
  const open = all.find(i => i.status === "open" || i.status === "under_investigation");
  if (open) return open;
  const now = (await getCurrentGameTime()).toISOString();
  const rec = await bharat01.entities.Investigation.create({
    target_player_id: targetPlayerId, target_player_name: targetName,
    scope, reason, evidence: "", suspicious_assets: "", estimated_amount: 0,
    status: "open", opened_game_time: now,
  });
  logAction({
    actor_id: actor?.id || "enforcement_ai", actor_name: actor?.name || "Enforcement AI", actor_role: actor?.role || "ai",
    action: "investigation_opened", scope, scope_id: stateId || "",
    related_entity: "Investigation", related_id: rec.id, details: reason,
  });
  await bharat01.entities.NewsItem.create({
    title: `🔍 Enforcement Directorate opens probe against ${targetName}`,
    content: `The ED has opened an investigation into ${targetName}. Reason: ${reason}.`,
    category: "legal", source: "TV99 Bharat", related_type: "investigation", related_id: rec.id,
  });
  return rec;
}

// Sweep all players; flag disproportionate assets.
export async function runEnforcementSweep(actor) {
  const profiles = await bharat01.entities.PlayerProfile.list();
  const flagged = [];
  for (const p of profiles) {
    const expected = expectedNetWorth(p);
    const actual = p.net_worth || p.e_coins || 0;
    if (actual > expected * 3) {
      const reason = `Disproportionate assets: declared net worth ${actual.toLocaleString()} vs expected ${expected.toLocaleString()} (${Math.round(actual / expected)}x).`;
      const inv = await openInvestigation(p.player_id, p.username, reason, "national", "", actor);
      if (inv) flagged.push(p.username);
    }
  }
  logAction({
    actor_id: actor?.id || "enforcement_ai", actor_name: actor?.name || "Enforcement AI", actor_role: actor?.role || "ai",
    action: "enforcement_sweep", scope: "national", details: `Flagged ${flagged.length} players: ${flagged.join(", ") || "none"}`,
  });
  return { flagged, count: flagged.length };
}

// Mark an investigation as proven (after gathering evidence).
export async function markProven(investigationId, evidence, estimatedAmount, actor) {
  const now = (await getCurrentGameTime()).toISOString();
  const updated = await bharat01.entities.Investigation.update(investigationId, {
    status: "proven", evidence, estimated_amount: estimatedAmount || 0, closed_game_time: now,
  });
  logAction({
    actor_id: actor?.id || "enforcement_ai", actor_name: actor?.name || "Enforcement AI", actor_role: actor?.role || "ai",
    action: "investigation_proven", related_entity: "Investigation", related_id: investigationId, details: evidence,
  });
  return updated;
}