
import React, { useState } from "react";
import { BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { saveSeatConfigs } from "@/lib/stateSeatConfig";
import { Save, Landmark } from "lucide-react";

// Admin editor for per-state seat counts (Assembly / majority / Lok Sabha)
// and the national Lok Sabha totals. Saves to the StateSeatConfig entity and
// applies to the runtime config used by every election screen and the engine.

export default function SeatConfigEditor({ actor }) {
  const [states, setStates] = useState(BHARAT_STATES.map(s => ({ ...s })));
  const [national, setNational] = useState({ lokSabhaSeats: NATION.lokSabhaSeats, lokSabhaMajority: NATION.lokSabhaMajority });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function updateState(id, field, value) {
    setStates(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      await saveSeatConfigs({ states, national, actor });
      setMsg(`Saved — ${states.length} states + national config updated. New elections will use these seat counts.`);
    } catch (e) {
      setMsg("Error: " + (e.message || "failed to save"));
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-yellow-400" />
        <p className="text-xs text-zinc-400">Edit total seats per state and nation. Applies to all new elections immediately.</p>
      </div>

      {states.map(s => (
        <div key={s.id} className="flex items-center gap-2 bg-zinc-800/40 rounded-xl p-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <input type="text" value={s.name} onChange={e => updateState(s.id, "name", e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
            <p className="text-[9px] text-zinc-600">{s.id}</p>
          </div>
          <div>
            <label className="text-[8px] text-zinc-500 uppercase block">Assembly</label>
            <input type="number" value={s.assemblySeats} onChange={e => updateState(s.id, "assemblySeats", e.target.value)}
              className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
          </div>
          <div>
            <label className="text-[8px] text-zinc-500 uppercase block">Majority</label>
            <input type="number" value={s.assemblyMajority} onChange={e => updateState(s.id, "assemblyMajority", e.target.value)}
              className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
          </div>
          <div>
            <label className="text-[8px] text-zinc-500 uppercase block">Lok Sabha</label>
            <input type="number" value={s.lokSabhaSeats} onChange={e => updateState(s.id, "lokSabhaSeats", e.target.value)}
              className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 bg-gradient-to-r from-red-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">National Lok Sabha</p>
        </div>
        <div>
          <label className="text-[8px] text-zinc-500 uppercase block">Total Seats</label>
          <input type="number" value={national.lokSabhaSeats} onChange={e => setNational({ ...national, lokSabhaSeats: e.target.value })}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
        </div>
        <div>
          <label className="text-[8px] text-zinc-500 uppercase block">Majority</label>
          <input type="number" value={national.lokSabhaMajority} onChange={e => setNational({ ...national, lokSabhaMajority: e.target.value })}
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Seat Configuration"}
      </button>
      {msg && <p className="text-xs text-green-400 mt-2 text-center">{msg}</p>}
    </div>
  );
}