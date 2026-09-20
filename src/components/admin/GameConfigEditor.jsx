
import React, { useState, useEffect } from "react";
import { getGameConfig } from "@/lib/gameTime";
import { setGameConfig } from "@/lib/gameConfig";
import { formatGameTime } from "@/lib/gameTime";
import { Save, Clock } from "lucide-react";

const FIELDS = [
  { key: "time_speed_multiplier", label: "Time Speed (×)", type: "number", step: "0.5" },
  { key: "president_rule_duration_days", label: "President's Rule (days)", type: "number" },
  { key: "budget_min_score", label: "Budget Min Score (%)", type: "number" },
  { key: "national_majority", label: "National Majority", type: "number" },
  { key: "default_assembly_majority_pct", label: "Default Assembly Majority", type: "number", step: "0.05" },
  { key: "mla_access_days", label: "MLA Access (days)", type: "number" },
  { key: "elected_term_days", label: "Elected Term (days)", type: "number" },
  { key: "salary_cycle_hours", label: "Salary Cycle (hours)", type: "number" },
  { key: "starting_e_coins", label: "Starting e-Coins", type: "number" },
];

export default function GameConfigEditor({ actor }) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { getGameConfig().then(setConfig); }, []);

  async function save() {
    setSaving(true); setMsg("");
    try {
      const patch = {};
      for (const f of FIELDS) patch[f.key] = Number(config[f.key]);
      await setGameConfig(patch, actor);
      setMsg("Saved.");
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    finally { setSaving(false); }
  }

  if (!config) return <div className="flex justify-center py-6"><div className="w-7 h-7 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="bg-zinc-800/40 rounded-xl p-3 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-yellow-400" />
        <p className="text-xs text-zinc-400">Game start: <span className="text-white">{formatGameTime(config.game_start_time)}</span></p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-[10px] text-zinc-500">{f.label}</label>
            <input type={f.type} step={f.step} value={config[f.key]}
              onChange={e => setConfig({ ...config, [f.key]: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="w-full mt-3 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Configuration"}
      </button>
      {msg && <p className="text-xs text-green-400 mt-2 text-center">{msg}</p>}
    </div>
  );
}