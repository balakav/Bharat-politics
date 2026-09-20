
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Briefcase, Crown, Trash2, UserPlus, Users, Send, CheckCircle } from "lucide-react";
import { STATE_MINISTRIES, NATIONAL_MINISTRIES } from "@/lib/ministries";

// Cabinet formation (Party HQ). The party leader appoints the FULL cabinet —
// CM/PM, Speaker, Deputy CM, Whip and ministers — choosing from the party's
// OWN winning candidates of THIS government's election only (no other
// parties, no other states, no MLA/MP mixing). One person may hold more than
// one ministry. "Finalize & Send" submits exactly once per review round; while
// a request is pending the leader can keep editing the cabinet, and after a
// rejection they revise and send again.

const DEFAULT_PORTFOLIO = {
  pm: "Prime Minister & National Administration",
  cm: "Chief Minister & Administration",
  speaker: "Speaker's Office",
  deputy_cm: "Deputy Chief Minister's Office",
  whip: "Parliamentary Affairs",
};

export default function CabinetBuilder({ gov }) {
  const [winners, setWinners] = useState([]);
  const [party, setParty] = useState(null);
  const [ministers, setMinisters] = useState([]);
  const [candidateId, setCandidateId] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [position, setPosition] = useState("minister");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approval, setApproval] = useState(null);

  useEffect(() => { load(); }, [gov?.id]);

  async function load() {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    const ps = me ? await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []) : [];
    if (ps[0]) setProfile(ps[0]);
    if (!gov) { setLoading(false); return; }
    const [w, mins, parties, approvals] = await Promise.all([
      base44.entities.Candidature.filter({ election_id: gov.election_id, result: "won" }, undefined, 1000).catch(() => []),
      base44.entities.Minister.filter({ government_id: gov.id, is_active: true }).catch(() => []),
      base44.entities.PoliticalParty.filter({ name: gov.party_name }).catch(() => []),
      base44.entities.CabinetApproval.list("-created_date", 50).catch(() => []),
    ]);
    setParty(parties[0] || null);
    // OWN party's winners of THIS election only — the right house (MLAs or
    // MPs, never mixed) and the right state/nation, no other parties.
    setWinners(w.filter(x => x.party_name === gov.party_name));
    setMinisters(mins);
    setApproval(approvals.find(a => a.government_id === gov.id) || null);
    setLoading(false);
  }

  const isNational = gov?.type === "national";
  // Once the government is formed, ONLY the party leader (or an admin) can
  // edit the cabinet — other members get a read-only view.
  const canEdit = isAdmin || (party && profile && party.president_id === profile.player_id);
  const ministryList = isNational ? NATIONAL_MINISTRIES : STATE_MINISTRIES;
  const positions = isNational
    ? [
      { value: "pm", label: "Prime Minister" },
      { value: "speaker", label: "Speaker" },
      { value: "whip", label: "Whip" },
      { value: "union_minister", label: "Union Minister" },
      { value: "minister", label: "Minister" },
    ]
    : [
      { value: "cm", label: "Chief Minister" },
      { value: "speaker", label: "Speaker" },
      { value: "deputy_cm", label: "Deputy CM" },
      { value: "whip", label: "Whip" },
      { value: "minister", label: "Minister" },
    ];
  const isMinisterRole = position === "minister" || position === "union_minister";
  const positionLabel = (p) => (positions.find(x => x.value === p)?.label || (p || "minister").replace(/_/g, " "));

  // The appointment pool: every OWN-party winning MLA/MP of this election.
  // A person may already hold a role — they can still get another ministry.
  const pool = winners
    .filter(w => w.player_id && !w.player_id.startsWith("AI_"))
    .map(w => {
      const held = ministers.filter(m => m.player_id === w.player_id).map(m => positionLabel(m.position));
      return {
        key: w.id, player_id: w.player_id, player_name: w.player_name,
        sub: `${w.constituency}${held.length ? ` · already: ${held.join(", ")}` : ""}`,
      };
    });

  async function setWhipDesignation(playerId, playerName, designation) {
    if (!party) return;
    const mems = await base44.entities.PartyMember.filter({ player_id: playerId, party_id: party.id }).catch(() => []);
    if (mems[0]) await base44.entities.PartyMember.update(mems[0].id, { designation });
    else if (designation !== "Member") {
      await base44.entities.PartyMember.create({
        player_id: playerId, player_name: playerName, party_id: party.id,
        party_name: party.name, designation,
      }).catch(() => {});
    }
  }

  async function appoint() {
    const w = pool.find(x => x.key === candidateId);
    if (!w || busy) return;
    if (isMinisterRole && !portfolio.trim()) { setMsg("Choose the ministry for this appointment."); return; }
    setBusy(true); setMsg("");
    try {
      const finalPortfolio = isMinisterRole ? portfolio.trim() : DEFAULT_PORTFOLIO[position];
      // Executive roles (CM/PM/Speaker/Deputy CM/Whip) are one per government —
      // appointing replaces the current holder. Ministers can hold several
      // ministries at once.
      if (!isMinisterRole) {
        for (const m of ministers.filter(m => m.position === position)) {
          await base44.entities.Minister.delete(m.id);
        }
      } else if (ministers.some(m => m.player_id === w.player_id && m.portfolio === finalPortfolio)) {
        setMsg(`${w.player_name} already holds ${finalPortfolio}.`);
        setBusy(false);
        return;
      }
      await base44.entities.Minister.create({
        scope: isNational ? "national" : "state",
        state_id: gov.state_id || "",
        government_id: gov.id,
        player_id: w.player_id,
        player_name: w.player_name,
        portfolio: finalPortfolio,
        position,
        party_name: gov.party_name,
        appointed_game_time: new Date().toISOString(),
        is_active: true,
      });
      // Whip is also a party role (floor voting) — keep it in sync.
      if (position === "whip") await setWhipDesignation(w.player_id, w.player_name, "Whip");
      // Appointing the CM/PM updates the head of government everywhere.
      if (position === "cm" || position === "pm") {
        await base44.entities.Government.update(gov.id, {
          head_player_id: w.player_id, head_player_name: w.player_name,
        }).catch(() => {});
      }
      // Create the matching ministry (ministers only) so it appears on the
      // Ministries screen.
      if (isMinisterRole) {
        const existing = await base44.entities.Ministry.filter({ government_id: gov.id }).catch(() => []);
        if (!existing.some(m => m.name === finalPortfolio)) {
          await base44.entities.Ministry.create({
            scope: isNational ? "national" : "state",
            state_id: gov.state_id || "",
            government_id: gov.id,
            name: finalPortfolio,
            description: `${finalPortfolio} — headed by ${w.player_name}.`,
            head_name: w.player_name,
            party_name: gov.party_name,
            works: "[]",
            is_active: true,
          });
        }
      }
      setMsg(`${w.player_name} appointed as ${positionLabel(position)}${isMinisterRole ? ` — ${finalPortfolio}` : ""}.`);
      setCandidateId(""); setPortfolio(""); setPosition("minister");
      // Close the on-screen keyboard after submitting.
      document.activeElement?.blur?.();
      await load();
    } catch (e) {
      setMsg("Error: " + (e.message || "failed to appoint"));
    }
    setBusy(false);
  }

  // The leader can remove ANYONE from the cabinet — including the CM, PM,
  // Speaker and Whip.
  async function removeMinister(m) {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.Minister.delete(m.id);
      if (m.position === "whip") await setWhipDesignation(m.player_id, m.player_name, "Member");
      setMsg(`${m.player_name} removed from the cabinet.`);
      await load();
    } catch (e) {
      setMsg("Error: " + (e.message || "failed to remove"));
    }
    setBusy(false);
  }

  // Finalize — ONE submission per review round. While the request is pending
  // the button locks; after a rejection the leader revises and sends again.
  const pendingApproval = approval?.status === "pending";
  async function finalizeCabinet() {
    if (!canEdit || ministers.length === 0 || busy || pendingApproval) return;
    setBusy(true); setMsg("");
    try {
      await base44.entities.CabinetApproval.create({
        scope: isNational ? "national" : "state",
        state_id: gov.state_id || "",
        state_name: gov.state_name || "",
        government_id: gov.id,
        party_name: gov.party_name,
        head_player_name: gov.head_player_name,
        head_title: gov.head_title,
        cabinet: JSON.stringify(ministers.map(m => ({
          player_id: m.player_id, player_name: m.player_name,
          portfolio: m.portfolio, position: m.position, party_name: m.party_name,
        }))),
        status: "pending",
        submitted_by_name: profile?.username || "",
      });
      setMsg(`Cabinet sent to the ${isNational ? "President" : "Governor"} for approval.`);
      document.activeElement?.blur?.();
      await load();
    } catch (e) {
      setMsg("Error: " + (e.message || "failed"));
    }
    setBusy(false);
  }

  if (!gov) return null;
  if (loading) {
    return (
      <div className="bg-zinc-800/40 rounded-xl p-3 border border-yellow-500/20">
        <p className="text-[11px] text-zinc-500">Loading cabinet…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 rounded-xl p-3 border border-yellow-500/20 flex items-center gap-2">
        <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{gov.party_name}</p>
          <p className="text-[10px] text-zinc-400 truncate">{gov.head_title}: {gov.head_player_name} · {gov.state_name || "Bharat Union"}</p>
        </div>
      </div>

      {/* Cabinet approval status (President / Governor) */}
      {approval && (
        <div className={`rounded-xl p-2.5 border text-[11px] flex items-center gap-1.5
          ${approval.status === "approved" ? "bg-green-500/10 border-green-500/30 text-green-400" : approval.status === "rejected" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
          {approval.status === "approved" ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <Send className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="truncate">
            {approval.status === "pending"
              ? `Sent to the ${isNational ? "President" : "Governor"} — awaiting approval. You can still edit the cabinet.`
              : approval.status === "approved"
                ? `Cabinet approved by the ${isNational ? "President" : "Governor"}.`
                : `Cabinet rejected by the ${isNational ? "President" : "Governor"} — revise and resend.`}
          </span>
        </div>
      )}

      <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/50">
        {!canEdit ? (
          <p className="text-[11px] text-zinc-500">Read-only — only the party leader can appoint or remove cabinet members.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500">
              Appoint from your own party's winning {isNational ? "MPs" : "MLAs"} of this election — no other parties, no MLA/MP mixing.
            </p>
            {/* Position selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {positions.map(p => (
                <button key={p.value} onClick={() => { setPosition(p.value); setPortfolio(""); }}
                  className={`text-[10px] py-1.5 rounded-lg font-semibold transition-all
                    ${position === p.value ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {pool.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No winning {isNational ? "MPs" : "MLAs"} from your party's election results yet.</p>
            ) : (
              <>
                <select value={candidateId} onChange={e => setCandidateId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
                  <option value="">Select a winning {isNational ? "MP" : "MLA"} of your party…</option>
                  {pool.map(w => <option key={w.key} value={w.key}>{w.player_name} — {w.sub}</option>)}
                </select>
                {isMinisterRole && (
                  <select value={portfolio} onChange={e => setPortfolio(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
                    <option value="">Choose the ministry…</option>
                    {ministryList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
                <button onClick={appoint} disabled={busy || !candidateId || (isMinisterRole && !portfolio.trim())}
                  className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> {busy ? "Appointing…" : `Appoint as ${positionLabel(position)}`}
                </button>
              </>
            )}
            {msg && <p className="text-[10px] text-green-400 mt-1">{msg}</p>}
          </div>
        )}
      </div>

      <div className="bg-zinc-800/40 rounded-xl p-3 border border-zinc-700/50">
        <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2 flex items-center gap-1"><Briefcase className="w-3 h-3" /> Current Cabinet ({ministers.length})</p>
        {ministers.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No appointments yet.</p>
        ) : (
          <div className="space-y-1.5">
            {ministers.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-zinc-900/60 rounded-lg px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-white truncate">{m.player_name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{m.portfolio} · {positionLabel(m.position)}</p>
                  {m.player_id && <p className="text-[9px] text-zinc-600 truncate">ID: {m.player_id}</p>}
                </div>
                {canEdit && (
                  <button onClick={() => removeMinister(m)} className="text-zinc-600 hover:text-red-400 flex-shrink-0 ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canEdit && ministers.length > 0 && (
          <button onClick={finalizeCabinet} disabled={busy || pendingApproval}
            className={`w-full text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 mt-2
              ${pendingApproval ? "bg-zinc-700 cursor-not-allowed" : "bg-gradient-to-r from-red-500 to-yellow-500"}`}>
            <Send className="w-3.5 h-3.5" />
            {pendingApproval
              ? `Sent — Awaiting ${isNational ? "Presidential" : "Governor's"} Approval`
              : `Finalize & Send to the ${isNational ? "President" : "Governor"}`}
          </button>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Users className="w-3 h-3" /> This cabinet is shown on every {gov.state_name || "national"} screen.</p>
    </div>
  );
}