import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useParams } from "react-router-dom";
import { formatCoins } from "@/lib/gameData";
import StatCard from "@/components/game/StatCard";
import {
  User, LogOut, Coins, Shield, Vote, Building2, Car, TrendingUp,
  Calendar, Edit, Save, X, MapPin
} from "lucide-react";

export default function Profile() {
  const { playerId } = useParams();
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [myMembership, setMyMembership] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [wins, setWins] = useState([]);
  const [showAllSeats, setShowAllSeats] = useState(false);

  const isOwnProfile = !playerId;

  useEffect(() => { loadData(); }, [playerId]);

  async function loadData() {
    const me = await bharat01.auth.me();
    setUser(me);
    let profileData;
    if (playerId) {
      const profiles = await bharat01.entities.PlayerProfile.filter({ player_id: playerId });
      if (profiles.length > 0) profileData = profiles[0];
    } else {
      const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
      if (profiles.length > 0) profileData = profiles[0];
    }
    if (profileData) {
      setProfile(profileData);
      setBio(profileData.bio || "");
      if (profileData.party_id) {
        const members = await bharat01.entities.PartyMember.filter({ player_id: profileData.player_id, party_id: profileData.party_id });
        if (members.length > 0) setMyMembership(members[0]);
      }
      const winRecords = await bharat01.entities.ElectionRecord.filter({ winner_player_id: profileData.player_id });
      const dedupedWins = {};
      for (const w of winRecords) {
        const key = `${w.election_date}_${w.constituency}_${w.position_title}`;
        if (!dedupedWins[key]) dedupedWins[key] = w;
      }
      setWins(Object.values(dedupedWins));
    }
    setLoading(false);
  }

  async function saveBio() {
    await bharat01.entities.PlayerProfile.update(profile.id, { bio });
    setProfile(prev => ({ ...prev, bio }));
    setEditing(false);
  }

  async function logout() {
    await bharat01.auth.logout("/login");
  }

  async function leaveParty() {
    if (!profile || !myMembership) return;
    setLeaving(true);
    const partyId = profile.party_id;
    await bharat01.entities.PartyMember.delete(myMembership.id);
    const party = await bharat01.entities.PoliticalParty.get(partyId);
    const updates = { member_count: Math.max(0, (party.member_count || 0) - 1) };
    if (myMembership.designation === "President") {
      const allMembers = await bharat01.entities.PartyMember.filter({ party_id: partyId });
      const remaining = allMembers.filter(m => m.player_id !== profile.player_id);
      if (remaining.length > 0) {
        await bharat01.entities.PartyMember.update(remaining[0].id, { designation: "President" });
        updates.president_id = remaining[0].player_id;
        updates.president_name = remaining[0].player_name;
      } else {
        updates.president_id = "";
        updates.president_name = "";
      }
    }
    if (myMembership.designation === "Vice President") { updates.vice_president_id = ""; updates.vice_president_name = ""; }
    if (myMembership.designation === "General Secretary") { updates.general_secretary_id = ""; updates.general_secretary_name = ""; }
    if (myMembership.designation === "Treasurer") { updates.treasurer_id = ""; updates.treasurer_name = ""; }
    await bharat01.entities.PoliticalParty.update(partyId, updates);
    await bharat01.entities.PlayerProfile.update(profile.id, { party_id: "", party_name: "" });
    setLeaving(false);
    setShowLeaveConfirm(false);
    setMyMembership(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Group wins by position — collapsed to the first 8 until expanded
  const displayWins = showAllSeats ? wins : wins.slice(0, 8);
  const winsByPosition = {};
  for (const w of displayWins) {
    const pos = w.position_title || "Unknown";
    if (!winsByPosition[pos]) winsByPosition[pos] = [];
    winsByPosition[pos].push(w);
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-2xl flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile?.username}</h1>
            <p className="text-xs text-zinc-500">ID: {profile?.player_id}</p>
            <p className="text-sm text-yellow-400 mt-1">{profile?.party_name || "Independent"}</p>
          </div>
        </div>

        {isOwnProfile && (
          editing ? (
            <div className="mt-4">
              <textarea value={bio} onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none resize-none"
                rows={2} placeholder="Write your bio..." />
              <button onClick={saveBio}
                className="mt-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1">
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2">
              <p className="text-sm text-zinc-400 flex-1">{profile?.bio || "No bio yet"}</p>
              <button onClick={() => setEditing(true)} className="text-zinc-500 hover:text-zinc-300">
                <Edit className="w-4 h-4" />
              </button>
            </div>
          )
        )}
        {!isOwnProfile && profile?.bio && (
          <p className="text-sm text-zinc-400 mt-3">{profile.bio}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon={Coins} label="E-Coins" value={formatCoins(profile?.e_coins || 0)} color="amber" />
        <StatCard icon={TrendingUp} label="Net Worth" value={formatCoins(profile?.net_worth || 0)} color="green" />
        <StatCard icon={Shield} label="Reputation" value={`${profile?.reputation || 0}/100`} color="blue" />
        <StatCard icon={Vote} label="Elections Won" value={`${profile?.elections_won || 0}/${profile?.elections_contested || 0}`} color="purple" />
        <StatCard icon={Building2} label="Properties" value={profile?.properties_owned || 0} color="green" />
        <StatCard icon={Car} label="Vehicles" value={profile?.vehicles_owned || 0} color="red" />
      </div>

      {/* Position — only shown when the player actually holds one */}
      {profile?.position_held && profile.position_held !== "None" && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm text-zinc-400 mb-1">Current Position</h3>
          <p className="text-lg font-bold text-white">{profile.position_held}</p>
        </div>
      )}

      {/* Won Constituencies */}
      {wins.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-zinc-400">Elected Seats</h3>
            <span className="text-xs bg-red-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold">{wins.length} seats</span>
          </div>
          <div className="space-y-3">
            {Object.entries(winsByPosition).map(([position, positionWins]) => (
              <div key={position}>
                <p className="text-xs text-yellow-400 font-semibold uppercase mb-1">{position} ({positionWins.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {positionWins.map((w, i) => (
                    <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      {w.constituency}{w.seat_type && w.seat_type !== "general" ? ` (${w.seat_type})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {wins.length > 8 && (
            <button onClick={() => setShowAllSeats(v => !v)}
              className="w-full mt-3 text-xs text-yellow-400 bg-zinc-800 border border-zinc-700 rounded-lg py-2 hover:bg-zinc-700 transition-all">
              {showAllSeats ? "Show less" : `Show all ${wins.length} seats`}
            </button>
          )}
        </div>
      )}

      {/* Party Membership / Leave Party */}
      {isOwnProfile && profile?.party_id && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm text-zinc-400 mb-1">Your Party</h3>
          <p className="text-lg font-bold text-white">{profile?.party_name}</p>
          <p className="text-sm text-yellow-400">{myMembership?.designation || "Member"}</p>
          {!showLeaveConfirm ? (
            <button onClick={() => setShowLeaveConfirm(true)}
              className="w-full mt-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Leave Party
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-red-400 text-center">Are you sure? You'll lose your position in the party.</p>
              <div className="flex gap-2">
                <button onClick={leaveParty} disabled={leaving}
                  className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-50">
                  {leaving ? "Leaving..." : "Confirm"}
                </button>
                <button onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 bg-zinc-800 text-zinc-300 rounded-xl py-2 text-sm font-bold border border-zinc-700 flex items-center justify-center gap-1">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Join Date */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 mb-4 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-zinc-500" />
        <div>
          <p className="text-sm text-zinc-400">Joined</p>
          <p className="text-sm text-white">{profile?.created_date ? new Date(profile.created_date).toLocaleDateString() : "N/A"}</p>
        </div>
      </div>

      {/* Logout */}
      {isOwnProfile && (
        <button onClick={logout}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      )}
    </div>
  );
}