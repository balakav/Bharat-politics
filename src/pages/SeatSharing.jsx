import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getStateById, BHARAT_STATES, NATION } from "@/lib/bharatStates";
import ChannelChat from "@/components/chat/ChannelChat";
import { PieChart, Handshake, ChevronRight, Save, CheckCircle, Lock, MapPin } from "lucide-react";

// Seat sharing (Political section) — parties contesting an election together
// finalize the constituency split here, per alliance, for the nation or a
// single state. Only the alliance chairman (or an admin) edits; every member
// sees the deal. Each alliance also gets its own group chat.

export default function SeatSharing() {
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [alliances, setAlliances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("share");
  const [scope, setScope] = useState("national");
  const [selectedState, setSelectedState] = useState("");
  const [alloc, setAlloc] = useState({});
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) setProfile(ps[0]);
    }
    const all = await base44.entities.Alliance.list().catch(() => []);
    setAlliances(all);
    setLoading(false);
  }

  // My party's alliances (admins see every alliance).
  const myAlliances = isAdmin || !profile?.party_id
    ? alliances
    : alliances.filter(a => (a.member_party_ids || []).includes(profile.party_id) || (a.member_party_names || []).includes(profile.party_name));

  const alliance = alliances.find(a => a.id === selected);
  const canEdit = isAdmin || (alliance && profile && alliance.chairman_party_id === profile.party_id);
  const totalSeats = scope === "national" ? NATION.lokSabhaSeats : (getStateById(selectedState)?.assemblySeats || 0);

  async function loadShare() {
    if (!alliance || (scope === "state" && !selectedState)) { setRecord(null); setAlloc({}); return; }
    const recs = await base44.entities.SeatShare.filter({
      alliance_id: alliance.id,
      scope,
      ...(scope === "national" ? {} : { state_id: selectedState }),
    }).catch(() => []);
    const rec = recs[0] || null;
    setRecord(rec);
    let a = {};
    try { a = Object.fromEntries((JSON.parse(rec?.allocations || "[]")).map(x => [x.party_name, x.seats])); } catch (e) {}
    setAlloc(a);
  }

  useEffect(() => { loadShare(); }, [selected, scope, selectedState]); // eslint-disable-line

  const allocated = Object.values(alloc).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);

  async function save(finalize = false) {
    if (!alliance || busy) return;
    setBusy(true); setMsg("");
    try {
      const allocations = JSON.stringify((alliance.member_party_names || []).map(n => ({ party_name: n, seats: parseInt(alloc[n], 10) || 0 })));
      const data = { allocations, total_seats: totalSeats, ...(finalize ? { status: "finalized", finalized_by_name: profile?.username || "Chairman" } : {}) };
      if (record) await base44.entities.SeatShare.update(record.id, data);
      else await base44.entities.SeatShare.create({
        alliance_id: alliance.id,
        alliance_name: alliance.name,
        scope,
        state_id: scope === "national" ? "" : selectedState,
        ...data,
      });
      setMsg(finalize ? "Seat sharing finalized — the deal is locked." : "Seat sharing saved.");
      // Close the on-screen keyboard after submitting.
      document.activeElement?.blur?.();
      loadShare();
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

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <PieChart className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Seat Sharing</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Alliance partners finalize the constituency split before an election · alliance chat</p>

      {!alliance ? (
        myAlliances.length === 0 ? (
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
            <Handshake className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-white">No alliances yet</p>
            <p className="text-xs text-zinc-500 mt-1">Join or create an alliance (Political → Alliance) — seat sharing opens for your alliance here.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Your Alliances · tap to open</h2>
            <div className="space-y-2">
              {myAlliances.map(a => (
                <button key={a.id} onClick={() => { setSelected(a.id); setTab("share"); }}
                  className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Handshake className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{(a.member_party_names || []).length} parties</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <button onClick={() => setSelected(null)} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
            <ChevronRight className="w-3 h-3 rotate-180" /> All Alliances
          </button>
          <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3 flex items-center gap-3">
            <Handshake className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{alliance.name}</p>
              <p className="text-[11px] text-zinc-500 truncate">{(alliance.member_party_names || []).join(" · ")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setTab("share")}
              className={`py-2 rounded-xl text-xs font-bold ${tab === "share" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              Seat Sharing
            </button>
            <button onClick={() => setTab("chat")}
              className={`py-2 rounded-xl text-xs font-bold ${tab === "chat" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              Alliance Chat
            </button>
          </div>

          {tab === "share" ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setScope("national")}
                  className={`py-2 rounded-xl text-[11px] font-bold ${scope === "national" ? "bg-orange-500/20 text-amber-400 border border-orange-500/40" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                  National ({NATION.lokSabhaSeats})
                </button>
                <button onClick={() => { setScope("state"); setSelectedState(""); }}
                  className={`py-2 rounded-xl text-[11px] font-bold ${scope === "state" ? "bg-orange-500/20 text-amber-400 border border-orange-500/40" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                  State
                </button>
              </div>

              {scope === "state" && (
                <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white mb-3">
                  <option value="">Select a state…</option>
                  {BHARAT_STATES.map(s => <option key={s.id} value={s.id}>{s.name} ({s.assemblySeats} seats)</option>)}
                </select>
              )}

              {(scope === "national" || selectedState) ? (
                <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {scope === "national" ? NATION.name : getStateById(selectedState)?.name} · {totalSeats} seats
                    </p>
                    <span className={`text-[10px] font-bold ${allocated === totalSeats ? "text-green-400" : "text-amber-400"}`}>
                      {allocated}/{totalSeats} allocated
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${Math.min((allocated / Math.max(totalSeats, 1)) * 100, 100)}%` }} />
                  </div>

                  {record?.status === "finalized" ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-green-400 flex items-center gap-1 font-semibold mb-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Finalized by {record.finalized_by_name}
                      </p>
                      {Object.entries(alloc).map(([p, seats]) => (
                        <div key={p} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                          <p className="text-[11px] text-white truncate">{p}</p>
                          <p className="text-[11px] font-bold text-amber-400 flex-shrink-0 ml-2">{seats} seats</p>
                        </div>
                      ))}
                    </div>
                  ) : !canEdit ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1"><Lock className="w-3 h-3" /> Only the alliance chairman can edit the seat split.</p>
                      {(alliance.member_party_names || []).map(p => (
                        <div key={p} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                          <p className="text-[11px] text-white truncate">{p}</p>
                          <p className="text-[11px] font-bold text-amber-400 flex-shrink-0 ml-2">{alloc[p] || 0} seats</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 mb-3">
                        {(alliance.member_party_names || []).map(p => (
                          <div key={p} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                            <p className="text-[11px] text-white truncate flex-1">{p}</p>
                            <input type="number" min="0" value={alloc[p] ?? ""} onChange={e => setAlloc({ ...alloc, [p]: e.target.value })}
                              placeholder="0"
                              className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-white" />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => save(false)} disabled={busy}
                          className="flex-1 bg-zinc-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
                          <Save className="w-3.5 h-3.5" /> Save Draft
                        </button>
                        <button onClick={() => save(true)} disabled={busy}
                          className="flex-1 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
                          <CheckCircle className="w-3.5 h-3.5" /> Finalize
                        </button>
                      </div>
                    </>
                  )}
                  {msg && <p className="text-[11px] text-green-400 mt-2">{msg}</p>}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600 text-center py-4">Select a state to start the seat split.</p>
              )}
            </>
          ) : (
            <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
              <ChannelChat channel={`alliance_${alliance.id}`} meId={profile?.player_id} meName={profile?.username} heightClass="h-72" />
            </div>
          )}
        </>
      )}
    </div>
  );
}