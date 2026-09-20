// Shared server-side state/constituency resolution for the Bharat Union's
// 21 states. Mirrors src/lib/bharatStates.js — backend functions can't import src/.

export const BHARAT_STATES = [
  { id: "ANG", name: "Anga-Desam", assemblySeats: 180, lokSabhaSeats: 30 },
  { id: "BHP", name: "Bharathapura", assemblySeats: 120, lokSabhaSeats: 20 },
  { id: "CHE", name: "Cheralam", assemblySeats: 220, lokSabhaSeats: 37 },
  { id: "CHO", name: "Chola-Desam", assemblySeats: 260, lokSabhaSeats: 44 },
  { id: "GAN", name: "Gandharam", assemblySeats: 160, lokSabhaSeats: 27 },
  { id: "HAS", name: "Hastinapura", assemblySeats: 320, lokSabhaSeats: 54 },
  { id: "IND", name: "Indraprastha", assemblySeats: 140, lokSabhaSeats: 24 },
  { id: "KAL", name: "Kalinga-Desam", assemblySeats: 210, lokSabhaSeats: 35 },
  { id: "KSH", name: "Kashi-Desam", assemblySeats: 170, lokSabhaSeats: 29 },
  { id: "KOS", name: "Kosala", assemblySeats: 230, lokSabhaSeats: 39 },
  { id: "KUN", name: "Kuntala-Desam", assemblySeats: 250, lokSabhaSeats: 42 },
  { id: "KUR", name: "Kurukshetra", assemblySeats: 180, lokSabhaSeats: 30 },
  { id: "KRN", name: "Kurunji", assemblySeats: 150, lokSabhaSeats: 25 },
  { id: "KRU", name: "Kuru-Desam", assemblySeats: 210, lokSabhaSeats: 35 },
  { id: "MAG", name: "Magadha-Desam", assemblySeats: 280, lokSabhaSeats: 47 },
  { id: "MAH", name: "Mahendrapuri", assemblySeats: 170, lokSabhaSeats: 28 },
  { id: "MAR", name: "Marudhagam", assemblySeats: 220, lokSabhaSeats: 37 },
  { id: "MUL", name: "Mullai-Nadu", assemblySeats: 300, lokSabhaSeats: 50 },
  { id: "NAR", name: "Narmada-Rajiyam", assemblySeats: 190, lokSabhaSeats: 32 },
  { id: "PAN", name: "Panchalam", assemblySeats: 230, lokSabhaSeats: 38 },
  { id: "PND", name: "Pandiya-Nadu", assemblySeats: 270, lokSabhaSeats: 45 },
];

export function getStateById(id) {
  return BHARAT_STATES.find(s => s.id === id) || null;
}

export function resolveState(nameOrId) {
  // Normalize away spaces/hyphens so "Anga Desam", "anga-desam" and "ANG" all match.
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const q = norm(nameOrId);
  if (!q) return null;
  return BHARAT_STATES.find(
    s => norm(s.id) === q || norm(s.name) === q || norm(s.name).includes(q)
  ) || null;
}

function pad(n) {
  return String(n).padStart(3, "0");
}

export function assemblyConstituencyNames(state) {
  return Array.from({ length: state.assemblySeats }, (_, i) => `${state.name} AC ${pad(i + 1)}`);
}

export function lokSabhaConstituencyNames(state) {
  return Array.from({ length: state.lokSabhaSeats }, (_, i) => `${state.name} LS ${pad(i + 1)}`);
}