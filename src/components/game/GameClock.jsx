
import React, { useState, useEffect, useRef } from "react";
import { getGameConfig, toGameTime, formatGameTime, gameDayNumber } from "@/lib/gameTime";
import { Clock } from "lucide-react";

// Centralized in-game clock badge (Day + time), visible app-wide via GameLayout.
// Fetches the game config ONCE, then ticks locally — no repeated API calls, so
// the Day counter is always visible even during rate limits.
export default function GameClock() {
  const [time, setTime] = useState(null);
  const [config, setConfig] = useState(null);
  const cfgRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const cfg = await getGameConfig();
      if (!active) return;
      cfgRef.current = cfg;
      setConfig(cfg);
      setTime(toGameTime(Date.now(), cfg));
    })();
    const t = setInterval(() => {
      if (cfgRef.current) setTime(toGameTime(Date.now(), cfgRef.current));
    }, 1000);
    return () => { active = false; clearInterval(t); };
  }, []);

  if (!time || !config) {
    return (
      <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
        <Clock className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[11px] text-zinc-600">—</span>
      </div>
    );
  }

  const day = gameDayNumber(time, config);
  return (
    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
      <Clock className="w-3.5 h-3.5 text-yellow-400" />
      <span className="text-[11px] text-zinc-200 font-semibold">Day {day}</span>
      <span className="text-[10px] text-zinc-500 hidden sm:inline">{formatGameTime(time)}</span>
    </div>
  );
}