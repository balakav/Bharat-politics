
import React, { useState, useEffect } from "react";
import { getSalaryConfigMap, setSalaryConfig, DEFAULT_SALARY } from "@/lib/salary";
import { formatCoins } from "@/lib/gameData";
import { Save } from "lucide-react";

const POSITIONS = Object.keys(DEFAULT_SALARY);

export default function SalaryConfigEditor({ actor }) {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { getSalaryConfigMap().then(m => { setMap(m); setLoading(false); }); }, []);

  function update(pos, field, value) {
    setMap({ ...map, [pos]: { ...map[pos], [field]: field === "position" ? value : Number(value) } });
  }

  async function save(pos) {
    setSaving(true); setMsg("");
    try {
      const s = map[pos];
      await setSalaryConfig(pos, { base_salary: Number(s.base_salary), max_salary: Number(s.max_salary), growth_rate: Number(s.growth_rate), cycle_hours: Number(s.cycle_hours) }, actor);
      setMsg(`${pos.toUpperCase()} saved.`);
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-6"><div className="w-7 h-7 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {POSITIONS.map(pos => {
        const s = map[pos];
        if (!s) return null;
        return (
          <div key={pos} className="bg-zinc-800/40 rounded-xl p-3">
            <p className="text-sm font-semibold text-white uppercase mb-2">{pos}</p>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[9px] text-zinc-500">Base</label>
                <input type="number" value={s.base_salary} onChange={e => update(pos, "base_salary", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500">Max</label>
                <input type="number" value={s.max_salary} onChange={e => update(pos, "max_salary", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500">Growth %</label>
                <input type="number" value={s.growth_rate} onChange={e => update(pos, "growth_rate", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500">Cycle h</label>
                <input type="number" value={s.cycle_hours} onChange={e => update(pos, "cycle_hours", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
            </div>
            <button onClick={() => save(pos)} disabled={saving} className="mt-2 text-[10px] bg-zinc-700 text-yellow-400 px-3 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50"><Save className="w-3 h-3" /> Save</button>
            <p className="text-[10px] text-zinc-600 mt-1">Cap: {formatCoins(s.max_salary)}</p>
          </div>
        );
      })}
      {msg && <p className="text-xs text-green-400 text-center">{msg}</p>}
    </div>
  );
}