
import React, { useState } from "react";
import { MapPin, Hammer, TrendingUp, CheckCircle } from "lucide-react";
import { formatCoins } from "@/lib/gameData";
import WorkTypePicker from "@/components/constituency/WorkTypePicker";

// One won seat: constituency summary (works, dev score, vote boost), the
// "Start Work" expander, and that constituency's work log.
export default function ConstituencyWorkCard({ seat, works, eCoins, busy, onStartWork }) {
  const [open, setOpen] = useState(false);
  const score = works.reduce((a, w) => a + (w.impact || 0), 0);
  const boost = Math.min((score / 100) * 50, 50);
  const spend = works.reduce((a, w) => a + (w.cost || 0), 0);

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm font-bold text-white truncate">{seat.constituency}</p>
        </div>
        <span className="text-[10px] bg-red-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
          {seat.positions.join(" · ")}
        </span>
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">{seat.party_name || "Independent"}</p>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {[["Works", works.length, "text-white"], ["Spend", formatCoins(spend), "text-yellow-400"], ["Boost", `+${boost.toFixed(0)}%`, "text-green-400"]].map(([l, v, c]) => (
          <div key={l} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
            <p className={`text-xs font-bold ${c}`}>{v}</p>
            <p className="text-[8px] text-zinc-500 uppercase">{l}</p>
          </div>
        ))}
      </div>

      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full" style={{ width: `${Math.min(boost * 2, 100)}%` }} />
      </div>

      <button onClick={() => setOpen(!open)} disabled={busy}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
        <Hammer className="w-3.5 h-3.5" /> {open ? "Close" : "Start Constituency Work"}
      </button>
      {open && <WorkTypePicker eCoins={eCoins} busy={busy} onSelect={onStartWork} />}

      {works.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-800">
          <p className="text-[9px] text-zinc-500 uppercase font-semibold mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Work Log
          </p>
          <div className="space-y-1">
            {works.slice(0, 5).map(w => (
              <div key={w.id} className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                <p className="text-[11px] text-zinc-300 truncate flex-1">{w.name}</p>
                <span className="text-[10px] text-yellow-400 flex-shrink-0">{formatCoins(w.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}