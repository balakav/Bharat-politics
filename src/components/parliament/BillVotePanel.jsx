
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Gavel, ScrollText, CheckSquare, XSquare, Minus, Vote, Megaphone, Loader2 } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { isConstitutionalBill, requiredVotesFor } from "@/lib/billFlow";

// Legislative Assembly / Lok Sabha Bill Voting. The Speaker opens voting on an
// admitted bill and closes it — on close, the Voting Agent (backend) tallies
// every vote (individual + the Whip's party line, which counts the party's
// present members at once) and routes the bill onward. Members vote from
// their seats; the Whip broadcasts the party's voting instruction to all.

function BillVotePanel({ channelKey, scope, stateId = "", speakerName, winners = [], partySeats = [], memberLabel = "MLA", level = "state", totalSeats = 0 }) {
  const SESSION = `billsession_${channelKey}`;
  const CHAT = `parl_chat_${channelKey}`;

  const [bills, setBills] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myMember, setMyMember] = useState(null);
  const [session, setSession] = useState({ open: false, billId: "" });
  const [votes, setVotes] = useState({});
  const [partyLine, setPartyLine] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) {
        setProfile(ps[0]);
        const mems = await base44.entities.PartyMember.filter({ player_id: ps[0].player_id }).catch(() => []);
        if (mems[0]) setMyMember(mems[0]);
      }
    }
    const all = await base44.entities.Bill.list("-created_date", 500).catch(() => []);
    setBills(all.filter(b => b.scope === scope && (scope === "national" ? true : b.state_id === stateId)));

    const rawSess = await base44.entities.ChatMessage.filter({ channel: SESSION }).catch(() => []);
    const sess = [...rawSess].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const latest = sess[sess.length - 1];
    const parts = latest ? latest.message.split("|") : [];
    const open = parts[0] === "OPEN";
    const openBillId = open ? parts[1] : "";
    setSession({ open, billId: openBillId });

    const voteMap = {};
    const line = {};
    if (openBillId) {
      const vot = await base44.entities.ChatMessage.filter({ channel: "billvote_" + openBillId }).catch(() => []);
      const sortedVot = [...vot].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      for (const v of sortedVot) {
        const p = v.message.split("|");
        if (p[0] === "PARTY" && p.length >= 4) line[p[1]] = { vote: p[2], count: parseInt(p[3], 10) || 0 };
        else if (p.length >= 2 && p[0]) voteMap[p[0]] = { vote: p[1], party: p[3] || "" };
      }
    }
    setVotes(voteMap);
    setPartyLine(line);
    setLoading(false);
  }, [channelKey, scope, stateId]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 10000);
  useEffect(() => {
    const unsub = base44.entities.ChatMessage.subscribe(e => {
      const ch = e.data?.channel || "";
      if (ch === SESSION || ch.startsWith("billvote_")) load();
    });
    return unsub;
  }, [SESSION, load]);

  const isSpeaker = isAdmin || (profile?.username && speakerName && profile.username === speakerName);
  const isMember = !!profile && winners.some(w => w.player_id === profile.player_id);
  const myPartyName = myMember?.party_name || profile?.party_name || "";
  const isWhip = ["Whip", "Opposition Leader", level === "national" ? "National Whip" : "State Whip"].includes(myMember?.designation);
  const myPartyCount = partySeats.find(p => p.party === myPartyName)?.count || 0;

  const votingBills = bills.filter(b => b.status === "assembly_vote");
  const activeBill = votingBills.find(b => b.id === session.billId) || null;

  // Live tally — same rules as the Voting Agent.
  let yes = 0, no = 0, abstain = 0;
  for (const info of Object.values(votes)) {
    const line = partyLine[info.party];
    if (line && line.vote !== "free") continue;
    if (info.vote === "yes") yes += 1;
    else if (info.vote === "no") no += 1;
    else abstain += 1;
  }
  // Whip lines count the party's ACTUAL strength in the house (the same
  // source the chamber uses), so a whip vote is never tallied as zero.
  for (const [party, line] of Object.entries(partyLine)) {
    const count = partySeats.find(p => p.party === party)?.count ?? line.count;
    if (line.vote === "yes") yes += count;
    else if (line.vote === "no") no += count;
    else if (line.vote === "abstain") abstain += count;
  }
  const myVote = votes[profile?.player_id]?.vote;

  async function openVoting(b) {
    setBusy(true);
    try {
      await base44.entities.ChatMessage.create({ channel: SESSION, sender_id: "speaker", sender_name: "Speaker", message: "OPEN|" + b.id + "|" + b.title, message_type: "system" });
      await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: "speaker", sender_name: "Speaker", message: "📜 Bill voting opened: \"" + b.title + "\". " + memberLabel + "s, cast your votes.", message_type: "system" });
      setResult(null);
      await load();
    } finally { setBusy(false); }
  }

  async function closeVoting() {
    if (!session.billId || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("votingAgent", { bill_id: session.billId, total_seats: totalSeats, party_seats: partySeats });
      setResult(res.data);
      await base44.entities.ChatMessage.create({ channel: SESSION, sender_id: "speaker", sender_name: "Speaker", message: "CLOSED", message_type: "system" });
      await load();
    } catch (e) {
      setResult({ error: (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || "Tally failed" });
      setBusy(false);
    }
  }

  async function castVote(v) {
    if (!session.open || !isMember || !profile || busy) return;
    await base44.entities.ChatMessage.create({ channel: "billvote_" + session.billId, sender_id: profile.player_id, sender_name: profile.username, message: profile.player_id + "|" + v + "|" + profile.username + "|" + myPartyName, message_type: "system" });
    await load();
  }

  // The Whip directs the whole party's vote at once and broadcasts the
  // instruction to every party member on the floor.
  async function whipCast(v) {
    if (!session.open || !isWhip || !myPartyName || busy) return;
    await base44.entities.ChatMessage.create({ channel: "billvote_" + session.billId, sender_id: profile.player_id, sender_name: profile.username, message: "PARTY|" + myPartyName + "|" + v + "|" + myPartyCount, message_type: "system" });
    await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: "whip", sender_name: "Whip · " + myPartyName, message: "🪢 Party line: all " + myPartyCount + " " + myPartyName + " " + memberLabel + "s " + (v === "free" ? "vote as they wish" : "vote " + v.toUpperCase()) + " on \"" + (activeBill ? activeBill.title : "") + "\".", message_type: "system" });
    await load();
  }

  if (loading) return null;

  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5" /> Bill Voting
        </h3>
        {isSpeaker && !session.open && votingBills.length > 0 && !result && (
          <span className="text-[9px] text-zinc-500">Open voting on a bill below</span>
        )}
      </div>

      {votingBills.length === 0 ? (
        <p className="text-[11px] text-zinc-600">No bill in debate &amp; voting. Bills admitted by the Speaker's Office appear here.</p>
      ) : (
        <div className="space-y-2">
          {votingBills.map(b => {
            const isActive = session.open && b.id === session.billId;
            return (
              <div key={b.id} className={`rounded-xl p-2.5 border ${isActive ? "bg-orange-500/10 border-orange-500/30" : "bg-zinc-800/60 border-zinc-700"}`}>
                <p className="text-xs font-bold text-white truncate">{b.title}</p>
                <p className="text-[10px] text-zinc-500 truncate">{b.category || "General"} · {b.summary || "No summary"}</p>
                {isSpeaker && !session.open && (
                  <button onClick={() => openVoting(b)} disabled={busy}
                    className="mt-2 w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                    <Vote className="w-3 h-3" /> Open Voting
                  </button>
                )}
                {isActive && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[["YES", yes, "text-green-400"], ["NO", no, "text-red-400"], ["ABSTAIN", abstain, "text-zinc-300"], ["TURNOUT", yes + no + abstain, "text-yellow-400"]].map(([label, val, cls]) => (
                        <div key={label} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
                          <p className={`text-sm font-bold ${cls}`}>{val}</p>
                          <p className="text-[8px] text-zinc-500 uppercase">{label}</p>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const constitutional = isConstitutionalBill(b);
                      const req = requiredVotesFor(totalSeats, constitutional);
                      return (
                        <p className="text-[9px] text-zinc-500 mt-1.5 text-center">
                          {req > 0
                            ? `To pass: ${req} YES of ${totalSeats} seats — ${constitutional ? "2/3 majority (Constitutional Amendment)" : "simple majority"}`
                            : `Majority of the votes cast decides${constitutional ? " — Constitutional Amendment: 2/3 of the house" : ""}`}
                        </p>
                      );
                    })()}
                    {isMember && (
                      <div className="flex gap-1.5 mt-2">
                        {["yes", "no", "abstain"].map(v => (
                          <button key={v} onClick={() => castVote(v)}
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg capitalize border transition-all
                              ${myVote === v ? "border-white/60" : "border-transparent"}
                              ${v === "yes" ? "bg-green-600 text-white" : v === "no" ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-200"}`}>
                            {v === "yes" ? <CheckSquare className="w-3 h-3 mx-auto" /> : v === "no" ? <XSquare className="w-3 h-3 mx-auto" /> : <Minus className="w-3 h-3 mx-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {isWhip && (
                      <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                        <p className="text-[10px] text-amber-400 font-bold truncate mb-1.5">
                          <Megaphone className="w-3 h-3 inline mr-1" /> Whip · {myPartyName} ({myPartyCount} {memberLabel}s)
                        </p>
                        <div className="flex gap-1.5">
                          {[["yes", "Aye"], ["no", "No"], ["abstain", "Abstain"], ["free", "Free"]].map(([v, label]) => (
                            <button key={v} onClick={() => whipCast(v)} disabled={myPartyCount === 0}
                              className="flex-1 text-[10px] font-bold px-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 disabled:opacity-40">
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {isSpeaker && (
                      <button onClick={closeVoting} disabled={busy}
                        className="mt-2 w-full bg-red-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gavel className="w-3 h-3" />} Close Voting · Tally
                      </button>
                    )}
                    {!isSpeaker && !isMember && !isWhip && (
                      <p className="text-[9px] text-zinc-600 text-center mt-1.5">View only — only {memberLabel}s, the Speaker and Whips take part.</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result && (
        <div className={`mt-2 rounded-xl p-2.5 border ${result.error ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
          {result.error ? (
            <p className="text-[11px] text-red-400">{result.error}</p>
          ) : (
            <>
              <p className="text-[11px] font-bold text-white">
                {result.passed ? "✅ Passed by the house" : "❌ Bill Failed"} — YES: {result.yes} · NO: {result.no} · ABSTAIN: {result.abstain}
                {result.required > 0 ? ` · Required: ${result.required} of ${result.totalSeats}${result.isConstitutional ? " (2/3 majority)" : " (simple majority)"}` : ""}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {result.passed
                  ? "Moved to the Speaker's Office for certification."
                  : result.required > 0
                    ? `The bill failed — it needed ${result.required} YES votes.`
                    : "The bill failed — the NOs had it."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BillVotePanel;