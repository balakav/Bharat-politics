import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { formatCoins, generatePlayerId } from "@/lib/gameData";
import { SALARY_CONFIG, formatCountdown } from "@/lib/electionSchedule";
import { getGameConfig, gameDayNumber } from "@/lib/gameTime";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import {
  Landmark, Coins, Wallet, Clock, Vote, CalendarDays, CheckSquare, Users,
  AlertTriangle, Bell, Landmark as LandmarkIcon
} from "lucide-react";
import NotificationBell from "@/components/game/NotificationBell";
import RoleBadge from "@/components/game/RoleBadge";
import GameClock from "@/components/game/GameClock";
import QuickActionSections from "@/components/game/QuickActionSections";

function getGreeting() {
  return "Welcome";
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

export default function Home() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [news, setNews] = useState([]);
  const [canCollectSalary, setCanCollectSalary] = useState(false);
  const [salaryCooldown, setSalaryCooldown] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [partyInfo, setPartyInfo] = useState(null);
  const [partyMembers, setPartyMembers] = useState(0);
  const [partyPopularity, setPartyPopularity] = useState(50);
  const [salaryError, setSalaryError] = useState("");
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  const [gameDay, setGameDay] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [overview, setOverview] = useState({ events: 0, tasks: 0, meetings: 0, alerts: 0 });

  useEffect(() => { loadData(); }, []);
  useAutoRefresh(loadData, 60000);

  useEffect(() => {
    if (!profile) return;
    const checkCooldown = () => {
      const lastCollected = profile.last_salary_collected ? new Date(profile.last_salary_collected) : null;
      if (!lastCollected) { setCanCollectSalary(true); setSalaryCooldown(0); return; }
      const elapsed = Date.now() - lastCollected.getTime();
      const cooldownMs = SALARY_CONFIG.cooldownMinutes * 60 * 1000;
      if (elapsed >= cooldownMs) { setCanCollectSalary(true); setSalaryCooldown(0); }
      else { setCanCollectSalary(false); setSalaryCooldown(cooldownMs - elapsed); }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [profile]);

  async function loadData() {
    try {
      const me = await base44.auth.me();
      setIsAdmin(me.role === "admin");
      const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
      if (profiles.length > 0) setProfile(profiles[0]);
      else setShowSetup(true);

      const [newsItems, config, elections] = await Promise.all([
        base44.entities.NewsItem.list('-created_date', 5),
        getGameConfig(),
        base44.entities.Election.list('-created_date', 100),
      ]);
      setNews(newsItems);
      setGameDay(gameDayNumber(Date.now(), config));
      setOverview(o => ({
        ...o,
        events: elections.filter(e => !e.results_declared).length,
        meetings: elections.filter(e => e.status === "voting").length,
      }));

      if (profiles.length > 0) {
        const p = profiles[0];
        const [tasks, invs] = await Promise.all([
          base44.entities.Task.filter({ player_id: p.player_id, status: "pending" }),
          base44.entities.Investigation.filter({ target_player_id: p.player_id }),
        ]);
        setOverview(o => ({
          ...o,
          tasks: tasks.length,
          alerts: invs.filter(i => ["open", "under_investigation"].includes(i.status)).length,
        }));
        if (p.party_id) {
          const party = await base44.entities.PoliticalParty.get(p.party_id);
          setPartyInfo(party);
          const [members, pop] = await Promise.all([
            base44.entities.PartyMember.filter({ party_id: party.id }),
            base44.entities.PopularityScore.filter({ scope: "party", target_id: party.id }),
          ]);
          setPartyMembers(members.length);
          if (pop.length > 0) setPartyPopularity(pop[0].score || 50);
          if (party.president_id === p.player_id) {
            const pending = await base44.entities.Candidature.filter({ party_id: party.id, ticket_status: "pending" });
            setPendingTicketCount(pending.length);
          } else setPendingTicketCount(0);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function collectSalary() {
    if (!canCollectSalary || !profile || collecting) return;
    setSalaryError("");
    const salary = SALARY_CONFIG.baseSalary * (profile.salary_multiplier || 1);
    if (partyInfo && partyInfo.president_id !== profile.player_id) {
      if ((partyInfo.party_fund || 0) < salary) {
        setSalaryError("Party fund insufficient. Contact your party president.");
        return;
      }
      setCollecting(true);
      await base44.entities.PoliticalParty.update(partyInfo.id, { party_fund: (partyInfo.party_fund || 0) - salary });
      setPartyInfo(prev => ({ ...prev, party_fund: (prev.party_fund || 0) - salary }));
    } else {
      setCollecting(true);
    }
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: (profile.e_coins || 0) + salary,
      net_worth: (profile.net_worth || 0) + salary,
      last_salary_collected: new Date().toISOString(),
    });
    setProfile(prev => ({
      ...prev,
      e_coins: (prev.e_coins || 0) + salary,
      net_worth: (prev.net_worth || 0) + salary,
      last_salary_collected: new Date().toISOString(),
    }));
    setCollecting(false);
  }

  async function createProfile() {
    if (!username.trim()) return;
    const newProfile = await base44.entities.PlayerProfile.create({
      username: username.trim(),
      bio: bio.trim(),
      player_id: generatePlayerId(),
      e_coins: 1000000000,
      reputation: 50,
      properties_owned: 1,
      vehicles_owned: 1,
      net_worth: 1000000000,
      salary_multiplier: 1,
    });
    setProfile(newProfile);
    setShowSetup(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
              <Landmark className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Bharat Union</h1>
            <p className="text-zinc-500">MMO Political Simulation</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-4">Create Your Political Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your political name"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Your political vision..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 resize-none" rows={3} />
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-orange-500/20">
                <h3 className="text-amber-400 font-semibold text-sm mb-2">🎁 Welcome Rewards</h3>
                <div className="space-y-1 text-sm text-zinc-300">
                  <p>• ₹100 Crore E-Coins</p>
                  <p>• Starter Residence</p>
                  <p>• Starter Vehicle</p>
                </div>
              </div>
              <button onClick={createProfile} disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-orange-500/20">
                Enter Bharat Politics
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const salaryAmount = SALARY_CONFIG.baseSalary * (profile?.salary_multiplier || 1);
  const rep = profile?.reputation || 0;

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {/* Header: avatar, greeting, position badge, game day */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt={profile.username} className="w-11 h-11 rounded-full border-2 border-yellow-500/50 object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 flex items-center justify-center text-white font-bold text-lg">
              {(profile?.username || "P")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <h1 className="text-base font-bold text-white truncate min-w-0">{getGreeting()}, {profile?.username}</h1>
              {profile?.position_held && profile.position_held !== "None" && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 uppercase border border-yellow-500/30 flex-shrink-0">
                  {profile.position_held}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 truncate">ID: {profile?.player_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-[9px] text-zinc-500 uppercase">Day</p>
            <p className="text-sm font-bold text-yellow-400">{gameDay}</p>
          </div>
          <NotificationBell overview={overview} news={news} pendingTickets={pendingTicketCount} partyId={profile?.party_id} />
        </div>
      </div>

      {/* Treasury + Salary cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Coins className="w-4 h-4 text-yellow-400" />
            <p className="text-[10px] text-zinc-500 uppercase">Treasury</p>
          </div>
          <p className="text-xl font-bold text-white truncate">{formatCoins(profile?.e_coins || 0)}</p>
          <p className="text-[10px] text-zinc-600">E-Coins balance</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] text-zinc-500 uppercase">Political Salary</p>
          </div>
          <p className="text-xl font-bold text-white truncate">{formatCoins(salaryAmount)}</p>
          <button onClick={collectSalary} disabled={!canCollectSalary || collecting}
            className="mt-2 w-full bg-gradient-to-r from-orange-500 to-amber-400 text-white py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50">
            {canCollectSalary ? (collecting ? "..." : "Collect") : (<><Clock className="w-3 h-3" /> {formatCountdown(salaryCooldown)}</>)}
          </button>
        </div>
      </div>
      {salaryError && <p className="text-xs text-red-400 mb-3">{salaryError}</p>}
      {partyInfo && partyInfo.president_id !== profile?.player_id && (
        <p className="text-[10px] text-yellow-400/70 mb-3">Party Fund: {formatCoins(partyInfo.party_fund || 0)}</p>
      )}

      {/* President notification */}
      {pendingTicketCount > 0 && profile?.party_id && (
        <Link to={`/parties/${profile.party_id}`}
          className="block bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 mb-4 hover:bg-orange-500/15 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center"><Bell className="w-5 h-5 text-amber-400" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-400">{pendingTicketCount} Pending Ticket Request{pendingTicketCount > 1 ? "s" : ""}</p>
              <p className="text-xs text-zinc-400">Tap to review and approve candidates</p>
            </div>
          </div>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-zinc-900 rounded-2xl p-3.5 border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Net Worth</p>
          <p className="text-lg font-bold text-white truncate">{formatCoins(profile?.net_worth || 0)}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-3.5 border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Reputation</p>
          <div className="flex items-end gap-1.5">
            <p className="text-lg font-bold text-white">{rep}</p>
            <span className="text-[10px] text-zinc-600 mb-1">/100</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" style={{ width: `${rep}%` }} />
          </div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-3.5 border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Elections Won</p>
          <p className="text-lg font-bold text-amber-400">{profile?.elections_won || 0}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-3.5 border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Current Position</p>
          <p className="text-sm font-bold text-white truncate">{profile?.position_held || "None"}</p>
        </div>
      </div>

      {/* Role + game day strip */}
      <div className="flex items-center gap-2 mb-2.5">
        <RoleBadge />
        <GameClock />
      </div>

      {/* Today's overview */}
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Today's Overview</h2>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { icon: LandmarkIcon, label: "Events", value: overview.events, color: "#fb923c" },
          { icon: CheckSquare, label: "Tasks", value: overview.tasks, color: "#f59e0b" },
          { icon: Users, label: "Meetings", value: overview.meetings, color: "#fbbf24" },
          { icon: AlertTriangle, label: "Alerts", value: overview.alerts, color: "#fb7185" },
        ].map(o => {
          const Icon = o.icon;
          return (
            <div key={o.label} className="bg-zinc-900 rounded-xl p-2.5 border border-zinc-800 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: o.color }} />
              <p className="text-base font-bold text-white">{o.value}</p>
              <p className="text-[9px] text-zinc-500 uppercase">{o.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions in 4 sections */}
      <QuickActionSections isAdmin={isAdmin} />

      {/* Breaking news */}
      {news.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Breaking News</h2>
            <Link to="/news" className="text-xs text-yellow-400">See all</Link>
          </div>
          <div className="space-y-2">
            {news.map(item => (
              <div key={item.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-start gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-400/20 flex items-center justify-center flex-shrink-0">
                    <Vote className="w-5 h-5 text-yellow-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold uppercase">{item.category || "News"}</span>
                    <span className="text-[10px] text-zinc-600">{timeAgo(item.created_date)}</span>
                  </div>
                  <p className="text-sm text-white font-medium leading-snug line-clamp-2">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Party card */}
      {partyInfo && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Your Party</p>
          <p className="text-lg font-bold text-white">{partyInfo.name}</p>
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-white">{partyMembers}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Members</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-yellow-400">{formatCoins(partyInfo.party_fund || 0)}</p>
              <p className="text-[9px] text-zinc-500 uppercase">Fund</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-amber-400">{partyPopularity}%</p>
              <p className="text-[9px] text-zinc-500 uppercase">Popularity</p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 uppercase mb-1">Party Popularity</p>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" style={{ width: `${partyPopularity}%` }} />
          </div>
          <Link to={`/parties/${partyInfo.id}`} className="block text-center text-[11px] text-yellow-400 mt-3">Open party page →</Link>
        </div>
      )}

      {/* Calendar hint */}
      <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-yellow-400" />
        <p className="text-[11px] text-zinc-400">Game Day {gameDay} — salaries refresh every {SALARY_CONFIG.cooldownMinutes} min.</p>
      </div>
    </div>
  );
}