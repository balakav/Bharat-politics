import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getStateById, BHARAT_STATES, NATION } from "@/lib/bharatStates";
import { Megaphone, MapPin, Globe2, CheckCircle, XCircle, Flame, Lock } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// Protest screen — the opposition's street power. A party that is NOT part of
// the government at a scope (nation or a state) can organise a protest there
// against the ruling party. Validated protests raise anti-incumbency against
// the ruling party: its popularity drops now, and its candidates' votes are
// penalised in the next election declared for that scope.

const STATUS_BADGE = {
  pending: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

export default function Protests() {
  const [profile, setProfile] = useState(null);
  const [party, setParty] = useState(null);
  const [governments, setGovernments] = useState([]);
  const [protests, setProtests] = useState([]);
  const [ministers, setMinisters] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scope, setScope] = useState("national");
  const [stateId, setStateId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await base44.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) {
        setProfile(ps[0]);
        if (ps[0].party_id) {
          setParty(await base44.entities.PoliticalParty.get(ps[0].party_id).catch(() => null));
        }
      }
    }
    const [govs, prots, mins] = await Promise.all([
      base44.entities.Government.list("-created_date", 300).catch(() => []),
      base44.entities.Protest.list("-created_date", 200).catch(() => []),
      base44.entities.Minister.filter({ is_active: true }).catch(() => []),
    ]);
    setGovernments(govs.filter(g => g.is_active !== false));
    setProtests(prots);
    setMinisters(mins);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 30000);

  // Every protest goes to the Home Minister of that scope (the Union Home
  // Minister nationally, the state's Home Minister for a state) — they approve
  // or reject it. No admin validation is needed.
  const homeMinisterFor = (p) => ministers.find(m =>
    m.scope === (p.scope === "national" ? "national" : "state") &&
    (p.scope === "national" || m.state_id === p.state_id) &&
    /home/i.test(m.portfolio || ""));
  const isHomeMinister = (p) => {
    const hm = homeMinisterFor(p);
    return !!hm && !!profile && hm.player_id === profile.player_id;
  };

  const govFor = (sc, sid) => sc === "national"
    ? governments.find(g => g.type === "national")
    : governments.find(g => g.type === "state" && g.state_id === sid);
  // Opposition = the party is NOT part of the government at this scope.
  const isOpposition = (g) => !!g && !!party &&
    !(g.party_id === party.id || (g.coalition_parties || []).includes(party.name));

  const activeGov = govFor(scope, stateId);
  const canOrganize = party && isOpposition(activeGov);

  async function organize() {
    if (!canOrganize || !title.trim() || busy) return;
    setBusy(true);
    try {
      const scopeName = scope === "national" ? NATION.name : (getStateById(stateId)?.name || "");
      await base44.entities.Protest.create({
        title: title.trim(),
        description: description.trim(),
        scope: scope === "national" ? "national" : "state",
        state_id: scope === "national" ? "" : stateId,
        state_name: scope === "national" ? NATION.name : scopeName,
        organizer_party_id: party.id,
        organizer_party_name: party.name,
        organizer_player_id: profile.player_id,
        organizer_player_name: profile.username,
        target_party_name: activeGov.party_name,
        impact: 8,
        status: "pending",
      });
      await base44.entities.NewsItem.create({
        title: `✊ ${party.name} organises a protest against ${activeGov.party_name}`,
        content: `${party.name} has taken to the streets in ${scopeName} against the ${activeGov.party_name} government — "${title.trim()}". The protest now goes to the ${scope === "national" ? "Union Home Minister" : `${scopeName} Home Minister`} for approval.`,
        category: "politics",
        source: "TV99 Bharat",
      }).catch(() => {});
      setTitle(""); setDescription(""); setMsg("");
      document.activeElement?.blur?.();
      await load();
    } finally { setBusy(false); }
  }

  // Home Minister review — an APPROVED protest raises anti-incumbency against
  // the ruling party (popularity drop now + vote penalty in the next election).
  async function validate(p, status) {
    setBusy(true);
    try {
      await base44.entities.Protest.update(p.id, { status, reviewed_by_name: profile?.username || "" });
      if (status === "approved") {
        const targets = await base44.entities.PoliticalParty.filter({ name: p.target_party_name }).catch(() => []);
        if (targets[0]) {
          const pops = await base44.entities.PopularityScore.filter({ scope: "party", target_id: targets[0].id }).catch(() => []);
          if (pops[0]) {
            await base44.entities.PopularityScore.update(pops[0].id, {
              score: Math.max(0, (pops[0].score || 50) - (p.impact || 5)),
            });
          }
        }
        await base44.entities.NewsItem.create({
          title: `🔥 Valid protest — anti-incumbency rises against ${p.target_party_name}`,
          content: `The protest "${p.title}" by ${p.organizer_party_name} in ${p.state_name || NATION.name} was approved by the Home Minister. Public anger against ${p.target_party_name} grows (+${p.impact || 5} anti-incumbency).`,
          category: "politics",
          source: "TV99 Bharat",
        }).catch(() => {});
      }
      await load();
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-6 h-6 text-red-400" />
        <h1 className="text-2xl font-bold text-white">Protest</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Opposition parties can organise protests against the ruling party — valid protests raise anti-incumbency.
      </p>

      {/* Scope */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setScope("national")}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5
            ${scope === "national" ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <Globe2 className="w-4 h-4" /> National
        </button>
        <button onClick={() => { setScope("state"); setStateId(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5
            ${scope === "state" ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <MapPin className="w-4 h-4" /> State
        </button>
      </div>

      {scope === "state" && !stateId && (
        <div className="space-y-1.5 mb-3">
          {BHARAT_STATES.map(s => {
            const g = govFor("state", s.id);
            const opp = party && isOpposition(g);
            return (
              <button key={s.id} onClick={() => setStateId(s.id)}
                className="w-full text-left bg-zinc-900 rounded-xl p-2.5 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0">{s.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{g ? `${g.party_name} in power${opp ? " · you can protest" : ""}` : "No government"}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {scope === "state" && stateId && (
        <button onClick={() => setStateId("")} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
          ← All States
        </button>
      )}

      {(scope === "national" || stateId) && (
        <>
          {/* Ruling party at this scope */}
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 mb-3">
            <p className="text-[10px] text-zinc-500 uppercase mb-0.5">Ruling party at this scope</p>
            <p className="text-sm font-bold text-white truncate">{activeGov?.party_name || "No government formed"}</p>
            {activeGov && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {party ? (canOrganize ? "Your party is in opposition here — you can organise a protest." : "Your party is in government here — only opposition parties can protest.") : "Join a party to organise protests."}
              </p>
            )}
          </div>

          {/* Organize form — opposition parties only */}
          {canOrganize ? (
            <div className="bg-zinc-900 rounded-2xl p-3 border border-red-500/20 mb-4 space-y-2">
              <p className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 text-red-400" /> Organise a Protest · {party.name}
              </p>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Protest title (e.g. Roll Back Fuel Tax)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Demands / description"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-white resize-none" />
              <button onClick={organize} disabled={busy || !title.trim()}
                className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Megaphone className="w-4 h-4" /> {busy ? "Organising…" : "Organise Protest"}
              </button>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-zinc-500" />
              <p className="text-[11px] text-zinc-500">Only opposition parties can organise protests at this scope.</p>
            </div>
          )}
        </>
      )}

      {/* All protests */}
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Protests ({protests.length})</h3>
      {protests.length === 0 ? (
        <p className="text-[11px] text-zinc-600">No protests yet.</p>
      ) : (
        <div className="space-y-2">
          {protests.map(p => (
            <div key={p.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5 min-w-0">
                  <Megaphone className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> {p.title}
                </p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase flex-shrink-0 ${STATUS_BADGE[p.status] || "bg-zinc-700 text-zinc-300"}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                {p.organizer_party_name} → against {p.target_party_name} · {p.state_name || NATION.name}
              </p>
              {p.description && <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{p.description}</p>}
              {p.status === "approved" && (
                <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Valid — anti-incumbency +{p.impact || 5} against {p.target_party_name}
                </p>
              )}
              {p.status === "pending" && (() => {
                const hm = homeMinisterFor(p);
                if (!isHomeMinister(p)) {
                  return (
                    <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Awaiting Home Minister review: {hm?.player_name || "not appointed yet"}
                    </p>
                  );
                }
                return (
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => validate(p, "approved")} disabled={busy}
                      className="flex-1 bg-green-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => validate(p, "rejected")} disabled={busy}
                      className="flex-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 border border-zinc-700 disabled:opacity-50">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                );
              })()}
              {p.status === "approved" && p.reviewed_by_name && (
                <p className="text-[10px] text-zinc-500 mt-1">Reviewed by Home Minister {p.reviewed_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}