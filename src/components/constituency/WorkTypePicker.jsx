
import React from "react";
import { Route, GraduationCap, Heart, TreePine, Droplets, Trophy, Fish, HandHeart } from "lucide-react";
import { DEVELOPMENT_TYPES, formatCoins } from "@/lib/gameData";

const iconMap = { Route, GraduationCap, Heart, TreePine, Droplets, Trophy, Fish, HandHeart };

// Grid of constituency work types, priced from the engine's DEVELOPMENT_TYPES.
// A work is instantly delivered (matches the Development screen) and pays
// from the member's own e-coins.
export default function WorkTypePicker({ eCoins, busy, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {DEVELOPMENT_TYPES.map(dt => {
        const Icon = iconMap[dt.icon] || Route;
        const tooPoor = (eCoins || 0) < dt.cost;
        return (
          <button key={dt.type} onClick={() => onSelect(dt)} disabled={busy || tooPoor}
            className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 text-left hover:border-zinc-700 transition-all disabled:opacity-50">
            <Icon className="w-5 h-5 text-yellow-400 mb-1.5" />
            <p className="text-xs font-semibold text-white">{dt.name}</p>
            <p className="text-[10px] text-yellow-400">{formatCoins(dt.cost)}</p>
            <p className="text-[10px] text-green-400">+{dt.impact}% boost</p>
          </button>
        );
      })}
    </div>
  );
}