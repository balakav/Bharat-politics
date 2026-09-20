
import React from "react";
import { formatCoins } from "@/lib/gameData";
import { Coins } from "lucide-react";

export default function CoinBadge({ amount }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500/20 to-yellow-500/20 border border-red-500/30 rounded-full px-3 py-1">
      <Coins className="w-4 h-4 text-yellow-400" />
      <span className="text-sm font-bold text-yellow-300">{formatCoins(amount)}</span>
    </div>
  );
}