
import React from "react";
import { partyColor } from "@/lib/partyColors";

// Compact party-wise seat summary: a proportional color bar plus the top
// parties with their seat counts. Used by the Government (Election Data)
// screen, state pages and analytics.

export default function PartySeatBar({ seats, limit = 5 }) {
  const sorted = [...seats].sort((a, b) => b.seats - a.seats);
  if (sorted.length === 0) return null;
  const shown = sorted.slice(0, limit);
  const restSeats = sorted.slice(limit).reduce((s, x) => s + x.seats, 0);
  const total = sorted.reduce((s, x) => s + x.seats, 0) || 1;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800 mb-2">
        {shown.map(p => (
          <div key={p.party} style={{ width: `${(p.seats / total) * 100}%`, background: partyColor(p.party) }} />
        ))}
        {restSeats > 0 && <div className="bg-zinc-600" style={{ width: `${(restSeats / total) * 100}%` }} />}
      </div>
      <div className="space-y-1">
        {shown.map(p => (
          <div key={p.party} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: partyColor(p.party) }} />
              <span className="truncate">{p.party}</span>
            </span>
            <span className="text-white font-semibold flex-shrink-0 ml-2">{p.seats} seat{p.seats === 1 ? "" : "s"}</span>
          </div>
        ))}
        {restSeats > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />Others ({sorted.length - limit})
            </span>
            <span className="text-zinc-300 font-semibold">{restSeats}</span>
          </div>
        )}
      </div>
    </div>
  );
}