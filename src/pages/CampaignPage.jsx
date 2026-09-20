import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useParams, useNavigate } from "react-router-dom";
import { CAMPAIGN_TYPES, formatCoins } from "@/lib/gameData";
import { ArrowLeft, Megaphone, Mic, Image, Tv, Home, Share2, CheckCircle } from "lucide-react";

const iconMap = { Megaphone, Mic, Image, Tv, Home, Share2 };

export default function CampaignPage() {
  const { electionId, candidatureId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [running, setRunning] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await bharat01.auth.me();
    const [profiles, camps] = await Promise.all([
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.Campaign.filter({ candidature_id: candidatureId || "" }),
    ]);
    if (profiles.length > 0) setProfile(profiles[0]);
    setCampaigns(camps);
  }

  async function runCampaign(ct) {
    if (!profile || profile.e_coins < ct.cost) return;
    setRunning(ct.type);
    await bharat01.entities.Campaign.create({
      player_id: profile.player_id,
      election_id: electionId,
      candidature_id: candidatureId || "",
      type: ct.type,
      constituency: "",
      cost: ct.cost,
      impact: ct.impact,
      description: ct.description,
    });
    await bharat01.entities.PlayerProfile.update(profile.id, {
      e_coins: profile.e_coins - ct.cost,
      reputation: Math.min(100, (profile.reputation || 50) + Math.floor(ct.impact / 2)),
    });
    setProfile(prev => ({
      ...prev,
      e_coins: prev.e_coins - ct.cost,
      reputation: Math.min(100, (prev.reputation || 50) + Math.floor(ct.impact / 2)),
    }));
    setRunning(null);
    loadData();
  }

  return (
    <div className="p-4 max-w-lg mx-auto">

      <h1 className="text-2xl font-bold text-white mb-2">Campaign Center</h1>
      <p className="text-sm text-zinc-400 mb-4">Run campaigns to increase your chances of winning</p>

      <div className="space-y-3 mb-6">
        {CAMPAIGN_TYPES.map(ct => {
          const Icon = iconMap[ct.icon] || Megaphone;
          return (
            <button
              key={ct.type}
              onClick={() => runCampaign(ct)}
              disabled={running === ct.type || (profile?.e_coins || 0) < ct.cost}
              className="w-full bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-left hover:border-zinc-700 transition-all disabled:opacity-50 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{ct.name}</p>
                <p className="text-xs text-zinc-500">{ct.description}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-yellow-400">{formatCoins(ct.cost)}</span>
                  <span className="text-xs text-green-400">+{ct.impact} impact</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Campaign History</h2>
      <div className="space-y-2">
        {campaigns.map(c => (
          <div key={c.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white capitalize">{c.type?.replace("_", " ")}</p>
              <p className="text-xs text-zinc-500">{formatCoins(c.cost)} · +{c.impact} impact</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}