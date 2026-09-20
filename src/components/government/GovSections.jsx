
import React from "react";
import { Link } from "react-router-dom";
import { formatCoins } from "@/lib/gameData";
import { Wallet, TrendingUp, FileBarChart, MessageCircle, FileText } from "lucide-react";

// Shared government sections — common for central and state:
// treasury/popularity stats + Economy · Budget · Ministers · Cabinet cards.

export function GovStatsGrid({ treasury, popularity }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
        <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-4 h-4 text-amber-400" /><p className="text-[10px] text-zinc-500 uppercase">Treasury</p></div>
        <p className="text-base font-bold text-amber-400">{formatCoins(treasury?.balance || 0)}</p>
        <p className="text-[10px] text-zinc-600">Rev {formatCoins(treasury?.total_revenue || 0)} · Spend {formatCoins(treasury?.total_expenditure || 0)}</p>
      </div>
      <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
        <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="w-4 h-4 text-amber-400" /><p className="text-[10px] text-zinc-500 uppercase">Popularity</p></div>
        <p className="text-base font-bold text-white">{popularity?.score ?? "—"}{popularity?.trend === "up" ? " ↑" : popularity?.trend === "down" ? " ↓" : ""}</p>
        <p className="text-[10px] text-zinc-600 truncate">{popularity?.factors || "Not computed yet"}</p>
      </div>
    </div>
  );
}

export function GovSectionLinks({ title }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">{title}</h2>
      <div className="grid grid-cols-4 gap-2">
        <Link to="/economy" className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <Wallet className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">Economy</span>
        </Link>
        <Link to="/budget" className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <FileBarChart className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">Budget</span>
        </Link>
        <Link to="/ministers" className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <MessageCircle className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">Ministers</span>
        </Link>
        <Link to="/bills" className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex flex-col items-center gap-1">
          <FileText className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] text-zinc-300 font-medium">Bills</span>
        </Link>
      </div>
    </div>
  );
}