import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION, getStateById, generateAssemblyConstituencies, generateLokSabhaConstituencies } from "@/lib/bharatStates";
import { createElection, createNationalElection, createByElection, setElectionStatus, declareResults } from "@/lib/bharatElectionService";
import { Megaphone, Landmark, Building2, Globe2, ChevronRight, Vote, RotateCcw } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import ElectionStagePanel from "@/components/election/ElectionStagePanel";

export default function AdminElections() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [elections, setElections] = useState([]);
  const [busy, setBusy] = useState(null);
  // By-election controls: any MLA / MP constituency.
  const [beState, setBeState] = useState(BHARAT_STATES[0].id);
  const [beHouse, setBeHouse] = useState("vidhan_sabha");
  const [beConstituency, setBeConstituency] = useState("");

  const load = useCallback(async () => {
    const me = await bharat01.auth.me();
    if (me.role !== "admin") { navigate("/"); return; }
    const all = await bharat01.entities.Election.list("-created_date", 200);
    setElections(all.filter(e => e.election_type === "national" || e.state_id));
    setReady(true);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 30000);

  function activeFor(stateId, type) {
    return elections.find(e => e.state_id === stateId && e.election_type === type && !e.results_declared);
  }
  const nationalActive = elections.find(e => e.election_type === "national" && !e.results_declared);

  async function announce(stateId) {
    setBusy(`vidhan_sabha-${stateId}`);
    try { await createElection(stateId, "vidhan_sabha"); await load(); } finally { setBusy(null); }
  }
  async function announceNational() {
    setBusy("national");
    try { await createNationalElection(); await load(); } finally { setBusy(null); }
  }
  async function startVoting(el) {
    setBusy("stage-" + el.id);
    try { await setElectionStatus(el.id, "voting"); await load(); } finally { setBusy(null); }
  }
  async function declare(el) {
    setBusy("stage-" + el.id);
    try { await declareResults(el.id); await load(); } finally { setBusy(null); }
  }
  async function announceByElection() {
    if (!beConstituency) return;
    setBusy("by-election");
    try {
      await createByElection(beState, beHouse, beConstituency);
      setBeConstituency("");
      await load();
    } finally { setBusy(null); }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const beStateObj = getStateById(beState);
  const beConstituencies = beHouse === "vidhan_sabha"
    ? (beStateObj ? generateAssemblyConstituencies(beStateObj).map(c => c.name) : [])
    : (beStateObj ? generateLokSabhaConstituencies(beStateObj).map(c => c.name) : []);
  const activeByElections = elections.filter(e => e.cycle_key === "by_election" && !e.results_declared);

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Election Commission</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-4">Election Commissioner (admin) · announce and manage election stages: Nomination → Voting → Results</p>

      <Link to="/elections" className="flex items-center gap-2 text-xs text-yellow-400 mb-4">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Elections
      </Link>

      {/* National General Election — the single common Lok Sabha election */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
            <Globe2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">National General Election (Lok Sabha)</h3>
            <p className="text-xs text-zinc-500">{NATION.lokSabhaSeats} Lok Sabha seats · Majority {NATION.lokSabhaMajority} · common for all 21 states</p>
          </div>
        </div>
        {nationalActive ? (
          <ElectionStagePanel election={nationalActive} busy={busy} onStartVoting={startVoting} onDeclare={declare} />
        ) : (
          <button onClick={announceNational} disabled={busy === "national"}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Vote className="w-4 h-4" /> Announce National Election
          </button>
        )}
      </div>

      {/* By-Election — any MLA / MP constituency */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Announce By-Election</h3>
        </div>
        <p className="text-[11px] text-zinc-500 mb-3">Pick any vacated MLA (Assembly) or MP (Lok Sabha) constituency and send it back to the polls.</p>
        <div className="space-y-2">
          <select value={beState} onChange={e => { setBeState(e.target.value); setBeConstituency(""); }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white">
            {BHARAT_STATES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => { setBeHouse("vidhan_sabha"); setBeConstituency(""); }}
              className={`text-[10px] py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 border transition-all ${beHouse === "vidhan_sabha" ? "bg-orange-500/20 text-amber-400 border-orange-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
              <Landmark className="w-3 h-3" /> MLA (Assembly)
            </button>
            <button onClick={() => { setBeHouse("lok_sabha"); setBeConstituency(""); }}
              className={`text-[10px] py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 border transition-all ${beHouse === "lok_sabha" ? "bg-orange-500/20 text-amber-400 border-orange-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
              <Building2 className="w-3 h-3" /> MP (Lok Sabha)
            </button>
          </div>
          <select value={beConstituency} onChange={e => setBeConstituency(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white">
            <option value="">Select constituency…</option>
            {beConstituencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={announceByElection} disabled={busy === "by-election" || !beConstituency}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Megaphone className="w-4 h-4" /> Announce By-Election
          </button>
        </div>
        {activeByElections.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Active By-Elections</p>
            {activeByElections.map(e => (
              <div key={e.id}>
                <ElectionStagePanel election={e} busy={busy} onStartVoting={startVoting} onDeclare={declare} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* State Assembly elections — Lok Sabha is the single national election above */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">State Assembly Elections</h2>
      <div className="grid grid-cols-1 gap-3">
        {BHARAT_STATES.map(s => {
          const active = activeFor(s.id, "vidhan_sabha");
          return (
            <div key={s.id} className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px]">{s.id}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{s.name}</h3>
                  <p className="text-[10px] text-zinc-500">{s.assemblySeats} AC · Majority {s.assemblyMajority}</p>
                </div>
              </div>

              {active ? (
                <ElectionStagePanel election={active} busy={busy} onStartVoting={startVoting} onDeclare={declare} />
              ) : (
                <button onClick={() => announce(s.id)} disabled={busy === `vidhan_sabha-${s.id}`}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Megaphone className="w-3.5 h-3.5" /> Announce Assembly Election
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}