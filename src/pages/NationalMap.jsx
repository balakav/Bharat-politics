import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import BharatMapSVG from "@/components/nation/BharatMapSVG";
import { NATION, BHARAT_STATES, getStateById } from "@/lib/bharatStates";
import { Globe2, Crown, MapPin, Landmark, Building2, ChevronRight } from "lucide-react";

const FALLBACK_COLORS = ["#2979ff", "#00c853", "#6200ea", "#ff9100", "#ff5252", "#00bcd4", "#e91e63"];

function partyColorFor(partyName) {
  if (!partyName) return null;
  // Player-created parties get a deterministic color from their name
  let h = 0;
  for (let i = 0; i < partyName.length; i++) h = (h * 31 + partyName.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

// Nation screen — 100% live data. The map is colored by the CURRENT
// governments; a state with no government stays unclaimed, and its panel
// shows "no one can form the government". No simulated/fake results.

export default function NationalMap() {
  const [governments, setGovernments] = useState([]);
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [govs, els] = await Promise.all([
          bharat01.entities.Government.list('-created_date', 200),
          bharat01.entities.Election.list('-created_date', 200),
        ]);
        setGovernments(govs);
        setElections(els.filter(e => e.election_type === "national" || e.state_id));
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const colorFor = (stateId) => {
    const gov = governments.find(g => g.state_id === stateId && g.is_active);
    if (!gov) return null;
    // Admin-edited map color takes priority over the automatic party color.
    return gov.map_color || partyColorFor(gov.party_name);
  };

  // Live legend — only parties actually in government somewhere.
  const legendParties = [];
  for (const g of governments) {
    if (!g.is_active || g.is_active === false) continue;
    if (!g.party_name || legendParties.some(p => p.name === g.party_name)) continue;
    legendParties.push({
      name: g.party_name,
      short: g.party_name.split(" ").map(w => w[0]).join("").slice(0, 4).toUpperCase(),
      color: g.map_color || partyColorFor(g.party_name),
    });
  }

  const stateCount = BHARAT_STATES.length;
  const assemblyTotal = BHARAT_STATES.reduce((sum, s) => sum + s.assemblySeats, 0);

  const selState = selected ? getStateById(selected) : null;
  const selGov = selected ? governments.find(g => g.state_id === selected && g.is_active) : null;
  const selElections = selected ? elections.filter(e => e.state_id === selected) : [];
  const selActive = selElections.find(e => !e.results_declared);
  let selCab = null;
  try { selCab = selGov?.cabinet ? JSON.parse(selGov.cabinet) : null; } catch (e) {}

  const govColor = {
    majority: "bg-green-500/20 text-green-400",
    coalition: "bg-yellow-500/20 text-yellow-400",
    hung: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Globe2 className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">{NATION.name}</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-4">{NATION.name} · {stateCount} States · General Election</p>

      {/* National stats — live from the config */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <p className="text-lg font-bold text-white">{stateCount}</p>
          <p className="text-[9px] text-zinc-500 uppercase">States</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <p className="text-lg font-bold text-white">{assemblyTotal}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Assembly</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <p className="text-lg font-bold text-yellow-400">{NATION.lokSabhaSeats}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Lok Sabha</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-zinc-800">
          <p className="text-lg font-bold text-red-400">{NATION.lokSabhaMajority}</p>
          <p className="text-[9px] text-zinc-500 uppercase">Majority</p>
        </div>
      </div>

      {/* Interactive SVG map — live government colors only */}
      <div className="mb-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : (
          <BharatMapSVG colorFor={colorFor} onSelect={setSelected} selectedId={selected} parties={legendParties} />
        )}
        <p className="text-[10px] text-zinc-500 text-center mt-2">Tap a state to view its details · States stay white until a government is formed</p>
      </div>

      {/* Inline state detail panel — current data only */}
      {selState && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-yellow-500/30 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-xl flex items-center justify-center text-white font-bold text-xs">{selState.id}</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{selState.name}</h2>
              <p className="text-[11px] text-zinc-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selState.capital}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 text-xs">Close</button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-white">{selState.assemblySeats}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Assembly</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-yellow-400">{selState.assemblyMajority}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Majority</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-white">{selState.lokSabhaSeats}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Lok Sabha</p>
            </div>
          </div>

          {selActive ? (
            <Link to={`/elections/${selActive.id}`} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2.5 mb-3 border border-zinc-700/50">
              {selActive.election_type === "lok_sabha" ? <Building2 className="w-4 h-4 text-yellow-400" /> : <Landmark className="w-4 h-4 text-yellow-400" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{selActive.title}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{selActive.status}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </Link>
          ) : (
            <p className="text-[11px] text-zinc-600 mb-3">No active election in this state.</p>
          )}

          {selGov ? (
            <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-xl p-3 border border-yellow-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-zinc-400">Government</p>
              </div>
              <p className="text-sm font-bold text-white">{selGov.party_name}</p>
              <p className="text-[11px] text-zinc-400">{selGov.head_title}: {selGov.head_player_name}</p>
              {selCab?.status && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${govColor[selCab.status]}`}>{selCab.status}</span>
                  <span className="text-[10px] text-zinc-500">{selCab.total_seats || 0} seats · Majority {selCab.majority_mark || "?"}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600">No one can form the government yet.</p>
          )}

          <Link to={`/states/${selState.id}`} className="mt-3 block text-center text-xs text-yellow-400">Open state page →</Link>
        </div>
      )}

      {/* States grid — clickable, live colors */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">States</h2>
      <div className="grid grid-cols-2 gap-2">
        {BHARAT_STATES.map(s => {
          const winColor = colorFor(s.id) || "#3f3f46";
          return (
            <Link key={s.id} to={`/states/${s.id}`}
              className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: winColor + "33", color: winColor }}>{s.id}</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: winColor }} />
              </div>
              <p className="text-xs font-semibold text-white truncate">{s.name}</p>
              <p className="text-[10px] text-zinc-500">{s.assemblySeats} AC · {s.lokSabhaSeats} LS</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}