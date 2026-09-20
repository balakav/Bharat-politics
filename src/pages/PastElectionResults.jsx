import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useNavigate } from "react-router-dom";
import ConstituencyResult from "@/components/election/ConstituencyResult";
import { BHARAT_STATES, NATION, getStateById } from "@/lib/bharatStates";
import { getCompletedElections } from "@/lib/electionResults";
import { Globe2, Landmark, ArrowLeft, ChevronRight, Search, ChevronDown, Download, MapPin } from "lucide-react";

export default function PastElectionResults() {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState(null); // "NAT" or state id or null
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedConstituency, setExpandedConstituency] = useState(null);
  const [constituencySearch, setConstituencySearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => { loadElections(); }, []);

  async function loadElections() {
    // Central election-results source — same data as every other screen.
    setElections(await getCompletedElections());
    setLoading(false);
  }

  async function exportAllToCSV() {
    const records = await bharat01.entities.ElectionRecord.list("-election_date", 5000);
    const headers = ["Election Date", "Election Type", "Election Title", "State", "Position", "Constituency", "Winner Name", "Winner Party", "Winner Party Short", "Winner Votes", "Runner-up Name", "Runner-up Party", "Runner-up Votes", "Vote Margin"];
    const rows = records.map(r => [
      r.election_date || "", r.election_type || "", r.election_title || "", r.state_name || "",
      r.position_title || "", r.constituency || "", r.winner_name || "", r.winner_party || "",
      r.winner_party_short || "", r.winner_votes || 0, r.runner_up_name || "",
      r.runner_up_party || "", r.runner_up_votes || 0, r.vote_margin || 0
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bharat_election_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function selectElection(el) {
    setSelectedElection(el);
    setLoading(true);
    const cands = await bharat01.entities.Candidature.filter({ election_id: el.id }, '-votes_received', 5000);
    setCandidates(cands);
    setLoading(false);
  }

  const constituencyGroups = {};
  for (const c of candidates) {
    if (!constituencyGroups[c.constituency]) {
      constituencyGroups[c.constituency] = { name: c.constituency, constituency: c.constituency, seat_type: c.seat_type, candidates: [] };
    }
    constituencyGroups[c.constituency].candidates.push(c);
  }
  const groupList = Object.values(constituencyGroups).sort((a, b) => a.name.localeCompare(b.name));
  const filteredGroups = constituencySearch
    ? groupList.filter(g => g.name.toLowerCase().includes(constituencySearch.toLowerCase()))
    : groupList;
  const visibleGroups = filteredGroups.slice(0, visibleCount);

  const partyWins = {};
  for (const g of groupList) {
    const winner = g.candidates.find(c => c.result === 'won');
    if (winner) {
      const party = winner.party_short || 'IND';
      partyWins[party] = (partyWins[party] || 0) + 1;
    }
  }

  const groupedElections = {};
  for (const el of elections) {
    const key = el.election_type === "national" ? "NAT" : (el.state_id || "OTHER");
    if (!groupedElections[key]) groupedElections[key] = [];
    groupedElections[key].push(el);
  }
  const stateKeys = Object.keys(groupedElections).sort((a, b) => {
    if (a === "NAT") return -1;
    if (b === "NAT") return 1;
    const sa = getStateById(a)?.name || a;
    const sb = getStateById(b)?.name || b;
    return sa.localeCompare(sb);
  });

  const filteredElections = selectedState ? (groupedElections[selectedState] || []) : [];

  if (loading && !selectedElection) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <button onClick={() => {
        if (selectedElection) { setSelectedElection(null); setCandidates([]); }
        else if (selectedState) { setSelectedState(null); }
        else navigate(-1);
      }} className="flex items-center gap-2 text-zinc-400 mb-4">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Past Election Results</h1>
        <button onClick={exportAllToCSV} className="bg-gradient-to-r from-red-500 to-yellow-500 text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {!selectedElection && !selectedState && (
        <div className="space-y-3">
          {stateKeys.map(key => {
            const isNat = key === "NAT";
            const state = isNat ? null : getStateById(key);
            const count = groupedElections[key].length;
            return (
              <button key={key} onClick={() => setSelectedState(key)}
                className="w-full bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center">
                      {isNat ? <Globe2 className="w-5 h-5 text-yellow-400" /> : <Landmark className="w-5 h-5 text-yellow-400" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{isNat ? "National Lok Sabha" : state?.name}</h3>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        {isNat ? <MapPin className="w-3 h-3" /> : null} {count} past {count === 1 ? 'election' : 'elections'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600" />
                </div>
              </button>
            );
          })}
          {elections.length === 0 && (
            <div className="text-center py-8">
              <Landmark className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No past elections yet</p>
              <p className="text-xs text-zinc-600 mt-1">Results appear here after admins declare election results</p>
            </div>
          )}
        </div>
      )}

      {!selectedElection && selectedState && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {selectedState === "NAT" ? "National Lok Sabha Elections" : getStateById(selectedState)?.name}
          </h2>
          {filteredElections.length === 0 ? (
            <div className="text-center py-8"><p className="text-zinc-500 text-sm">No past elections yet</p></div>
          ) : (
            filteredElections.map(el => (
              <button key={el.id} onClick={() => selectElection(el)}
                className="w-full bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all text-left flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{el.title}</p>
                  <p className="text-xs text-zinc-500">{new Date(el.created_date).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </button>
            ))
          )}
        </div>
      )}

      {selectedElection && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      )}

      {selectedElection && !loading && (
        <>
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
            <h2 className="text-xl font-bold text-white">{selectedElection.title}</h2>
            <p className="text-xs text-zinc-500 mt-1">{new Date(selectedElection.created_date).toLocaleDateString()}</p>
            <p className="text-xs text-zinc-500">{groupList.length} constituencies · {candidates.length} candidates · Majority {selectedElection.majority_mark}</p>
          </div>

          {Object.keys(partyWins).length > 0 && (
            <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-4">
              <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase">Party-wise Results</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(partyWins).sort((a, b) => b[1] - a[1]).map(([party, wins]) => (
                  <span key={party} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">
                    {party}: <span className="text-yellow-400 font-bold">{wins}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {groupList.length > 10 && (
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={constituencySearch} onChange={e => { setConstituencySearch(e.target.value); setVisibleCount(20); }}
                placeholder="Search constituency..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500" />
            </div>
          )}

          <div className="space-y-2">
            {visibleGroups.map(group => (
              <ConstituencyResult key={group.name} group={group}
                isExpanded={expandedConstituency === group.name}
                onToggle={() => setExpandedConstituency(expandedConstituency === group.name ? null : group.name)} />
            ))}
          </div>

          {visibleCount < filteredGroups.length && (
            <button onClick={() => setVisibleCount(visibleCount + 20)}
              className="w-full mt-3 bg-zinc-800 text-zinc-300 py-2 rounded-xl text-sm font-medium border border-zinc-700 flex items-center justify-center gap-1">
              <ChevronDown className="w-4 h-4" /> Load More ({filteredGroups.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}