import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runEnforcementSweep } from "@/lib/enforcementAI";
import { runCourtDocket } from "@/lib/courtAI";
import { generateNewsBatch } from "@/lib/newsAI";
import { recomputeGovernmentPopularity, recomputePartyPopularity } from "@/lib/popularity";
import { BHARAT_STATES, getStateById } from "@/lib/bharatStates";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Bot, Search, Gavel, Newspaper, TrendingUp, Play, Globe2 } from "lucide-react";

export default function AdminAI() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState([]);

  async function run(key, label, fn) {
    setBusy(key); setLog(l => [{ key, label, status: "running" }, ...l].slice(0, 8));
    try {
      const r = await fn();
      setLog(l => l.map(x => x.key === key ? { ...x, status: "done", result: r } : x));
    } catch (e) {
      setLog(l => l.map(x => x.key === key ? { ...x, status: "error", result: e.message || "error" } : x));
    } finally { setBusy(""); }
  }

  const adminActor = { id: "admin", name: "Admin", role: "admin" };

  async function recomputeAll(scope, stateId) {
    await recomputeGovernmentPopularity(scope, stateId);
    const records = await base44.entities.ElectionRecord.filter({ election_type: scope === "national" ? "national" : "vidhan_sabha" });
    const scoped = records.filter(r => scope === "national" ? true : r.state_id === stateId);
    const parties = new Set(scoped.map(r => r.winner_party_short || r.winner_party).filter(Boolean));
    for (const p of [...parties].slice(0, 6)) await recomputePartyPopularity(p, scope, stateId);
    return { parties: parties.size };
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">AI Systems</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Run the game's AI engines on demand. These normally trigger automatically; use this panel to re-run or refresh.</p>

      <div className="space-y-2 mb-4">
        <button onClick={() => run("ed", "Enforcement Sweep", () => runEnforcementSweep(adminActor))} disabled={!!busy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 disabled:opacity-50">
          <Search className="w-5 h-5 text-red-400" />
          <div className="text-left flex-1"><p className="text-sm text-white font-medium">Enforcement Sweep</p><p className="text-[10px] text-zinc-500">Scan players for disproportionate assets</p></div>
          {busy === "ed" ? <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <Play className="w-4 h-4 text-zinc-500" />}
        </button>

        <button onClick={() => run("court", "Court Docket", () => runCourtDocket({ id: "court_ai", name: "Court AI", role: "ai" }))} disabled={!!busy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 disabled:opacity-50">
          <Gavel className="w-5 h-5 text-yellow-400" />
          <div className="text-left flex-1"><p className="text-sm text-white font-medium">Court Docket</p><p className="text-[10px] text-zinc-500">Advance all open court cases one stage</p></div>
          {busy === "court" ? <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <Play className="w-4 h-4 text-zinc-500" />}
        </button>

        <button onClick={() => run("news", "News Generation", () => generateNewsBatch(3))} disabled={!!busy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 disabled:opacity-50">
          <Newspaper className="w-5 h-5 text-blue-400" />
          <div className="text-left flex-1"><p className="text-sm text-white font-medium">Generate News</p><p className="text-[10px] text-zinc-500">Add 3 political news items to the feed</p></div>
          {busy === "news" ? <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <Play className="w-4 h-4 text-zinc-500" />}
        </button>

        <button onClick={() => run("pop_nat", "National Popularity", () => recomputeAll("national", ""))} disabled={!!busy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 disabled:opacity-50">
          <Globe2 className="w-5 h-5 text-green-400" />
          <div className="text-left flex-1"><p className="text-sm text-white font-medium">Recompute National Popularity</p><p className="text-[10px] text-zinc-500">Government + party scores (national)</p></div>
          {busy === "pop_nat" ? <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <Play className="w-4 h-4 text-zinc-500" />}
        </button>
      </div>

      {/* Per-state popularity recompute */}
      <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2">State Popularity</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {BHARAT_STATES.map(s => (
          <button key={s.id} onClick={() => run("pop_" + s.id, s.name + " Popularity", () => recomputeAll("state", s.id))} disabled={!!busy}
            className="text-[10px] bg-zinc-800 text-zinc-300 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
            {busy === "pop_" + s.id ? <div className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <TrendingUp className="w-3 h-3" />}
            {s.id}
          </button>
        ))}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Activity Log</h2>
          <div className="space-y-1.5">
            {log.map((x, i) => (
              <div key={i} className="bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-white">{x.label}</span>
                <span className={`text-[10px] font-semibold ${x.status === "done" ? "text-green-400" : x.status === "error" ? "text-red-400" : "text-yellow-400"}`}>
                  {x.status === "done" ? "✓ " + (typeof x.result === "object" ? JSON.stringify(x.result).slice(0, 40) : x.result) : x.status === "error" ? "✗ " + x.result : "running…"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}