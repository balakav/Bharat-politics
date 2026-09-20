import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { BHARAT_STATES, getStateById } from "@/lib/bharatStates";
import { recomputeGovernmentPopularity, recomputePartyPopularity } from "@/lib/popularity";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Globe2, Landmark, RefreshCw, Crown } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const trendIcon = { up: <TrendingUp className="w-3.5 h-3.5 text-green-400" />, down: <TrendingDown className="w-3.5 h-3.5 text-red-400" />, stable: <Minus className="w-3.5 h-3.5 text-zinc-500" /> };

export default function Popularity() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("NAT");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scores, setScores] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    const me = await base44.auth.me().catch(() => ({ role: "user" }));
    setIsAdmin(me.role === "admin");
    const isNat = selected === "NAT";
    const stateId = isNat ? "" : selected;
    const scope = isNat ? "national" : "state";
    const all = await base44.entities.PopularityScore.list("-updated_game_time", 200);
    setScores(all.filter(s => s.scope === "government" ? true : (isNat ? !s.state_id : s.state_id === stateId)));
    setLoading(false);
  }, [selected]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  const isNat = selected === "NAT";
  const state = isNat ? null : getStateById(selected);

  async function recompute() {
    setBusy(true);
    try {
      const scope = isNat ? "national" : "state";
      const stateId = isNat ? "" : selected;
      await recomputeGovernmentPopularity(scope, stateId);
      // recompute top parties from recent records
      const records = await base44.entities.ElectionRecord.filter({ election_type: scope === "national" ? "national" : "vidhan_sabha" });
      const scoped = records.filter(r => isNat ? true : r.state_id === stateId);
      const parties = new Set(scoped.map(r => r.winner_party_short || r.winner_party).filter(Boolean));
      for (const p of [...parties].slice(0, 6)) await recomputePartyPopularity(p, scope, stateId);
      await loadData();
    } finally { setBusy(false); }
  }

  const govScores = scores.filter(s => s.scope === "government");
  const partyScores = scores.filter(s => s.scope === "party");

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Popularity</h1>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setSelected("NAT")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${selected === "NAT" ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}><Globe2 className="w-3 h-3" /> National</button>
        {BHARAT_STATES.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selected === s.id ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>{s.name}</button>
        ))}
      </div>

      {isAdmin && (
        <button onClick={recompute} disabled={busy} className="w-full mb-4 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> Recompute Popularity
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Crown className="w-4 h-4" /> Government</h2>
          {govScores.length === 0 ? (
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center mb-4">
              <Landmark className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-white">No government popularity yet</p>
              <p className="text-xs text-zinc-500 mt-1">{isAdmin ? "Recompute to generate scores." : "An admin will recompute periodically."}</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {govScores.map(s => (
                <div key={s.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium truncate">{s.target_name}</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-yellow-400">{s.score}{trendIcon[s.trend]}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full" style={{ width: `${s.score}%` }} />
                  </div>
                  {s.factors && <p className="text-[10px] text-zinc-500 mt-1">{s.factors}</p>}
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Parties</h2>
          {partyScores.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No party popularity scores yet.</p>
          ) : (
            <div className="space-y-2">
              {partyScores.map(s => (
                <div key={s.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate">{s.target_name}</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-yellow-400">{s.score}{trendIcon[s.trend]}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.score}%` }} />
                  </div>
                  {s.factors && <p className="text-[10px] text-zinc-500 mt-1">{s.factors}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}