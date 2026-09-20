
import React, { useState } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION, getStateById } from "@/lib/bharatStates";
import { getAssemblyResults, getNationalResults } from "@/lib/electionResults";
import { Sparkles, RefreshCw } from "lucide-react";

// Parliament creation. The admin first loads the completed election's results
// for the chosen house — EVERY party that won seats is listed with its seat
// count (editable) and a role: the party that forms the government (ruling),
// coalition partners, outside support, or opposition. The chamber is then
// generated from this full party picture. The Speaker is NOT entered here —
// it comes from the cabinet formed in Party HQ. Nation AND all 21 states.

const ROLES = [
  { value: "ruling", label: "Forms Govt" },
  { value: "coalition", label: "Coalition" },
  { value: "support", label: "Outside Support" },
  { value: "opposition", label: "Opposition" },
];

export default function ParliamentSetupForm({ actor }) {
  const [scope, setScope] = useState("national");
  const [stateId, setStateId] = useState(BHARAT_STATES[0].id);
  const [rows, setRows] = useState([]); // { name, seats, role }
  const [loadingResults, setLoadingResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadResults() {
    setLoadingResults(true); setMsg("");
    try {
      const { winners } = scope === "national"
        ? await getNationalResults()
        : await getAssemblyResults(stateId);
      const counts = {};
      for (const w of winners) {
        const p = w.party_name || "Independent";
        counts[p] = (counts[p] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) {
        setRows([]);
        setMsg("No completed election with winners for this house yet — declare results first.");
      } else {
        setRows(sorted.map(([name, seats], i) => ({ name, seats, role: i === 0 ? "ruling" : "opposition" })));
      }
    } catch (e) {
      setMsg("Error loading results: " + (e.message || "failed"));
    }
    setLoadingResults(false);
  }

  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return patch.role === "ruling" && r.role === "ruling" ? { ...r, role: "opposition" } : r;
      const next = { ...r, ...patch };
      return next;
    }));
  }

  async function generate() {
    setMsg("");
    const ruling = rows.filter(r => r.role === "ruling");
    if (ruling.length !== 1) { setMsg("Mark exactly one party as the one that forms the government."); return; }
    if (!ruling[0].name.trim() || (ruling[0].seats || 0) <= 0) { setMsg("The ruling party needs a name and seat count."); return; }
    setBusy(true);
    try {
      const isNational = scope === "national";
      const state = isNational ? null : getStateById(stateId);
      const total = isNational ? NATION.lokSabhaSeats : state.assemblySeats;
      const coal = rows.filter(r => r.role === "coalition" && r.name.trim()).map(r => ({ name: r.name.trim(), seats: r.seats || 0 }));
      const sup = rows.filter(r => r.role === "support" && r.name.trim()).map(r => ({ name: r.name.trim(), seats: r.seats || 0 }));
      const govSeats = (ruling[0].seats || 0) + coal.reduce((s, p) => s + p.seats, 0) + sup.reduce((s, p) => s + p.seats, 0);
      if (govSeats > total) { setMsg(`Government seats (${govSeats}) exceed total seats (${total}).`); setBusy(false); return; }
      const title = isNational ? `${NATION.name} Lok Sabha` : `${state.name} Legislative Assembly`;
      // The Speaker is appointed through cabinet formation (Party HQ) —
      // resolve the live Speaker minister for this house.
      const speakerRecs = await bharat01.entities.Minister.filter({
        scope: isNational ? "national" : "state",
        position: "speaker",
        is_active: true,
        ...(isNational ? {} : { state_id: stateId }),
      }).catch(() => []);
      const speakerName = speakerRecs[0]?.player_name || "";
      const existing = await bharat01.entities.ParliamentSetup.filter({ scope, state_id: isNational ? "" : stateId });
      for (const e of existing) await bharat01.entities.ParliamentSetup.delete(e.id);
      await bharat01.entities.ParliamentSetup.create({
        scope,
        house: isNational ? "lok_sabha" : "assembly",
        state_id: isNational ? "" : stateId,
        state_name: isNational ? NATION.name : state.name,
        title,
        speaker_name: speakerName,
        total_seats: total,
        majority_mark: Math.floor(total / 2) + 1,
        winning_party_name: ruling[0].name.trim(),
        winning_party_seats: ruling[0].seats || 0,
        coalition: JSON.stringify(coal),
        supporters: JSON.stringify(sup),
        government_seats: govSeats,
        opposition_seats: total - govSeats,
      });
      setMsg(`${title} created — ${govSeats} government / ${total - govSeats} opposition seats.`);
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">Load the completed election's results — every winning party is listed with its seats. Mark who forms the government, the coalition and outside support; the chamber is generated from the full picture. Same flow for the nation and every state.</p>
      {msg && <p className="text-[11px] text-amber-400 mb-2">{msg}</p>}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => { setScope("national"); setRows([]); }}
          className={`text-xs py-2 rounded-lg font-semibold border transition-all ${scope === "national" ? "bg-orange-500/20 text-amber-400 border-orange-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
          National
        </button>
        <button onClick={() => { setScope("state"); setRows([]); }}
          className={`text-xs py-2 rounded-lg font-semibold border transition-all ${scope === "state" ? "bg-orange-500/20 text-amber-400 border-orange-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
          State
        </button>
      </div>

      {scope === "state" && (
        <select value={stateId} onChange={e => { setStateId(e.target.value); setRows([]); }}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white mb-3">
          {BHARAT_STATES.map(s => <option key={s.id} value={s.id}>{s.name} ({s.assemblySeats} seats)</option>)}
        </select>
      )}

      {rows.length === 0 ? (
        <button onClick={loadResults} disabled={loadingResults}
          className="w-full bg-zinc-800 border border-zinc-700 text-amber-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 mb-3">
          <RefreshCw className={`w-4 h-4 ${loadingResults ? "animate-spin" : ""}`} />
          {loadingResults ? "Loading results…" : "Load Election Results (all winning parties)"}
        </button>
      ) : (
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] text-zinc-500">All parties that won seats — adjust seats if needed and set each party's role. The chamber displays based on this.</p>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-zinc-800/60 rounded-lg p-1.5 border border-zinc-700/50">
              <input value={r.name} onChange={e => updateRow(i, { name: e.target.value })} disabled={r.role === "ruling" ? false : false}
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
              <input type="number" value={r.seats} onChange={e => updateRow(i, { seats: parseInt(e.target.value, 10) || 0 })}
                className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
              <select value={r.role} onChange={e => updateRow(i, { role: e.target.value })}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-1.5 py-1.5 text-[10px] text-white">
                {ROLES.map(ro => <option key={ro.value} value={ro.value}>{ro.label}</option>)}
              </select>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={loadResults} disabled={loadingResults}
              className="flex-1 text-[10px] text-yellow-400 bg-zinc-800 border border-zinc-700 rounded-lg py-1.5 flex items-center justify-center gap-1 disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${loadingResults ? "animate-spin" : ""}`} /> Reload results
            </button>
            <button onClick={generate} disabled={busy}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" /> {busy ? "Generating…" : "Generate Parliament"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600">Speaker comes from your cabinet — appoint the Speaker in Party HQ (cabinet formation).</p>
        </div>
      )}
    </div>
  );
}