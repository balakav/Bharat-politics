
import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { KeyRound, Trash2, ShieldCheck } from "lucide-react";

// Admin → Access. Grant and revoke special access for any player — the admin
// picks the player, picks the special access type, and the grant is listed
// here until revoked.

const ACCESS_TYPES = [
  { value: "election_control", label: "Election Control — run elections anywhere" },
  { value: "treasury", label: "Treasury Access — manage national/state funds" },
  { value: "speaker_powers", label: "Speaker Powers — admit & certify bills in any house" },
  { value: "bill_approval", label: "Bill Approval — President/Governor decisions" },
  { value: "cabinet_approval", label: "Cabinet Approval — approve any cabinet" },
  { value: "protest_approval", label: "Protest Approval — Home Minister decisions" },
  { value: "news_broadcast", label: "News Broadcast — publish official announcements" },
  { value: "parliament_setup", label: "Parliament Setup — create chambers" },
  { value: "ministry_override", label: "Ministry Override — manage any ministry office" },
];

export default function AccessManager() {
  const [profiles, setProfiles] = useState([]);
  const [grants, setGrants] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [accessType, setAccessType] = useState(ACCESS_TYPES[0].value);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [ps, gs] = await Promise.all([
      bharat01.entities.PlayerProfile.list("-created_date", 300).catch(() => []),
      bharat01.entities.SpecialAccess.list("-created_date", 300).catch(() => []),
    ]);
    setProfiles(ps);
    setGrants(gs);
    setLoading(false);
  }

  async function grant() {
    if (!playerId || busy) return;
    setBusy(true); setMsg("");
    try {
      const p = profiles.find(x => x.player_id === playerId);
      if (grants.some(g => g.player_id === playerId && g.access_type === accessType)) {
        setMsg("This player already holds that access.");
      } else {
        await bharat01.entities.SpecialAccess.create({
          player_id: playerId,
          player_name: p?.username || playerId,
          access_type: accessType,
          granted_by_name: "Admin",
          note: note.trim(),
        });
        setNote("");
        setMsg(`${p?.username || playerId} was granted ${labelOf(accessType)}.`);
        await load();
      }
    } catch (e) {
      setMsg("Error: " + (e.message || "could not grant access"));
    }
    setBusy(false);
  }

  async function revoke(g) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      await bharat01.entities.SpecialAccess.delete(g.id);
      setMsg(`Access revoked for ${g.player_name}.`);
      await load();
    } catch (e) {
      setMsg("Error: " + (e.message || "could not revoke"));
    }
    setBusy(false);
  }

  function labelOf(value) {
    return (ACCESS_TYPES.find(t => t.value === value)?.label || value).split(" — ")[0];
  }

  if (loading) {
    return <p className="text-[11px] text-zinc-500">Loading players…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Grant special access to any player — they keep it until you revoke it here.
      </p>

      <div className="space-y-2">
        <select value={playerId} onChange={e => setPlayerId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
          <option value="">Select a player…</option>
          {profiles.map(p => (
            <option key={p.id} value={p.player_id}>{p.username || p.player_id} {p.player_id ? `(${p.player_id})` : ""}</option>
          ))}
        </select>
        <select value={accessType} onChange={e => setAccessType(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white">
          {ACCESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-orange-500" />
        <button onClick={grant} disabled={busy || !playerId}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> {busy ? "Granting…" : "Grant Access"}
        </button>
        {msg && <p className="text-[10px] text-green-400">{msg}</p>}
      </div>

      <div>
        <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2">Current Special Access ({grants.length})</p>
        {grants.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No special access granted yet.</p>
        ) : (
          <div className="space-y-1.5">
            {grants.map(g => (
              <div key={g.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-2.5 py-1.5 border border-zinc-700/50">
                <div className="min-w-0">
                  <p className="text-[11px] text-white font-medium truncate">{g.player_name || g.player_id}</p>
                  <p className="text-[10px] text-amber-400 truncate">{labelOf(g.access_type)}</p>
                  {g.note && <p className="text-[9px] text-zinc-500 truncate">Note: {g.note}</p>}
                </div>
                <button onClick={() => revoke(g)} disabled={busy} className="text-zinc-600 hover:text-red-400 flex-shrink-0 ml-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}