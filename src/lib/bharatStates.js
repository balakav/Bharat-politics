
// =============================================================================
// Bharatvarsha Union — Centralized multi-state election configuration & engine
// One config drives all 21 states. Adding a 22nd state = add one object below.
// Parties are NEVER static here — every party comes from the live
// PoliticalParty list created by players, and an election only shows the
// parties actually participating in it.
// =============================================================================

export const NATION = {
  name: "Bharat Union",
  shortName: "Bharat",
  // National Lok Sabha configuration (game-defined values, preserved as-is)
  lokSabhaSeats: 748,
  lokSabhaMajority: 374,
  // Stated assembly total per the design spec (used for validation flagging)
  assemblySeatsStated: 4620,
};

// 21 states with exact seat counts as supplied. Do NOT alter these values.
// Capital cities come from the uploaded Bharatvarsha map.
export const BHARAT_STATES = [
  { id: "ANG", name: "Anga-Desam", capital: "Anganagar", assemblySeats: 180, assemblyMajority: 91, lokSabhaSeats: 30 },
  { id: "BHP", name: "Bharathapura", capital: "Bharathapura", isNationalCapital: true, assemblySeats: 120, assemblyMajority: 61, lokSabhaSeats: 20 },
  { id: "CHE", name: "Cheralam", capital: "Musiri", assemblySeats: 220, assemblyMajority: 111, lokSabhaSeats: 37 },
  { id: "CHO", name: "Chola-Desam", capital: "Cholapuram", assemblySeats: 260, assemblyMajority: 131, lokSabhaSeats: 44 },
  { id: "GAN", name: "Gandharam", capital: "Gandharapur", assemblySeats: 160, assemblyMajority: 81, lokSabhaSeats: 27 },
  { id: "HAS", name: "Hastinapura", capital: "Hastinapura", assemblySeats: 320, assemblyMajority: 161, lokSabhaSeats: 54 },
  { id: "IND", name: "Indraprastha", capital: "Indraprastha", assemblySeats: 140, assemblyMajority: 71, lokSabhaSeats: 24 },
  { id: "KAL", name: "Kalinga-Desam", capital: "Kalingapatnam", assemblySeats: 210, assemblyMajority: 106, lokSabhaSeats: 35 },
  { id: "KSH", name: "Kashi-Desam", capital: "Kashinagara", assemblySeats: 170, assemblyMajority: 86, lokSabhaSeats: 29 },
  { id: "KOS", name: "Kosala", capital: "Kosalanagar", assemblySeats: 230, assemblyMajority: 116, lokSabhaSeats: 39 },
  { id: "KUN", name: "Kuntala-Desam", capital: "Kuntalapura", assemblySeats: 250, assemblyMajority: 126, lokSabhaSeats: 42 },
  { id: "KUR", name: "Kurukshetra", capital: "Kurukshetra", assemblySeats: 180, assemblyMajority: 91, lokSabhaSeats: 30 },
  { id: "KRN", name: "Kurunji", capital: "Kuripatti", assemblySeats: 150, assemblyMajority: 76, lokSabhaSeats: 25 },
  { id: "KRU", name: "Kuru-Desam", capital: "Kurugram", assemblySeats: 210, assemblyMajority: 106, lokSabhaSeats: 35 },
  { id: "MAG", name: "Magadha-Desam", capital: "Rajagriha", assemblySeats: 280, assemblyMajority: 141, lokSabhaSeats: 47 },
  { id: "MAH", name: "Mahendrapuri", capital: "Mahendrapuri", assemblySeats: 170, assemblyMajority: 86, lokSabhaSeats: 28 },
  { id: "MAR", name: "Marudhagam", capital: "Marudhanalur", assemblySeats: 220, assemblyMajority: 111, lokSabhaSeats: 37 },
  { id: "MUL", name: "Mullai-Nadu", capital: "Mullainagar", assemblySeats: 300, assemblyMajority: 151, lokSabhaSeats: 50 },
  { id: "NAR", name: "Narmada-Rajiyam", capital: "Narmadanagar", assemblySeats: 190, assemblyMajority: 96, lokSabhaSeats: 32 },
  { id: "PAN", name: "Panchalam", capital: "Panchalam", assemblySeats: 230, assemblyMajority: 116, lokSabhaSeats: 38 },
  { id: "PND", name: "Pandiya-Nadu", capital: "Pandiyanallur", assemblySeats: 270, assemblyMajority: 136, lokSabhaSeats: 45 },
];

export function getStateById(id) {
  return BHARAT_STATES.find(s => s.id === id);
}

// ---- Constituency generation (data-driven, not hard-coded) -------------------

export function generateAssemblyConstituencies(state) {
  return Array.from({ length: state.assemblySeats }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      id: `${state.id}-${num}`,
      number: i + 1,
      name: `${state.name} AC ${num}`,
      state_id: state.id,
      election_type: "vidhan_sabha",
    };
  });
}

export function generateLokSabhaConstituencies(state) {
  return Array.from({ length: state.lokSabhaSeats }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      id: `${state.id}-LS-${num}`,
      number: i + 1,
      name: `${state.name} LS ${num}`,
      state_id: state.id,
      election_type: "lok_sabha",
    };
  });
}

// ---- Configuration validation (flags mismatches, never alters source data) ---

export function validateBharatConfig() {
  const stateCount = BHARAT_STATES.length;
  const assemblyTotal = BHARAT_STATES.reduce((s, st) => s + st.assemblySeats, 0);
  const lokSabhaTotal = BHARAT_STATES.reduce((s, st) => s + st.lokSabhaSeats, 0);
  const errors = [];
  const warnings = [];

  if (stateCount !== 21) errors.push(`State count is ${stateCount}, expected 21.`);
  if (lokSabhaTotal !== 748) errors.push(`Lok Sabha total is ${lokSabhaTotal}, expected 748.`);
  // Per-state values are preserved as supplied; only flag the spec mismatch.
  if (assemblyTotal !== NATION.assemblySeatsStated) {
    warnings.push(`Assembly total from supplied per-state data is ${assemblyTotal}, spec states ${NATION.assemblySeatsStated}. Per-state seat counts preserved as instructed.`);
  }
  // Verify every supplied majority is internally consistent (floor(n/2)+1) — flag if not
  BHARAT_STATES.forEach(st => {
    const calc = Math.floor(st.assemblySeats / 2) + 1;
    if (st.assemblyMajority !== calc) {
      warnings.push(`${st.name}: supplied majority ${st.assemblyMajority} differs from mathematical ${calc} (preserved).`);
    }
  });

  return {
    stateCount,
    assemblyTotal,
    lokSabhaTotal,
    lokSabhaMajority: NATION.lokSabhaMajority,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}