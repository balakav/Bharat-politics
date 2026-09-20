
import { base44 } from "@/api/base44Client";

// Salary system (spec #25). Per-position salaries, admin-configurable via the
// SalaryConfig entity. Salary grows by role multiplier but is capped at max_salary.

export const DEFAULT_SALARY = {
  mla: { position: "mla", base_salary: 250000, max_salary: 1000000, growth_rate: 5, cycle_hours: 24 },
  mp: { position: "mp", base_salary: 350000, max_salary: 1500000, growth_rate: 5, cycle_hours: 24 },
  minister: { position: "minister", base_salary: 500000, max_salary: 2000000, growth_rate: 5, cycle_hours: 24 },
  cm: { position: "cm", base_salary: 750000, max_salary: 3000000, growth_rate: 5, cycle_hours: 24 },
  pm: { position: "pm", base_salary: 1000000, max_salary: 5000000, growth_rate: 5, cycle_hours: 24 },
  speaker: { position: "speaker", base_salary: 400000, max_salary: 1500000, growth_rate: 5, cycle_hours: 24 },
};

export async function getSalaryConfigMap() {
  let list = [];
  try { list = await base44.entities.SalaryConfig.filter({ is_active: true }); } catch (e) {}
  const map = {};
  for (const s of list) map[s.position] = s;
  // fill defaults for any missing position
  for (const [pos, def] of Object.entries(DEFAULT_SALARY)) {
    if (!map[pos]) map[pos] = def;
  }
  return map;
}

// Salary amount for a position given a salary multiplier (e.g. from elections won).
export async function getSalaryForPosition(position, multiplier = 1) {
  const map = await getSalaryConfigMap();
  const cfg = map[position];
  if (!cfg) return 0;
  const base = cfg.base_salary || 0;
  const max = cfg.max_salary || base * 4;
  const grown = base * (1 + ((cfg.growth_rate || 0) / 100) * Math.max(0, (multiplier || 1) - 1));
  return Math.round(Math.min(grown, max));
}

export async function setSalaryConfig(position, patch, actor) {
  const existing = await base44.entities.SalaryConfig.filter({ position });
  let rec;
  if (existing.length > 0) {
    rec = await base44.entities.SalaryConfig.update(existing[0].id, { ...patch, position, is_active: true });
  } else {
    rec = await base44.entities.SalaryConfig.create({ ...DEFAULT_SALARY[position], ...patch, position, is_active: true });
  }
  return rec;
}