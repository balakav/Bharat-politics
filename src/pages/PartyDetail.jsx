import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Coins, UserPlus, Shield, Crown, ChevronDown, LogOut } from "lucide-react";
import { formatCoins } from "@/lib/gameData";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function PartyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [party, setParty] = useState(null);
  const [members, setMembers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [depositAmount, setDepositAmount] = useState(10000000);
  const [depositing, setDepositing] = useState(false);
  const [pendingTickets, setPendingTickets] = useState([]);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  useAutoRefresh(loadData, 60000);

  async function loadData() {
    const [pt, mems, me] = await Promise.all([
      base44.entities.PoliticalParty.get(id),
      base44.entities.PartyMember.filter({ party_id: id }),
      base44.auth.me(),
    ]);
    setParty(pt);
    setMembers(mems);
    const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
    if (profiles.length > 0) setProfile(profiles[0]);
    try {
      const tickets = await base44.entities.Candidature.filter({ party_id: id, ticket_status: "pending" });
      setPendingTickets(tickets);
    } catch (e) {}
    setLoading(false);
  }

  const isMember = members.some(m => m.player_id === profile?.player_id);
  const myMembership = members.find(m => m.player_id === profile?.player_id);
  const isPresident = myMembership?.designation === "President";

  async function joinParty() {
    if (!profile || isMember) return;
    setJoining(true); setJoinError("");
    // One party per player — they must leave their current party first.
    const existing = await base44.entities.PartyMember.filter({ player_id: profile.player_id }).catch(() => []);
    if (existing.length > 0) {
      setJoinError(`You are already a member of ${existing[0].party_name} — leave that party first, then join or create a new one.`);
      setJoining(false);
      return;
    }
    const isFirstMember = members.length === 0;
    const designation = isFirstMember ? "President" : "Member";
    await base44.entities.PartyMember.create({
      player_id: profile.player_id,
      player_name: profile.username,
      party_id: id,
      party_name: party.name,
      designation,
      joined_date: new Date().toISOString().split("T")[0],
    });
    const updates = { member_count: (party.member_count || 0) + 1 };
    if (isFirstMember) {
      updates.president_id = profile.player_id;
      updates.president_name = profile.username;
    }
    await base44.entities.PoliticalParty.update(id, updates);
    await base44.entities.PlayerProfile.update(profile.id, { party_id: id, party_name: party.name });
    setJoining(false);
    loadData();
  }

  const DESIGNATIONS = ["Member", "Vice President", "General Secretary", "Treasurer"];

  async function assignDesignation(memberId, newDesignation) {
    setAssigningId(memberId);
    await base44.entities.PartyMember.update(memberId, { designation: newDesignation });
    setAssigningId(null);
    loadData();
  }

  async function leaveParty() {
    if (!profile || !myMembership) return;
    setLeaving(true);
    await base44.entities.PartyMember.delete(myMembership.id);
    const updates = { member_count: Math.max(0, (party.member_count || 0) - 1) };
    if (myMembership.designation === "President") {
      const remaining = members.filter(m => m.player_id !== profile.player_id);
      if (remaining.length > 0) {
        const nextPres = remaining[0];
        await base44.entities.PartyMember.update(nextPres.id, { designation: "President" });
        updates.president_id = nextPres.player_id;
        updates.president_name = nextPres.player_name;
      } else {
        updates.president_id = "";
        updates.president_name = "";
      }
    }
    if (myMembership.designation === "Vice President") { updates.vice_president_id = ""; updates.vice_president_name = ""; }
    if (myMembership.designation === "General Secretary") { updates.general_secretary_id = ""; updates.general_secretary_name = ""; }
    if (myMembership.designation === "Treasurer") { updates.treasurer_id = ""; updates.treasurer_name = ""; }
    await base44.entities.PoliticalParty.update(id, updates);
    await base44.entities.PlayerProfile.update(profile.id, { party_id: "", party_name: "" });
    setLeaving(false);
    navigate("/parties");
  }

  async function approveTicket(ticket) {
    const ticketNumber = "TICKET-" + Date.now().toString(36).toUpperCase();
    await base44.entities.Candidature.update(ticket.id, {
      ticket_status: "approved",
      ticket_number: ticketNumber,
    });
    await base44.entities.NewsItem.create({
      title: `🎫 ${ticket.player_name} Approved as ${party.name} Candidate`,
      content: `${party.name} president has approved ${ticket.player_name}'s candidature for ${ticket.constituency}. Ticket Number: ${ticketNumber}. The candidate is now officially nominated by the party.`,
      category: "politics",
      source: "TV99 Tamil Nadu",
    });
    loadData();
  }

  async function rejectTicket(ticket) {
    await base44.entities.Candidature.update(ticket.id, { ticket_status: "rejected" });
    loadData();
  }

  async function depositToFund() {
    if (!profile || depositing || depositAmount <= 0) return;
    if ((profile.e_coins || 0) < depositAmount) return;
    setDepositing(true);
    await base44.entities.PoliticalParty.update(id, {
      party_fund: (party.party_fund || 0) + depositAmount,
    });
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: (profile.e_coins || 0) - depositAmount,
    });
    setParty(prev => ({ ...prev, party_fund: (prev.party_fund || 0) + depositAmount }));
    setProfile(prev => ({ ...prev, e_coins: (prev.e_coins || 0) - depositAmount }));
    setDepositing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const desigIcons = { President: Crown, "Vice President": Shield, "General Secretary": Shield, Treasurer: Coins };

  return (
    <div className="p-4 max-w-lg mx-auto">

      <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: party?.color || "#FF6B00" }}>
            {party?.short_name?.substring(0, 2)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{party?.name}</h1>
            <p className="text-sm text-zinc-400">{party?.short_name} · {party?.ideology}</p>
            {party?.symbol && <p className="text-xs text-yellow-400/80 mt-1">Symbol: {party.symbol}</p>}
          </div>
        </div>
        {party?.description && <p className="text-sm text-zinc-400 mt-3">{party.description}</p>}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1 text-sm text-zinc-400">
            <Users className="w-4 h-4" /> {party?.member_count || 0} members
          </div>
          <div className="flex items-center gap-1 text-sm text-zinc-400">
            <Coins className="w-4 h-4" /> {formatCoins(party?.party_fund || 0)}
          </div>
        </div>
      </div>

      {!isMember && (
        <button onClick={joinParty} disabled={joining}
          className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-2 disabled:opacity-50">
          <UserPlus className="w-5 h-5" /> {joining ? "Joining..." : "Join Party"}
        </button>
      )}

      {joinError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-4">{joinError}</p>
      )}

      {isMember && (
        <button onClick={leaveParty} disabled={leaving}
          className="w-full bg-red-600/20 text-red-400 border border-red-600/30 font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-red-600/30 transition-all">
          <LogOut className="w-5 h-5" /> {leaving ? "Leaving..." : "Leave Party"}
        </button>
      )}

      {isPresident && pendingTickets.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Pending Ticket Approvals ({pendingTickets.length})</h2>
          <div className="space-y-2">
            {pendingTickets.map(t => (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-3 border border-yellow-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{t.player_name}</p>
                    <p className="text-xs text-zinc-500">{t.constituency}{t.seat_type && t.seat_type !== 'general' ? ` · ${t.seat_type}` : ''}</p>
                  </div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Pending</span>
                </div>
                {t.manifesto && <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{t.manifesto}</p>}
                <div className="flex gap-2">
                  <button onClick={() => approveTicket(t)} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-xs font-bold">Approve Ticket</button>
                  <button onClick={() => rejectTicket(t)} className="flex-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg py-2 text-xs font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPresident && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm text-zinc-400 mb-2">Party Fund — President Only</h3>
          <p className="text-lg font-bold text-yellow-400 mb-3">{formatCoins(party?.party_fund || 0)}</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={e => setDepositAmount(Math.max(1, Number(e.target.value)))}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
            />
            <button onClick={depositToFund} disabled={depositing || (profile?.e_coins || 0) < depositAmount}
              className="bg-gradient-to-r from-red-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 whitespace-nowrap">
              {depositing ? "..." : "Deposit"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">Members' salary is paid from this fund</p>
        </div>
      )}

      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Members ({members.length})</h2>
      <div className="space-y-2">
        {members.map(m => {
          const DesigIcon = desigIcons[m.designation] || Users;
          const isThisPresident = m.designation === "President";
          const canAssign = isPresident && !isThisPresident;
          return (
            <div key={m.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DesigIcon className={`w-4 h-4 ${isThisPresident ? "text-yellow-400" : "text-zinc-500"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{m.player_name}</p>
                      {isThisPresident && (
                        <span className="text-[10px] bg-red-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">LEADER</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{m.designation}</p>
                  </div>
                </div>
                {canAssign && (
                  <div className="relative">
                    <select
                      value={m.designation}
                      disabled={assigningId === m.id}
                      onChange={(e) => assignDesignation(m.id, e.target.value)}
                      className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-zinc-700 appearance-none pr-7 cursor-pointer focus:outline-none focus:border-red-500"
                    >
                      {DESIGNATIONS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}