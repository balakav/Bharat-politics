import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { DEVELOPMENT_TYPES, VIDHAN_SABHA_CONSTITUENCIES, formatCoins } from "@/lib/gameData";
import { ArrowLeft, Route, GraduationCap, Heart, TreePine, Droplets, Trophy, Fish, HandHeart, CheckCircle, TrendingUp, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const iconMap = { Route, GraduationCap, Heart, TreePine, Droplets, Trophy, Fish, HandHeart };

export default function Development() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(null);
  const [constituency, setConstituency] = useState("");
  const [devTracker, setDevTracker] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await bharat01.auth.me();
    const [profiles, projs] = await Promise.all([
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.DevelopmentProject.list('-created_date', 20),
    ]);
    if (profiles.length > 0) setProfile(profiles[0]);
    setProjects(projs);
    if (profiles.length > 0) {
      const myProjects = projs.filter(p => p.player_id === profiles[0].player_id);
      const byConsti = {};
      for (const p of myProjects) {
        const key = p.constituency || 'Unknown';
        if (!byConsti[key]) byConsti[key] = { score: 0, count: 0 };
        byConsti[key].score += (p.impact || 0);
        byConsti[key].count += 1;
      }
      const trackerData = Object.entries(byConsti).map(([consti, data]) => ({
        constituency: consti,
        score: data.score,
        count: data.count,
        boost: Math.min((data.score / 100) * 50, 50),
      })).sort((a, b) => b.score - a.score);
      setDevTracker(trackerData);
    }
    setLoading(false);
  }

  async function buildProject(devType) {
    if (!profile || profile.e_coins < devType.cost) return;
    setBuilding(devType.type);
    await bharat01.entities.DevelopmentProject.create({
      player_id: profile.player_id,
      player_name: profile.username,
      type: devType.type,
      name: devType.name + " at " + (constituency || "Chennai"),
      location: constituency || "Chennai",
      constituency: constituency || "Chennai",
      cost: devType.cost,
      impact: devType.impact,
      status: "completed",
    });
    await bharat01.entities.PlayerProfile.update(profile.id, {
      e_coins: profile.e_coins - devType.cost,
      reputation: Math.min(100, (profile.reputation || 50) + devType.impact),
    });
    setProfile(prev => ({
      ...prev,
      e_coins: prev.e_coins - devType.cost,
      reputation: Math.min(100, (prev.reputation || 50) + devType.impact),
    }));
    setBuilding(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">

      <h1 className="text-2xl font-bold text-white mb-2">Development Projects</h1>
      <p className="text-sm text-zinc-400 mb-4">Build infrastructure to boost your election chances in that constituency</p>

      <div className="mb-4">
        <label className="text-sm text-zinc-400 block mb-1">Location</label>
        <select value={constituency} onChange={e => setConstituency(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500">
          <option value="">Select constituency</option>
          {VIDHAN_SABHA_CONSTITUENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {DEVELOPMENT_TYPES.map(dt => {
          const Icon = iconMap[dt.icon] || Route;
          return (
            <button
              key={dt.type}
              onClick={() => buildProject(dt)}
              disabled={building === dt.type || (profile?.e_coins || 0) < dt.cost}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-left hover:border-zinc-700 transition-all disabled:opacity-50"
            >
              <Icon className="w-6 h-6 text-yellow-400 mb-2" />
              <p className="text-sm font-semibold text-white">{dt.name}</p>
              <p className="text-xs text-yellow-400 mt-1">{formatCoins(dt.cost)}</p>
              <p className="text-xs text-green-400">+{dt.impact}% election boost</p>
            </button>
          );
        })}
      </div>

      {devTracker.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Win Probability Tracker
          </h2>
          <div className="space-y-2">
            {devTracker.map(t => (
              <div key={t.constituency} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{t.constituency}</span>
                  </div>
                  <span className="text-xs text-yellow-400 font-bold flex-shrink-0 ml-2">+{t.boost.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-zinc-500">Score: {t.score}</span>
                  <span className="text-xs text-zinc-500">{t.count} projects</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full"
                    style={{ width: `${t.boost * 2}%` }} />
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">Vote boost in next election for this constituency</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent Projects</h2>
      <div className="space-y-2">
        {projects.map(p => (
          <div key={p.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">{p.name}</p>
              <p className="text-xs text-zinc-500">by {p.player_name} · {formatCoins(p.cost)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}