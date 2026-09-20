
import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { NATION, getStateById } from "@/lib/bharatStates";
import { Send, Crown, Ban, CheckCircle } from "lucide-react";

// Admin-driven government formation:
// After results are declared, NO government forms automatically. The admin
// sends a Formation Request to the winning (or single largest) party. Its
// president must then prove majority — alone or via an alliance — before the
// Government record is created (FormationRequests inbox page). If the party is
// AI-only (no registered player party), the admin can form it directly.
// Fallback: President's Rule (state elections).

function tallySeats(winners) {
  const counts = {};
  for (const w of winners) {
    const key = w.party_name || "Independent";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([name, seats]) => ({ name, seats })).sort((a, b) => b.seats - a.seats);
}

export default function FormationAdmin({ actor }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);

  async function loadData() {
    const [done, govs, parties, reqs] = await Promise.all([
      bharat01.entities.Election.filter({ results_declared: true }, "-created_date", 20),
      bharat01.entities.Government.list("-created_date", 200),
      bharat01.entities.PoliticalParty.list(),
      bharat01.entities.FormationRequest.list("-created_date", 200),
    ]);
    const rows = [];
    for (const el of done) {
      const winners = await bharat01.entities.Candidature.filter({ election_id: el.id, result: "won" }, undefined, 1000);
      const gov = govs.find(g => g.election_id === el.id && g.is_active !== false);
      rows.push({
        el,
        partySeats: tallySeats(winners),
        hasGov: !!gov,
        gov,
        requests: reqs.filter(r => r.election_id === el.id),
        parties,
      });
    }
    setElections(rows);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function sendRequest(row, party) {
    setBusy(row.el.id + party.name);
    setMsg("");
    try {
      const rec = row.parties.find(p => p.name === party.name || p.short_name === (party.name || "").split(" ")[0]);
      const hours = parseInt(deadlineHours, 10) || 24;
      await bharat01.entities.FormationRequest.create({
        election_id: row.el.id,
        election_title: row.el.title,
        scope: row.el.election_type === "national" ? "national" : "state",
        state_id: row.el.state_id || "",
        state_name: row.el.state_name || NATION.name,
        party_id: rec?.id || party.name,
        party_name: party.name,
        party_short: rec?.short_name || "",
        president_id: rec?.president_id || "",
        president_name: rec?.president_name || "",
        seats: party.seats,
        majority_mark: row.el.majority_mark || 0,
        deadline_game_time: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
        status: "sent",
        note: "Governor invites the party to prove majority (own or alliance).",
      });
      // Post the invitation in the Public Chat (floor test notice).
      await bharat01.entities.ChatMessage.create({
        channel: "global",
        sender_id: "governor",
        sender_name: "Governor",
        sender_photo: "",
        message: `🏛️ Governor invites ${party.name} (${party.seats} seats) to form the government in ${row.el.state_name || NATION.name}. Prove majority within ${hours} hours (floor test).`,
        message_type: "system",
      });
      setMsg(`Formation request sent to ${party.name} (deadline: ${hours}h).`);
      await loadData();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy("");
  }

  async function formDirect(row, party) {
    // AI party (no player president): admin forms the government directly.
    if (party.seats < (row.el.majority_mark || 0)) { setMsg("No majority — send a request so the party can build an alliance instead."); return; }
    setBusy(row.el.id + party.name);
    setMsg("");
    try {
      const isNational = row.el.election_type === "national";
      const headTitle = isNational ? "Prime Minister" : "Chief Minister";
      await bharat01.entities.Government.create({
        type: isNational ? "national" : "state",
        election_id: row.el.id,
        state_id: isNational ? "" : (row.el.state_id || ""),
        state_name: isNational ? NATION.name : (row.el.state_name || ""),
        head_player_id: "",
        head_player_name: "AI Government",
        head_title: headTitle,
        party_id: "",
        party_name: party.name,
        coalition_parties: [],
        cabinet: JSON.stringify({ status: "majority", total_seats: party.seats, majority_mark: row.el.majority_mark }),
        is_active: true,
      });
      await bharat01.entities.NewsItem.create({
        title: `🏛️ ${party.name} forms government in ${row.el.state_name || NATION.name}`,
        content: `${party.name} proved majority with ${party.seats} seats (majority mark ${row.el.majority_mark}). ${headTitle} sworn in.`,
        category: "politics", source: "TV99 Bharat", related_type: "government_formation", related_id: row.el.id,
      });
      setMsg(`${party.name} government formed.`);
      await loadData();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy("");
  }

  async function imposePresidentRule(row) {
    setBusy(row.el.id + "pr");
    setMsg("");
    try {
      await bharat01.entities.PresidentRule.create({
        state_id: row.el.state_id || "",
        state_name: row.el.state_name || "",
        started_game_time: new Date().toISOString(),
        duration_days: 3,
        status: "active",
        reason: `No government formed after ${row.el.title}.`,
      });
      await bharat01.entities.NewsItem.create({
        title: `⚖️ President's Rule imposed in ${row.el.state_name}`,
        content: `No party proved majority after the ${row.el.title}. President's Rule is in effect for 3 game days.`,
        category: "politics", source: "TV99 Bharat", related_type: "president_rule", related_id: row.el.id,
      });
      setMsg("President's Rule imposed.");
      await loadData();
    } catch (e) { setMsg("Error: " + (e.message || "failed")); }
    setBusy("");
  }

  if (loading) return <div className="flex justify-center py-6"><div className="w-7 h-7 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">Governor (admin): after results, send a formation request to the winning / single largest party. Their president proves majority (own or alliance) at <span className="text-yellow-400">/formation-requests</span>. AI parties without a president can be formed directly.</p>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-zinc-400">Floor test deadline:</p>
        <input type="number" min="1" value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)}
          className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white" />
        <p className="text-xs text-zinc-500">hours</p>
      </div>
      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}

      {elections.length === 0 && <p className="text-xs text-zinc-500 text-center py-6">No declared elections yet.</p>}
      <div className="space-y-3">
        {elections.map(row => {
          const majority = row.el.majority_mark || 0;
          const largest = row.partySeats[0];
          return (
            <div key={row.el.id} className="bg-zinc-800/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{row.el.title}</p>
                  <p className="text-[10px] text-zinc-500">Majority mark: {majority} · {row.el.election_type}</p>
                </div>
                {row.hasGov
                  ? <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold uppercase flex-shrink-0">Govt Formed</span>
                  : <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold uppercase flex-shrink-0">Awaiting</span>}
              </div>

              <div className="space-y-1 mb-2">
                {row.partySeats.slice(0, 6).map((p, i) => {
                  const hasPresident = row.parties.some(pp => pp.name === p.name || pp.president_id);
                  const req = row.requests.find(r => r.party_name === p.name && r.status === "sent");
                  return (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 w-4">{i + 1}</span>
                      <span className="text-xs text-white flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-bold text-yellow-400 w-8 text-right">{p.seats}</span>
                      {!row.hasGov && !req && (
                        <button onClick={() => sendRequest(row, p)} disabled={!!busy}
                          className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
                          <Send className="w-3 h-3" /> Request
                        </button>
                      )}
                      {req && <span className="text-[9px] text-blue-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sent</span>}
                      {!row.hasGov && !hasPresident && p.seats >= majority && (
                        <button onClick={() => formDirect(row, p)} disabled={!!busy}
                          className="text-[10px] bg-gradient-to-r from-red-500 to-yellow-500 text-white px-2 py-1 rounded-lg font-semibold disabled:opacity-50">
                          Form AI Govt
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {!row.hasGov && row.el.state_id && (
                <button onClick={() => imposePresidentRule(row)} disabled={!!busy}
                  className="w-full text-[10px] bg-zinc-700 text-red-400 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
                  <Ban className="w-3 h-3" /> Impose President's Rule
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}