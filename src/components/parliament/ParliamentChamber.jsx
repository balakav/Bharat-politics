
import React, { useMemo } from "react";

// Round-table parliament chamber: Speaker at the top, GOVERNMENT block on the
// LEFT (ruling party first, then coalition, then outside support — each
// party's seats contiguous, parties ordered largest → smallest, no mixing)
// and OPPOSITION on the RIGHT (same ordering). Every party gets its own
// unique color (evenly spaced hues — no two parties share a color family).
// Tapping a seat shows that member's details: constituency, name (MP for the
// Lok Sabha / MLA for an assembly), party and group — Government, Outside
// Support or Opposition (NA when the seat has no member).

function parseParties(json) {
  try { return JSON.parse(json || "[]"); } catch (e) { return []; }
}

// Curated party colors — every swatch comes from a DIFFERENT family (red,
// blue, green, yellow, purple, pink, teal, orange, indigo, lime, rose, cyan,
// violet, fuchsia), assigned largest-party-first. Parties beyond the palette
// get golden-ratio hues with varied lightness so no two ever share a family.
const PARTY_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899",
  "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#f43f5e", "#06b6d4",
  "#8b5cf6", "#d946ef",
];

function buildSeats(total, govCount) {
  const cx = 200, cy = 44;
  // An extra row for the big houses plus a wider arc (85° per side) gives
  // every seat a little breathing room. Dot size adapts to each row's spacing
  // so seats never sit congested on top of each other.
  const rows = total > 400 ? 7 : 5;
  const radii = Array.from({ length: rows }, (_, i) => 44 + Math.round(((195 - 44) * i) / (rows - 1)));
  const weightSum = radii.reduce((a, b) => a + b, 0);
  let remaining = total;
  const seats = [];
  radii.forEach((radius, ri) => {
    let n = ri === radii.length - 1 ? remaining : Math.max(1, Math.round((total * radius) / weightSum));
    if (n > remaining) n = remaining;
    remaining -= n;
    if (n <= 0) return;
    const govRow = Math.min(n, Math.round((n * govCount) / Math.max(total, 1)));
    const oppRow = n - govRow;
    const push = (count, a0, a1, side) => {
      const arc = (radius * (a1 - a0) * Math.PI) / 180;
      const r = Math.max(0.9, Math.min(2.6, (arc / Math.max(count, 1)) * 0.45));
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        const a = ((a0 + t * (a1 - a0)) * Math.PI) / 180;
        seats.push({ x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a), side, r });
      }
    };
    push(govRow, 183, 268, "left");   // government side
    push(oppRow, 272, 357, "right");  // opposition side
  });
  return seats;
}

const GROUP_LABEL = { government: "Government", support: "Outside Support", opposition: "Opposition" };
const GROUP_COLOR = { government: "text-green-400", support: "text-amber-400", opposition: "text-rose-400" };

