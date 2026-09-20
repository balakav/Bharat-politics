import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Link } from "react-router-dom";
import { MessageSquare, Lock } from "lucide-react";
import ChannelChat from "@/components/chat/ChannelChat";

// Party group chat — a dedicated PartyHQ screen for party members only
// (a PartyMember record is required). Messages go to the party_hq_<id>
// channel and sync live across members.

export default function PartyChat() {
  const [profile, setProfile] = useState(null);
  const [party, setParty] = useState(null);
  const [channel, setChannel] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const me = await bharat01.auth.me().catch(() => null);
    if (me) {
      const ps = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) {
        const p = ps[0];
        setProfile(p);
        if (p.party_id) {
          const [partyRec, members] = await Promise.all([
            bharat01.entities.PoliticalParty.get(p.party_id).catch(() => null),
            bharat01.entities.PartyMember.filter({ party_id: p.party_id }).catch(() => []),
          ]);
          setParty(partyRec);
          setMemberCount(members.length);
          if (members.some(m => m.player_id === p.player_id)) {
            setChannel(`party_hq_${p.party_id}`);
          }
        }
      }
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20 pt-10">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
          <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white mb-1">Party members only</h1>
          <p className="text-xs text-zinc-500">Join a political party to access the party group chat.</p>
          <Link to="/party-hq" className="text-[11px] text-yellow-400 mt-3 inline-block">← Back to Party HQ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20 flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-6 h-6 text-amber-400 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate">Party Group Chat</h1>
          <p className="text-[11px] text-zinc-500 truncate">{party?.name} · {memberCount} members</p>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 p-3 flex flex-col min-h-0">
        <ChannelChat channel={channel} meId={profile?.player_id} meName={profile?.username} heightClass="flex-1" />
      </div>
    </div>
  );
}