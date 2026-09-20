import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Plus, Handshake, Trash2, X, Check, ChevronRight, Megaphone, Tv, FileText, Users } from "lucide-react";
import { ALLIANCE_CAMPAIGN_TYPES, formatCoins } from "@/lib/gameData";

const ALLIANCE_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#84CC16"];

export default function Alliances() {
  const [alliances, setAlliances] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [selectedAlliance, setSelectedAlliance] = useState(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(ALLIANCE_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [selectedParties, setSelectedParties] = useState([]);
  const [isPresident, setIsPresident] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userParty, setUserParty] = useState(null);
  const [allianceCamps, setAllianceCamps] = useState([]);
  const [runningCamp, setRunningCamp] = useState(null);

  const allianceIconMap = { Megaphone, Tv, FileText, Users };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [als, pts] = await Promise.all([
      base44.entities.Alliance.list("-created_date"),
      base44.entities.PoliticalParty.list(),
    ]);
    setAlliances(als);
    setParties(pts);
    try {
      const me = await base44.auth.me();
      const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
      if (profiles.length > 0) {
        const p = profiles[0];
        setUserProfile(p);
        if (p.party_id) {
          const party = pts.find(pt => pt.id === p.party_id);
          setIsPresident(party?.president_id === p.player_id);
          setUserParty(party);
        }
      }
    } catch (e) {}
    setLoading(false);
  }

  async function loadAllianceCampaigns(allianceId) {
    try {
      const camps = await base44.entities.Campaign.filter({ alliance_id: allianceId });
      setAllianceCamps(camps);
    } catch (e) {
      setAllianceCamps([]);
    }
  }

  async function runAllianceCampaign(act) {
    if (!userProfile || !isPresident || !userParty) return;
    if ((userParty.party_fund || 0) < act.cost) return;
    setRunningCamp(act.type);
    try {
      await base44.entities.Campaign.create({
        player_id: userProfile.player_id,
        election_id: "",
        candidature_id: "",
        alliance_id: selectedAlliance.id,
        type: act.type,
        cost: act.cost,
        impact: act.impact,
        description: act.description,
      });
      const updated = await base44.entities.PoliticalParty.update(userParty.id, {
        party_fund: (userParty.party_fund || 0) - act.cost,
      });
      setUserParty(updated);
    } catch (e) {}
    setRunningCamp(null);
    loadAllianceCampaigns(selectedAlliance.id);
  }

  async function createAlliance() {
    if (!name.trim()) return;
    setCreating(true);
    const selectedPartyObjs = parties.filter(p => selectedParties.includes(p.id));
    await base44.entities.Alliance.create({
      name: name.trim(),
      short_name: shortName.trim() || name.trim().substring(0, 3).toUpperCase(),
      description: description.trim(),
      color,
      member_party_ids: selectedParties,
      member_party_names: selectedPartyObjs.map(p => p.name),
      chairman_party_id: selectedPartyObjs[0]?.id || "",
      chairman_party_name: selectedPartyObjs[0]?.name || "",
    });
    setName(""); setShortName(""); setDescription(""); setSelectedParties([]); setColor(ALLIANCE_COLORS[0]);
    setCreating(false);
    setView("list");
    loadData();
  }

  async function addParty(alliance, party) {
    const ids = [...new Set([...(alliance.member_party_ids || []), party.id])];
    const names = [...new Set([...(alliance.member_party_names || []), party.name])];
    await base44.entities.Alliance.update(alliance.id, {
      member_party_ids: ids, member_party_names: names,
      chairman_party_id: ids[0] || "", chairman_party_name: names[0] || "",
    });
    const updated = await base44.entities.Alliance.get(alliance.id);
    setSelectedAlliance(updated);
    loadData();
  }

  async function removeParty(alliance, partyId) {
    const party = parties.find(p => p.id === partyId);
    const ids = (alliance.member_party_ids || []).filter(id => id !== partyId);
    const names = (alliance.member_party_names || []).filter(n => n !== party?.name);
    await base44.entities.Alliance.update(alliance.id, {
      member_party_ids: ids, member_party_names: names,
      chairman_party_id: ids[0] || "", chairman_party_name: names[0] || "",
    });
    const updated = await base44.entities.Alliance.get(alliance.id);
    setSelectedAlliance(updated);
    loadData();
  }

  async function deleteAlliance(alliance) {
    await base44.entities.Alliance.delete(alliance.id);
    setView("list"); setSelectedAlliance(null); loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <button onClick={() => setView("list")} className="flex items-center gap-2 text-zinc-400 mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-6">Create Alliance</h1>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Alliance Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Secular Progressive Alliance"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Short Name</label>
            <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="e.g. SPA"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Alliance ideology and goals..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none" rows={3} />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ALLIANCE_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Member Parties ({selectedParties.length})</label>
            <div className="max-h-60 overflow-y-auto space-y-1 bg-zinc-800 rounded-xl p-2">
              {parties.map(p => {
                const selected = selectedParties.includes(p.id);
                return (
                  <button key={p.id} onClick={() => {
                    setSelectedParties(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                  }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between
                    ${selected ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "text-zinc-300 hover:bg-zinc-700 border border-transparent"}`}>
                    <span>{p.name} ({p.short_name})</span>
                    {selected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={createAlliance} disabled={!name.trim() || creating}
            className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
            {creating ? "Creating..." : "Create Alliance"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedAlliance) {
    const memberParties = parties.filter(p => (selectedAlliance.member_party_ids || []).includes(p.id));
    const nonMemberParties = parties.filter(p => !(selectedAlliance.member_party_ids || []).includes(p.id));
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <button onClick={() => { setView("list"); setSelectedAlliance(null); }} className="flex items-center gap-2 text-zinc-400 mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: selectedAlliance.color || "#8B5CF6" }}>
              {selectedAlliance.short_name?.substring(0, 2) || "AL"}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedAlliance.name}</h1>
              <p className="text-xs text-zinc-500">{selectedAlliance.short_name}</p>
            </div>
          </div>
          {selectedAlliance.description && <p className="text-sm text-zinc-400 mb-3">{selectedAlliance.description}</p>}
          {selectedAlliance.chairman_party_name && (
            <div className="bg-zinc-800 rounded-xl p-2 text-sm">
              <span className="text-zinc-500">Chairman: </span>
              <span className="text-yellow-400 font-medium">{selectedAlliance.chairman_party_name}</span>
            </div>
          )}
          {isPresident && (
            <button onClick={() => deleteAlliance(selectedAlliance)}
              className="w-full mt-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Alliance
            </button>
          )}
          {!isPresident && (
            <p className="text-xs text-zinc-500 mt-3 text-center">Only party presidents can modify alliances.</p>
          )}
        </div>

        {/* Alliance Campaigns */}
        {isPresident && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Alliance Campaigns</h2>
            <p className="text-xs text-zinc-500 mb-2">Party Fund: {formatCoins(userParty?.party_fund || 0)}</p>
            <div className="space-y-2 mb-2">
              {ALLIANCE_CAMPAIGN_TYPES.map(act => {
                const Icon = allianceIconMap[act.icon] || Megaphone;
                const canAfford = (userParty?.party_fund || 0) >= act.cost;
                return (
                  <button key={act.type} onClick={() => runAllianceCampaign(act)}
                    disabled={runningCamp === act.type || !canAfford}
                    className="w-full bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all disabled:opacity-50 flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{act.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{act.description}</p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-yellow-400">{formatCoins(act.cost)}</span>
                        <span className="text-xs text-green-400">+{act.impact} impact</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {allianceCamps.length > 0 && (
              <p className="text-xs text-zinc-600">{allianceCamps.length} campaigns run for this alliance</p>
            )}
          </div>
        )}

        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Member Parties ({memberParties.length})</h2>
        <div className="space-y-2 mb-4">
          {memberParties.map(p => (
            <div key={p.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: p.color || "#FF6B00" }}>
                  {p.short_name?.substring(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.member_count || 0} members</p>
                </div>
              </div>
              {isPresident && (
                <button onClick={() => removeParty(selectedAlliance, p.id)}
                  className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {memberParties.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No parties in this alliance yet</p>}
        </div>

        {isPresident && nonMemberParties.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Add Parties</h2>
            <div className="space-y-2">
              {nonMemberParties.map(p => (
                <button key={p.id} onClick={() => addParty(selectedAlliance, p)}
                  className="w-full bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: p.color || "#FF6B00" }}>
                      {p.short_name?.substring(0, 2)}
                    </div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                  </div>
                  <Plus className="w-4 h-4 text-yellow-400" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Handshake className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Alliances</h1>
        </div>
        {isPresident ? (
          <button onClick={() => setView("create")}
            className="bg-gradient-to-r from-red-500 to-yellow-500 text-white rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Create
          </button>
        ) : (
          <span className="text-xs text-zinc-600 max-w-[140px] text-right">Only party presidents can manage</span>
        )}
      </div>
      {alliances.length === 0 ? (
        <div className="text-center py-8">
          <Handshake className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-1">No alliances yet</p>
          <p className="text-xs text-zinc-600">Create an alliance to unite parties</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alliances.map(a => (
            <button key={a.id} onClick={() => { setSelectedAlliance(a); setView("detail"); loadAllianceCampaigns(a.id); }}
              className="w-full bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all text-left">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: a.color || "#8B5CF6" }}>
                    {a.short_name?.substring(0, 2) || "AL"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{a.name}</h3>
                    <p className="text-xs text-zinc-500">{a.member_party_names?.length || 0} parties</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </div>
              {a.member_party_names && a.member_party_names.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.member_party_names.slice(0, 5).map((n, i) => (
                    <span key={i} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{n}</span>
                  ))}
                  {a.member_party_names.length > 5 && <span className="text-[10px] text-zinc-500">+{a.member_party_names.length - 5} more</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}