export default function ParliamentChamber({ setup, selectedSeat, onSeatClick, winners = [], ministers = [], memberLabel = "MLA" }) {
  const { seats, seatMeta, palette, total, govTotal, orderedParties } = useMemo(() => {
    const total = Math.max(setup?.total_seats || 0, (setup?.government_seats || 0) + (setup?.opposition_seats || 0));
    const govTotal = Math.min(setup?.government_seats || 0, total);
    const coalition = parseParties(setup?.coalition);
    const supporters = parseParties(setup?.supporters);
    const groupOf = (name) =>
      name === setup?.winning_party_name || coalition.some(c => c.name === name)
        ? "government"
        : (supporters.some(s => s.name === name) ? "support" : "opposition");

    // Every party that won, with its seat count — largest first, no mixing.
    const counts = new Map();
    if (setup?.winning_party_name) counts.set(setup.winning_party_name, setup.winning_party_seats || 0);
    for (const p of coalition) counts.set(p.name, p.seats || 0);
    for (const p of supporters) counts.set(p.name, p.seats || 0);
    const winnersByParty = {};
    for (const w of winners) {
      const pn = w.party_name || "Independent";
      (winnersByParty[pn] = winnersByParty[pn] || []).push(w);
    }
    // Opposition parties aren't in the setup JSON — count their ACTUAL winning
    // seats from the results (every winner, not just the first one).
    for (const [pn, list] of Object.entries(winnersByParty)) {
      if (!counts.has(pn)) counts.set(pn, list.length);
    }
    const orderedParties = [...counts.entries()]
      .map(([name, count]) => ({ name, count, group: groupOf(name) }))
      .sort((a, b) => b.count - a.count);

    // Unique colors — one distinct family per party, ranked largest-first.
    const palette = {};
    orderedParties.forEach((p, i) => {
      palette[p.name] = PARTY_COLORS[i] ||
        `hsl(${Math.round((i * 137.508) % 360)} 65% ${45 + ((i * 17) % 20)}%)`;
    });

    // Members fill the blocks party by party, largest → smallest.
    const byVotes = (a, b) => (b.votes_received || 0) - (a.votes_received || 0);
    const pick = (list) => list.flatMap(p =>
      (winnersByParty[p.name] || []).slice().sort(byVotes).map(w => ({
        player_id: w.player_id,
        name: w.player_name || "—",
        constituency: w.constituency || "—",
        party: w.party_name || "Independent",
        group: p.group,
      })));
    const govMembers = pick(orderedParties.filter(p => p.group !== "opposition"));
    const oppMembers = pick(orderedParties.filter(p => p.group === "opposition"));

    const seatList = buildSeats(total, govTotal);
    let gi = 0, oi = 0;
    const seatMeta = seatList.map(s => {
      const m = s.side === "left" ? govMembers[gi++] : oppMembers[oi++];
      if (!m) return null;
      const minister = ministers.find(x => x.is_active !== false && x.player_id && x.player_id === m.player_id);
      return {
        ...m,
        minister: minister ? `${minister.player_name}${minister.portfolio ? ` (${minister.portfolio})` : ""}` : null,
      };
    });
    return { seats: seatList, seatMeta, palette, total, govTotal, orderedParties };
  }, [setup, winners, ministers]);

  // Unfilled seats keep their block's ordered party colors.
  const colored = useMemo(() => {
    const seq = (list, len) => {
      const arr = [];
      for (const p of list) for (let k = 0; k < p.count; k++) arr.push(palette[p.name] || "#52525b");
      while (arr.length < len) arr.push(list.length ? palette[list[list.length - 1].name] || "#52525b" : "#52525b");
      return arr;
    };
    const govSeq = seq(orderedParties.filter(p => p.group !== "opposition"), seats.filter(s => s.side === "left").length);
    const oppSeq = seq(orderedParties.filter(p => p.group === "opposition"), seats.filter(s => s.side === "right").length);
    let li = 0, ri = 0;
    return seats.map((s, i) => {
      if (seatMeta[i]) return palette[seatMeta[i].party] || "#52525b";
      return s.side === "left" ? govSeq[li++] : oppSeq[ri++];
    });
  }, [seats, seatMeta, palette, orderedParties]);

  // Live Speaker — appointed through cabinet formation (Party HQ), falling
  // back to the setup's stored speaker.
  const speakerName = ministers.find(m => m.is_active !== false && m.position === "speaker")?.player_name || setup?.speaker_name || "";
  const sel = selectedSeat ? seatMeta[selectedSeat - 1] : null;

  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-white truncate">{setup?.title || "Parliament"}</h3>
        <span className="text-[10px] text-zinc-500 flex-shrink-0">Speaker: {speakerName || "—"}</span>
      </div>
      <svg viewBox="0 0 400 258" className="w-full select-none">
        <text x="200" y="10" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="700">SPEAKER</text>
        <rect x="182" y="14" width="36" height="14" rx="4" fill="#fbbf24" />
        <text x="200" y="38" textAnchor="middle" fill="#fbbf24" fontSize="8">{speakerName}</text>
        <text x="18" y="252" fill="#22c55e" fontSize="10" fontWeight="700">GOVERNMENT</text>
        <text x="382" y="252" textAnchor="end" fill="#f43f5e" fontSize="10" fontWeight="700">OPPOSITION</text>
        {seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colored[i]}
            stroke={selectedSeat === i + 1 ? "#ffffff" : "none"} strokeWidth={selectedSeat === i + 1 ? 1.4 : 0}
            onClick={() => onSeatClick && onSeatClick(i + 1)}
            className={onSeatClick ? "cursor-pointer hover:opacity-70" : ""} />
        ))}
      </svg>

      {/* Tap-to-view member card */}
      {selectedSeat && (
        <div className="mt-2 bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Seat #{selectedSeat}</p>
            {onSeatClick && (
              <button onClick={() => onSeatClick(null)} className="text-[10px] text-zinc-400 hover:text-white">✕</button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sel ? palette[sel.party] || "#888" : "#888" }} />
            <p className="text-xs font-bold text-white truncate">{memberLabel}: {sel?.name || "NA"}</p>
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">Constituency: {sel?.constituency || "NA"}</p>
          <p className="text-[10px] text-zinc-400">Party: {sel?.party || "NA"}</p>
          <p className={`text-[10px] font-semibold ${GROUP_COLOR[sel?.group] || "text-zinc-400"}`}>
            Group: {GROUP_LABEL[sel?.group] || "NA"}
          </p>
          <p className="text-[10px] text-zinc-400">Minister: {sel?.minister || "NA"}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {[
          ["Total", total, "text-white"],
          ["Government", govTotal, "text-green-400"],
          ["Opposition", setup?.opposition_seats ?? (total - govTotal), "text-rose-400"],
          ["Majority", setup?.majority_mark ?? "—", "text-amber-400"],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
            <p className={`text-sm font-bold ${cls}`}>{val}</p>
            <p className="text-[8px] text-zinc-500 uppercase">{label}</p>
          </div>
        ))}
      </div>
      {onSeatClick && <p className="text-[9px] text-zinc-600 text-center mt-1.5">Tap a seat to view the {memberLabel} and select it for voting</p>}
      {/* Party strength — every winning party, largest first, with its unique color */}
      <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1">
        <p className="text-[9px] text-zinc-500 uppercase font-semibold">Party Strength</p>
        {orderedParties.map(p => (
          <div key={p.name} className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-zinc-300 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: palette[p.name] || "#888" }} />
              <span className="truncate">{p.name}</span>
            </span>
            <span className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className={`text-[8px] ${GROUP_COLOR[p.group]}`}>{GROUP_LABEL[p.group]}</span>
              <span className="text-white font-semibold">{p.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}