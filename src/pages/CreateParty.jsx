import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function CreateParty() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [ideology, setIdeology] = useState("");
  const [color, setColor] = useState("#FF6B00");
  const [symbol, setSymbol] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    bharat01.auth.me().then(async me => {
      const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
      if (profiles.length > 0) setProfile(profiles[0]);
    });
  }, []);

  async function handleCreate() {
    if (!name.trim() || !shortName.trim() || !profile) return;
    // One party per player — leave the current party before creating a new one.
    const existing = await bharat01.entities.PartyMember.filter({ player_id: profile.player_id }).catch(() => []);
    if (existing.length > 0) {
      setErr(`You are already a member of ${existing[0].party_name} — leave that party before creating a new one.`);
      return;
    }
    setErr("");
    setCreating(true);
    const party = await bharat01.entities.PoliticalParty.create({
      name: name.trim(),
      short_name: shortName.trim().toUpperCase(),
      description,
      ideology,
      color,
      symbol,
      president_id: profile.player_id,
      president_name: profile.username,
      member_count: 1,
      party_fund: 0,
    });
    await bharat01.entities.PartyMember.create({
      player_id: profile.player_id,
      player_name: profile.username,
      party_id: party.id,
      party_name: party.name,
      designation: "President",
    });
    await bharat01.entities.PlayerProfile.update(profile.id, {
      party_id: party.id,
      party_name: party.name,
    });
    navigate(`/parties/${party.id}`);
  }

  const colors = ["#D32F2F", "#FFC107", "#FF6B00", "#00BCD4", "#E91E63", "#2196F3", "#4CAF50", "#9C27B0", "#607D8B"];

  return (
    <div className="p-4 max-w-lg mx-auto">

      <h1 className="text-2xl font-bold text-white mb-6">Create Political Party</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Party Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. People's Democratic Front"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Short Name</label>
          <input type="text" value={shortName} onChange={e => setShortName(e.target.value)}
            placeholder="e.g. PDF" maxLength={6}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Ideology</label>
          <input type="text" value={ideology} onChange={e => setIdeology(e.target.value)}
            placeholder="e.g. Centre-left, Progressive"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What does your party stand for?"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none"
            rows={3} />
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Party Color</label>
          <div className="flex gap-2 flex-wrap">
            {colors.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-xl border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1">Party Symbol</label>
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)}
            placeholder="e.g. Lotus, Hand, Clock..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
        </div>
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{err}</p>}
        <button onClick={handleCreate} disabled={!name.trim() || !shortName.trim() || creating}
          className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
          {creating ? "Creating..." : "Create Party"}
        </button>
      </div>
    </div>
  );
}