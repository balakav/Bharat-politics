
import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Search, ScrollText } from "lucide-react";

export default function AuditViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await bharat01.entities.AuditLog.list("-created_date", 100);
        setLogs(list);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter(l => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (l.action || "").toLowerCase().includes(q) || (l.actor_name || "").toLowerCase().includes(q) || (l.details || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-zinc-500" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by action, actor, details…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><div className="w-7 h-7 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center">
          <ScrollText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No audit entries</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filtered.map(l => (
            <div key={l.id} className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white font-medium">{l.action}</span>
                <span className="text-[10px] text-zinc-600">{new Date(l.created_date).toLocaleString("en-IN")}</span>
              </div>
              <p className="text-[11px] text-zinc-400">{l.actor_name || "—"} <span className="text-zinc-600">· {l.scope || ""}</span></p>
              {l.details && <p className="text-[10px] text-zinc-500 mt-0.5">{l.details}</p>}
              {l.new_value && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">→ {l.new_value}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-2">{filtered.length} of {logs.length} entries (latest 100 loaded)</p>
    </div>
  );
}