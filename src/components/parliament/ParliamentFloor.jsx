
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Gavel, Megaphone, Vote, CheckSquare, XSquare, Minus, Send } from "lucide-react";

// Parliament floor: speaker-controlled motions + per-seat voting + live chat.
// Reuses the realtime ChatMessage channel pattern (no new entities) so it works
// identically for the national parliament and all 21 state assemblies.

export default function ParliamentFloor({ channelKey, speakerName, totalSeats, selectedSeat, partySeats = [], winners = [], memberLabel = "MLA", level = "state" }) {
  const CHAT = `parl_chat_${channelKey}`;
  const SESSION = `parl_session_${channelKey}`;
  const VOTE = `parl_vote_${channelKey}`;

  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [motion, setMotion] = useState({ title: "", type: "" });
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("General Motion");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [votes, setVotes] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [myMember, setMyMember] = useState(null);
  const [partyLine, setPartyLine] = useState({});

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      setIsAdmin(me?.role === "admin");
      if (me) {
        const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
        if (profiles[0]) {
          setProfile(profiles[0]);
          const memberships = await base44.entities.PartyMember.filter({ player_id: profiles[0].player_id }).catch(() => []);
          if (memberships[0]) setMyMember(memberships[0]);
        }
      }
      loadAll();
    })();
    const unsub = base44.entities.ChatMessage.subscribe(event => {
      const ch = event.data?.channel;
      if (ch === CHAT || ch === SESSION || ch === VOTE) loadAll();
    });
    return unsub;
  }, [channelKey]);

  async function loadAll() {
    const [sess, vot, chat] = await Promise.all([
      base44.entities.ChatMessage.filter({ channel: SESSION }).catch(() => []),
      base44.entities.ChatMessage.filter({ channel: VOTE }).catch(() => []),
      base44.entities.ChatMessage.filter({ channel: CHAT }).catch(() => []),
    ]);
    const byTime = (a, b) => new Date(a.created_date) - new Date(b.created_date);
    const latestSess = [...sess].sort(byTime).at(-1);
    if (latestSess) {
      const parts = latestSess.message.split("|");
      if (parts[0] === "VOTE_START") { setPhase("voting"); setMotion({ title: parts[1] || "", type: parts[2] || "Motion" }); }
      else { setPhase("idle"); setMotion({ title: "", type: "" }); }
    } else { setPhase("idle"); setMotion({ title: "", type: "" }); }
    const voteMap = {};
    const line = {};
    for (const v of [...vot].sort(byTime)) {
      const parts = v.message.split("|");
      if (parts[0] === "PARTY" && parts.length >= 4) line[parts[1]] = { vote: parts[2], count: parseInt(parts[3], 10) || 0 };
      else if (parts.length === 2) voteMap[parts[0]] = parts[1];
    }
    setVotes(voteMap);
    setPartyLine(line);
    setMessages([...chat].sort(byTime).slice(-60));
  }

  const isSpeaker = isAdmin || (profile?.username && speakerName && profile.username === speakerName);

  async function startVote() {
    if (!newTitle.trim()) return;
    await base44.entities.ChatMessage.create({ channel: SESSION, sender_id: "speaker", sender_name: "Speaker", message: `VOTE_START|${newTitle.trim()}|${newType}`, message_type: "system" });
    await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: "speaker", sender_name: "Speaker", message: `🗳️ Voting opened: "${newTitle.trim()}" (${newType}). MPs, cast your votes.`, message_type: "system" });
    setShowForm(false); setNewTitle(""); setNewDesc("");
  }

  async function endVote() {
    const vals = Object.values(votes);
    const yes = vals.filter(v => v === "yes").length;
    const no = vals.filter(v => v === "no").length;
    const abstain = vals.filter(v => v === "abstain").length;
    const result = yes > no ? "PASSED" : "FAILED";
    await base44.entities.ChatMessage.create({ channel: SESSION, sender_id: "speaker", sender_name: "Speaker", message: "VOTE_END", message_type: "system" });
    await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: "speaker", sender_name: "Speaker", message: `⚖️ Motion "${motion.title}" — ${result}. YES: ${yes} · NO: ${no} · ABSTAIN: ${abstain}`, message_type: "system" });
  }

  async function castVote(v) {
    if (!selectedSeat || phase !== "voting" || !canParticipate) return;
    await base44.entities.ChatMessage.create({ channel: VOTE, sender_id: profile?.player_id || "guest", sender_name: profile?.username || "Guest", message: `${selectedSeat}|${v}`, message_type: "system" });
    setVotes(prev => ({ ...prev, [selectedSeat]: v }));
  }

  async function sendChat() {
    if (!input.trim() || !canParticipate) return;
    await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: profile?.player_id || "guest", sender_name: profile?.username || "Guest", sender_photo: profile?.photo_url || "", message: input.trim(), message_type: "text" });
    setInput("");
    // Close the on-screen keyboard after sending.
    document.activeElement?.blur?.();
  }

  // Whip party-line votes count every MLA/MP of that party at once.
  const whip = { yes: 0, no: 0, abstain: 0 };
  for (const l of Object.values(partyLine)) {
    if (whip[l.vote] != null) whip[l.vote] += l.count;
  }
  const yes = Object.values(votes).filter(v => v === "yes").length + whip.yes;
  const no = Object.values(votes).filter(v => v === "no").length + whip.no;
  const abstain = Object.values(votes).filter(v => v === "abstain").length + whip.abstain;
  const notVoted = Math.max((totalSeats || 0) - (yes + no + abstain), 0);

  const myPartyName = myMember?.party_name || profile?.party_name || "";
  // Whips are per level: the National Whip runs the Lok Sabha floor, the State
  // Whip the assemblies. "Whip" (both) and the Opposition Leader also qualify.
  const isWhip = ["Whip", "Opposition Leader", level === "national" ? "National Whip" : "State Whip"].includes(myMember?.designation);
  const myPartyMLAs = partySeats.find(p => p.party === myPartyName)?.count || 0;
  const isMember = !!profile && winners.some(w => w.player_id === profile.player_id);
  // Floor access: only sitting MLAs/MPs — or the Speaker, a Whip or an admin —
  // may vote, chat or take part. Everyone else gets view-only access.
  const canParticipate = isAdmin || isSpeaker || isWhip || isMember;

  async function whipCast(v) {
    if (!isWhip || phase !== "voting" || !myPartyName) return;
    await base44.entities.ChatMessage.create({ channel: VOTE, sender_id: profile?.player_id || "guest", sender_name: profile?.username || "Guest", message: `PARTY|${myPartyName}|${v}|${myPartyMLAs}`, message_type: "system" });
    await base44.entities.ChatMessage.create({ channel: CHAT, sender_id: "speaker", sender_name: "Whip", message: `🪢 ${myPartyName} whip: all ${myPartyMLAs} ${memberLabel}s ${v === "free" ? "are free to vote" : `vote ${v.toUpperCase()}`}`, message_type: "system" });
    loadAll();
  }

  return (
    <div className="space-y-3">
      {/* Motion & voting */}
      <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5" /> Motion & Voting
          </h3>
          {isSpeaker && phase !== "voting" && (
            <button onClick={() => setShowForm(o => !o)} className="text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Megaphone className="w-3 h-3" /> New Motion
            </button>
          )}
          {isSpeaker && phase === "voting" && (
            <button onClick={endVote} className="text-[10px] bg-red-600 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Vote className="w-3 h-3" /> Close Voting
            </button>
          )}
        </div>

        {phase === "voting" ? (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-2.5 mb-2">
            <p className="text-xs font-bold text-white">{motion.title}</p>
            <p className="text-[10px] text-zinc-500">{motion.type} · Voting in progress</p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-600 mb-2">No active motion.</p>
        )}

        {showForm && isSpeaker && (
          <div className="bg-zinc-800/60 rounded-xl p-2.5 mb-2 space-y-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Motion title (e.g. Budget Bill 2026)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500" />
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
              {["General Motion", "Government Motion", "Opposition Motion", "Confidence Motion", "No-Confidence Motion", "Budget Motion", "Constitutional Motion", "Bill Vote"].map(t => <option key={t}>{t}</option>)}
            </select>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Motion description (optional)" rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-orange-500" />
            <button onClick={startVote} disabled={!newTitle.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold py-1.5 rounded-lg disabled:opacity-50">
              Open Voting
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[["YES", yes, "text-green-400"], ["NO", no, "text-red-400"], ["ABSTAIN", abstain, "text-zinc-300"], ["NOT VOTED", notVoted, "text-zinc-500"]].map(([label, val, cls]) => (
            <div key={label} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
              <p className={`text-sm font-bold ${cls}`}>{val}</p>
              <p className="text-[8px] text-zinc-500 uppercase">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <p className="text-[11px] text-zinc-400 flex-1">Selected seat: <span className="text-white font-bold">{selectedSeat || "—"}</span></p>
          {(["yes", "no", "abstain"] ).map(v => (
            <button key={v} onClick={() => castVote(v)} disabled={!selectedSeat || phase !== "voting" || !canParticipate}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg capitalize disabled:opacity-40 ${v === "yes" ? "bg-green-600 text-white" : v === "no" ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-200"}`}>
              {v === "yes" ? <CheckSquare className="w-3 h-3" /> : v === "no" ? <XSquare className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {isWhip && phase === "voting" && (
          <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 flex items-center gap-1.5">
            <p className="text-[10px] text-amber-400 font-bold flex-1 truncate">🪢 Whip · {myPartyName} ({myPartyMLAs} {memberLabel}s)</p>
            {[["yes", "Aye"], ["no", "No"], ["abstain", "Abstain"], ["free", "Free"]].map(([v, label]) => (
              <button key={v} onClick={() => whipCast(v)} disabled={myPartyMLAs === 0}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 disabled:opacity-40 flex-shrink-0">
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Parliament Chat
        </h3>
        <div className="h-36 overflow-y-auto space-y-1.5 mb-2 pr-1">
          {messages.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-4">No messages yet</p>}
          {messages.map(m => m.message_type === "system" ? (
            <div key={m.id} className="text-center"><span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">{m.message}</span></div>
          ) : (
            <div key={m.id} className={`flex ${m.sender_id === profile?.player_id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl p-2 ${m.sender_id === profile?.player_id ? "bg-orange-500/20" : "bg-zinc-800"}`}>
                {m.sender_id !== profile?.player_id && <p className="text-[10px] font-medium text-amber-400">{m.sender_name}</p>}
                <p className="text-[11px] text-white">{m.message}</p>
              </div>
            </div>
          ))}
        </div>
        {canParticipate ? (
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Message the house..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
            <button onClick={sendChat} disabled={!input.trim()}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-3 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 text-center">View only — only {memberLabel}s, the Speaker and party Whips can chat and vote on the floor.</p>
        )}
      </div>
    </div>
  );
}