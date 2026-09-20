
import React from "react";
import { Link } from "react-router-dom";
import { Vote, Trophy, Play } from "lucide-react";

// Fixed Election Commission stage sequence: Nomination → Voting → Results.
// Only the next stage's action is shown, so no stage can be skipped or
// started before the previous one completes.

export default function ElectionStagePanel({ election, busy, onStartVoting, onDeclare }) {
  const stage = election.results_declared ? 3 : election.status === "voting" ? 2 : 1;
  const steps = ["Nomination", "Voting", "Results"];
  const disabled = busy === "stage-" + election.id;

  return (
    <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
      <div className="flex items-center gap-1 mb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= stage ? "bg-gradient-to-r from-orange-500 to-amber-400" : "bg-zinc-700"}`} />
            <p className={`text-[9px] mt-1 text-center ${i + 1 <= stage ? "text-amber-400 font-bold" : "text-zinc-600"}`}>{i + 1}. {s}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white truncate">{election.title}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300 capitalize flex-shrink-0">{election.status}</span>
      </div>
      {stage === 1 && (
        <button onClick={() => onStartVoting(election)} disabled={disabled}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
          <Play className="w-3.5 h-3.5" /> Open Voting
        </button>
      )}
      {stage === 2 && (
        <button onClick={() => onDeclare(election)} disabled={disabled}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
          {disabled ? "Counting…" : (<><Vote className="w-3.5 h-3.5" /> Declare Results</>)}
        </button>
      )}
      {stage === 3 && (
        <Link to={`/elections/${election.id}`}
          className="w-full bg-zinc-700 text-amber-400 text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> View Results Report
        </Link>
      )}
    </div>
  );
}