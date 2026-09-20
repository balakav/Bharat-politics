
import { base44 } from "@/api/base44Client";
import { logAction } from "./audit";

// Configurable tax system (spec #13/#21). National taxes apply to all states;
// state taxes are state-specific. Admin creates TaxConfig records; the economic
// engine reads them at computation time, so tax changes take effect immediately.

// Returns active tax configs applicable to a scope.
// National scope: only national taxes. State scope: national + that state's taxes.
export async function getActiveTaxes(scope, stateId = "") {
  let all = [];
  try { all = await base44.entities.TaxConfig.filter({ is_active: true }); } catch (e) { return []; }
  return all.filter(t => {
    if (scope === "national") return t.scope === "national";
    return t.scope === "national" || (t.scope === "state" && t.state_id === stateId);
  });
}

// Compute total tax for a base amount and tax_type, summing all applicable taxes.
export function computeTax(baseAmount, taxConfigs, taxType) {
  if (!baseAmount || baseAmount <= 0) return 0;
  const applicable = taxConfigs.filter(t =>
    t.tax_type === taxType &&
    baseAmount >= (t.min_threshold || 0) &&
    (!(t.max_threshold) || baseAmount <= t.max_threshold)
  );
  let total = 0;
  for (const t of applicable) total += Math.round(baseAmount * (t.rate / 100));
  return total;
}

export async function createTaxConfig(data, actor) {
  if (!data.name || !data.tax_type || data.scope == null || data.rate == null) {
    throw new Error("Missing required tax fields (name, tax_type, scope, rate).");
  }
  if (data.rate < 0 || data.rate > 100) throw new Error("Tax rate must be between 0 and 100.");
  if (data.scope === "state" && !data.state_id) throw new Error("State taxes require a state_id.");
  // Duplicate check (same name + scope + state)
  const existing = await base44.entities.TaxConfig.filter({ name: data.name, scope: data.scope, state_id: data.scope === "state" ? data.state_id : "" });
  if (existing.length > 0) throw new Error("A tax with this name already exists for this scope.");
  const rec = await base44.entities.TaxConfig.create({ ...data, is_active: true });
  logAction({
    actor_id: actor?.id || "admin", actor_name: actor?.name || "Admin", actor_role: actor?.role || "admin",
    action: "tax_created", scope: data.scope, scope_id: data.state_id || "",
    related_entity: "TaxConfig", related_id: rec.id, new_value: JSON.stringify(rec),
  });
  return rec;
}

export async function toggleTax(taxId, active, actor) {
  return await base44.entities.TaxConfig.update(taxId, { is_active: active });
}