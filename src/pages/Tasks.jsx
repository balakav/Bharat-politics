import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { generateTasksForPlayer, resolveTask, expireOverdueTasks } from "@/lib/taskAI";
import { usePlayerRole } from "@/hooks/usePlayerRole";
import { formatCoins } from "@/lib/gameData";
import { ArrowLeft, CheckSquare, Clock, Trophy, TrendingUp, Coins, AlertTriangle } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function Tasks() {
  const navigate = useNavigate();
  const role = usePlayerRole();
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const me = await bharat01.auth.me();
      const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
      const p = profiles[0];
      setProfile(p);
      if (p) {
        await expireOverdueTasks(p.player_id);
        const pos = role.primary?.role || "citizen";
        await generateTasksForPlayer(p.player_id, pos, role.primary?.state_id ? "state" : "national", role.primary?.state_id || "", 3, 3);
        const all = await bharat01.entities.Task.filter({ player_id: p.player_id }, "-created_date", 50);
        setTasks(all);
      }
    } catch (e) {}
    setLoading(false);
  }, [role]);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  async function handleChoose(taskId, idx) {
    setBusy(true); setOutcome(null);
    try {
      const choice = await resolveTask(taskId, idx);
      setOutcome(choice);
      await loadData();
    } finally { setBusy(false); }
  }

  const pending = tasks.filter(t => t.status === "pending");
  const history = tasks.filter(t => t.status !== "pending");

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <CheckSquare className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-3">Role: {role.primary?.label || "Citizen"} · Reputation {profile?.reputation || 0}</p>

      {outcome && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-3">
          <p className="text-xs text-green-400 font-semibold">Choice: {outcome.label}</p>
          <p className="text-[11px] text-zinc-300 mt-0.5">
            {outcome.reputation ? `${outcome.reputation > 0 ? "+" : ""}${outcome.reputation} reputation` : ""}
            {outcome.e_coins ? ` · ${outcome.e_coins > 0 ? "+" : ""}${formatCoins(outcome.e_coins)} coins` : ""}
            {outcome.risk ? ` · risk: ${outcome.risk}` : ""}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : pending.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center mb-4">
          <CheckSquare className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No active tasks</p>
          <p className="text-xs text-zinc-500 mt-1">New tasks will appear here periodically.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {pending.map(t => {
            const choices = JSON.parse(t.choices || "[]");
            return (
              <div key={t.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-3">{t.objective}</p>
                <div className="space-y-2">
                  {choices.map((c, idx) => (
                    <button key={idx} onClick={() => handleChoose(t.id, idx)} disabled={busy}
                      className="w-full text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white transition-all disabled:opacity-50">
                      <div className="flex items-center justify-between">
                        <span>{c.label}</span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                          {c.reputation ? <span className={c.reputation > 0 ? "text-green-400" : "text-red-400"}>{c.reputation > 0 ? "+" : ""}{c.reputation}rep</span> : null}
                          {c.e_coins ? <span className={c.e_coins > 0 ? "text-green-400" : "text-red-400"}>{c.e_coins > 0 ? "+" : ""}{formatCoins(c.e_coins)}</span> : null}
                          {c.risk ? <AlertTriangle className="w-3 h-3 text-yellow-400" /> : null}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {t.deadline_game_time && (
                  <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Deadline: {new Date(t.deadline_game_time).toLocaleString()}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">History</h2>
          <div className="space-y-2">
            {history.slice(0, 15).map(t => (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{t.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">→ {t.chosen_option || t.status}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase flex-shrink-0
                  ${t.status === "completed" ? "bg-green-500/20 text-green-400" : t.status === "expired" ? "bg-zinc-700 text-zinc-400" : "bg-zinc-700 text-zinc-400"}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}