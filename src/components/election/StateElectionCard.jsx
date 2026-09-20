
import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Landmark, Building2, Play, Vote, BarChart3, ChevronRight, Home } from "lucide-react";
import { getStateById } from "@/lib/bharatStates";

const statusConfig = {
  campaign: { color: "bg-yellow-500/20 text-yellow-400", label: "Campaign" },
  voting: { color: "bg-green-500/20 text-green-400", label: "Voting Live" },
  counting: { color: "bg-orange-500/20 text-orange-400", label: "Counting" },
  completed: { color: "bg-blue-500/20 text-blue-400", label: "Completed" },
  upcoming: { color: "bg-zinc-500/20 text-zinc-400", label: "Upcoming" },
};

function ElectionRow({ election, isAdmin, onOpenVoting, onDeclare, busy }) {
  const sc = statusConfig[election.status] || statusConfig.upcoming;
  const isLS = election.election_type === "lok_sabha";
  const Icon = isLS ? Building2 : Landmark;
  return (
    <div className="bg-zinc-800/60 rounded-xl p-2.5 border border-zinc-700/50">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/elections/${election.id}`} className="flex items-center gap-2 min-w-0 flex-1">
          <Icon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{election.cycle_key === "by_election" ? "By-Election" : isLS ? "Lok Sabha" : "Vidhan Sabha"}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
          </div>
        </Link>
        {isAdmin && election.status === "campaign" && (
          <button onClick={() => onOpenVoting(election.id)} disabled={busy}
            className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
            <Vote className="w-3 h-3" /> Open
          </button>
        )}
        {isAdmin && election.status === "voting" && (
          <button onClick={() => onDeclare(election.id)} disabled={busy}
            className="text-[10px] bg-gradient-to-r from-red-500 to-yellow-500 text-white px-2 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
            <BarChart3 className="w-3 h-3" /> Declare
          </button>
        )}
        <Link to={`/elections/${election.id}`} className="text-zinc-500">
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function StateElectionCard({ state, elections, isAdmin, isHome, busyId, onOpenVoting, onDeclare, onSetHome }) {
  // Lok Sabha is one common national election — state cards show only Assembly
  // elections (plus any Lok Sabha by-elections for that state).
  const stateElections = elections.filter(e =>
    e.state_id === state.id && e.election_type !== "national" &&
    (e.election_type !== "lok_sabha" || e.cycle_key === "by_election"));
  const activeElections = stateElections.filter(e => !e.results_declared);
  const ruling = stateElections.filter(e => e.results_declared).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
      <Link to={`/states/${state.id}`} className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {state.id}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-white text-sm truncate">{state.name}</h3>
            {isHome && <Home className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
          </div>
          <p className="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
            <MapPin className="w-2.5 h-2.5" /> {state.capital} · {state.assemblySeats} AC · {state.lokSabhaSeats} LS
          </p>
        </div>
      </Link>

      {activeElections.length > 0 ? (
        <div className="space-y-1.5 mb-2">
          {activeElections.map(e => (
            <ElectionRow key={e.id} election={e} isAdmin={isAdmin} busy={busyId === e.id}
              onOpenVoting={onOpenVoting} onDeclare={onDeclare} />
          ))}
        </div>
      ) : ruling ? (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1.5 mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <p className="text-[10px] text-blue-300 truncate">Last: {ruling.title} — completed</p>
        </div>
      ) : (
        <p className="text-[10px] text-zinc-600 mb-2">No active election</p>
      )}

      {!isAdmin && !isHome && (
        <button onClick={() => onSetHome(state.id)}
          className="w-full text-[10px] bg-zinc-800/60 text-zinc-300 py-1.5 rounded-lg font-medium border border-zinc-700/50 flex items-center justify-center gap-1">
          <Home className="w-3 h-3" /> Set as Home State
        </button>
      )}
    </div>
  );
}