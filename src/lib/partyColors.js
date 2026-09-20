
// Deterministic, party-unique colors shared by every screen (parliament
// chamber, parliament hub, seat sharing). There is NO static party list —
// every party gets a golden-angle hue from its name so no two parties land
// in the same color family.
export function partyColor(name) {
  if (!name) return "#a1a1aa";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = Math.round((h * 137.508) % 360);
  return `hsl(${hue} 72% 55%)`;
}