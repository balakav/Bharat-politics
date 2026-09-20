import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { setElectionStatus, declareResults } from "@/lib/bharatElectionService";
import StateElectionCard from "@/components/election/StateElectionCard";
import { Landmark, BarChart3, Trophy, Globe2, ChevronRight, Megaphone } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function Elections() {
  const [elections, setElections] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadData = useCallback(async () => {
    const me = await bharat01.auth.me();
    setIsAdmin(me.role === "admin");
    const [allElections, profiles] = await Promise.all([
      bharat01.entities.Election.list('-created_date', 200),
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
    ]);
    // Only Bharat elections: national OR state-scoped. Excludes legacy TN/RMC/Panchayat.
    const bharatElections = allElections.filter(e => e.election_type === "national" || e.state_id);
    setElections(bharatElections);
    if (profiles.length > 0) setProfile(profiles[0]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 60000);

  async function refresh() { await loadData(); }

  async function openVoting(electionId) {
    setBusyId(electionId);
    try { await setElectionStatus(electionId, "voting"); await refresh(); } finally { setBusyId(null); }
  }
  async function declare(electionId) {
    setBusyId(electionId);
    try { await declareResults(electionId); await refresh(); } finally { setBusyId(null); }
  }
  async function setHome(stateId) {
    if (!profile) return;
    await bharat01.entities.PlayerProfile.update(profile.id, { home_state_id: stateId });
    setProfile(prev => ({ ...prev, home_state_id: stateId }));
  }

  // Only ongoing elections — completed ones live under Past Election Results.
  const activeElections = elections.filter(e => !e.results_declared && e.status !== "completed");
  const nationalElection = activeElections.find(e => e.election_type === "national");
  // Only states that actually have an active election.
  const statesWithElections = BHARAT_STATES.filter(s => activeElections.some(e => e.state_id === s.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const natStatus = nationalElection?.status;
  const natStatusConfig = { campaign: "bg-yellow-500/20 text-yellow-400", voting: "bg-green-500/20 text-green-400", completed: "bg-blue-500/20 text-blue-400" };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Elections</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-3">{NATION.name} · 21 states · {NATION.lokSabhaSeats} Lok Sabha seats</p>

      {/* Admin announce link */}
      {isAdmin && (
        <Link to="/admin/elections" className="block bg-gradient-to-r from-orange-500/15 to-yellow-400/15 border border-yellow-500/30 rounded-2xl p-3 mb-4 hover:from-orange-500/25 hover:to-yellow-400/25 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-xl flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Announce Elections</p>
              <p className="text-xs text-zinc-400">Create new state or national elections</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          </div>
        </Link>
      )}

      {/* Home state prompt */}
      {!isAdmin && !profile?.home_state_id && (
        <div className="bg-zinc-900 rounded-2xl p-3 border border-yellow-500/30 mb-4">
          <p className="text-sm text-yellow-400 font-semibold mb-1">Choose your home state</p>
          <p className="text-xs text-zinc-400">Tap "Set as Home State" on any card below to unlock the full candidacy & campaign flow there.</p>
        </div>
      )}

      {/* National Lok Sabha Election banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-xl flex items-center justify-center">
            <Globe2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">National Lok Sabha Election</h3>
            <p className="text-xs text-zinc-500">{NATION.lokSabhaSeats} seats · Majority {NATION.lokSabhaMajority}</p>
          </div>
        </div>
        {nationalElection ? (
          <Link to={`/elections/${nationalElection.id}`} className="flex items-center justify-between bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
            <div>
              <p className="text-xs text-white font-medium">{nationalElection.title}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${natStatusConfig[natStatus] || "bg-zinc-700"}`}>{natStatus}</span>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && natStatus === "campaign" && (
                <button onClick={(e) => { e.preventDefault(); openVoting(nationalElection.id); }} disabled={busyId === nationalElection.id}
                  className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-lg font-semibold disabled:opacity-50">Open Voting</button>
              )}
              {isAdmin && natStatus === "voting" && (
                <button onClick={(e) => { e.preventDefault(); declare(nationalElection.id); }} disabled={busyId === nationalElection.id}
                  className="text-[10px] bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white px-2 py-1 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Declare
                </button>
              )}
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </Link>
        ) : (
          <p className="text-xs text-zinc-500">No national election scheduled{isAdmin ? " — announce from the admin page" : ""}.</p>
        )}
      </div>

      {/* State cards — only states with an election */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">State Elections</h2>
      {statesWithElections.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {statesWithElections.map(state => (
            <StateElectionCard key={state.id} state={state} elections={activeElections} isAdmin={isAdmin}
              isHome={profile?.home_state_id === state.id} busyId={busyId}
              onOpenVoting={openVoting} onDeclare={declare} onSetHome={setHome} />
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Landmark className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No state elections yet</p>
          <p className="text-xs text-zinc-500 mt-1">{isAdmin ? "Announce an election from the admin page to see states here." : "Check back once an election is announced."}</p>
        </div>
      )}

      {/* Past results */}
      <Link to="/past-results" className="mt-4 block bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Past Election Results</h3>
              <p className="text-xs text-zinc-500">View results of all completed elections</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
      </Link>
    </div>
  );
}