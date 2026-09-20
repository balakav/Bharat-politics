import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { runEnforcementSweep, markProven } from "@/lib/enforcementAI";
import { fileCourtCase, advanceCourtCase, runCourtDocket } from "@/lib/courtAI";
import { ArrowLeft, ShieldAlert, Scale, Gavel, Search, Play, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const invColor = { open: "bg-yellow-500/20 text-yellow-400", under_investigation: "bg-orange-500/20 text-orange-400", proven: "bg-red-500/20 text-red-400", dismissed: "bg-zinc-700 text-zinc-400", closed: "bg-zinc-700 text-zinc-400" };
const caseColor = { filed: "bg-yellow-500/20 text-yellow-400", hearing: "bg-orange-500/20 text-orange-400", judgment: "bg-blue-500/20 text-blue-400", closed: "bg-zinc-700 text-zinc-400" };

export default function Legal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [investigations, setInvestigations] = useState([]);
  const [cases, setCases] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      const me = await bharat01.auth.me();
      setIsAdmin(me.role === "admin");
      const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
      const p = profiles[0];
      setProfile(p);
      const targetId = p?.player_id;
      const [invs, allCases] = await Promise.all([
        targetId ? bharat01.entities.Investigation.filter({ target_player_id: targetId }, "-created_date", 50) : Promise.resolve([]),
        bharat01.entities.CourtCase.list("-created_date", 100),
      ]);
      setInvestigations(invs);
      // Every case I'm involved in — as defendant OR complainant, with its stage.
      setCases(allCases.filter(c =>
        (targetId && c.defendant_id === targetId) ||
        (p?.username && c.complainant === p.username)));
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  async function act(fn, label) {
    setBusy(true); setMsg("");
    try { const r = await fn(); setMsg(`${label} done.`); await loadData(); }
    catch (e) { setMsg(`${label} failed: ${e.message || "error"}`); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Legal & Investigations</h1>
      </div>

      {msg && <p className="text-xs text-zinc-400 mb-3">{msg}</p>}

      {/* Judiciary — separate Supreme Court / High Court screens */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => navigate("/courts?court=supreme")}
          className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <Scale className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">Supreme Court</span>
          <span className="text-[8px] text-zinc-600">National · one court</span>
        </button>
        <button onClick={() => navigate("/courts?court=high")}
          className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <Gavel className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">High Court</span>
          <span className="text-[8px] text-zinc-600">Per state · file a case</span>
        </button>
      </div>

      {/* Admin AI controls */}
      {isAdmin && (
        <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-4">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2">Enforcement & Court AI</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => act(() => runEnforcementSweep({ id: "admin", name: "Admin", role: "admin" }), "Enforcement sweep")} disabled={busy}
              className="text-[11px] bg-zinc-800 text-yellow-400 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Search className="w-3 h-3" /> ED Sweep</button>
            <button onClick={() => act(() => runCourtDocket({ id: "court_ai", name: "Court AI", role: "ai" }), "Court docket")} disabled={busy}
              className="text-[11px] bg-zinc-800 text-yellow-400 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Gavel className="w-3 h-3" /> Court Docket</button>
          </div>
        </div>
      )}

      {/* Investigations against the player */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Investigations ({investigations.length})</h2>
      {investigations.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-500/50 mx-auto mb-2" />
          <p className="text-sm text-white">Clean record</p>
          <p className="text-xs text-zinc-500 mt-1">No investigations against you.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {investigations.map(inv => (
            <div key={inv.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">Investigation</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${invColor[inv.status] || "bg-zinc-700"}`}>{inv.status}</span>
              </div>
              <p className="text-xs text-zinc-400">{inv.reason}</p>
              {inv.evidence && <p className="text-[11px] text-zinc-500 mt-1">Evidence: {inv.evidence}</p>}
              {isAdmin && inv.status === "open" && (
                <button onClick={() => act(() => markProven(inv.id, "Evidence gathered during ED probe.", 5000000, { id: "admin", name: "Admin", role: "admin" }), "Mark proven")} disabled={busy}
                  className="mt-2 text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-lg font-semibold">Mark Proven</button>
              )}
              {isAdmin && inv.status === "proven" && (
                <button onClick={() => act(() => fileCourtCase(inv.id, { id: "admin", name: "Admin", role: "admin" }), "File court case")} disabled={busy}
                  className="mt-2 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1"><FileText className="w-3 h-3" /> File Court Case</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Court cases */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Scale className="w-4 h-4" /> Court Cases ({cases.length})</h2>
      {cases.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No court cases</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <div key={c.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">{c.charges}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${caseColor[c.status] || "bg-zinc-700"}`}>{c.status}</span>
              </div>
              <p className="text-[10px] text-zinc-600">{c.case_id || "—"} · {c.scope === "national" ? "Supreme Court" : "High Court"}</p>
              <p className="text-xs text-zinc-400">Complainant: {c.complainant}{c.defendant_id !== profile?.player_id && c.defendant_name ? ` · Against: ${c.defendant_name}` : ""}</p>
              {c.judgment && (
                <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${c.judgment === "Guilty" ? "text-red-400" : "text-green-400"}`}>
                  {c.judgment === "Guilty" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Verdict: {c.judgment} {c.punishment ? `· ${c.punishment}` : ""}
                </p>
              )}
              {isAdmin && c.status !== "closed" && (
                <button onClick={() => act(() => advanceCourtCase(c.id, { id: "admin", name: "Admin", role: "admin" }), "Advance case")} disabled={busy}
                  className="mt-2 text-[10px] bg-zinc-800 text-yellow-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1"><Play className="w-3 h-3" /> Advance Stage</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}