import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams } from "react-router-dom";
import { Vote, CheckCircle, Landmark, AlertCircle, ArrowLeft, RefreshCw, Share2, BarChart3, Ban } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const PARTY_COLORS = ["#2979ff", "#00c853", "#6200ea", "#ff9100", "#ff5252", "#00bcd4", "#e91e63"];

// Every party comes from the live party list — its color is derived
// deterministically from its name (no static/preset party data).
function partyColor(name, short) {
  const label = name || short || "";
  if (!label) return "#607D8B";
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return PARTY_COLORS[h % PARTY_COLORS.length];
}
function partySymbol(name, short) {
  return short || "IND";
}

export default function PublicVote() {
  const { electionId } = useParams();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [constituencies, setConstituencies] = useState([]);
  const [selectedConsti, setSelectedConsti] = useState("");
  const [selected, setSelected] = useState(null); // candidate id or "NOTA"
  const [confirming, setConfirming] = useState(false);
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({}); // candidature_id -> public vote count
  const [notaCount, setNotaCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const el = await base44.entities.Election.get(electionId);
      setElection(el);
      const cands = await base44.entities.Candidature.filter({ election_id: electionId }, undefined, 1000);
      setCandidates(cands);
      const constiSet = [...new Set(cands.map(c => c.constituency).filter(Boolean))].sort();
      setConstituencies(constiSet);
      if (constiSet.length > 0 && !selectedConsti) setSelectedConsti(constiSet[0]);
      // live public vote counts
      try {
        const pv = await base44.entities.PublicVote.filter({ election_id: electionId });
        const c = {};
        let nota = 0;
        for (const v of pv) {
          if (v.candidature_id === "NOTA") nota++;
          else c[v.candidature_id] = (c[v.candidature_id] || 0) + 1;
        }
        setCounts(c); setNotaCount(nota);
      } catch (e) {}
    } catch (e) {
      setError("Unable to load election data. The election may not be active.");
    }
    setLoading(false);
  }, [electionId, selectedConsti]);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 15000);

  function changeConsti(c) { setSelectedConsti(c); setSelected(null); setVoted(false); setConfirming(false); }

  async function castVote() {
    if (!selected || voting) return;
    setVoting(true); setError("");
    try {
      const fingerprint = navigator.userAgent + Date.now().toString(36) + Math.random().toString(36);
      if (selected === "NOTA") {
        await base44.entities.PublicVote.create({
          election_id: electionId, candidature_id: "NOTA", candidate_name: "NOTA",
          party_name: "None of the Above", party_short: "NOTA", constituency: selectedConsti, voter_fingerprint: fingerprint,
        });
      } else {
        const c = candidates.find(x => x.id === selected);
        await base44.entities.PublicVote.create({
          election_id: electionId, candidature_id: c.id, candidate_name: c.player_name,
          party_name: c.party_name || "Independent", party_short: c.party_short || "IND",
          constituency: c.constituency, voter_fingerprint: fingerprint,
        });
      }
      setVoted(true); setConfirming(false); setSelected(null);
      await loadData();
    } catch (e) {
      setError("Failed to record vote. Please try again.");
    }
    setVoting(false);
  }

  function share() {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: election?.title || "Vote now", url }).catch(() => {}); }
    else { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-zinc-950"><div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;
  }
  if (error && !election) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Election Not Available</p>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  const constiCandidates = candidates.filter(c => c.constituency === selectedConsti);
  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0) + notaCount;

  return (
    <div className="min-h-screen bg-zinc-950 p-4 max-w-md mx-auto">
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-zinc-400 mb-3"><ArrowLeft className="w-5 h-5" /> Back</button>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-6 h-6 text-yellow-400" />
          <div>
            <h1 className="text-lg font-bold text-white">{election?.title}</h1>
            <p className="text-xs text-zinc-500">Public Voting · {totalVotes} votes cast</p>
          </div>
        </div>
        <button onClick={share} className="text-zinc-400 hover:text-yellow-400 flex items-center gap-1 text-xs"><Share2 className="w-4 h-4" />{copied ? "Copied" : "Share"}</button>
      </div>

      {constituencies.length > 1 && (
        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1.5">Your Constituency</label>
          <select value={selectedConsti} onChange={e => changeConsti(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500">
            {constituencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {voted ? (
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-10 h-10 text-green-400" /></div>
          <h2 className="text-xl font-bold text-white mb-2">Vote Recorded!</h2>
          <p className="text-sm text-zinc-400 mb-1">Your vote has been cast on the EVM.</p>
          <p className="text-xs text-zinc-600 mb-2">Constituency: {selectedConsti}</p>
          <div className="bg-zinc-900/60 rounded-xl p-3 mb-4 text-left">
            <p className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Live tally ({selectedConsti})</p>
            <div className="space-y-1">
              {constiCandidates.map(c => {
                const cnt = counts[c.id] || 0;
                return <div key={c.id} className="flex justify-between text-[11px]"><span className="text-zinc-400 truncate">{c.player_name}</span><span className="text-white font-medium">{cnt}</span></div>;
              })}
              <div className="flex justify-between text-[11px]"><span className="text-zinc-500">NOTA</span><span className="text-zinc-400">{notaCount}</span></div>
            </div>
          </div>
          <button onClick={() => { setVoted(false); }} className="bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold px-6 py-3 rounded-xl text-sm flex items-center gap-2 mx-auto"><RefreshCw className="w-4 h-4" /> Next Voter</button>
        </div>
      ) : confirming ? (
        <div className="bg-gradient-to-b from-blue-900/40 to-zinc-900 rounded-2xl border-2 border-blue-700/40 p-5 text-center">
          <p className="text-xs text-blue-300 uppercase font-semibold mb-2">Confirm your vote</p>
          <p className="text-lg font-bold text-white mb-1">
            {selected === "NOTA" ? "NOTA — None of the Above" : candidates.find(c => c.id === selected)?.player_name}
          </p>
          {selected !== "NOTA" && <p className="text-xs text-zinc-400 mb-4">{candidates.find(c => c.id === selected)?.party_name}</p>}
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-xl text-sm font-semibold">Cancel</button>
            <button onClick={castVote} disabled={voting} className="flex-1 bg-gradient-to-r from-red-500 to-yellow-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {voting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Vote className="w-4 h-4" />} Confirm Vote
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-b from-blue-900/40 to-zinc-900 rounded-2xl border-2 border-blue-700/40 p-4">
          <div className="bg-blue-950/60 rounded-lg p-3 mb-3 text-center border border-blue-700/30">
            <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider">Ballot Unit</p>
            <p className="text-sm text-white font-bold">{selectedConsti}</p>
          </div>
          <p className="text-[10px] text-blue-300/70 text-center mb-2">Tap a candidate to select, then press the vote button.</p>
          {constiCandidates.length === 0 ? (
            <div className="text-center py-8"><Vote className="w-10 h-10 text-zinc-600 mx-auto mb-2" /><p className="text-sm text-zinc-500">No candidates in this constituency</p></div>
          ) : (
            <div className="space-y-2">
              {constiCandidates.map((c, i) => {
                const color = partyColor(c.party_name, c.party_short);
                const isSel = selected === c.id;
                return (
                  <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full rounded-xl p-3 border flex items-center gap-3 transition-all text-left ${isSel ? "bg-blue-600/30 border-blue-400 ring-2 ring-blue-400/50" : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700"}`}>
                    <span className="text-lg font-bold text-zinc-500 w-7 text-center flex-shrink-0">{i + 1}</span>
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {c.player_photo ? <img src={c.player_photo} alt={c.player_name} className="w-full h-full object-cover" /> : <span className="text-xs text-zinc-500">N/A</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.player_name}</p>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} /><span className="text-xs text-zinc-400 truncate">{c.party_name || "Independent"}</span></div>
                      <p className="text-xs text-yellow-400/80">{partySymbol(c.party_name, c.party_short)}</p>
                    </div>
                    {isSel && <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
              {/* NOTA */}
              <button onClick={() => setSelected("NOTA")} className={`w-full rounded-xl p-3 border flex items-center gap-3 transition-all text-left ${selected === "NOTA" ? "bg-zinc-600/40 border-zinc-400 ring-2 ring-zinc-400/50" : "bg-zinc-800/50 hover:bg-zinc-700/50 border-zinc-700"}`}>
                <span className="text-lg font-bold text-zinc-500 w-7 text-center flex-shrink-0">N</span>
                <div className="w-12 h-12 rounded-lg bg-zinc-700 flex-shrink-0 flex items-center justify-center"><Ban className="w-5 h-5 text-zinc-400" /></div>
                <div className="flex-1"><p className="text-sm font-semibold text-white">NOTA</p><p className="text-xs text-zinc-500">None of the Above</p></div>
                {selected === "NOTA" && <CheckCircle className="w-5 h-5 text-zinc-300 flex-shrink-0" />}
              </button>
            </div>
          )}
          <button onClick={() => setConfirming(true)} disabled={!selected} className="w-full mt-3 bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            <Vote className="w-4 h-4" /> {selected ? "Cast Vote" : "Select a candidate"}
          </button>
        </div>
      )}

      {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-xs text-red-400">{error}</p></div>}
      <div className="mt-4 bg-zinc-900 rounded-xl p-3 border border-zinc-800"><p className="text-[10px] text-zinc-500 text-center">Public voting facility. Each vote boosts a candidate during result counting. Tap → Confirm → Done.</p></div>
    </div>
  );
}