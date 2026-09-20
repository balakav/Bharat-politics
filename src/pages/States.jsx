import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe2, ChevronRight, MapPin } from "lucide-react";
import { BHARAT_STATES, validateBharatConfig } from "@/lib/bharatStates";

export default function States() {
  const navigate = useNavigate();
  const validation = validateBharatConfig();

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Globe2 className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">States of Bharat</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-4">{validation.stateCount} states · {validation.assemblyTotal} assembly seats · {validation.lokSabhaTotal} Lok Sabha seats</p>

      <div className="grid grid-cols-1 gap-3">
        {BHARAT_STATES.map((s, i) => (
          <button key={s.id} onClick={() => navigate(`/states/${s.id}`)}
            className="w-full text-left bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-red-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {s.id}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{s.name}</h3>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {s.capital}
                    {s.isNationalCapital && <span className="text-yellow-400">· Capital</span>}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600 flex-shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-zinc-800/60 rounded-lg py-1.5 text-center">
                <p className="text-sm font-bold text-white">{s.assemblySeats}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Assembly</p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg py-1.5 text-center">
                <p className="text-sm font-bold text-yellow-400">{s.assemblyMajority}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Majority</p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg py-1.5 text-center">
                <p className="text-sm font-bold text-white">{s.lokSabhaSeats}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Lok Sabha</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}