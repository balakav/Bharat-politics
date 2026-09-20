import React, { useState, useEffect, useCallback } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { getStateById, NATION } from "@/lib/bharatStates";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { ScrollText, Stamp, CheckCircle, XCircle, Undo2, Lock, Crown } from "lucide-react";

// President / Governor screens (Parliament → President · Governor):
// 1. Cabinet requests — the ruling party's finalized cabinet arrives here for
//    approval before the government is complete.
// 2. Bills — assent (enacting the bill as a Law), reject, or return.
// Governor-rejected state bills are referred to the President.
// Each bill is titled "Government of <State/Nation> — Bill No: 00X" where the
// number is its introduction order within that government's house.

function parseCabinet(json) {
  try { return JSON.parse(json || "[]"); } catch (e) { return []; }
}

export default function BillApprovals({ authority }) {
  const isPresident = authority === "president";
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [bills, setBills] = useState([]);
  const [billNums, setBillNums] = useState({});
  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const me = await bharat01.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    setAdminName(me?.full_name || "");
    const all = await bharat01.entities.Bill.list("-created_date", 500).catch(() => []);
    // Stable bill numbers: introduction order (oldest = 001) per government
    // house — national bills together, each state's bills separately.
    const asc = [...all].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const nums = {};
    const counters = {};
    for (const b of asc) {
      const key = b.scope === "national" ? "national" : (b.state_id || "other");
      counters[key] = (counters[key] || 0) + 1;
      nums[b.id] = String(counters[key]).padStart(3, "0");
    }
    setBillNums(nums);
    setBills(all.filter(b =>
      isPresident ? b.status === "president_review" : (b.scope === "state" && b.status === "governor_review")));
    const reqs = await bharat01.entities.CabinetApproval.list("-created_date", 100).catch(() => []);
    setCabinets(reqs.filter(r => isPresident ? r.scope === "national" : r.scope === "state"));
    setLoading(false);
  }, [isPresident]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 30000);

  async function approve(b) {
    setBusy(true); setMsg("");
    try {
      const law = await bharat01.entities.Law.create({
        title: b.title,
        scope: b.scope,
        state_id: b.state_id || "",
        bill_id: b.id,
        category: b.category || "General",
        summary: b.summary || "",
        enacted_game_time: new Date().toISOString(),
        is_active: true,
      });
      await bharat01.entities.Bill.update(b.id, {
        status: "law",
        law_id: law.id,
        ...(isPresident ? { president_note: "Assented by the President" } : { governor_note: "Assented by the Governor" }),
      });
      setMsg(`"${b.title}" assented — enacted as law.`);
      await load();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  // Governor rejection refers the bill to the President; President rejection is final.
  async function reject(b) {
    setBusy(true); setMsg("");
    try {
      await bharat01.entities.Bill.update(b.id, {
        status: isPresident ? "president_rejected" : "president_review",
        ...(isPresident ? { president_note: "Rejected by the President" } : { governor_note: "Rejected by the Governor — referred to the President" }),
      });
      setMsg(`"${b.title}" ${isPresident ? "rejected." : "rejected — referred to the President."}`);
      await load();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  async function returnBill(b) {
    setBusy(true); setMsg("");
    try {
      await bharat01.entities.Bill.update(b.id, { status: "president_returned", president_note: "Returned for reconsideration" });
      setMsg(`"${b.title}" returned for reconsideration.`);
      await load();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  // Cabinet approval — the President (national) / Governor (state) approves or
  // rejects the ruling party's finalized cabinet.
  async function reviewCabinet(r, status) {
    setBusy(true); setMsg("");
    try {
      const reviewer = isPresident ? "President" : "Governor";
      await bharat01.entities.CabinetApproval.update(r.id, {
        status,
        reviewed_by_name: `${reviewer}${adminName ? ` (${adminName})` : ""}`,
      });
      if (status === "approved") {
        const cab = parseCabinet(r.cabinet);
        await bharat01.entities.NewsItem.create({
          title: `🏛️ ${r.party_name} cabinet approved and sworn in`,
          content: `The ${reviewer} approved the ${r.party_name} cabinet — ${r.head_title} ${r.head_player_name} with ${cab.length} ministers${r.scope === "state" && r.state_name ? ` in ${r.state_name}` : ""}.`,
          category: "politics",
          source: "TV99 Bharat",
        }).catch(() => {});
        setMsg(`${r.party_name} cabinet approved.`);
      } else {
        setMsg(`${r.party_name} cabinet rejected.`);
      }
      await load();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const govLabel = (r) => (r.scope === "national" ? NATION.name : (r.state_name || getStateById(r.state_id)?.name || r.state_id || "State"));

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        {isPresident ? <ScrollText className="w-6 h-6 text-yellow-400" /> : <Stamp className="w-6 h-6 text-yellow-400" />}
        <h1 className="text-2xl font-bold text-white">{isPresident ? "President of Bharat Union" : "Raj Bhavan · Governor"}</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-1">
        {isPresident
          ? "Cabinet requests and bills passed by the Lok Sabha await the President's approval — assented bills are enacted as laws."
          : "State cabinet requests and assembly bills await the Governor's approval, state by state."}
      </p>
      {!isAdmin && (
        <p className="text-[10px] text-zinc-600 mb-4 flex items-center gap-1"><Lock className="w-3 h-3" /> View only — approval is given by the admin.</p>
      )}
      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}

      {/* Cabinet requests */}
      {cabinets.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Cabinet Requests ({cabinets.length})</h2>
          <div className="space-y-2">
            {cabinets.map(r => {
              const cab = parseCabinet(r.cabinet);
              return (
                <div key={r.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <p className="text-[10px] text-amber-400 font-semibold mb-0.5">Government of {govLabel(r)}</p>
                  <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" /> {r.party_name} · Cabinet
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{r.head_title}: {r.head_player_name} · {cab.length} ministers · submitted by {r.submitted_by_name || "—"}</p>
                  <div className="mt-1 space-y-0.5">
                    {cab.slice(0, 4).map((m, i) => (
                      <p key={i} className="text-[10px] text-zinc-400 truncate">• {m.player_name} — {m.portfolio}</p>
                    ))}
                    {cab.length > 4 && <p className="text-[10px] text-zinc-600">+{cab.length - 4} more</p>}
                  </div>
                  {r.status === "pending" ? (
                    isAdmin && (
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={() => reviewCabinet(r, "approved")} disabled={busy}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/20 text-green-400 flex items-center gap-1 disabled:opacity-50">
                          <CheckCircle className="w-3 h-3" /> Approve Cabinet
                        </button>
                        <button onClick={() => reviewCabinet(r, "rejected")} disabled={busy}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/20 text-red-400 flex items-center gap-1 disabled:opacity-50">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )
                  ) : (
                    <p className={`text-[10px] mt-1.5 ${r.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                      {r.status === "approved" ? "Approved" : "Rejected"} by {r.reviewed_by_name || "—"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bills */}
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bills for Assent</h2>
      {bills.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <CheckCircle className="w-10 h-10 text-green-500/50 mx-auto mb-2" />
          <p className="text-sm text-white">No bills awaiting {isPresident ? "the President" : "the Governor"}</p>
          <p className="text-xs text-zinc-500 mt-1">Bills appear here once {isPresident ? "the Lok Sabha passes them" : "a state assembly passes them"}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map(b => (
            <div key={b.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] text-amber-400 font-semibold mb-1">
                Government of {govLabel(b)} — Bill No: {billNums[b.id] || "—"}
              </p>
              <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-amber-400 flex-shrink-0" /> {b.title}
              </p>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">{b.category || "General"} · {b.summary || "No summary"}</p>
              {isAdmin && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <button onClick={() => approve(b)} disabled={busy}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/20 text-green-400 flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle className="w-3 h-3" /> Give Assent · Enact
                  </button>
                  <button onClick={() => reject(b)} disabled={busy}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/20 text-red-400 flex items-center gap-1 disabled:opacity-50">
                    <XCircle className="w-3 h-3" /> {isPresident ? "Reject" : "Reject · Refer to President"}
                  </button>
                  {isPresident && (
                    <button onClick={() => returnBill(b)} disabled={busy}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center gap-1 disabled:opacity-50">
                      <Undo2 className="w-3 h-3" /> Return
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}