import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { NATION } from "@/lib/bharatStates";
import { Crown, CheckCircle, Handshake, XCircle, Landmark, Clock, Send } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// Government formation: when no party has a majority, the invited party leader
// sends coalition / outside-support requests to the other parties of their
// choice. A partner's seats count toward the majority ONLY after that party's
// president accepts the request. Only a winning candidate of the election
// (MP for national / MLA for state) may head the government.

export default function FormationRequests() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [seatData, setSeatData] = useState({});   // requestId -> [{name, seats}]
  const [supports, setSupports] = useState({});   // requestId -> [SupportRequest]
  const [partners, setPartners] = useState({});   // requestId -> [partyName] to request
  const [partyWinners, setPartyWinners] = useState({}); // requestId -> this party's winning candidates
  const [headChoice, setHeadChoice] = useState({});     // requestId -> chosen winner (CM/PM)
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadData(); }, []);
  useAutoRefresh(loadData, 30000);

  async function loadData() {
    const me = await bharat01.auth.me();
    const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
    if (profiles.length === 0) { setLoading(false); return; }
    const p = profiles[0];
    setProfile(p);

    const [myParties, allReqs] = await Promise.all([
      bharat01.entities.PoliticalParty.filter({ president_id: p.player_id }),
      bharat01.entities.FormationRequest.filter({ status: "sent" }),
    ]);
    const myPartyIds = myParties.map(x => x.id);
    const mine = allReqs.filter(r => myPartyIds.includes(r.party_id) || (r.president_id && r.president_id === p.player_id));
    setRequests(mine);

    const data = {};
    const pw = {};
    const sup = {};
    for (const r of mine) {
      const [winners, srs] = await Promise.all([
        bharat01.entities.Candidature.filter({ election_id: r.election_id, result: "won" }, undefined, 1000),
        bharat01.entities.SupportRequest.filter({ formation_request_id: r.id }),
      ]);
      const counts = {};
      for (const w of winners) {
        const key = w.party_name || "Independent";
        counts[key] = (counts[key] || 0) + 1;
      }
      data[r.id] = Object.entries(counts)
        .map(([name, seats]) => ({ name, seats }))
        .filter(x => x.name !== r.party_name)
        .sort((a, b) => b.seats - a.seats);
      // The party's OWN winners — the leader appoints the CM/PM from these,
      // even if the leader did not contest the election.
      pw[r.id] = winners
        .filter(w => (w.party_name || "Independent") === r.party_name && !(w.player_id || "").startsWith("AI_"))
        .sort((a, b) => (b.votes_received || 0) - (a.votes_received || 0));
      sup[r.id] = srs;
    }
    setSeatData(data);
    setPartyWinners(pw);
    setSupports(sup);
    setLoading(false);
  }

  function togglePartner(req, partyName) {
    setPartners(prev => {
      const cur = prev[req.id] || [];
      return { ...prev, [req.id]: cur.includes(partyName) ? cur.filter(x => x !== partyName) : [...cur, partyName] };
    });
  }

  function acceptedSeats(req) {
    return (supports[req.id] || []).filter(s => s.status === "accepted").reduce((sum, s) => sum + (s.seats || 0), 0);
  }

  function acceptedParties(req) {
    return (supports[req.id] || []).filter(s => s.status === "accepted").map(s => s.to_party_name);
  }

  async function sendSupportRequests(req) {
    const chosen = partners[req.id] || [];
    if (chosen.length === 0) return;
    const existing = supports[req.id] || [];
    const toSend = chosen.filter(name => !existing.some(s => s.to_party_name === name && ["pending", "accepted"].includes(s.status)));
    if (toSend.length === 0) { setMsg("Requests were already sent to the selected parties."); return; }
    setBusy(req.id);
    setMsg("");
    try {
      const allParties = await bharat01.entities.PoliticalParty.list();
      for (const name of toSend) {
        const target = allParties.find(x => x.name === name);
        const seats = (seatData[req.id] || []).find(x => x.name === name)?.seats || 0;
        await bharat01.entities.SupportRequest.create({
          formation_request_id: req.id,
          election_id: req.election_id,
          scope: req.scope,
          state_id: req.state_id || "",
          state_name: req.state_name || "",
          from_party_id: req.party_id,
          from_party_name: req.party_name,
          to_party_id: target?.id || "",
          to_party_name: name,
          to_president_id: target?.president_id || "",
          seats,
          support_type: "coalition",
          status: "pending",
        });
      }
      setMsg(`Support requests sent to ${toSend.length === 1 ? toSend[0] : toSend.length + " parties"} — their seats count only after they accept.`);
      setPartners(prev => ({ ...prev, [req.id]: [] }));
      await loadData();
    } catch (e) {
      setMsg("Error: " + (e.message || "failed to send requests"));
    }
    setBusy("");
  }

  async function formGovernment(req) {
    const own = req.seats || 0;
    const allied = acceptedSeats(req);
    const total = own + allied;
    if (total < (req.majority_mark || 0)) return;
    setBusy(req.id);
    setMsg("");
    try {
      // The party leader does NOT need to have contested — they appoint the
      // head of government (PM / CM) from the party's winning candidates.
      const isNational = req.scope === "national";
      const headTitle = isNational ? "Prime Minister" : "Chief Minister";
      const pw = partyWinners[req.id] || [];
      const head = pw.find(w => w.id === headChoice[req.id]) || pw[0] || null;
      const headId = head?.player_id || profile.player_id;
      const headName = head?.player_name || profile.username;
      const coalition = acceptedParties(req);
      const proofType = own >= (req.majority_mark || 0) ? "single" : "alliance";
      const gov = await bharat01.entities.Government.create({
        type: isNational ? "national" : "state",
        election_id: req.election_id,
        state_id: isNational ? "" : (req.state_id || ""),
        state_name: isNational ? NATION.name : (req.state_name || ""),
        head_player_id: headId,
        head_player_name: headName,
        head_title: headTitle,
        party_id: req.party_id,
        party_name: req.party_name,
        coalition_parties: coalition,
        cabinet: JSON.stringify({ status: proofType === "single" ? "majority" : "coalition", total_seats: total, majority_mark: req.majority_mark }),
        is_active: true,
      });
      await bharat01.entities.Minister.create({
        scope: req.scope,
        state_id: isNational ? "" : (req.state_id || ""),
        government_id: gov.id,
        player_id: headId,
        player_name: headName,
        portfolio: "Head of Government",
        position: isNational ? "pm" : "cm",
        party_id: req.party_id,
        party_name: req.party_name,
        appointed_game_time: new Date().toISOString(),
        is_active: true,
      });
      await bharat01.entities.FormationRequest.update(req.id, {
        status: "proven",
        proof_type: proofType,
        coalition_party_names: coalition,
        total_seats: total,
        government_id: gov.id,
      });
      if (!head || head.player_id === profile.player_id) {
        await bharat01.entities.PlayerProfile.update(profile.id, { position_held: isNational ? "PM" : "CM" });
      }
      await bharat01.entities.NewsItem.create({
        title: `🏛️ ${headName} sworn in as ${headTitle} of ${isNational ? NATION.name : req.state_name}`,
        content: `${req.party_name} proved majority with ${total} seats (${own} own${coalition.length ? ` + support from ${coalition.join(", ")}` : ""}). Majority mark: ${req.majority_mark}.`,
        category: "politics",
        source: "TV99 Bharat",
        related_type: "government_formation",
        related_id: gov.id,
      });
      setMsg(`Government formed! ${headName === profile.username ? "You are" : headName + " is"} now the ${headTitle} of ${isNational ? NATION.name : req.state_name}. Form the cabinet from Party HQ.`);
      await loadData();
    } catch (e) {
      setMsg("Error: " + (e.message || "failed to form government"));
    }
    setBusy("");
  }

  async function reject(req) {
    setBusy(req.id);
    try {
      await bharat01.entities.FormationRequest.update(req.id, { status: "failed", note: "Party declined / could not prove majority." });
      await loadData();
    } catch (e) {}
    setBusy("");
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-zinc-950"><div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Formation Requests</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">The Governor has invited your party to form the government. Ask other parties for coalition / outside support — their seats count only after they accept.</p>
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4"><p className="text-xs text-green-400">{msg}</p></div>}

      {requests.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Crown className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No pending requests</p>
          <p className="text-xs text-zinc-500 mt-1">When your party wins the most seats, the admin will invite you to form the government.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const majority = req.majority_mark || 0;
            const own = req.seats || 0;
            const allied = acceptedSeats(req);
            const total = own + allied;
            const hasOwnMajority = own >= majority;
            const canForm = total >= majority && !(req.deadline_game_time && new Date(req.deadline_game_time) < new Date());
            const expired = req.deadline_game_time && new Date(req.deadline_game_time) < new Date();
            const reqSupports = supports[req.id] || [];
            return (
              <div key={req.id} className="bg-zinc-900 rounded-2xl p-4 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{req.election_title || "Election"}</p>
                    <p className="text-[10px] text-zinc-500">{req.state_name || NATION.name} · Majority mark: {majority}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-zinc-400 flex-1 truncate">{req.party_name}</span>
                  <span className="text-sm font-bold text-yellow-400">{own} seats</span>
                  {hasOwnMajority && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold uppercase">Own Majority</span>}
                </div>

                {req.deadline_game_time && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className={`w-3.5 h-3.5 ${expired ? "text-red-400" : "text-amber-400"}`} />
                    <p className={`text-[11px] ${expired ? "text-red-400" : "text-zinc-400"}`}>
                      {expired ? "Floor test deadline passed" : `Floor test deadline: ${new Date(req.deadline_game_time).toLocaleString()}`}
                    </p>
                  </div>
                )}
                {expired && <p className="text-[11px] text-red-400 mb-3">The floor test window has closed. The Governor may re-issue the request.</p>}

                {!hasOwnMajority && (
                  <div className="mb-3">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1.5 flex items-center gap-1"><Handshake className="w-3 h-3" /> Choose parties to request support from</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(seatData[req.id] || []).slice(0, 8).map(p => {
                        const selected = (partners[req.id] || []).includes(p.name);
                        return (
                          <button key={p.name} onClick={() => togglePartner(req, p.name)}
                            className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-all
                              ${selected ? "bg-red-500/20 border-red-500/40 text-yellow-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                            {p.name} · {p.seats}
                          </button>
                        );
                      })}
                      {(seatData[req.id] || []).length === 0 && <p className="text-[11px] text-zinc-600">No other parties won seats.</p>}
                    </div>
                    <button onClick={() => sendSupportRequests(req)} disabled={busy === req.id || (partners[req.id] || []).length === 0}
                      className="mt-2 w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" /> Send Support Requests
                    </button>

                    {/* Requests sent + their status */}
                    {reqSupports.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {reqSupports.map(s => (
                          <div key={s.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-[11px] text-zinc-300 truncate">{s.to_party_name} · {s.seats} seats</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase flex-shrink-0 ml-2
                              ${s.status === "accepted" ? "bg-green-500/20 text-green-400" : s.status === "rejected" ? "bg-red-500/20 text-red-400" : s.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-zinc-700 text-zinc-400"}`}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(partyWinners[req.id] || []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1.5">
                      Appoint as {req.scope === "national" ? "Prime Minister (MP)" : "Chief Minister (MLA)"} — from your party's winners
                    </p>
                    <select
                      value={headChoice[req.id] || partyWinners[req.id][0]?.id || ""}
                      onChange={e => setHeadChoice(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
                      {partyWinners[req.id].map(w => (
                        <option key={w.id} value={w.id}>{w.player_name} · {w.constituency}</option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 mb-3">
                  Total: <span className={`font-bold ${canForm ? "text-green-400" : "text-red-400"}`}>{total}</span> / {majority} needed
                  {!canForm && ` — ${majority - total} more (accepted support only)`}
                </p>

                <div className="flex gap-2">
                  <button onClick={() => reject(req)} disabled={busy === req.id}
                    className="flex-1 bg-zinc-800 text-zinc-400 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Unable to Form
                  </button>
                  <button onClick={() => formGovernment(req)} disabled={busy === req.id || !canForm}
                    className="flex-1 bg-gradient-to-r from-red-500 to-yellow-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {busy === req.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {expired ? "Deadline Passed" : canForm ? "Prove Majority & Form Govt" : `Need ${majority - total} more seats`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}