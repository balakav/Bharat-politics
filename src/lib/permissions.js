
import { base44 } from "@/api/base44Client";

// Resolves a player's current political position(s) from existing game data.
// Returns { positions: [...], primary: { role, label, state_id? } }.
// Position priority: pm > cm > party_president > speaker > minister > mp > mla > citizen.
export async function resolvePlayerRole(playerProfile, userId) {
  const positions = [];
  const pid = playerProfile?.player_id || userId;
  let primary = { role: "citizen", label: "Citizen" };

  const setPrimaryIfHigher = (role, label, state_id) => {
    const order = ["citizen", "mla", "mp", "minister", "speaker", "party_president", "deputy_cm", "cm", "pm"];
    if (order.indexOf(role) > order.indexOf(primary.role)) {
      primary = { role, label, ...(state_id ? { state_id } : {}) };
    }
  };

  // Party President
  try {
    const parties = await base44.entities.PoliticalParty.filter({ president_id: pid });
    if (parties.length > 0) {
      positions.push({ role: "party_president", scope: "party", label: `Party President · ${parties[0].short_name}` });
      setPrimaryIfHigher("party_president", `Party President · ${parties[0].short_name}`);
    }
  } catch (e) {}

  // Minister / CM / PM / Speaker / Deputy CM
  try {
    const ministers = await base44.entities.Minister.filter({ player_id: pid, is_active: true });
    for (const m of ministers) {
      const label = `${labelForPosition(m.position)} · ${m.portfolio}`;
      positions.push({ role: m.position, scope: m.scope, state_id: m.state_id, label });
      setPrimaryIfHigher(m.position, label, m.state_id);
    }
  } catch (e) {}

  // Elected MLA / MP from won candidatures
  try {
    const won = await base44.entities.Candidature.filter({ player_id: pid, result: "won" });
    const counts = {};
    for (const c of won) {
      const r = c.election_type === "lok_sabha" || c.election_type === "national" ? "mp" : "mla";
      counts[r] = (counts[r] || 0) + 1;
    }
    if (counts.mla) {
      positions.push({ role: "mla", scope: "state", label: `MLA · ${counts.mla} seat(s)` });
      setPrimaryIfHigher("mla", "MLA");
    }
    if (counts.mp) {
      positions.push({ role: "mp", scope: "national", label: `MP · ${counts.mp} seat(s)` });
      setPrimaryIfHigher("mp", "MP");
    }
  } catch (e) {}

  return { positions, primary };
}

function labelForPosition(position) {
  switch (position) {
    case "pm": return "Prime Minister";
    case "cm": return "Chief Minister";
    case "speaker": return "Speaker";
    case "deputy_cm": return "Deputy CM";
    case "union_minister": return "Union Minister";
    default: return "Minister";
  }
}

// Coarse permission matrix. Refined per-system in later phases.
const ROLE_CAPS = {
  citizen: ["view_public", "vote"],
  mla: ["view_state", "assembly_attend", "vote_bill", "constituency_action", "view_public", "vote"],
  mp: ["view_national", "parliament_attend", "vote_bill", "view_public", "vote"],
  minister: ["department_action", "view_state", "view_public"],
  deputy_cm: ["department_action", "view_state", "view_public"],
  speaker: ["run_assembly", "view_state", "view_public"],
  cm: ["state_executive", "appoint_minister", "department_action", "view_state", "view_public"],
  pm: ["national_executive", "appoint_union_minister", "department_action", "view_national", "view_public"],
  party_president: ["appoint_cm", "appoint_pm", "appoint_minister", "ticket_approval", "view_public"],
  governor_ai: ["form_government", "president_rule", "bill_review"],
  president_ai: ["approve_bill"],
  admin: ["*"],
};

export function can(role, action) {
  const caps = ROLE_CAPS[role] || [];
  if (caps.includes("*")) return true;
  return caps.includes(action);
}

// Whether the player is currently in their elected "access period" (spec #4):
// MLA access = mla_access_days game-days after their most recent win.
export function inAccessPeriod(lastWinGameTime, config) {
  if (!lastWinGameTime) return false;
  const accessMs = (config.mla_access_days || 5) * 24 * 3600 * 1000;
  return Date.now() - new Date(lastWinGameTime).getTime() < accessMs;
}