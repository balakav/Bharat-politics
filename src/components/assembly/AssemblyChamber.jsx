
import React, { useMemo } from "react";

const FALLBACK_COLORS = ["#2979ff", "#00c853", "#6200ea", "#ff9100", "#ff5252", "#00bcd4", "#e91e63"];

// Every party (player-created, from the live party list) gets a deterministic
// color from its name — no static/preset party data.
const colorOf = (partyName) => {
  if (!partyName) return "#52525b";
  let h = 0;
  for (let i = 0; i < partyName.length; i++) h = (h * 31 + partyName.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
};

// Build N seat positions in a horseshoe (semicircle), rightmost first.
function buildSeats(N, cx, cy, innerR, rowGap, rows) {
  if (N <= 0) return [];
  const weights = Array.from({ length: rows }, (_, r) => 1 + r * 0.6);
  const wSum = weights.reduce((a, b) => a + b, 0);
  let counts = weights.map(w => Math.max(1, Math.round((w / wSum) * N)));
  let diff = N - counts.reduce((a, b) => a + b, 0);
  let i = rows - 1;
  while (diff !== 0) {
    if (diff > 0) { counts[i] += 1; diff -= 1; } else { if (counts[i] > 1) { counts[i] -= 1; diff += 1; } }
    i = (i - 1 + rows) % rows;
  }
  const positions = [];
  for (let r = 0; r < rows; r++) {
    const radius = innerR + r * rowGap;
    const c = counts[r];
    for (let s = 0; s < c; s++) {
      const t = c === 1 ? 0.5 : s / (c - 1);
      const angle = Math.PI * (1 - t); // 180° (left) → 0° (right)
      positions.push({ x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle), angle });
    }
  }
  // rightmost first (angle ascending)
  positions.sort((a, b) => a.angle - b.angle);
  return positions;
}

// Round-table / parliamentary chamber. Dynamic seat count from the state config
// (or actual winners). Government benches on the right, opposition on the left,
// Speaker at top, CM highlighted.
export default function AssemblyChamber({ state, winners = [], government, ministers = [], majorityMark = 0, presidentsRule = false }) {
  const totalConfigSeats = state?.assemblySeats || winners.length || 0;
  const N = Math.max(winners.length, 0);

  const { positions, ordered, govCount, oppCount, cmIndex } = useMemo(() => {
    const rulingParties = (() => {
      if (presidentsRule) return [];
      const fromCoal = government?.coalition_parties?.length ? government.coalition_parties : [];
      if (fromCoal.length) return fromCoal;
      const nm = government?.party_name || "";
      return nm.split(" + ").map(s => s.trim()).filter(s => s && s !== "President's Rule");
    })();
    const rulingSet = new Set(rulingParties);
    const govWinners = winners.filter(w => rulingSet.has(w.party_name));
    const oppWinners = winners.filter(w => !rulingSet.has(w.party_name));
    const cmMinister = ministers.find(m => m.position === "cm" || m.position === "pm");
    const cmWinner = cmMinister ? govWinners.find(w => ((w.player_id && w.player_id === cmMinister.player_id) || w.player_name === cmMinister.player_name)) : null;
    const orderedWinners = [
      ...(cmWinner ? [cmWinner] : []),
      ...govWinners.filter(w => w !== cmWinner),
      ...oppWinners,
    ];
    const pos = buildSeats(N || totalConfigSeats, 180, 188, 58, 21, 6);
    return {
      positions: pos,
      ordered: orderedWinners,
      govCount: govWinners.length,
      oppCount: oppWinners.length,
      cmIndex: cmWinner ? 0 : -1,
    };
  }, [winners, government, ministers, presidentsRule, N, totalConfigSeats]);

  const dotR = positions.length > 200 ? 3 : positions.length > 100 ? 4 : 5;
  const speakerX = 180, speakerY = 16;

  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
      <svg viewBox="0 0 360 210" className="w-full h-auto">
        {/* Speaker seat (top center) */}
        <circle cx={speakerX} cy={speakerY} r={9} fill="#1f2937" stroke="#F1C40F" strokeWidth={2} />
        <text x={speakerX} y={speakerY + 28} textAnchor="middle" fill="#F1C40F" fontSize="9" fontWeight="700">SPEAKER</text>

        {/* Floor line */}
        <path d="M 30 188 A 150 150 0 0 1 330 188" fill="none" stroke="#27272a" strokeWidth="1" />

        {/* Seats */}
        {positions.map((p, idx) => {
          const w = ordered[idx];
          const isGov = w && idx < govCount;
          const color = w ? colorOf(w.party_name) : "#3f3f46";
          const isCM = idx === cmIndex;
          return (
            <circle key={idx} cx={p.x} cy={p.y} r={isCM ? dotR + 2.5 : dotR}
              fill={color} fillOpacity={w ? 0.95 : 0.4}
              stroke={isCM ? "#F1C40F" : isGov ? "#fff2" : "none"} strokeWidth={isCM ? 2 : 1} />
          );
        })}
      </svg>

      {/* Strength summary */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="bg-zinc-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-yellow-400">{govCount}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Government</p>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-white">{majorityMark}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Majority</p>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-blue-400">{oppCount}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Opposition</p>
        </div>
      </div>
      <p className="text-[10px] text-zinc-600 text-center mt-1.5">
        {positions.length} seats · {state?.name || ""} Legislative Assembly
      </p>
    </div>
  );
}