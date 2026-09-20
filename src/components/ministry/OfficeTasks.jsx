
import React from "react";
import { ClipboardList, Sparkles, Clock } from "lucide-react";
import { formatGameTime } from "@/lib/gameTime";

// Office tasks for the minister: AI-generated role tasks with choices,
// rewards and deadlines. Resolving applies reputation / e-coin effects.

export default function OfficeTasks({ tasks, busy, onResolve, onGenerate }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
          <ClipboardList className="w-3 h-3" /> Office Tasks ({tasks.length})
        </p>
        <button onClick={onGenerate} disabled={busy}
          className="text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 disabled:opacity-50">
          <Sparkles className="w-3 h-3" /> Generate
        </button>
      </div>

      {tasks.length === 0 && <p className="text-[11px] text-zinc-600">No open tasks — tap Generate to receive office work.</p>}
      <div className="space-y-2">
        {tasks.map(t => {
          let choices = [];
          try { choices = JSON.parse(t.choices || "[]"); } catch (e) {}
          return (
            <div key={t.id} className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
              <p className="text-[11px] font-bold text-white">{t.title}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{t.objective}</p>
              {t.deadline_game_time && (
                <p className="text-[9px] text-zinc-600 mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Deadline: {formatGameTime(t.deadline_game_time)}
                </p>
              )}
              <div className="space-y-1.5 mt-1.5">
                {choices.map((c, i) => (
                  <button key={i} onClick={() => onResolve(t.id, i)} disabled={busy}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-left hover:border-orange-500/50 transition-all disabled:opacity-50">
                    <p className="text-[10px] text-white font-medium">{c.label}</p>
                    <p className="text-[9px] text-zinc-500">
                      {c.reputation ? `${c.reputation > 0 ? "+" : ""}${c.reputation} rep` : ""}
                      {c.e_coins ? ` · ${c.e_coins > 0 ? "+" : ""}₹${Math.abs(c.e_coins) / 100000}L` : ""}
                      {c.risk ? ` · risk: ${c.risk}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}