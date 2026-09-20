
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { invalidateResultsCache } from "@/lib/electionResults";
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react";

// Danger zone (Admin → Danger Zone): the admin selects EXACTLY which data to
// clear — per category — for the whole nation or a single state. Requires
// typing CLEAR to confirm. Each selected category is cleared independently.

const DATA_GROUPS = [
  { key: "elections", label: "Elections & Candidates", desc: "Elections + all candidatures/results" },
  { key: "government", label: "Government & Cabinet", desc: "Governments, ministers, ministries" },
  { key: "parliament", label: "Parliament Setups", desc: "Chamber configurations" },
  { key: "bills", label: "Bills & Laws", desc: "Drafts, votes, assents, enacted laws" },
  { key: "courts", label: "Court Cases", desc: "Supreme/High Court cases" },
  { key: "formation", label: "Formation & Support", desc: "Government formation + support requests" },
  { key: "economy", label: "Economy & Projects", desc: "Budgets, development projects, tasks, popularity" },
  { key: "presidentrule", label: "President's Rule", desc: "Active/ended President's Rule records" },
];

export default function DataWipe({ actor }) {
  const [target, setTarget] = useState("nation");
  const [stateId, setStateId] = useState(BHARAT_STATES[0].id);
  const [selected, setSelected] = useState([]);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  function toggle(key) {
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);
  }

  function append(m) { setLog(l => [...l, m]); }

  async function clearGroup(key, isNation, sid) {
    if (key === "elections") {
      const q = isNation ? { election_type: "national" } : { state_id: sid };
      const els = await base44.entities.Election.filter(q).catch(() => []);
      for (const e of els) {
        await base44.entities.Candidature.deleteMany({ election_id: e.id }).catch(() => {});
      }
      await base44.entities.Election.deleteMany(q).catch(() => {});
      return;
    }
    const STEPS = {
      government: [
        ["Government", isNation ? { type: "national" } : { state_id: sid }],
        ["Minister", isNation ? { scope: "national" } : { state_id: sid }],
        ["Ministry", isNation ? { scope: "national" } : { state_id: sid }],
      ],
      parliament: [["ParliamentSetup", isNation ? { scope: "national" } : { scope: "state", state_id: sid }]],
      bills: [
        ["Bill", isNation ? { scope: "national" } : { state_id: sid }],
        ["Law", isNation ? { scope: "national" } : { state_id: sid }],
      ],
      courts: [["CourtCase", isNation ? { scope: "national" } : { state_id: sid }]],
      formation: [
        ["FormationRequest", isNation ? { scope: "national" } : { state_id: sid }],
        ["SupportRequest", isNation ? { scope: "national" } : { state_id: sid }],
      ],
      economy: [
        ["Budget", isNation ? { scope: "national" } : { state_id: sid }],
        ["DevelopmentProject", isNation ? { scope: "national" } : { state_id: sid }],
        ["Task", isNation ? { scope: "national" } : { state_id: sid }],
        ["PopularityScore", isNation ? { scope: "government" } : { state_id: sid }],
      ],
      presidentrule: [["PresidentRule", isNation ? { status: "active" } : { state_id: sid }]],
    };
    for (const [name, q] of STEPS[key] || []) {
      await base44.entities[name].deleteMany(q).catch(() => {});
    }
  }

  async function run() {
    if (busy || selected.length === 0) return;
    setBusy(true); setLog([]);
    const isNation = target === "nation";
    const sid = isNation ? "" : stateId;
    try {
      for (const key of selected) {
        await clearGroup(key, isNation, sid);
        append(`${DATA_GROUPS.find(g => g.key === key)?.label || key} cleared`);
      }
      invalidateResultsCache();
      append("Results cache refreshed — screens show live data on their next refresh.");
    } catch (e) {
      append("Error: " + (e.message || "failed"));
    }
    setBusy(false);
  }

  const targetLabel = target === "nation" ? NATION.name : (BHARAT_STATES.find(s => s.id === stateId)?.name || stateId);
  const armed = confirmText.trim().toUpperCase() === "CLEAR";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <p className="text-xs text-zinc-400">Select the data categories to clear — for the nation or one state. This cannot be undone.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setTarget("nation")}
          className={`text-xs py-2 rounded-lg font-semibold border transition-all ${target === "nation" ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
          Nation
        </button>
        <button onClick={() => setTarget("state")}
          className={`text-xs py-2 rounded-lg font-semibold border transition-all ${target === "state" ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
          Single State
        </button>
      </div>

      {target === "state" && (
        <select value={stateId} onChange={e => setStateId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white mb-3">
          {BHARAT_STATES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <div className="space-y-1.5 mb-3">
        {DATA_GROUPS.map(g => {
          const on = selected.includes(g.key);
          return (
            <button key={g.key} onClick={() => toggle(g.key)}
              className={`w-full text-left rounded-xl px-3 py-2 border transition-all flex items-center gap-2.5
                ${on ? "bg-red-500/10 border-red-500/40" : "bg-zinc-800/60 border-zinc-700"}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                ${on ? "bg-red-500 border-red-500" : "border-zinc-600"}`}>
                {on && <CheckCircle className="w-3 h-3 text-white" />}
              </span>
              <span className="min-w-0">
                <p className={`text-xs font-semibold ${on ? "text-red-400" : "text-zinc-300"}`}>{g.label}</p>
                <p className="text-[9px] text-zinc-600">{g.desc}</p>
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
        <p className="text-xs text-white font-semibold mb-1">
          Clear {selected.length} categor{selected.length === 1 ? "y" : "ies"} · {targetLabel}
        </p>
        <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type CLEAR to confirm"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white mb-2" />
        <button onClick={run} disabled={busy || !armed || selected.length === 0}
          className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
          {busy ? <Trash2 className="w-4 h-4 animate-pulse" /> : <Trash2 className="w-4 h-4" />}
          {busy ? "Clearing…" : `Clear selected data (${targetLabel})`}
        </button>
      </div>

      {log.length > 0 && (
        <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/50 mt-3">
          <p className="text-[10px] text-green-400 font-semibold flex items-center gap-1 mb-1"><CheckCircle className="w-3 h-3" /> Wipe log</p>
          {log.map((l, i) => <p key={i} className="text-[10px] text-zinc-400">• {l}</p>)}
        </div>
      )}
    </div>
  );
}