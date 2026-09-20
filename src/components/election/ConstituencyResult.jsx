
import React from "react";
import { Trophy, ChevronDown, MapPin } from "lucide-react";

export default function ConstituencyResult({ group, isExpanded, onToggle }) {
  const sortedCands = [...group.candidates].sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
  const winner = sortedCands.find(c => c.result === 'won') || sortedCands[0];
  const maxVotes = sortedCands[0]?.votes_received || 1;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-white truncate">{group.name}</p>
            {winner && (
              <p className="text-xs text-yellow-400 truncate">
                {winner.player_name} ({winner.party_short})
              </p>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {sortedCands.map(c => {
            const isWinner = c.result === 'won';
            const pct = maxVotes > 0 ? ((c.votes_received || 0) / maxVotes) * 100 : 0;
            return (
              <div key={c.id} className={`rounded-lg p-2 ${isWinner ? "bg-red-500/10" : "bg-zinc-800/50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isWinner && <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />}
                    <span className="text-xs font-medium text-white truncate">{c.player_name}</span>
                    <span className="text-[10px] text-zinc-500 shrink-0">({c.party_short})</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-yellow-400">{(c.votes_received || 0).toLocaleString()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isWinner ? "bg-red-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                      {isWinner ? "WON" : "LOST"}
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isWinner ? "bg-red-500" : "bg-zinc-600"}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}