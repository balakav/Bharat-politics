import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getStateById, BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { BILL_STATUS_LABEL, BILL_STATUS_COLOR } from "@/lib/billFlow";
import { Gavel, ScrollText, CheckCircle, XCircle, Stamp, ChevronRight, Crown, MessagesSquare } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import ChannelChat from "@/components/chat/ChannelChat";

// Speaker's Office — the national Speaker (Lok Sabha) and every state's
// Legislative Assembly Speaker, separate offices on one screen.
// The Speaker is the real user appointed to the Speaker post (via the cabinet
// in Party HQ). Powers: admit/reject newly introduced bills for debate, and
// certify bills passed by the house onward — to the Governor (state) or the
// President (national).

export default function SpeakerOffice() {
  const [tab, setTab] = useState("national"); // "national" | "state"
  const [selectedState, setSelectedState] = useState("");
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [speakers, setSpeakers] = useState([]);
  const [bills, setBills] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) setProfile(ps[0]);
    }
    const [spks, all] = await Promise.all([
      base44.entities.Minister.filter({ position: "speaker", is_active: true }).catch(() => []),
      base44.entities.Bill.list("-created_date", 500).catch(() => []),
    ]);
    setSpeakers(spks);
    setBills(all);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 20000);

  async function act(b, to) {
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

  const currentSpeaker = tab === "national"
    ? speakers.find(m => m.scope === "national")
    : (selectedState ? speakers.find(m => m.state_id === selectedState) : null);
  const isSpeaker = isAdmin || (profile && currentSpeaker && profile.player_id === currentSpeaker.player_id);

  const scopeBills = bills.filter(b =>
    tab === "national" ? b.scope === "national" : (b.scope === "state" && b.state_id === selectedState));
  const forAdmission = scopeBills.filter(b => b.status === "speaker_review");
  const inVote = scopeBills.filter(b => b.status === "assembly_vote");
  const forCertification = scopeBills.filter(b => b.status === "speaker_office");
  const rejected = scopeBills.filter(b => b.status === "speaker_rejected");

  const BillRow = ({ b, actions }) => (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-white truncate flex items-center gap-1.5 min-w-0">
          <ScrollText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /> {b.title}
        </p>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${BILL_STATUS_COLOR[b.status] || "bg-zinc-700 text-zinc-300"}`}>
          {BILL_STATUS_LABEL[b.status] || b.status}
        </span>
      </div>
      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
        {b.category || "General"} · by {b.proposed_by_name || "Member"}
      </p>
      {actions && isSpeaker && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {actions.map(([label, to, good]) => (
            <button key={to} onClick={() => act(b, to)} disabled={busy}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1
                ${good ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {good ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Gavel className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Speaker's Office</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Admit bills for debate · certify passed bills — separate offices for the {NATION.name} Speaker and each state's Assembly Speaker.
      </p>

      {/* Office tabs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setTab("national")}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all
            ${tab === "national" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          National Speaker
        </button>
        <button onClick={() => { setTab("state"); setSelectedState(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all
            ${tab === "state" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          State Speakers
        </button>
      </div>

      {tab === "national" ? (
        <div>
          {/* Speaker identity */}
          <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 uppercase">Speaker of the Lok Sabha</p>
              <p className="text-sm font-bold text-white truncate">{currentSpeaker?.player_name || "Not appointed"}</p>
              <p className="text-[10px] text-zinc-500 truncate">{currentSpeaker?.party_name || "Appointed via the cabinet in Party HQ"}</p>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 flex items-center gap-1">
              <MessagesSquare className="w-3 h-3" /> Speaker's Discussion Chamber
            </p>
            <p className="text-[9px] text-zinc-600 mb-2">Opposition parties and members discuss bills with the Speaker here.</p>
            <ChannelChat channel="speaker_office_national" meId={profile?.player_id} meName={profile?.username} heightClass="h-48" />
          </div>

          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bills for Admission ({forAdmission.length})</h3>
          {forAdmission.length === 0 ? (
            <p className="text-[11px] text-zinc-600 mb-3">No bills awaiting admission. Bills introduced by MPs arrive here first.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {forAdmission.map(b => <BillRow key={b.id} b={b} actions={[["Admit for Debate & Vote", "assembly_vote", true], ["Reject", "speaker_rejected", false]]} />)}
            </div>
          )}

          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">In Debate & Voting ({inVote.length})</h3>
          {inVote.length === 0 ? (
            <p className="text-[11px] text-zinc-600 mb-3">No bill in debate right now.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {inVote.map(b => (
                <div key={b.id} className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-2.5">
                  <p className="text-xs font-bold text-white truncate">{b.title}</p>
                  <p className="text-[10px] text-zinc-500">Voting is run by the Speaker on the Lok Sabha floor.</p>
                  <Link to="/parliament/lok-sabha" className="text-[10px] text-yellow-400 mt-1 inline-flex items-center gap-1">
                    Go to the house floor <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Passed — Certify to the President ({forCertification.length})</h3>
          {forCertification.length === 0 ? (
            <p className="text-[11px] text-zinc-600 mb-3">No passed bills awaiting certification.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {forCertification.map(b => <BillRow key={b.id} b={b} actions={[["Certify → President", "president_review", true]]} />)}
            </div>
          )}

          {rejected.length > 0 && (
            <>
              <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Rejected by the Speaker ({rejected.length})</h3>
              <div className="space-y-2">{rejected.map(b => <BillRow key={b.id} b={b} />)}</div>
            </>
          )}
          {!isSpeaker && <p className="text-[10px] text-zinc-600 mt-3">View only — only the appointed Speaker (or an admin) can act in this office.</p>}
        </div>
      ) : !selectedState ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">All States · tap to open the Speaker's Office</h3>
          {BHARAT_STATES.map(s => {
            const sp = speakers.find(m => m.state_id === s.id);
            const count = bills.filter(b => b.scope === "state" && b.state_id === s.id &&
              ["speaker_review", "speaker_office"].includes(b.status)).length;
            return (
              <button key={s.id} onClick={() => setSelectedState(s.id)}
                className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">{s.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">Speaker: {sp?.player_name || "Not appointed"}{count > 0 ? ` · ${count} pending` : ""}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      ) : (() => {
        const st = getStateById(selectedState);
        return (
          <div>
            <button onClick={() => setSelectedState("")} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 rotate-180" /> All States
            </button>
            <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 uppercase">Speaker · {st?.name} Legislative Assembly</p>
                <p className="text-sm font-bold text-white truncate">{currentSpeaker?.player_name || "Not appointed"}</p>
                <p className="text-[10px] text-zinc-500 truncate">{currentSpeaker?.party_name || "Appointed via the cabinet in Party HQ"}</p>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3">
              <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 flex items-center gap-1">
                <MessagesSquare className="w-3 h-3" /> Speaker's Discussion Chamber
              </p>
              <p className="text-[9px] text-zinc-600 mb-2">Opposition parties and members discuss bills with the {st?.name} Speaker here.</p>
              <ChannelChat channel={`speaker_office_state_${selectedState}`} meId={profile?.player_id} meName={profile?.username} heightClass="h-48" />
            </div>

            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bills for Admission ({forAdmission.length})</h3>
            {forAdmission.length === 0 ? (
              <p className="text-[11px] text-zinc-600 mb-3">No bills awaiting admission. Bills introduced by MLAs arrive here first.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {forAdmission.map(b => <BillRow key={b.id} b={b} actions={[["Admit for Debate & Vote", "assembly_vote", true], ["Reject", "speaker_rejected", false]]} />)}
              </div>
            )}

            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">In Debate & Voting ({inVote.length})</h3>
            {inVote.length === 0 ? (
              <p className="text-[11px] text-zinc-600 mb-3">No bill in debate right now.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {inVote.map(b => (
                  <div key={b.id} className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-2.5">
                    <p className="text-xs font-bold text-white truncate">{b.title}</p>
                    <p className="text-[10px] text-zinc-500">Voting is run by the Speaker on the Assembly floor.</p>
                    <Link to={`/assembly/${selectedState}`} className="text-[10px] text-yellow-400 mt-1 inline-flex items-center gap-1">
                      Go to the house floor <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Stamp className="w-3 h-3" /> Passed — Certify to the Governor ({forCertification.length})
            </h3>
            {forCertification.length === 0 ? (
              <p className="text-[11px] text-zinc-600 mb-3">No passed bills awaiting certification.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {forCertification.map(b => <BillRow key={b.id} b={b} actions={[["Certify → Governor", "governor_review", true]]} />)}
              </div>
            )}

            {rejected.length > 0 && (
              <>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Rejected by the Speaker ({rejected.length})</h3>
                <div className="space-y-2">{rejected.map(b => <BillRow key={b.id} b={b} />)}</div>
              </>
            )}
            {!isSpeaker && <p className="text-[10px] text-zinc-600 mt-3">View only — only the appointed state Speaker (or an admin) can act in this office.</p>}
          </div>
        );
      })()}
    </div>
  );
}