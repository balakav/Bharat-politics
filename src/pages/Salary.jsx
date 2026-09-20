import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { getSalaryForPosition, getSalaryConfigMap } from "@/lib/salary";
import { treasuryDebit } from "@/lib/treasury";
import { getCurrentGameTime, getGameConfig } from "@/lib/gameTime";
import { usePlayerRole } from "@/hooks/usePlayerRole";
import { formatCoins } from "@/lib/gameData";
import { ArrowLeft, Wallet, Crown, Clock, Coins } from "lucide-react";

export default function Salary() {
  const navigate = useNavigate();
  const role = usePlayerRole();
  const [profile, setProfile] = useState(null);
  const [amount, setAmount] = useState(0);
  const [salaryMap, setSalaryMap] = useState({});
  const [collecting, setCollecting] = useState(false);
  const [lastCollected, setLastCollected] = useState(null);
  const [canCollect, setCanCollect] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await bharat01.auth.me();
        const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
        const p = profiles[0];
        setProfile(p);
        setLastCollected(p?.last_salary_collected ? new Date(p.last_salary_collected) : null);
        const map = await getSalaryConfigMap();
        setSalaryMap(map);
        const pos = role.primary?.role;
        const amt = await getSalaryForPosition(pos, p?.salary_multiplier || 1);
        setAmount(amt);
      } catch (e) {}
    })();
  }, [role]);

  // Cooldown check against the game clock (cycle_hours from config).
  useEffect(() => {
    let t;
    async function check() {
      if (!lastCollected) { setCanCollect(amount > 0); setCooldownLeft(""); return; }
      const cfg = await getGameConfig();
      const now = await getCurrentGameTime();
      const cycleMs = (cfg.salary_cycle_hours || 24) * 3600 * 1000;
      const elapsed = now.getTime() - lastCollected.getTime();
      const ready = elapsed >= cycleMs;
      setCanCollect(ready && amount > 0);
      if (!ready) {
        const left = cycleMs - elapsed;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        setCooldownLeft(`${h}h ${m}m left`);
      } else setCooldownLeft("");
    }
    check();
    t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [lastCollected, amount]);

  async function handleCollect() {
    if (!profile || !canCollect) return;
    setCollecting(true); setMsg("");
    try {
      const pos = role.primary?.role;
      const isNat = pos === "pm" || pos === "mp" || pos === "union_minister";
      const scope = isNat ? "national" : "state";
      const stateId = isNat ? "" : (role.primary?.state_id || "");
      // Debit the relevant treasury, credit the player.
      await treasuryDebit(scope, stateId, amount, `Salary: ${pos}`, { id: profile.player_id, name: profile.username, role: pos });
      const newBalance = (profile.e_coins || 0) + amount;
      const gameNow = (await getCurrentGameTime()).toISOString();
      await bharat01.entities.PlayerProfile.update(profile.id, { e_coins: newBalance, last_salary_collected: gameNow });
      await bharat01.entities.Transaction.create({
        sender_id: `treasury_${scope}`, sender_name: `${scope} Treasury`,
        receiver_id: profile.player_id, receiver_name: profile.username,
        amount, note: `Salary for ${pos}`, transaction_type: "salary",
      });
      setProfile({ ...profile, e_coins: newBalance });
      setLastCollected(new Date(gameNow));
      setCanCollect(false);
      setMsg(`Collected ${formatCoins(amount)} as ${pos} salary.`);
    } catch (e) {
      setMsg("Failed to collect salary: " + (e.message || "error"));
    } finally { setCollecting(false); }
  }

  const pos = role.primary?.role;
  const cfg = salaryMap[pos];

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Salary</h1>
      </div>

      <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">{role.primary?.label || "Citizen"}</h2>
        </div>
        <p className="text-3xl font-bold text-yellow-400">{formatCoins(amount)}</p>
        <p className="text-xs text-zinc-400 mt-1">Salary for position: {pos}</p>
        {cfg && <p className="text-[10px] text-zinc-600 mt-1">Base {formatCoins(cfg.base_salary)} · Cap {formatCoins(cfg.max_salary)} · Cycle {cfg.cycle_hours}h</p>}
      </div>

      <button onClick={handleCollect} disabled={!canCollect || collecting || amount === 0}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 mb-3">
        <Coins className="w-4 h-4" /> {collecting ? "Collecting…" : canCollect ? "Collect Salary" : "On Cooldown"}
      </button>

      {!canCollect && cooldownLeft && (
        <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> {cooldownLeft}</p>
      )}
      {msg && <p className="text-xs text-green-400 text-center mt-2">{msg}</p>}
      {amount === 0 && <p className="text-xs text-zinc-500 text-center mt-2">No salary for your current role. Win an election or get appointed to earn a government salary.</p>}

      {/* Salary table */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mt-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Salary Structure</h3>
        <div className="space-y-1.5">
          {Object.values(salaryMap).map(s => (
            <div key={s.position} className="flex items-center justify-between text-xs">
              <span className="text-white uppercase">{s.position}</span>
              <span className="text-zinc-400">{formatCoins(s.base_salary)} <span className="text-zinc-600">→ {formatCoins(s.max_salary)}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}