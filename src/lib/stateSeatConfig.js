
// Admin-editable seat configuration (DB → runtime). Applies StateSeatConfig
// records onto the in-memory BHARAT_STATES / NATION objects in place, so every
// sync consumer (election engine, map, validation) picks up admin changes.
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { logAction } from "@/lib/audit";

export function applyToRuntime(records) {
  for (const r of records || []) {
    if (r.config_type === "national") {
      if (r.name) NATION.name = r.name;
      if (r.lok_sabha_total) NATION.lokSabhaSeats = r.lok_sabha_total;
      if (r.lok_sabha_majority) NATION.lokSabhaMajority = r.lok_sabha_majority;
    } else if (r.state_id) {
      const st = BHARAT_STATES.find(s => s.id === r.state_id);
      if (st) {
        if (r.name) st.name = r.name;
        if (r.assembly_seats != null) st.assemblySeats = r.assembly_seats;
        if (r.assembly_majority != null) st.assemblyMajority = r.assembly_majority;
        if (r.lok_sabha_seats != null) st.lokSabhaSeats = r.lok_sabha_seats;
      }
    }
  }
}

// Fetch DB overrides and apply them to the runtime config (app-wide, on load).
export async function loadSeatConfigs() {
  const records = await bharat01.entities.StateSeatConfig.list();
  applyToRuntime(records);
  return records;
}

// Replace all stored config with the given values, apply to runtime, audit.
export async function saveSeatConfigs({ states, national, actor }) {
  await bharat01.entities.StateSeatConfig.deleteMany({ config_type: "state" });
  await bharat01.entities.StateSeatConfig.deleteMany({ config_type: "national" });
  const records = states.map(s => ({
    config_type: "state",
    state_id: s.id,
    name: s.name,
    assembly_seats: Number(s.assemblySeats),
    assembly_majority: Number(s.assemblyMajority),
    lok_sabha_seats: Number(s.lokSabhaSeats),
  }));
  records.push({
    config_type: "national",
    name: NATION.name,
    lok_sabha_total: Number(national.lokSabhaSeats),
    lok_sabha_majority: Number(national.lokSabhaMajority),
  });
  await bharat01.entities.StateSeatConfig.bulkCreate(records);
  applyToRuntime(records);
  try {
    logAction({
      actor_id: actor?.id || "admin",
      actor_name: actor?.name || "Admin",
      actor_role: actor?.role || "admin",
      action: "seat_config_changed",
      scope: "national",
      details: `Seat configuration updated (${states.length} states + national)`,
      new_value: JSON.stringify({ national, stateCount: states.length }),
    });
  } catch (e) {}
  return records;
}