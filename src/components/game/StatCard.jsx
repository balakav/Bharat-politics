
import React from "react";

export default function StatCard({ icon: Icon, label, value, color = "amber" }) {
  const colorMap = {
    amber: "from-red-500/20 to-yellow-500/10 border-red-500/20 text-yellow-400",
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400",
    red: "from-red-500/20 to-red-600/10 border-red-500/20 text-red-400",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400",
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}