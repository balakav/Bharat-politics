import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getElectionRecords, getCompletedElections } from "@/lib/electionResults";
import { BHARAT_STATES } from "@/lib/bharatStates";
import { partyColor } from "@/lib/partyColors";
import PartySeatBar from "@/components/election/PartySeatBar";
import { ArrowLeft, Database, Trophy, MapPin, TrendingUp, Crown, Landmark, Building, TreePine, BarChart3, Users, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid } from "recharts";

const TABS = [
  { key: "government", label: "Government", icon: Crown },
  { key: "vidhan_sabha", label: "Legislative Assembly", icon: Landmark },
  { key: "rmc", label: "RMC", icon: Building },
  { key: "panchayat", label: "Panchayat", icon: TreePine },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "strategy", label: "Strategy", icon: Target },
];

export default function ElectionData() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [governments, setGovernments] = useState([]);
  const [elections, setElections] = useState([]);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("government");
  const [multiSeatWinners, setMultiSeatWinners] = useState([]);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [devProjects, setDevProjects] = useState([]);

  useEffect(() => { loadData(); }, []);

  const strategyData = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (!r.constituency) continue;
      if (!map[r.constituency]) map[r.constituency] = { constituency: r.constituency, devScore: 0, winnerVotes: 0, runnerUpVotes: 0, count: 0 };
      map[r.constituency].winnerVotes += r.winner_votes || 0;
      map[r.constituency].runnerUpVotes += r.runner_up_votes || 0;
      map[r.constituency].count += 1;
    }
    for (const p of devProjects) {
      if (!p.constituency) continue;
      if (!map[p.constituency]) map[p.constituency] = { constituency: p.constituency, devScore: 0, winnerVotes: 0, runnerUpVotes: 0, count: 0 };
      map[p.constituency].devScore += p.impact || 0;
    }
    return Object.values(map).map(c => ({
      ...c,
      winProb: c.winnerVotes + c.runnerUpVotes > 0 ? Math.round((c.winnerVotes / (c.winnerVotes + c.runnerUpVotes)) * 100) : 0,
    }));
  }, [records, devProjects]);

  async function loadData() {
    const [recs, govs, projects, allWinners, completed] = await Promise.all([
      getElectionRecords(),
      base44.entities.Government.list("-created_date", 300).catch(() => []),
      base44.entities.DevelopmentProject.list("-created_date", 5000).catch(() => []),
      base44.entities.Candidature.filter({ result: "won" }, undefined, 5000).catch(() => []),
      getCompletedElections().catch(() => []),
    ]);
    setRecords(recs);
    setGovernments(govs);
    setDevProjects(projects);
    setWinners(allWinners);
    setElections(completed);

    const playerSeats = {};
    for (const r of recs) {
      if (!r.winner_player_id || r.winner_player_id.startsWith("AI_")) continue;
      if (!playerSeats[r.winner_player_id]) {
        playerSeats[r.winner_player_id] = { name: r.winner_name, seats: 0, constituencies: [], parties: new Set() };
      }
      playerSeats[r.winner_player_id].seats += 1;
      playerSeats[r.winner_player_id].constituencies.push({ constituency: r.constituency, position: r.position_title, party: r.winner_party, date: r.election_date });
      if (r.winner_party) playerSeats[r.winner_player_id].parties.add(r.winner_party);
    }
    const multiWinners = Object.entries(playerSeats)
      .map(([id, data]) => ({ id, ...data, parties: Array.from(data.parties) }))
      .sort((a, b) => b.seats - a.seats);
    setMultiSeatWinners(multiWinners);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Party-wise seat counts for any completed election (MPs for national,
  // MLAs for a state assembly) — from the live winners of that election.
  const seatsFor = (electionId) => {
    const counts = {};
    for (const w of winners) {
      if (w.election_id !== electionId) continue;
      const k = w.party_name || "Independent";
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts).map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats);
  };

  const nationalElection = elections.find(e => e.election_type === "national") || null;
  const nationalGov = governments.find(g => g.type === "national" && g.is_active !== false) || null;
  const natSeats = nationalElection ? seatsFor(nationalElection.id) : [];

  // Analytics: party-wise performance across ALL completed election results.
  const partyPerformance = (() => {
    const totals = {};
    for (const e of elections) {
      for (const p of seatsFor(e.id)) totals[p.party] = (totals[p.party] || 0) + p.seats;
    }
    return Object.entries(totals).map(([party, seats]) => ({ party, seats })).sort((a, b) => b.seats - a.seats);
  })();

  const rawFiltered = tab === "government" ? [] : records.filter(r => r.election_type === tab);
  const deduped = {};
  for (const r of rawFiltered) {
    const key = `${r.election_date}_${r.constituency}_${r.position_title}_${r.seat_type || 'general'}`;
    if (!deduped[key]) deduped[key] = r;
  }
  const filtered = Object.values(deduped);
  const grouped = {};
  for (const r of filtered) {
    const date = r.election_date || "Unknown";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(r);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Election Data</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-4">Records of all elected representatives</p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1
                ${tab === t.key ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              <Icon className="w-3 h-3" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Government — nation + every state, with party-wise seat data */}
      {tab === "government" && (
        <div>
          <div className="bg-gradient-to-br from-orange-500/10 to-yellow-400/10 border border-orange-500/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-semibold uppercase">National Government</span>
            </div>
            {nationalGov ? (
              <>
                <h2 className="text-xl font-bold text-white mb-1">{nationalGov.party_name}</h2>
                <p className="text-sm text-zinc-400">{nationalGov.head_title}: {nationalGov.head_player_name}</p>
                {nationalGov.coalition_parties && nationalGov.coalition_parties.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">Coalition: {nationalGov.coalition_parties.join(", ")}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">No central government formed yet</p>
            )}
            {natSeats.length > 0 && (
              <div className="mt-3 pt-3 border-t border-orange-500/20">
                <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2">Lok Sabha — MP seats party-wise</p>
                <PartySeatBar seats={natSeats} />
              </div>
            )}
          </div>

          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">State Governments · party-wise MLA seats</h3>
          <div className="space-y-2 mb-4">
            {BHARAT_STATES.map(s => {
              const g = governments.find(x => x.state_id === s.id && x.is_active !== false);
              const el = elections.find(e => e.election_type === "vidhan_sabha" && e.state_id === s.id);
              const seats = el ? seatsFor(el.id) : [];
              return (
                <div key={s.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    {g ? (
                      <span className="text-[10px] text-amber-400 truncate flex-shrink-0 ml-2">{g.party_name} · {g.head_title}: {g.head_player_name}</span>
                    ) : (
                      <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-2">No government</span>
                    )}
                  </div>
                  {seats.length > 0 ? (
                    <PartySeatBar seats={seats} />
                  ) : (
                    <p className="text-[11px] text-zinc-600">No assembly results declared yet.</p>
                  )}
                </div>
              );
            })}
          </div>

          <Link to="/government" className="block bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-center text-sm text-yellow-400">
            View Full Government Details →
          </Link>
        </div>
      )}

      {tab !== "government" && tab !== "analytics" && tab !== "strategy" && (
        sortedDates.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No {TABS.find(t => t.key === tab)?.label} records yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => (
              <div key={date}>
                <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 mb-2">
                  <p className="text-xs text-yellow-400 font-semibold uppercase">
                    Week of {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-zinc-500">{grouped[date].length} winners</p>
                </div>
                <div className="space-y-2">
                  {grouped[date].map((r, i) => (
                    <div key={r.id || i} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-sm font-medium text-white">{r.winner_name}</span>
                        </div>
                        <span className="text-[10px] bg-zinc-800 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                          {r.position_title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <MapPin className="w-3 h-3" /> {r.constituency}
                        {r.seat_type && r.seat_type !== "general" && ` (${r.seat_type})`}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-blue-400">{r.winner_party_short || r.winner_party || "IND"}</span>
                        <span className="text-zinc-400">{(r.winner_votes || 0).toLocaleString()} votes</span>
                        {r.vote_margin > 0 && (
                          <span className="text-green-400 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> M: {(r.vote_margin || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Analytics — party-wise across all election results, then top players */}
      {tab === "analytics" && (
        <div>
          {partyPerformance.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No election results yet</p>
              <p className="text-xs text-zinc-600 mt-1">Party-wise analytics appear once results are declared.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Party-wise Performance</h3>
              <p className="text-[10px] text-zinc-600 mb-3">Total seats won across all declared election results (national + state)</p>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={partyPerformance.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20, top: 5 }}>
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="party" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={95} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, fontSize: 12 }}
                      cursor={{ fill: "#27272a" }}
                    />
                    <Bar dataKey="seats" radius={[0, 6, 6, 0]}>
                      {partyPerformance.slice(0, 10).map(entry => (
                        <Cell key={entry.party} fill={partyColor(entry.party)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-3">
                {partyPerformance.map(p => (
                  <div key={p.party} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: partyColor(p.party) }} />
                      <span className="truncate">{p.party}</span>
                    </span>
                    <span className="text-white font-semibold flex-shrink-0 ml-2">{p.seats} seat{p.seats === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {multiSeatWinners.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No player wins recorded yet</p>
              <p className="text-xs text-zinc-600 mt-1">Win elections to appear on the leaderboard</p>
            </div>
          ) : (
            <div>
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Multi-Seat Winners</h3>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={multiSeatWinners.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20, top: 5 }}>
                      <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={85} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, fontSize: 12 }}
                        cursor={{ fill: "#27272a" }}
                      />
                      <Bar dataKey="seats" radius={[0, 6, 6, 0]}>
                        {multiSeatWinners.slice(0, 10).map((entry, index) => (
                          <Cell key={index} fill={entry.seats >= 5 ? "#ef4444" : entry.seats >= 3 ? "#3b82f6" : "#10b981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 5+ seats</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 3-4 seats</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 1-2 seats</span>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">All Winners ({multiSeatWinners.length})</h3>
              <div className="space-y-2 mb-4">
                {multiSeatWinners.map(w => (
                  <button key={w.id} onClick={() => setSelectedWinner(selectedWinner?.id === w.id ? null : w)}
                    className={`w-full bg-zinc-900 rounded-xl p-3 border transition-all text-left
                      ${selectedWinner?.id === w.id ? "border-red-500/50" : "border-zinc-800 hover:border-zinc-700"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{w.name}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2
                        ${w.seats >= 5 ? "bg-red-500/20 text-yellow-400" : w.seats >= 3 ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {w.seats} seats
                      </span>
                    </div>
                    {w.parties.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1 truncate">{w.parties.join(", ")}</p>
                    )}
                  </button>
                ))}
              </div>

              {selectedWinner && (
                <div className="bg-zinc-900 rounded-2xl p-4 border border-red-500/30">
                  <h3 className="text-sm font-semibold text-yellow-400 mb-3">{selectedWinner.name}'s Won Seats ({selectedWinner.seats})</h3>
                  <div className="space-y-2">
                    {selectedWinner.constituencies.map((c, i) => (
                      <div key={i} className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{c.constituency}</p>
                            <p className="text-xs text-zinc-500 truncate">{c.party || "Independent"}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-[10px] bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">{c.position}</span>
                          {c.date && <p className="text-[10px] text-zinc-600 mt-1">{new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "strategy" && (
        <div>
          {strategyData.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No strategy data yet</p>
              <p className="text-xs text-zinc-600 mt-1">Win elections and build development projects to see correlations</p>
            </div>
          ) : (
            <>
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Dev Score vs Win Probability</h3>
                <p className="text-xs text-zinc-500 mb-3">Each dot is a constituency — higher dev score tends to yield higher win %</p>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <ScatterChart margin={{ left: 5, right: 20, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" dataKey="devScore" name="Dev Score" tick={{ fill: "#71717a", fontSize: 11 }} />
                      <YAxis type="number" dataKey="winProb" name="Win %" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
                      <ZAxis type="number" dataKey="count" range={[40, 200]} name="Elections" />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs">
                              <p className="text-white font-medium">{d.constituency}</p>
                              <p className="text-yellow-400">Dev Score: {d.devScore}</p>
                              <p className="text-green-400">Win Prob: {d.winProb}%</p>
                              <p className="text-zinc-500">Elections: {d.count}</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={strategyData} fill="#ef4444" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Strategy Targets</h3>
                <p className="text-xs text-zinc-500 mb-3">Constituencies ranked by development investment & win rate</p>
                <div className="space-y-2">
                  {strategyData.filter(d => d.count > 0).sort((a, b) => b.devScore - a.devScore).slice(0, 10).map((d, i) => (
                    <div key={d.constituency} className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-zinc-500 flex-shrink-0">#{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{d.constituency}</p>
                          <p className="text-xs text-zinc-500">Dev Score: {d.devScore}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${d.winProb >= 60 ? "bg-green-500/20 text-green-400" : d.winProb >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                        {d.winProb}% win
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}