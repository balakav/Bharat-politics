
import { BHARAT_STATES, getStateById as staticGetStateById, NATION } from "./bharatStates";

// Single read point for state/nation configuration.
//
// Today: the static baseline in bharatStates.js is the source of truth
// (21 states, seat counts, fictional parties).
//
// Later (admin phase): a DB StateConfig entity will be able to override per-state
// seat counts / names, and PartyConfig entities for admin-managed parties.
// All NEW systems should call these helpers instead of importing bharatStates
// directly, so the future DB override is contained to this file.
export function getStateConfig(stateId) {
  return staticGetStateById(stateId);
}

export function getAllStateConfigs() {
  return BHARAT_STATES;
}

export function getNationConfig() {
  return NATION;
}