import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getStateById, BHARAT_STATES } from "@/lib/bharatStates";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Scale, Landmark, ChevronRight, Plus, X, Play, MapPin, Gavel } from "lucide-react";

// Judiciary — two separate courts inside Legal:
// Supreme Court: national level, exactly one, for the whole nation.
// High Court: one per state. Any player can file a case against another
// player; the admin advances the case through its stages.

const caseColor = { filed: "bg-yellow-500/20 text-yellow-400", hearing: "bg-orange-500/20 text-orange-400", judgment: "bg-blue-500/20 text-blue-400", closed: "bg-zinc-700 text-zinc-400" };
const NEXT_STAGE = { filed: "hearing", hearing: "judgment", judgment: "closed" };

export default function Courts() {
  const urlParams = new URLSearchParams(window.location.search);
  const [court, setCourt] = useState(urlParams.get("court") === "high" ? "high" : "supreme");
  const [selectedState, setSelectedState] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [players, setPlayers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ defendant_id: "", charges: "", evidence: "", witness_info: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [judgingId, setJudgingId] = useState(null);
  const [jForm, setJForm] = useState({ judgment: "", punishment: "", fine_amount: "" });

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) setProfile(ps[0]);
      setPlayers(await base44.entities.PlayerProfile.list().catch(() => []));
    }
    if (court === "supreme") {
      setCases(await base44.entities.CourtCase.filter({ scope: "national" }, "-created_date", 200).catch(() => []));
    } else if (selectedState) {
      setCases(await base44.entities.CourtCase.filter({ scope: "state", state_id: selectedState }, "-created_date", 200).catch(() => []));
    } else {
      setCases([]);
    }
    setLoading(false);
  }, [court, selectedState]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 30000);

  async function fileCase() {
    if (!form.defendant_id || !form.charges.trim() || !profile || busy) return;
    setBusy(true); setMsg("");
    try {
      const defendant = players.find(p => p.player_id === form.defendant_id);
      await base44.entities.CourtCase.create({
        case_id: `${court === "supreme" ? "SC" : "HC"}-${Date.now().toString().slice(-6)}`,
        scope: court === "supreme" ? "national" : "state",
        state_id: court === "supreme" ? "" : selectedState,
        complainant: profile.username,
        defendant_id: form.defendant_id,
        defendant_name: defendant?.username || "Unknown",
        charges: form.charges.trim(),
        evidence: form.evidence.trim(),
        witness_info: form.witness_info.trim(),
        status: "filed",
        filed_game_time: new Date().toISOString(),
      });
      setForm({ defendant_id: "", charges: "", evidence: "", witness_info: "" });
      setShowForm(false);
      // Close the on-screen keyboard after submitting.
      document.activeElement?.blur?.();
      setMsg("Case filed.");
      load();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  async function advanceCase(c) {
    setBusy(true);
    try { await base44.entities.CourtCase.update(c.id, { status: NEXT_STAGE[c.status] || "closed" }); load(); } finally { setBusy(false); }
  }

  // Judicial ruling — the admin (as the court) delivers the judgment on a case
  // in hearing: verdict, punishment and fine.
  async function deliverJudgment(c) {
    if (!jForm.judgment.trim() || busy) return;
    setBusy(true);
    try {
      await base44.entities.CourtCase.update(c.id, {
        status: "judgment",
        judgment: jForm.judgment.trim(),
        punishment: jForm.punishment.trim(),
        fine_amount: Number(jForm.fine_amount) || 0,
      });
      setJudgingId(null);
      setJForm({ judgment: "", punishment: "", fine_amount: "" });
      setMsg("Judgment delivered.");
      load();
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const CaseCard = ({ c }) => (
    <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] text-zinc-500 font-mono flex-shrink-0">{c.case_id || "—"}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${caseColor[c.status] || "bg-zinc-700 text-zinc-300"}`}>{c.status}</span>
      </div>
      <p className="text-sm font-bold text-white">{c.charges}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">Complainant: {c.complainant || "—"} · Defendant: {c.defendant_name || "—"}</p>
      {c.evidence && <p className="text-[10px] text-zinc-600 mt-1 truncate">Evidence: {c.evidence}</p>}
      {c.judgment && <p className="text-[11px] text-amber-400 mt-1">Verdict: {c.judgment}{c.punishment ? ` · ${c.punishment}` : ""}</p>}
      {isAdmin && c.status === "hearing" && judgingId !== c.id && (
        <button onClick={() => setJudgingId(c.id)} disabled={busy}
          className="mt-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
          <Gavel className="w-3 h-3" /> Deliver Judgment
        </button>
      )}
      {isAdmin && c.status === "hearing" && judgingId === c.id && (
        <div className="mt-2 space-y-1.5 bg-zinc-800/60 rounded-lg p-2 border border-zinc-700/50">
          <input type="text" value={jForm.judgment} onChange={e => setJForm({ ...jForm, judgment: e.target.value })} placeholder="Judgment (e.g. Guilty — charges proven)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white" />
          <input type="text" value={jForm.punishment} onChange={e => setJForm({ ...jForm, punishment: e.target.value })} placeholder="Punishment (e.g. barred from office for 2 terms)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white" />
          <input type="number" value={jForm.fine_amount} onChange={e => setJForm({ ...jForm, fine_amount: e.target.value })} placeholder="Fine amount (₹)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white" />
          <div className="flex gap-1.5">
            <button onClick={() => deliverJudgment(c)} disabled={busy || !jForm.judgment.trim()}
              className="flex-1 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-[10px] font-bold py-1.5 rounded-lg disabled:opacity-50">
              {busy ? "Delivering…" : "Deliver Judgment"}
            </button>
            <button onClick={() => setJudgingId(null)} className="text-[10px] text-zinc-500 px-2">✕</button>
          </div>
        </div>
      )}
      {isAdmin && c.status !== "closed" && c.status !== "hearing" && NEXT_STAGE[c.status] && (
        <button onClick={() => advanceCase(c)} disabled={busy}
          className="mt-2 text-[10px] bg-zinc-800 text-yellow-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
          <Play className="w-3 h-3" /> Advance to {NEXT_STAGE[c.status]}
        </button>
      )}
    </div>
  );

  const FileCaseForm = () => (
    <div className="bg-zinc-800/60 rounded-xl p-3 border border-zinc-700/50 space-y-2 mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-400 uppercase font-semibold">File a Case · {court === "supreme" ? "Supreme Court" : `${getStateById(selectedState)?.name || ""} High Court`}</p>
        <button onClick={() => setShowForm(false)} className="text-zinc-500"><X className="w-3.5 h-3.5" /></button>
      </div>
      <select value={form.defendant_id} onChange={e => setForm({ ...form, defendant_id: e.target.value })}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
        <option value="">Select defendant (player)…</option>
        {players.filter(p => p.player_id !== profile?.player_id).map(p => <option key={p.id} value={p.player_id}>{p.username}</option>)}
      </select>
      <input type="text" value={form.charges} onChange={e => setForm({ ...form, charges: e.target.value })} placeholder="Charges (e.g. Corruption, Fraud)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
      <input type="text" value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })} placeholder="Evidence (optional)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
      <input type="text" value={form.witness_info} onChange={e => setForm({ ...form, witness_info: e.target.value })} placeholder="Witness info (optional)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
      <button onClick={fileCase} disabled={busy || !form.defendant_id || !form.charges.trim()}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">
        {busy ? "Filing…" : "File Case"}
      </button>
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Judiciary</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Supreme Court (national, one) · High Court (one per state)</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => { setCourt("supreme"); setSelectedState(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${court === "supreme" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <Landmark className="w-4 h-4" /> Supreme Court
        </button>
        <button onClick={() => { setCourt("high"); setSelectedState(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold ${court === "high" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          High Court
        </button>
      </div>

      {court === "supreme" ? (
        <>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="w-full mb-3 bg-zinc-900 border border-zinc-700 text-amber-400 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> File a Case in the Supreme Court
            </button>
          )}
          {showForm && <FileCaseForm />}
          {msg && <p className="text-[11px] text-green-400 mb-3">{msg}</p>}
          {cases.length === 0 ? (
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
              <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-white">No cases before the Supreme Court</p>
            </div>
          ) : (
            <div className="space-y-2">{cases.map(c => <CaseCard key={c.id} c={c} />)}</div>
          )}
        </>
      ) : !selectedState ? (
        <>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">High Courts · one per state</h2>
          <div className="space-y-2">
            {BHARAT_STATES.map(s => (
              <button key={s.id} onClick={() => setSelectedState(s.id)}
                className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">{s.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name} High Court</p>
                  <p className="text-[11px] text-zinc-500">Tap to view & file cases</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </>
      ) : (() => {
        const st = getStateById(selectedState);
        const stateCases = cases;
        return (
          <>
            <button onClick={() => setSelectedState("")} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 rotate-180" /> All High Courts
            </button>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">{st?.name} High Court</h2>
            </div>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full mb-3 bg-zinc-900 border border-zinc-700 text-amber-400 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> File a Case
              </button>
            )}
            {showForm && <FileCaseForm />}
            {msg && <p className="text-[11px] text-green-400 mb-3">{msg}</p>}
            {stateCases.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
                <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-white">No cases in {st?.name} yet</p>
              </div>
            ) : (
              <div className="space-y-2">{stateCases.map(c => <CaseCard key={c.id} c={c} />)}</div>
            )}
          </>
        );
      })()}
    </div>
  );
}