import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Landmark, Building2, MapPin, Crown, AlertTriangle, ChevronRight } from "lucide-react";
import { getStateById } from "@/lib/bharatStates";
import { bharat01 } from "@/api/bharat01Client";
import { getAssemblyResults, getNationalResults } from "@/lib/electionResults";
import { getNationalConstituencies } from "@/lib/bharatElectionService";
import PartySeatBar from "@/components/election/PartySeatBar";

export default function StateDetail() {
  const { stateId } = useParams();
  const state = getStateById(stateId);

  const [govData, setGovData] = useState(null);
  const [elections, setElections] = useState([]);
  const [nationalElection, setNationalElection] = useState(null);
  const [asmWinners, setAsmWinners] = useState([]);
  const [natWinners, setNatWinners] = useState([]);
  const [constToState, setConstToState] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state) return;
    (async () => {
      try {
        // Live data only — no simulated election runs.
        const [govs, els, nat] = await Promise.all([
          bharat01.entities.Government.filter({ state_id: state.id }),
          bharat01.entities.Election.filter({ state_id: state.id }),
          bharat01.entities.Election.filter({ election_type: "national", results_declared: false }),
        ]);
        setGovData(govs.find(g => g.is_active) || govs[0] || null);
        setElections(els);
        setNationalElection(nat[0] || null);
        // Completed results — party-wise summaries for both election cards.
        const [asm, natl] = await Promise.all([
          getAssemblyResults(state.id).catch(() => ({ winners: [] })),
          getNationalResults().catch(() => ({ winners: [] })),
        ]);
        setAsmWinners(asm.winners || []);
        setNatWinners(natl.winners || []);
        setConstToState(Object.fromEntries(getNationalConstituencies().map(c => [c.name, c.state_id])));
      } catch (e) {}
      setLoading(false);
    })();
  }, [state?.id]);

  if (!state) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
          <p className="text-white font-medium">State not found</p>
          <p className="text-xs text-zinc-500 mt-1">Unknown state identifier: {stateId}</p>
        </div>
      </div>
    );
  }

  const byNewest = (a, b) => new Date(b.created_date) - new Date(a.created_date);
  const assemblyActive = [...elections]
    .filter(e => e.election_type === "vidhan_sabha" && !e.results_declared)
    .sort(byNewest)[0];
  const lsActive = [...elections]
    .filter(e => e.election_type === "lok_sabha" && !e.results_declared)
    .sort(byNewest)[0];

  // Party-wise seat counts from the completed elections (live data).
  const countSeats = (list) => {
    const counts = {};
    for (const w of list) {
      const k = w.party_name || "Independent";
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats);
  };
  const asmSeats = countSeats(asmWinners);
  const lsSeats = countSeats(natWinners.filter(w => constToState[w.constituency] === state.id));

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">

      {/* State header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl flex items-center justify-center">
            <Landmark className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{state.name}</h1>
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Capital: {state.capital}
              {state.isNationalCapital && <span className="text-yellow-400 font-semibold"> · National Capital</span>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
            <p className="text-lg font-bold text-white">{state.assemblySeats}</p>
            <p className="text-[10px] text-zinc-500 uppercase">Assembly</p>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{state.assemblyMajority}</p>
            <p className="text-[10px] text-zinc-500 uppercase">Majority</p>
          </div>
          <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
            <p className="text-lg font-bold text-white">{state.lokSabhaSeats}</p>
            <p className="text-[10px] text-zinc-500 uppercase">Lok Sabha</p>
          </div>
        </div>
      </div>

      {/* Government (live record) */}
      {(() => {
        if (loading) {
          return (
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4 flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          );
        }
        if (!govData) {
          return (
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4 text-center">
              <Crown className="w-5 h-5 text-zinc-600 mx-auto mb-1" />
              <p className="text-xs text-zinc-500">No government formed yet — results not declared.</p>
            </div>
          );
        }
        let cab = null;
        try { cab = govData.cabinet ? JSON.parse(govData.cabinet) : null; } catch (e) {}
        const govBadge = cab?.status === "majority" ? "bg-green-500/20 text-green-400"
          : cab?.status === "coalition" ? "bg-yellow-500/20 text-yellow-400"
          : "bg-red-500/20 text-red-400";
        return (
          <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-2xl p-4 border border-yellow-500/30 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h2 className="text-sm font-semibold text-white">State Government</h2>
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-lg font-bold text-white truncate">{govData.party_name}</p>
                <p className="text-xs text-zinc-400">{govData.head_title}: {govData.head_player_name}</p>
              </div>
              {cab?.status && (
                <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase whitespace-nowrap ml-2 ${govBadge}`}>{cab.status}</span>
              )}
            </div>
            {cab && (
              <p className="text-[11px] text-zinc-500 mt-2">{cab.total_seats || 0} seats won · Majority mark {cab.majority_mark || "?"}</p>
            )}
          </div>
        );
      })()}

      <Link to={`/assembly/${state.id}`} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl mb-4">
        <Landmark className="w-4 h-4" /> Open Legislative Assembly
      </Link>

      {/* Assembly Election — live data from the Election Commission */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="w-5 h-5 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">Assembly Election</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-2">{state.assemblySeats} constituencies · Majority {state.assemblyMajority}</p>
        {loading ? (
          <div className="w-5 h-5 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        ) : assemblyActive ? (
          <Link to={`/elections/${assemblyActive.id}`} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{assemblyActive.title}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{assemblyActive.status} · {assemblyActive.total_seats || state.assemblySeats} seats</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </Link>
        ) : (
          <p className="text-[11px] text-zinc-600">No active assembly election — the Election Commission announces elections from the admin panel.</p>
        )}
        {asmSeats.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1.5">Latest results — MLA seats party-wise</p>
            <PartySeatBar seats={asmSeats} />
          </div>
        )}
      </div>

      {/* Lok Sabha — the single national election + any state by-election */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">Lok Sabha Election</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-2">{state.lokSabhaSeats} parliamentary constituencies · contested in the National General Election</p>
        {loading ? (
          <div className="w-5 h-5 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        ) : lsActive ? (
          <Link to={`/elections/${lsActive.id}`} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{lsActive.title}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{lsActive.status} · 1 seat</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </Link>
        ) : nationalElection ? (
          <Link to={`/elections/${nationalElection.id}`} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{nationalElection.title}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{nationalElection.status} · {state.lokSabhaSeats} seats at stake</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </Link>
        ) : (
          <p className="text-[11px] text-zinc-600">No active Lok Sabha election.</p>
        )}
        {lsSeats.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1.5">Latest results — MP seats won in {state.name}, party-wise</p>
            <PartySeatBar seats={lsSeats} />
          </div>
        )}
      </div>
    </div>
  );
}