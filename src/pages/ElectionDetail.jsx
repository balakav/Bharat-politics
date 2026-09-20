import React, { useState, useEffect, useCallback, useRef } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getStateById } from "@/lib/bharatStates";
import { getConstituenciesForElection, getPositionForElection, declareResults, setElectionStatus } from "@/lib/bharatElectionService";
import { ArrowLeft, Users, Vote, BarChart3, Trophy, UserPlus, Megaphone, Clock, Globe2, MapPin, ShieldCheck, Lock, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import WinCelebration from "@/components/game/WinCelebration";
import GovernmentCertificate from "@/components/game/GovernmentCertificate";

export default function ElectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [certificateDismissed, setCertificateDismissed] = useState(false);
  const [alliances, setAlliances] = useState([]);
  const [myParty, setMyParty] = useState(null);
  const [userId, setUserId] = useState("");

  const completedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (completedRef.current) return; // stop polling once results are declared
    const me = await bharat01.auth.me();
    setIsAdmin(me.role === "admin");
    setUserId(me.id);
    const el = await bharat01.entities.Election.get(id);
    const [cands, profiles, allAlliances] = await Promise.all([
      bharat01.entities.Candidature.filter({ election_id: id }, '-votes_received', 1000),
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.Alliance.list(),
    ]);
    if (el?.results_declared || el?.status === "completed") completedRef.current = true;
    setElection(el);
    setCandidates(cands);
    setAlliances(allAlliances);
    if (profiles.length > 0) {
      setProfile(profiles[0]);
      if (profiles[0].party_id) {
        try { setMyParty(await bharat01.entities.PoliticalParty.get(profiles[0].party_id)); } catch (e) {}
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 20000);

  async function handleOpenVoting() {
    await setElectionStatus(id, "voting");
    await loadData();
  }
  async function handleDeclare() {
    setDeclaring(true);
    try { await declareResults(id); await loadData(); } finally { setDeclaring(false); }
  }

  async function handleRemoveCandidate(c) {
    await bharat01.entities.Candidature.delete(c.id);
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const state = election?.state_id ? getStateById(election.state_id) : null;
  const isNational = election?.election_type === "national";
  const isCompleted = election?.results_declared || election?.status === "completed";
  const isCampaign = election?.status === "campaign";
  const isVoting = election?.status === "voting";
  // Candidate delete is reserved for the party leader who nominated that person
  // to that constituency — i.e. the party president who created the candidature
  // (bulk nomination). Everyone else, including other leaders and admins, only views.
  const isPartyPresident = myParty && profile && myParty.president_id === profile.player_id;
  const canDeleteCandidate = (c) =>
    !isCompleted && !!isPartyPresident && c.party_id === myParty.id && c.created_by_id === userId;

  // Home-state gating applies to STATE elections only. The national (Lok Sabha)
  // election is open to EVERY party — any party president can bulk-apply their
  // candidates from any state.
  const isHomeState = isAdmin || isNational || (!!state && profile?.home_state_id === election.state_id);
  const canPlay = isHomeState;

  const sortedCandidates = [...candidates].sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
  const topCandidates = isCompleted ? sortedCandidates.slice(0, 30) : sortedCandidates;
  const myCands = sortedCandidates.filter(c => c.player_id === profile?.player_id);
  const displayCandidates = isCompleted ? [...new Set([...topCandidates, ...myCands])] : sortedCandidates;
  const myWins = myCands.filter(c => c.result === 'won');
  const myLosses = myCands.filter(c => c.result === 'lost');

  // Government certificate (majority / coalition)
  const majorityMark = election?.majority_mark || 0;
  const partySeats = {};
  const allianceSeatMap = {};
  for (const c of candidates) {
    if (c.result !== 'won') continue;
    const party = c.party_name || 'Independent';
    partySeats[party] = (partySeats[party] || 0) + 1;
    for (const a of alliances) {
      if ((a.member_party_names || []).includes(party)) {
        if (!allianceSeatMap[a.name]) allianceSeatMap[a.name] = { count: 0, parties: a.member_party_names };
        allianceSeatMap[a.name].count += 1;
      }
    }
  }
  let certificateData = null;
  for (const [party, seats] of Object.entries(partySeats)) {
    if (seats >= majorityMark) {
      const leader = candidates.filter(c => c.result === 'won' && (c.party_name || 'Independent') === party).sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0))[0];
      certificateData = { name: party, seats, majorityMark, isAlliance: false, leaderName: leader?.player_name || '', leaderConstituency: leader?.constituency || '' };
      break;
    }
  }
  if (!certificateData) {
    for (const [name, data] of Object.entries(allianceSeatMap)) {
      if (data.count >= majorityMark) {
        const leader = candidates.filter(c => c.result === 'won' && (data.parties || []).includes(c.party_name || 'Independent')).sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0))[0];
        certificateData = { name, seats: data.count, majorityMark, isAlliance: true, coalitionParties: data.parties, leaderName: leader?.player_name || '', leaderConstituency: leader?.constituency || '' };
        break;
      }
    }
  }

  const statusBadge = {
    campaign: { color: "bg-yellow-500/20 text-yellow-400", label: "Campaign Period" },
    voting: { color: "bg-green-500/20 text-green-400", label: "Voting Live" },
    completed: { color: "bg-blue-500/20 text-blue-400", label: "Results Declared" },
    upcoming: { color: "bg-zinc-500/20 text-zinc-400", label: "Upcoming" },
  };
  const sb = statusBadge[election?.status] || statusBadge.upcoming;

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {isCompleted && myWins.length > 0 && !celebrationDismissed && (
        <WinCelebration wins={myWins}
          positionLabel={myWins.length > 0 ? getPositionForElection(election.election_type) : ""}
          onDismiss={() => setCelebrationDismissed(true)} />
      )}
      {isCompleted && certificateData && !certificateDismissed && (
        <GovernmentCertificate partyName={certificateData.name} seats={certificateData.seats}
          majorityMark={certificateData.majorityMark} isAlliance={certificateData.isAlliance}
          coalitionParties={certificateData.coalitionParties} leaderName={certificateData.leaderName}
          leaderConstituency={certificateData.leaderConstituency} onDismiss={() => setCertificateDismissed(true)} />
      )}

      {/* Header */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
        <div className="flex items-center gap-2 mb-1">
          {isNational ? <Globe2 className="w-4 h-4 text-yellow-400" /> : (state ? <MapPin className="w-4 h-4 text-yellow-400" /> : null)}
          <p className="text-xs text-zinc-500">{isNational ? "National General Election" : (state?.name || election?.state_name || "")}</p>
        </div>
        <h1 className="text-xl font-bold text-white">{election?.title}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${sb.color}`}>
            {declaring ? "Counting..." : sb.label}
          </span>
          <span className="text-xs text-zinc-500">{election?.total_seats} seats</span>
          <span className="text-xs text-zinc-500">Majority: {election?.majority_mark}</span>
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && !isCompleted && (
        <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Admin Controls</p>
          <div className="flex gap-2">
            {isCampaign && (
              <button onClick={handleOpenVoting} disabled={declaring}
                className="flex-1 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Vote className="w-4 h-4" /> Open Voting
              </button>
            )}
            {isVoting && (
              <button onClick={handleDeclare} disabled={declaring}
                className="flex-1 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
                <BarChart3 className="w-4 h-4" /> {declaring ? "Counting..." : "Declare Results"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Home-state lock notice */}
      {!canPlay && isCampaign && (
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-zinc-500" />
          <p className="text-xs text-zinc-400">Full candidacy is available only in your home state. This state runs as AI-only.</p>
        </div>
      )}

      {/* Winner banner */}
      {isCompleted && myWins.length > 0 && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.8 }}
          className="bg-gradient-to-r from-red-500/20 to-yellow-500/10 border border-red-500/30 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-semibold">Winner Declared</span>
          </div>
          {myWins.map(w => (
            <div key={w.id}>
              <h2 className="text-xl font-bold text-white">{w.player_name}</h2>
              <p className="text-sm text-zinc-400">{w.party_name} · {w.constituency}</p>
              <p className="text-lg font-bold text-yellow-400 mt-1">{(w.votes_received || 0).toLocaleString()} votes</p>
              <p className="text-xs text-green-400 mt-1">Position: {getPositionForElection(election.election_type)}</p>
            </div>
          ))}
        </motion.div>
      )}
      {isCompleted && myLosses.length > 0 && myWins.length === 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Vote className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400 font-semibold">Election Lost</span>
          </div>
          {myLosses.map(l => (
            <div key={l.id}>
              <h2 className="text-lg font-bold text-white">{l.player_name}</h2>
              <p className="text-sm text-zinc-400">{l.party_name} · {l.constituency}</p>
              <p className="text-sm text-zinc-500 mt-1">{(l.votes_received || 0).toLocaleString()} votes</p>
            </div>
          ))}
        </div>
      )}

      {/* Ticket status */}
      {myCands.length > 0 && !isCompleted && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm text-zinc-400 mb-2">Your Election Ticket</h3>
          <div className="space-y-2">
            {myCands.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{c.constituency}</p>
                  <p className="text-xs text-zinc-500 truncate">{c.party_name}</p>
                  {c.ticket_status === "approved" && c.ticket_number && <p className="text-[10px] text-green-400 mt-0.5">🎫 {c.ticket_number}</p>}
                </div>
                <div className="flex-shrink-0 ml-2">
                  {c.ticket_status === "approved" ? <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-semibold">Approved</span>
                    : c.ticket_status === "rejected" ? <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-semibold">Rejected</span>
                    : <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-semibold">Pending</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player actions (home state only) */}
      {canPlay && isCampaign && (
        <Link to={`/elections/${id}/register`}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-center text-sm font-bold flex items-center justify-center gap-2 mb-3">
          <UserPlus className="w-4 h-4" /> Register as Candidate
        </Link>
      )}
      {canPlay && isCampaign && myCands.length > 0 && (
        <Link to={`/elections/${id}/campaign/${myCands[0]?.id || ''}`}
          className="w-full bg-purple-600 text-white rounded-xl py-3 text-center text-sm font-bold flex items-center justify-center gap-2 mb-4">
          <Megaphone className="w-4 h-4" /> Run Campaigns
        </Link>
      )}

      {isVoting && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4 text-center">
          <Vote className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-semibold">Voting in Progress</p>
          <p className="text-xs text-zinc-500 mt-1">{isAdmin ? "Tap 'Declare Results' to count votes." : "An admin will declare results once voting closes."}</p>
        </div>
      )}
      {declaring && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-center">
          <BarChart3 className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-pulse" />
          <p className="text-yellow-400 font-semibold">Counting Votes...</p>
          <p className="text-xs text-zinc-500 mt-1">Results are being declared across all constituencies. This may take a moment.</p>
        </div>
      )}

      {/* Candidates */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" /> {isCompleted ? 'Top Candidates' : 'Registered Candidates'} ({candidates.length})
      </h2>
      {candidates.length === 0 ? (
        <div className="text-center py-8">
          <Vote className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No candidates registered yet</p>
          {canPlay && isCampaign && <p className="text-xs text-zinc-600 mt-1">Register to be the first candidate!</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {displayCandidates.map(c => {
            const isWinner = c.result === 'won';
            const maxVotes = sortedCandidates[0]?.votes_received || 1;
            const pct = maxVotes > 0 ? ((c.votes_received || 0) / maxVotes) * 100 : 0;
            return (
              <div key={c.id} className={`bg-zinc-900 rounded-xl p-3 border ${isWinner ? "border-red-500/50" : "border-zinc-800"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {isWinner && <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                    <span className="text-sm font-medium text-white truncate">{c.player_name}</span>
                    <span className="text-xs text-zinc-500 flex-shrink-0">({c.party_short || "IND"})</span>
                    {canDeleteCandidate(c) && (
                      <button onClick={() => handleRemoveCandidate(c)} title="Withdraw candidate"
                        className="ml-1 p-1 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                  {isCompleted && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-yellow-400">{(c.votes_received || 0).toLocaleString()}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isWinner ? "bg-red-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                        {isWinner ? "WON" : "LOST"}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mb-1 truncate">{c.constituency}</p>
                {isCompleted && (
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isWinner ? "bg-red-500" : "bg-zinc-600"}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {isCompleted && sortedCandidates.length > 30 && (
            <Link to="/past-results" className="block text-center text-xs text-yellow-400 py-2">
              View full constituency-wise results →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}