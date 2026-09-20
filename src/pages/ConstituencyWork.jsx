import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Hammer, Vote } from "lucide-react";
import ConstituencyWorkCard from "@/components/constituency/ConstituencyWorkCard";

// Constituency Work dashboard (Govt & Core): elected MLAs/MPs deliver works
// in the constituencies they actually WON — unlike the Development screen,
// no free choice of constituency. Works pay from the member's own e-coins
// and build their reputation, exactly like the Development engine.
export default function ConstituencyWork() {
  const [profile, setProfile] = useState(null);
  const [seats, setSeats] = useState([]);
  const [worksByC, setWorksByC] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const me = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
    if (!profiles[0]) { setLoading(false); return; }
    const p = profiles[0];
    const [won, works] = await Promise.all([
      base44.entities.Candidature.filter({ player_id: p.player_id, result: "won" }).catch(() => []),
      base44.entities.DevelopmentProject.filter({ player_id: p.player_id }, "-created_date", 200).catch(() => []),
    ]);
    // Group won seats by constituency (a constituency can be held as both MLA and MP).
    const byC = {};
    for (const c of won) {
      const key = c.constituency || "—";
      if (!byC[key]) byC[key] = { constituency: key, positions: [], party_name: c.party_name };
      const isMP = c.election_type === "lok_sabha" || c.election_type === "national";
      if (!byC[key].positions.includes(isMP ? "MP" : "MLA")) byC[key].positions.push(isMP ? "MP" : "MLA");
    }
    setProfile(p);
    setSeats(Object.values(byC));
    const grouped = {};
    for (const w of works) {
      const k = w.constituency || "—";
      (grouped[k] = grouped[k] || []).push(w);
    }
    setWorksByC(grouped);
    setLoading(false);
  }

  async function startWork(dt, seat) {
    if (!profile || busy || (profile.e_coins || 0) < dt.cost) return;
    setBusy(true); setMsg("");
    try {
      await base44.entities.DevelopmentProject.create({
        player_id: profile.player_id,
        player_name: profile.username,
        type: dt.type,
        name: `${dt.name} at ${seat.constituency}`,
        location: seat.constituency,
        constituency: seat.constituency,
        cost: dt.cost,
        impact: dt.impact,
        status: "completed",
      });
      const newCoins = (profile.e_coins || 0) - dt.cost;
      const newRep = Math.min(100, (profile.reputation || 50) + dt.impact);
      await base44.entities.PlayerProfile.update(profile.id, { e_coins: newCoins, reputation: newRep });
      setProfile(prev => ({ ...prev, e_coins: newCoins, reputation: newRep }));
      setMsg(`${dt.name} delivered in ${seat.constituency} — +${dt.impact}% reputation.`);
      document.activeElement?.blur?.();
      await load();
    } catch (e) {
      setMsg("Error: " + (e.message || "work failed"));
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const totalWorks = Object.values(worksByC).reduce((a, l) => a + l.length, 0);

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Hammer className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Constituency Work</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Deliver development works in the constituencies you won as an elected member.</p>

      {seats.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Vote className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No constituency yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-3">Win an election to unlock constituency work in your seat.</p>
          <Link to="/elections" className="inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-lg">
            Go to Elections
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-4 flex items-center justify-between">
            <p className="text-xs text-zinc-400">Your balance</p>
            <p className="text-sm font-bold text-yellow-400">₹{((profile?.e_coins || 0) / 10000000).toFixed(0)}Cr</p>
          </div>
          {msg && <p className="text-[11px] text-green-400 mb-3">{msg}</p>}
          <div className="space-y-3">
            {seats.map(seat => (
              <ConstituencyWorkCard key={seat.constituency} seat={seat}
                works={worksByC[seat.constituency] || []}
                eCoins={profile?.e_coins} busy={busy}
                onStartWork={(dt) => startWork(dt, seat)} />
            ))}
          </div>
          {totalWorks === 0 && (
            <p className="text-[11px] text-zinc-600 text-center mt-3">No works delivered yet — start your first project above.</p>
          )}
        </>
      )}
    </div>
  );
}