
import { bharat01 } from "@/api/bharat01Client";

// Default global game configuration. Overridden by the GameConfig entity (key "global").
export const DEFAULTS = {
  game_start_time: new Date().toISOString(),
  time_speed_multiplier: 1,
  president_rule_duration_days: 3,
  budget_min_score: 70,
  national_majority: 374,
  default_assembly_majority_pct: 0.5,
  mla_access_days: 5,
  elected_term_days: 30,
  salary_cycle_hours: 24,
  starting_e_coins: 1000000000,
};

let cachedConfig = null;
let cachedAt = 0;
const CACHE_TTL = 30000;

// Returns the merged global config (defaults + DB record if present).
export async function getGameConfig() {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CACHE_TTL) {
    return { ...DEFAULTS, ...cachedConfig };
  }
  try {
    const list = await bharat01.entities.GameConfig.filter({ key: "global" });
    cachedConfig = list[0] || null;
  } catch (e) {
    cachedConfig = null;
  }
  cachedAt = now;
  return { ...DEFAULTS, ...(cachedConfig || {}) };
}

// Centralized game clock — converts a real timestamp to game time using the
// configured anchor + speed multiplier. All systems MUST use this for game time.
export function toGameTime(realDateMs, config) {
  const startMs = new Date(config.game_start_time).getTime();
  const speed = config.time_speed_multiplier || 1;
  const elapsedReal = realDateMs - startMs;
  const elapsedGame = elapsedReal * speed;
  return new Date(startMs + elapsedGame);
}

export async function getCurrentGameTime() {
  const config = await getGameConfig();
  return toGameTime(Date.now(), config);
}

export function formatGameTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Game day number since the game clock started (Day 1 = start).
export function gameDayNumber(date, config) {
  const start = new Date(config.game_start_time).getTime();
  const gt = new Date(date).getTime();
  return Math.floor((gt - start) / (24 * 3600 * 1000)) + 1;
}

// Game-day difference between two dates, using the same game clock.
export function gameDaysBetween(aDate, bDate, config) {
  const dayMs = 24 * 3600 * 1000;
  return Math.round((new Date(bDate).getTime() - new Date(aDate).getTime()) / dayMs);
}