import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getStateById } from "@/lib/bharatStates";
import { getCurrentGameTime, formatGameTime, gameDayNumber, getGameConfig } from "@/lib/gameTime";
import { getAssemblyResults } from "@/lib/electionResults";
import AssemblyChamber from "@/components/assembly/AssemblyChamber";
import ParliamentChamber from "@/components/parliament/ParliamentChamber";
import ParliamentFloor from "@/components/parliament/ParliamentFloor";
import BillVotePanel from "@/components/parliament/BillVotePanel";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { ArrowLeft, Landmark, Crown, Users, Megaphone, ShieldAlert, Clock, Briefcase } from "lucide-react";

const positionLabel = (p) => ({ pm: "PM", cm: "CM", speaker: "Speaker", deputy_cm: "Deputy CM", union_minister: "Union Minister", minister: "Minister" }[p] || "Minister");

export default function Assembly() {
  const { stateId } = useParams();
  const navigate = useNavigate();
  const state = getStateById(stateId);
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState(null);
  const [winners, setWinners] = useState([]);
  const [government, setGovernment] = useState(null);
  const [ministers, setMinisters] = useState([]);
  const [presidentRule, setPresidentRule] = useState(null);
  const [gameNow, setGameNow] = useState(null);
  const [setup, setSetup] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const loadData = useCallback(async () => {
    if (!state) { setLoading(false); return; }
    // Central election-results source — same data as every other screen.
    const { election: el, winners: won } = await getAssemblyResults(stateId);
    setElection(el);
    setWinners(el ? [...won].sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0)) : []);
    const govs = await base44.entities.Government.filter({ state_id: stateId, type: "state" }, "-created_date", 50);
    const gov = govs.find(g => g.is_active) || govs[0] || null;
    setGovernment(gov);
    let mins = [];
    if (gov) mins = await base44.entities.Minister.filter({ government_id: gov.id, is_active: true });
    setMinisters(mins);
    const prs = await base44.entities.PresidentRule.filter({ state_id: stateId, status: "active" }, "-created_date", 10);
    setPresidentRule(prs[0] || null);
    const setups = await base44.entities.ParliamentSetup.filter({ scope: "state", state_id: stateId }, "-created_date", 5);
    setSetup(setups[0] || null);
    const cfg = await getGameConfig();
    setGameNow(await getCurrentGameTime());
    setLoading(false);
  }, [stateId, state]);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  if (!state) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <p className="text-white">State not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const pr = presidentRule;
  const cm = ministers.find(m => m.position === "cm");
  const speaker = ministers.find(m => m.position === "speaker");
  const cabinet = ministers.filter(m => m.position !== "cm" && m.position !== "speaker");
  const majorityMark = election?.majority_mark || state.assemblyMajority;
  // Party-wise MLA counts — powers the whip's party-line voting on the floor.
  const partySeats = Object.entries(winners.reduce((acc, w) => {
    const p = w.party_name || "Independent";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {})).map(([party, count]) => ({ party, count }));

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-end mb-3">
        <Link to={`/government?state=${state.id}`}
          className="text-[11px] bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5" /> Full Govt Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Legislative Assembly</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-3">{state.name} · {state.assemblySeats} seats · Majority {state.assemblyMajority}</p>

      {/* President's Rule banner */}
      {pr && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-red-400 uppercase">President's Rule Active</h2>
          </div>
          <p className="text-xs text-zinc-300">No elected government. Government, minister and budget actions are suspended.</p>
          <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Ends: {formatGameTime(pr.ends_game_time)}</p>
        </div>
      )}

      {/* Current session / chamber — admin-created round-table parliament takes priority */}
      {setup ? (
        <>
          <ParliamentChamber setup={setup} selectedSeat={selectedSeat} onSeatClick={setSelectedSeat} winners={winners} ministers={ministers} />
          <ParliamentFloor channelKey={stateId} speakerName={ministers.find(m => m.position === "speaker")?.player_name || setup.speaker_name} totalSeats={setup.total_seats} selectedSeat={selectedSeat} partySeats={partySeats} winners={winners} />
        </>
      ) : !election ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center mb-4">
          <Landmark className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-white text-sm font-medium">No completed election</p>
          <p className="text-xs text-zinc-500 mt-1">The assembly will convene after the {state.name} Assembly election results are declared.</p>
        </div>
      ) : (
        <div className="mb-4">
          <AssemblyChamber state={state} winners={winners} government={government} ministers={ministers}
            majorityMark={majorityMark} presidentsRule={!!pr} />
        </div>
      )}

      {/* Bill voting panel — the Speaker opens/closes voting; the Voting Agent tallies */}
      {(setup || election) && (
        <div className="mb-4">
          <BillVotePanel channelKey={stateId} scope="state" stateId={stateId}
            speakerName={ministers.find(m => m.position === "speaker")?.player_name || setup?.speaker_name}
            winners={winners} partySeats={partySeats} memberLabel="MLA" level="state" totalSeats={state.assemblySeats} />
        </div>
      )}

      {/* Government summary */}
      {setup && <div className="h-3" />}
      {government && !pr && (
        <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">{government.party_name}</h2>
          </div>
          <p className="text-xs text-zinc-300">{government.head_title}: <span className="text-white font-medium">{government.head_player_name}</span></p>
          {cm && <p className="text-[11px] text-zinc-500 mt-0.5">Chief Minister · {cm.party_name}</p>}
          {speaker && <p className="text-[11px] text-zinc-500">Speaker: {speaker.player_name}</p>}
        </div>
      )}

      {/* Ministers */}
      {cabinet.length > 0 && !pr && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Council of Ministers ({ministers.length})
          </h3>
          <div className="space-y-2">
            {ministers.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{m.player_name}</p>
                  <p className="text-[11px] text-zinc-500">{m.portfolio} · {m.party_name || "—"}</p>
                  {m.player_id && <p className="text-[10px] text-zinc-600">ID: {m.player_id}</p>}
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold flex-shrink-0">{positionLabel(m.position)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}