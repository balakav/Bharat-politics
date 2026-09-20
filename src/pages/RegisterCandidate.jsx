import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useParams, useNavigate } from "react-router-dom";
import { getStateById } from "@/lib/bharatStates";
import { getConstituenciesForElection } from "@/lib/bharatElectionService";
import BulkCandidateUpload from "@/components/election/BulkCandidateUpload";
import { FileText, MapPin, UserPlus, Upload } from "lucide-react";

// Candidate application with two inner screens:
//   Normal Apply — one candidate picks a party, constituency and manifesto.
//   Bulk Apply   — a party president uploads the party's full candidate list.

export default function RegisterCandidate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState("normal"); // "normal" | "bulk"
  const [election, setElection] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [parties, setParties] = useState([]);
  const [constituency, setConstituency] = useState("");
  const [partyId, setPartyId] = useState("");
  const [manifesto, setManifesto] = useState("");
  const [budget, setBudget] = useState(10000000);
  const [registering, setRegistering] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [bulkPartyId, setBulkPartyId] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [el, me] = await Promise.all([
      bharat01.entities.Election.get(id),
      bharat01.auth.me(),
    ]);
    setElection(el);
    const [profiles, pts] = await Promise.all([
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.PoliticalParty.list(),
    ]);
    if (profiles.length > 0) setProfile(profiles[0]);
    setIsAdmin(me?.role === "admin");
    setParties(pts);
  }

  const state = election?.state_id ? getStateById(election.state_id) : null;
  const constituencies = election ? getConstituenciesForElection(election).map(c => ({ value: c, label: c })) : [];
  const filteredConstituencies = search
    ? constituencies.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : constituencies;

  // Home-state gate (normal apply only)
  const isHomeState = !state || (profile?.home_state_id === election?.state_id);

  // Parties this user leads — eligible for bulk apply.
  const myParties = parties.filter(p => p?.president_id && p.president_id === profile?.player_id);
  const bulkParty = myParties.find(p => p.id === bulkPartyId) || myParties[0] || null;

  async function handleRegister() {
    if (!constituency || !profile) return;
    setRegistering(true);
    const party = parties.find(p => p.id === partyId);
    const isIndependent = !partyId;
    const isPartyPresident = party?.president_id === profile.player_id;
    const ticketStatus = (isIndependent || isPartyPresident) ? "approved" : "pending";
    const ticketNumber = (isIndependent || isPartyPresident) ? "TICKET-" + Date.now().toString(36).toUpperCase() : "";
    await bharat01.entities.Candidature.create({
      election_id: id,
      election_type: election.election_type,
      player_id: profile.player_id,
      player_name: profile.username,
      player_photo: profile.photo_url || "",
      party_id: partyId || "",
      party_name: party?.name || "Independent",
      party_short: party?.short_name || "IND",
      constituency,
      seat_type: "general",
      manifesto,
      campaign_budget: budget,
      registration_number: "BR-" + Date.now().toString(36).toUpperCase(),
      ticket_status: ticketStatus,
      ticket_number: ticketNumber,
    });
    await bharat01.entities.PlayerProfile.update(profile.id, {
      elections_contested: (profile.elections_contested || 0) + 1,
    });
    if (!isIndependent && !isPartyPresident) {
      await bharat01.entities.NewsItem.create({
        title: `🎫 New Ticket Request from ${profile.username}`,
        content: `${profile.username} has requested a ${party.name} ticket for ${constituency} in ${election.title}. The party president needs to review and approve this request.`,
        category: "politics",
        source: "TV99 Bharat",
        related_type: "ticket_request",
        related_id: partyId,
      });
    }
    navigate(`/elections/${id}`);
  }

  if (!isHomeState && !isAdmin && mode === "normal") {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <MapPin className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-white font-medium">Not your home state</p>
          <p className="text-xs text-zinc-500 mt-1">You can only register as a candidate in your chosen home state ({state?.name || "Bharat"}).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">

      <h1 className="text-2xl font-bold text-white mb-1">Register as Candidate</h1>
      <p className="text-zinc-400 text-sm mb-1">{election?.title}</p>
      <p className="text-xs text-zinc-600 mb-4">
        {mode === "normal"
          ? `Showing ${Math.min(filteredConstituencies.length, visibleCount)} of ${constituencies.length} constituencies`
          : "Upload your party's full candidate list in one file"}
      </p>

      {/* Inner screens: Normal Apply / Bulk Apply */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setMode("normal")}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
            ${mode === "normal" ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <UserPlus className="w-4 h-4" /> Normal Apply
        </button>
        <button onClick={() => setMode("bulk")}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
            ${mode === "bulk" ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <Upload className="w-4 h-4" /> Bulk Apply
        </button>
      </div>

      {mode === "normal" ? (
        <div className="space-y-4">
          {/* Party Selection */}
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Party (with Election Symbol)</label>
            <div className="max-h-60 overflow-y-auto space-y-1 bg-zinc-800 rounded-xl p-2">
              <button onClick={() => setPartyId("")}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between
                  ${partyId === "" ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "text-zinc-300 hover:bg-zinc-700 border border-transparent"}`}>
                <span>Independent (IND)</span>
                <span className="text-[10px] text-zinc-500">Independent</span>
              </button>
              {parties.map(p => (
                <button key={p.id} onClick={() => setPartyId(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between
                    ${partyId === p.id ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "text-zinc-300 hover:bg-zinc-700 border border-transparent"}`}>
                  <span className="truncate">{p.name} ({p.short_name})</span>
                  {p.symbol && <span className="text-[10px] text-yellow-400/70 whitespace-nowrap ml-2">{p.symbol}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Constituency Selection */}
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Constituency</label>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(50); }} placeholder="Search constituencies..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 mb-2" />
            <div className="max-h-56 overflow-y-auto space-y-1 bg-zinc-800 rounded-xl p-2">
              {filteredConstituencies.slice(0, visibleCount).map(c => (
                <button key={c.value} onClick={() => { setConstituency(c.value); setSearch(c.label); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                    ${constituency === c.value ? "bg-red-500/20 text-yellow-400" : "text-zinc-300 hover:bg-zinc-700"}`}>
                  {c.label}
                </button>
              ))}
              {filteredConstituencies.length === 0 && <p className="text-[10px] text-zinc-600 text-center py-2">No constituencies match your search</p>}
            </div>
            {filteredConstituencies.length > visibleCount && (
              <button onClick={() => setVisibleCount(v => v + 50)} className="w-full mt-2 text-xs text-yellow-400 bg-zinc-800 border border-zinc-700 rounded-lg py-2 hover:bg-zinc-700 transition-all">Show more ({filteredConstituencies.length - visibleCount} remaining)</button>
            )}
          </div>

          {/* Manifesto */}
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Manifesto</label>
            <textarea value={manifesto} onChange={e => setManifesto(e.target.value)} placeholder="Your election promises..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none" rows={3} />
          </div>

          <button onClick={handleRegister} disabled={!constituency || registering}
            className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            <FileText className="w-5 h-5" />
            {registering ? "Registering..." : "Register Candidature"}
          </button>
        </div>
      ) : !election ? (
        <div className="text-center py-8"><p className="text-zinc-500 text-sm">Loading election…</p></div>
      ) : myParties.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-white font-medium">Party presidents only</p>
          <p className="text-xs text-zinc-500 mt-1">Bulk Apply lets a party president register the party's entire candidate list from one file. You are not the president of any party.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myParties.length > 1 && (
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Select your party</label>
              <div className="space-y-1 bg-zinc-800 rounded-xl p-2">
                {myParties.map(p => (
                  <button key={p.id} onClick={() => setBulkPartyId(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all
                      ${bulkParty?.id === p.id ? "bg-red-500/20 text-yellow-400" : "text-zinc-300 hover:bg-zinc-700"}`}>
                    {p.name} ({p.short_name})
                  </button>
                ))}
              </div>
            </div>
          )}
          {bulkParty && (
            <BulkCandidateUpload election={election} party={bulkParty} onDone={() => navigate(`/elections/${id}`)} />
          )}
        </div>
      )}
    </div>
  );
}