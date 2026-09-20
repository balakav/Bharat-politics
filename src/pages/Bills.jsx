import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getStateById, BHARAT_STATES } from "@/lib/bharatStates";
import { BILL_STATUS_LABEL, BILL_STATUS_COLOR, billNextSteps } from "@/lib/billFlow";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { ScrollText, Plus, ChevronRight, X, MapPin, UserPlus } from "lucide-react";

// Bills & Acts. Bills are introduced at the member's level — an MP introduces
// national bills, an MLA introduces their state's bills — and every new bill
// first goes to the SPEAKER'S OFFICE for admission, then to debate & voting on
// the house floor (the Speaker opens/closes voting; the Voting Agent tallies),
// then the Speaker certifies it onward — Governor for state bills, President
// for national bills.

export default function Bills() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [bills, setBills] = useState([]);
  const [elections, setElections] = useState([]);
  const [myWons, setMyWons] = useState([]);
  const [scope, setScope] = useState("national");
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", summary: "" });
  const [profile, setProfile] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    let pid = "";
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) { setProfile(ps[0]); pid = ps[0].player_id; }
      setSpeakers(await base44.entities.Minister.filter({ position: "speaker", is_active: true }).catch(() => []));
    }
    const [all, els, wons] = await Promise.all([
      base44.entities.Bill.list("-created_date", 500).catch(() => []),
      base44.entities.Election.list("-created_date", 200).catch(() => []),
      pid ? base44.entities.Candidature.filter({ player_id: pid, result: "won" }, undefined, 200).catch(() => []) : Promise.resolve([]),
    ]);
    setBills(all);
    setElections(els);
    setMyWons(wons);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 30000);

  async function createBill() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      await base44.entities.Bill.create({
        title: form.title.trim(),
        scope: scope === "national" ? "national" : "state",
        state_id: scope === "national" ? "" : selectedState,
        proposed_by_id: profile?.player_id || "",
        proposed_by_name: profile?.username || "Member",
        category: form.category.trim() || "General",
        summary: form.summary.trim(),
        // New bills go straight to the Speaker's Office for admission.
        status: "speaker_review",
        introduced_game_time: new Date().toISOString(),
      });
      setForm({ title: "", category: "", summary: "" });
      setShowForm(false);
      // Close the on-screen keyboard after submitting.
      document.activeElement?.blur?.();
      load();
    } finally { setBusy(false); }
  }

  async function advance(b, to) {
    setBusy(true);
    try { await base44.entities.Bill.update(b.id, { status: to }); await load(); } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Level-based bill creation: an MP (won a national/Lok Sabha seat) can
  // introduce NATIONAL bills; an MLA of a state can introduce that state's
  // bills. The Speaker and admin can introduce at any scope.
  const electionOf = (id) => elections.find(e => e.id === id);
  const isMP = myWons.some(w => ["national", "lok_sabha"].includes(electionOf(w.election_id)?.election_type));
  const isMLAIn = (sid) => myWons.some(w => {
    const e = electionOf(w.election_id);
    return e && e.election_type === "vidhan_sabha" && e.state_id === sid;
  });
  const speakerAt = (sc, sid) => speakers.some(m =>
    m.player_id === profile?.player_id &&
    (sc === "national" ? m.scope === "national" : m.state_id === sid));
  const canManageNational = isAdmin || speakerAt("national");
  const canManageState = isAdmin || speakerAt("state", selectedState);
  const canIntroduceNational = canManageNational || isMP;
  const canIntroduceState = canManageState || (selectedState ? isMLAIn(selectedState) : false);
  const canManage = scope === "national" ? canManageNational : canManageState;
  const canIntroduce = scope === "national" ? canIntroduceNational : canIntroduceState;
  const introduceAs = scope === "national"
    ? (isMP ? " as MP" : "")
    : (selectedState && isMLAIn(selectedState) ? " as MLA" : "");

  const BillCard = ({ b }) => (
    <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5 min-w-0">
          <ScrollText className="w-4 h-4 text-amber-400 flex-shrink-0" /> {b.title}
        </p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${BILL_STATUS_COLOR[b.status] || "bg-zinc-700 text-zinc-300"}`}>
          {BILL_STATUS_LABEL[b.status] || b.status}
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 truncate">
        {b.category || "General"} · by {b.proposed_by_name || "Member"}{b.summary ? ` · ${b.summary}` : ""}
      </p>
      {canManage && billNextSteps(b).length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {billNextSteps(b).map(([label, to]) => (
            <button key={to} onClick={() => advance(b, to)} disabled={busy}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg disabled:opacity-50 ${to.includes("rejected") ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-amber-400"}`}>
              {label} →
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const NewBillForm = () => (
    <div className="bg-zinc-800/60 rounded-xl p-3 border border-zinc-700/50 space-y-2 mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> New Bill · {scope === "national" ? "National" : getStateById(selectedState)?.name}
        </p>
        <button onClick={() => setShowForm(false)} className="text-zinc-500"><X className="w-3.5 h-3.5" /></button>
      </div>
      <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Bill title (e.g. Farmers Welfare Act 2026)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
      <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. Welfare, Finance, Education)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
      <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Bill summary" rows={2}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white resize-none" />
      <p className="text-[9px] text-zinc-600">On introduction this bill goes to the Speaker's Office for admission.</p>
      <button onClick={createBill} disabled={busy || !form.title.trim()}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">
        {busy ? "Introducing…" : `Introduce Bill${introduceAs}`}
      </button>
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <ScrollText className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Bills & Acts</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Member bills → Speaker's Office → house voting → Speaker's certification → Governor (state) · President (national)
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setScope("national")}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all ${scope === "national" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          National
        </button>
        <button onClick={() => { setScope("state"); setSelectedState(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all ${scope === "state" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          State
        </button>
      </div>

      {scope === "national" ? (
        <>
          {canIntroduce && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="w-full mb-3 bg-zinc-900 border border-zinc-700 text-amber-400 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Introduce New Bill{introduceAs}
            </button>
          )}
          {showForm && <NewBillForm />}
          {bills.filter(b => b.scope === "national").length === 0 ? (
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
              <ScrollText className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-white">No national bills yet</p>
              <p className="text-xs text-zinc-500 mt-1">MPs introduce bills here — each one goes to the Speaker's Office first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bills.filter(b => b.scope === "national").map(b => <BillCard key={b.id} b={b} />)}
            </div>
          )}
        </>
      ) : !selectedState ? (
        <>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">All States · tap to view bills</h2>
          <div className="space-y-2">
            {BHARAT_STATES.map(s => {
              const st = bills.filter(b => b.scope === "state" && b.state_id === s.id);
              return (
                <button key={s.id} onClick={() => setSelectedState(s.id)}
                  className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">{s.id}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-zinc-500">{st.length > 0 ? `${st.length} bills` : "No bills yet"}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      ) : (() => {
        const st = getStateById(selectedState);
        const stateBills = bills.filter(b => b.scope === "state" && b.state_id === selectedState);
        return (
          <>
            <button onClick={() => setSelectedState("")} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 rotate-180" /> All States
            </button>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">{st?.name} Bills</h2>
            </div>
            {canIntroduce && !showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full mb-3 bg-zinc-900 border border-zinc-700 text-amber-400 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> Introduce New Bill{introduceAs}
              </button>
            )}
            {showForm && <NewBillForm />}
            {stateBills.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
                <ScrollText className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-white">No bills in {st?.name} yet</p>
                <p className="text-xs text-zinc-500 mt-1">MLAs introduce bills here — each one goes to the Speaker's Office first.</p>
              </div>
            ) : (
              <div className="space-y-2">{stateBills.map(b => <BillCard key={b.id} b={b} />)}</div>
            )}
          </>
        );
      })()}
    </div>
  );
}