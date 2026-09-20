
import React from "react";
import { usePlayerRole } from "@/hooks/usePlayerRole";
import { Shield } from "lucide-react";

// Shows the player's current primary political role. Visible app-wide via GameLayout.
export default function RoleBadge() {
  const role = usePlayerRole();
  if (role.loading) {
    return (
      <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
        <Shield className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[11px] text-zinc-600">…</span>
      </div>
    );
  }
  const isCitizen = role.primary?.role === "citizen";
  const color = isCitizen ? "text-zinc-400" : "text-yellow-400";
  return (
    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 max-w-[60vw]">
      <Shield className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
      <span className={`text-[11px] font-medium truncate ${color}`}>{role.primary?.label || "Citizen"}</span>
    </div>
  );
}