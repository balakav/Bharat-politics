import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Link } from "react-router-dom";
import { formatCoins } from "@/lib/gameData";
import { Trophy, Crown, Medal, Coins, Building2, Car, Vote, Users } from "lucide-react";

export default function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [parties, setParties] = useState([]);
  const [tab, setTab] = useState("richest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      bharat01.entities.PlayerProfile.list('-net_worth', 50),
      bharat01.entities.PoliticalParty.list('-member_count', 20),
    ]).then(([p, pt]) => {
      setPlayers(p);
      setParties(pt);
      setLoading(false);
    });
  }, []);

  const tabs = [
    { key: "richest", label: "Richest", icon: Coins },
    { key: "elections", label: "Elections", icon: Vote },
    { key: "properties", label: "Properties", icon: Building2 },
    { key: "vehicles", label: "Vehicles", icon: Car },
    { key: "parties", label: "Parties", icon: Users },
  ];

  const sortedPlayers = [...players].sort((a, b) => {
    if (tab === "richest") return (b.net_worth || 0) - (a.net_worth || 0);
    if (tab === "elections") return (b.elections_won || 0) - (a.elections_won || 0);
    if (tab === "properties") return (b.properties_owned || 0) - (a.properties_owned || 0);
    if (tab === "vehicles") return (b.vehicles_owned || 0) - (a.vehicles_owned || 0);
    return 0;
  });

  const getValue = (p) => {
    if (tab === "richest") return formatCoins(p.net_worth || 0);
    if (tab === "elections") return `${p.elections_won || 0} wins`;
    if (tab === "properties") return `${p.properties_owned || 0}`;
    if (tab === "vehicles") return `${p.vehicles_owned || 0}`;
    return "";
  };

  const medalColors = ["text-amber-400", "text-zinc-300", "text-orange-600"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1
              ${tab === t.key ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "parties" ? (
        <div className="space-y-2">
          {parties.map((party, i) => (
            <div key={party.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-3">
              <span className={`text-lg font-bold ${medalColors[i] || "text-zinc-500"} w-8 text-center`}>#{i + 1}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: party.color || "#FF6B00" }}>
                {party.short_name?.substring(0, 2)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{party.name}</p>
                <p className="text-xs text-zinc-500">{party.member_count || 0} members</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPlayers.map((player, i) => (
            <Link key={player.id} to={`/profile/${player.player_id}`} className={`bg-zinc-900 rounded-xl p-4 border ${i === 0 ? "border-red-500/30" : "border-zinc-800"} flex items-center gap-3`}>
              <span className={`text-lg font-bold ${medalColors[i] || "text-zinc-500"} w-8 text-center`}>
                {i < 3 ? <Crown className={`w-5 h-5 mx-auto ${medalColors[i]}`} /> : `#${i + 1}`}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{player.username}</p>
                <p className="text-xs text-zinc-500">{player.party_name || "Independent"}</p>
              </div>
              <span className="text-sm font-bold text-yellow-400">{getValue(player)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}