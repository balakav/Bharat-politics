
import React from "react";
import { Crown } from "lucide-react";

const PARTY_COLORS = {
  "DMK": "#D32F2F", "AIADMK": "#2E7D32", "BJP": "#FF6B00", "INC": "#00BCD4",
  "PMK": "#FFC107", "VCK": "#1565C0", "CPI(M)": "#B71C1C", "CPI": "#D32F2F",
  "MDMK": "#E91E63", "NTK": "#FF8F00", "AMMK": "#388E3C", "DMDK": "#455A64",
  "TMC": "#00897B", "KMDK": "#1B5E20", "MMK": "#1976D2", "AISMK": "#F57C00",
  "IND": "#666666",
};

function getPartyColor(mla) {
  return PARTY_COLORS[mla.party_short] || "#666666";
}

function Seat({ mla, isSpeaker, isMe }) {
  const color = getPartyColor(mla);
  return (
    <div className={`flex flex-col items-center ${isSpeaker ? "scale-125 mb-2" : ""}`}>
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 ${isMe ? "border-yellow-400 ring-2 ring-red-400/30" : "border-transparent"}`}
        style={{ backgroundColor: color }}
      >
        {mla.player_name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      {isSpeaker && <Crown className="w-3 h-3 text-yellow-400 -mt-1" />}
      <p className="text-[8px] text-zinc-400 mt-0.5 text-center truncate w-full max-w-[60px]">{mla.player_name?.split(" ")[0]}</p>
      <p className="text-[7px] text-zinc-600 text-center truncate w-full max-w-[60px]">{mla.constituency}</p>
      {isMe && <span className="text-[7px] text-yellow-400 font-bold">YOU</span>}
    </div>
  );
}

export default function SeatingGrid({ mlas, speaker, currentPlayerId }) {
  if (!mlas || mlas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">No MLAs found. Complete a Vidhan Sabha election first.</p>
      </div>
    );
  }

  const speakerMla = mlas.find(m => m.id === speaker?.id) || mlas[0];
  const regularMlas = mlas.filter(m => m.id !== speakerMla.id);

  return (
    <div className="flex flex-col items-center">
      {/* Speaker seat at top center */}
      <div className="mb-4 flex flex-col items-center">
        <div className="text-[10px] text-yellow-400 font-semibold uppercase mb-1">Speaker</div>
        <Seat mla={speakerMla} isSpeaker={true} isMe={speakerMla.player_id === currentPlayerId} />
      </div>

      {/* Divider line representing the floor */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-4" />

      {/* Regular MLA seats in grid */}
      <div className="grid grid-cols-4 gap-2 w-full">
        {regularMlas.map(mla => (
          <Seat key={mla.id} mla={mla} isMe={mla.player_id === currentPlayerId} />
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 mt-4">{mlas.length} MLAs seated</p>
    </div>
  );
}