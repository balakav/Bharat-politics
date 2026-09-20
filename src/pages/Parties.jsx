import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Building2, Plus, Users, ChevronRight, Coins, Handshake } from "lucide-react";
import { formatCoins } from "@/lib/gameData";

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParties();
  }, []);

  async function loadParties() {
    const pts = await base44.entities.PoliticalParty.list();
    setParties(pts);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Political Parties</h1>
        <div className="flex items-center gap-2">
          <Link to="/alliances" className="bg-zinc-800 text-yellow-400 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-1 border border-zinc-700">
            <Handshake className="w-4 h-4" /> Alliances
          </Link>
          <Link to="/parties/create" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Create
          </Link>
        </div>
      </div>

      {parties.length === 0 && (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-4">No parties yet — only parties created by players appear here.</p>
          <Link to="/parties/create" className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-xl text-sm font-bold">
            Create the First Party
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {[...parties].sort((a, b) => (b.member_count || 0) - (a.member_count || 0)).map((party, idx) => {
          const rank = idx + 1;
          const rankStyle = rank === 1 ? "bg-amber-500 text-black" : rank === 2 ? "bg-zinc-400 text-black" : rank === 3 ? "bg-orange-700 text-white" : "bg-zinc-800 text-zinc-400";
          return (
          <Link key={party.id} to={`/parties/${party.id}`}
            className="block bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${rankStyle}`}>
                    #{rank}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: party.color || "#FF6B00" }}>
                  {party.short_name?.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{party.name}</h3>
                  {party.symbol && <p className="text-[10px] text-yellow-400/70">Symbol: {party.symbol}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {party.member_count || 0}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Coins className="w-3 h-3" /> {formatCoins(party.party_fund || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}