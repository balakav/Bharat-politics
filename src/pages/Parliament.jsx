import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Crown, Building2, ChevronRight, ScrollText, Stamp, Gavel } from "lucide-react";
import { bharat01 } from "@/api/bharat01Client";
import { NATION } from "@/lib/bharatStates";
import { partyColor } from "@/lib/partyColors";

// Parliament hub: Rajya Sabha / Lok Sabha open their session directly;
// State Assembly goes to the state list, then the chosen state's assembly.
// Party details come from the live admin-created ParliamentSetup.

export default function Parliament() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  useEffect(() => {
    bharat01.entities.ParliamentSetup.filter({ scope: "national" }, "-created_date", 5)
      .then(s => setSetup(s[0] || null)).catch(() => setSetup(null));
  }, []);
  const houses = [
    { title: "President", desc: "National bills awaiting assent — view only", icon: ScrollText, path: "/parliament/president" },
    { title: "Rajya Sabha", desc: "National council — view-only house", icon: Crown, path: "/parliament/rajya-sabha" },
    { title: "Lok Sabha", desc: setup ? `Ruling: ${setup.winning_party_name} · ${setup.government_seats}/${setup.total_seats} seats` : "House of the People — directly elected MPs", icon: Landmark, path: "/parliament/lok-sabha" },
    { title: "Governor", desc: "State bills awaiting assent — view only", icon: Stamp, path: "/parliament/governor" },
    { title: "Legislative Assembly", desc: "21 state legislatures — pick a state", icon: Building2, path: "/states" },
    { title: "Speaker's Office", desc: "National & state Speakers — bill admission and certification", icon: Gavel, path: "/speaker-office" },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Parliament</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-5">{NATION.name} · President · Rajya Sabha · Lok Sabha · Governor · Legislative Assembly · Speaker</p>

      <div className="space-y-3">
        {houses.map(h => (
          <button key={h.title} onClick={() => navigate(h.path)}
            className="w-full text-left bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-4 border border-yellow-500/25 hover:border-yellow-400/60 transition-all flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 flex items-center justify-center flex-shrink-0">
              <h.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white">{h.title}</p>
              <p className="text-xs text-zinc-400 truncate">{h.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          </button>
        ))}
      </div>

      {/* Party details — the live ruling-party breakdown of the Lok Sabha */}
      {setup && (() => {
        const coal = JSON.parse(setup.coalition || "[]");
        const sup = JSON.parse(setup.supporters || "[]");
        return (
          <div className="mt-4 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Party Details · Lok Sabha</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: partyColor(setup.winning_party_name) }} />
              <p className="text-sm font-bold text-white truncate flex-1">{setup.winning_party_name}</p>
              <span className="text-xs font-semibold text-green-400 flex-shrink-0">{setup.winning_party_seats} seats</span>
            </div>
            {coal.length > 0 && <p className="text-[10px] text-zinc-400 mb-1">Coalition: {coal.map(p => `${p.name} (${p.seats})`).join(", ")}</p>}
            {sup.length > 0 && <p className="text-[10px] text-zinc-400 mb-1">Outside support: {sup.map(p => `${p.name} (${p.seats})`).join(", ")}</p>}
            <p className="text-[10px] text-zinc-500">Government {setup.government_seats} · Opposition {setup.opposition_seats} · Majority {setup.majority_mark}</p>
          </div>
        );
      })()}
    </div>
  );
}