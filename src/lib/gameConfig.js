
import { bharat01 } from "@/api/bharat01Client";
import { getGameConfig, DEFAULTS } from "./gameTime";
import { logAction } from "./audit";

// Writes/updates the single global GameConfig record. Logged to AuditLog.
// `actor` is optional: { id, name, role }.
export async function setGameConfig(patch, actor) {
  let existing = [];
  try {
    existing = await bharat01.entities.GameConfig.filter({ key: "global" });
  } catch (e) {}
  const oldValue = existing[0] || null;
  let rec;
  if (existing.length > 0) {
    rec = await bharat01.entities.GameConfig.update(existing[0].id, { ...patch, key: "global" });
  } else {
    rec = await bharat01.entities.GameConfig.create({ ...DEFAULTS, ...patch, key: "global" });
  }
  // Refresh the in-memory cache used by gameTime.js
  // (getGameConfig re-reads on next call within TTL, but we force freshness by
  // bumping a no-op — the cache is internal to that module; callers re-fetch.)
  try {
    logAction({
      actor_id: actor?.id || "system",
      actor_name: actor?.name || "System",
      actor_role: actor?.role || "admin",
      action: "game_config_changed",
      scope: "national",
      old_value: oldValue ? JSON.stringify(oldValue) : "",
      new_value: JSON.stringify(rec),
      details: "Game configuration updated",
    });
  } catch (e) {}
  return rec;
}

export async function getFullGameConfig() {
  return getGameConfig();
}