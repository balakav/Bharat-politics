import { bharat01 } from "@/api/bharat01Client";
import { getCurrentGameTime } from "./gameTime";

// Centralized audit logger. Never throws — audit must not break the calling flow.
// Spec #45: every major action records actor, role, action, scope, related entity,
// old/new value, and the in-game time.
export async function logAction({
  actor_id,
  actor_name,
  actor_role,
  action,
  scope,
  scope_id,
  related_entity,
  related_id,
  old_value,
  new_value,
  details,
}) {
  try {
    let game_time;
    try {
      game_time = (await getCurrentGameTime()).toISOString();
    } catch (e) {}
    await bharat01.entities.AuditLog.create({
      actor_id: actor_id || "system",
      actor_name: actor_name || "System",
      actor_role: actor_role || "ai",
      action: String(action),
      scope: scope || "",
      scope_id: scope_id || "",
      related_entity: related_entity || "",
      related_id: related_id || "",
      old_value: old_value != null ? String(old_value) : "",
      new_value: new_value != null ? String(new_value) : "",
      details: details || "",
      game_time,
    });
  } catch (e) {
    // swallow — audit failures must not surface to users
  }
}