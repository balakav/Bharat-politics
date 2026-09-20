
import { base44 } from "@/api/base44Client";
import { logAction } from "./audit";

// Treasury AI — one treasury record per scope (state or national).
// All government revenue/expenditure flows through these helpers so the
// economic simulation has a single source of truth (spec #22).

export async function getTreasury(scope, stateId = "") {
  const list = await base44.entities.Treasury.filter({ scope, state_id: stateId, is_active: true });
  if (list.length > 0) return list[0];
  return await base44.entities.Treasury.create({
    scope, state_id: stateId, balance: 0, total_revenue: 0, total_expenditure: 0, is_active: true,
  });
}

export async function treasuryCredit(scope, stateId, amount, reason, actor) {
  if (!amount) return null;
  const t = await getTreasury(scope, stateId);
  const balance = (t.balance || 0) + amount;
  const total_revenue = (t.total_revenue || 0) + amount;
  const updated = await base44.entities.Treasury.update(t.id, { balance, total_revenue });
  logAction({
    actor_id: actor?.id || "treasury_ai", actor_name: actor?.name || "Treasury AI", actor_role: actor?.role || "ai",
    action: "treasury_credit", scope, scope_id: stateId || "",
    related_entity: "Treasury", related_id: t.id, new_value: String(balance), details: reason || "",
  });
  return updated;
}

export async function treasuryDebit(scope, stateId, amount, reason, actor) {
  if (!amount) return null;
  const t = await getTreasury(scope, stateId);
  const balance = (t.balance || 0) - amount;
  const total_expenditure = (t.total_expenditure || 0) + amount;
  const updated = await base44.entities.Treasury.update(t.id, { balance, total_expenditure });
  logAction({
    actor_id: actor?.id || "treasury_ai", actor_name: actor?.name || "Treasury AI", actor_role: actor?.role || "ai",
    action: "treasury_debit", scope, scope_id: stateId || "",
    related_entity: "Treasury", related_id: t.id, new_value: String(balance), details: reason || "",
  });
  return updated;
}