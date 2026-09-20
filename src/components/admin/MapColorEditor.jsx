
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BHARAT_STATES } from "@/lib/bharatStates";

// Admin can recolor any state on the Nation map based on government formation.
// The color is stored on the state's active Government record (map_color);
// the map prefers it over the automatic party color.

export default function MapColorEditor({ actor }) {
  const [governments, setGovernments] = useState([]);
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const govs = await base44.entities.Government.list("-created_date", 200);
    setGovernments(govs.filter(g => g.state_id));
  }

  async function setColor(stateId, color) {
    const gov = governments.find(g => g.state_id === stateId && g.is_active !== false) || governments.find(g => g.state_id === stateId);
    if (!gov) { setMsg(`No government formed in ${stateId} yet — the color applies once the government forms.`); return; }
    setSaving(stateId);
    try {
      await base44.entities.Government.update(gov.id, { map_color: color });
      setGovernments(prev => prev.map(g => g.id === gov.id ? { ...g, map_color: color } : g));
      setMsg(`${stateId} map color updated.`);
    } catch (e) { setMsg("Failed to update color."); }
    setSaving("");
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">Edit each state's color on the Nation map. The color is applied to the state's active government (formed after the election).</p>
      {msg && <p className="text-[11px] text-amber-400 mb-2">{msg}</p>}
      <div className="space-y-2">
        {BHARAT_STATES.map(s => {
          const gov = governments.find(g => g.state_id === s.id && g.is_active !== false) || governments.find(g => g.state_id === s.id);
          const current = pending[s.id] ?? gov?.map_color ?? "#ffffff";
          return (
            <div key={s.id} className="flex items-center gap-3 bg-zinc-800/40 rounded-lg p-2">
              <span className="text-xs text-white flex-1 truncate">{s.name}</span>
              {gov && <span className="text-[9px] text-zinc-500 truncate max-w-[40%]">{gov.party_name}</span>}
              {!gov && <span className="text-[9px] text-zinc-600">No government</span>}
              <input type="color" value={current} disabled={saving === s.id}
                onChange={e => setPending(p => ({ ...p, [s.id]: e.target.value }))}
                onBlur={() => { if (pending[s.id] && pending[s.id] !== (gov?.map_color || "#ffffff")) setColor(s.id, pending[s.id]); }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-zinc-700" />
            </div>
          );
        })}
      </div>
    </div>
  );
}