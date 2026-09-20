import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, getStateById, NATION } from "@/lib/bharatStates";
import { getTreasury } from "@/lib/treasury";
import { GovStatsGrid, GovSectionLinks } from "@/components/government/GovSections";
import { getGameConfig } from "@/lib/gameTime";
import { Landmark, Globe2, Crown, ChevronRight, ShieldAlert, Clock } from "lucide-react";

// Government term: every government serves 125 game-hours from formation.
// When the term ends the government is dissolved automatically and the admin
// (Election Commission) is notified to announce the next election.
const GOV_TERM_HOURS = 125;

function termRemainingMs(g, cfg) {
  const speed = cfg?.time_speed_multiplier || 1;
  const elapsedGame = (Date.now() - new Date(g.created_date).getTime()) * speed;
  return GOV_TERM_HOURS * 3600 * 1000 - elapsedGame;
}

function formatTerm(ms) {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${m}m left`;
}

async function expireTerms(govs, cfg) {
  for (const g of govs) {
    if (g.is_active === false || termRemainingMs(g, cfg) > 0) continue;
    await bharat01.entities.Government.update(g.id, { is_active: false }).catch(() => {});
    g.is_active = false;
    // Notify the admin (Election Commission) to announce the next election.
    await bharat01.entities.AuditLog.create({
      actor_id: "system", actor_name: "System", actor_role: "system",
      action: "government_term_expired",
      scope: g.type, scope_id: g.state_id || "national",
      related_entity: "Government", related_id: g.id,
      details: `The ${g.type === "national" ? NATION.name : g.state_name} government (${g.party_name}) completed its ${GOV_TERM_HOURS}-hour term and stands dissolved. Announce the next election from the Election Commission.`,
    }).catch(() => {});
    await bharat01.entities.NewsItem.create({
      title: `⏳ Term over — ${g.party_name} government stands dissolved`,
      content: `The ${g.type === "national" ? NATION.name : g.state_name} government led by ${g.party_name} completed its ${GOV_TERM_HOURS}-hour term and has been dissolved. The Election Commission will announce the next election.`,
      category: "breaking", source: "TV99 Bharat",
    }).catch(() => {});
  }
}

// Government hub: Central shows the national government; State lists all 21
// states and tapping one opens that state's government dashboard inline —
// ruling party, treasury, popularity and the common sections (economy, budget,
// ministers, cabinet). Deep link: /government?state=XX opens a state directly.

export default function Government() {
  const navigate = useNavigate();
  const [scope, setScope] = useState(() => (new URLSearchParams(window.location.search).get("state") ? "state" : "central"));
  const [selectedState, setSelectedState] = useState(() => new URLSearchParams(window.location.search).get("state") || "");
  const [loading, setLoading] = useState(true);
  const [gov, setGov] = useState(null);
  const [governments, setGovernments] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [popularity, setPopularity] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [presidentRules, setPresidentRules] = useState([]);
  const [gameCfg, setGameCfg] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const govs = await bharat01.entities.Government.list("-created_date", 200);
    const cfg = await getGameConfig();
    setGameCfg(cfg);
    // Dissolve any government whose 125-hour term is over + notify the admin.
    await expireTerms(govs, cfg);
    setGovernments(govs);
    const prs = await bharat01.entities.PresidentRule.filter({ status: "active" }).catch(() => []);
    setPresidentRules(prs);
    setGov(() => govs.find(g => g.type === "national" && g.is_active !== false) || null);
    try { setTreasury(await getTreasury("national", "")); } catch (e) {}
    try {
      const pop = await bharat01.entities.PopularityScore.filter({ scope: "government" });
      setPopularity(pop.find(p => !p.state_id) || null);
    } catch (e) {}
    setLoading(false);
  }

  // Selected state's treasury + popularity
  useEffect(() => {
    if (!selectedState) { setStateData(null); return; }
    (async () => {
      try {
        const [t, pops] = await Promise.all([
          getTreasury("state", selectedState),
          bharat01.entities.PopularityScore.filter({ scope: "government" }),
        ]);
        setStateData({ treasury: t, popularity: pops.find(p => p.state_id === selectedState) || null });
      } catch (e) { setStateData(null); }
    })();
  }, [selectedState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  let govCab = null;
  try { govCab = gov?.cabinet ? JSON.parse(gov.cabinet) : null; } catch (e) {}

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Landmark className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Government</h1>
      </div>

      {/* Central / State toggle */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button onClick={() => { setScope("central"); setSelectedState(""); }}
          className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
            ${scope === "central" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <Globe2 className="w-4 h-4" /> Central
        </button>
        <button onClick={() => { setScope("state"); setSelectedState(""); }}
          className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
            ${scope === "state" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          <Landmark className="w-4 h-4" /> State
        </button>
      </div>

      {scope === "central" ? (
        <>
          {gov ? (
            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-400/10 border border-orange-500/30 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-400 font-semibold uppercase">Central Government</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{gov.party_name}</h2>
              <p className="text-sm text-zinc-400">{gov.head_title}: {gov.head_player_name}</p>
              {gameCfg && (
                <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Term: {formatTerm(termRemainingMs(gov, gameCfg))} · of {GOV_TERM_HOURS}h
                </p>
              )}
              {govCab?.total_seats != null && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${govCab.status === "majority" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                    {govCab.status === "majority" ? "Majority" : "Coalition"}
                  </span>
                  <span className="text-xs text-zinc-500">{govCab.total_seats} seats · Majority {govCab.majority_mark ?? "?"}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-4 text-center">
              <Globe2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No central government formed yet</p>
              <p className="text-xs text-zinc-600 mt-1">Forms after the National Lok Sabha election completes.</p>
            </div>
          )}

          <GovStatsGrid treasury={treasury} popularity={popularity} />
          <GovSectionLinks title="Central Sections" />
        </>
      ) : selectedState ? (() => {
        const state = getStateById(selectedState);
        const sg = governments.find(g => g.state_id === selectedState && g.is_active !== false);
        let cab = null;
        try { cab = sg?.cabinet ? JSON.parse(sg.cabinet) : null; } catch (e) {}
        // Under President's Rule the previous government is hidden from active UI.
        const pr = presidentRules.find(p => p.state_id === selectedState);
        return (
          <>
            {pr && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <h2 className="text-sm font-bold text-red-400 uppercase">President's Rule Active</h2>
                </div>
                <p className="text-xs text-zinc-300">The previous government stands dismissed. Government actions are suspended.</p>
                {pr.ends_game_time && (
                  <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Ends: {new Date(pr.ends_game_time).toLocaleString()}</p>
                )}
              </div>
            )}

            {!pr && sg ? (
              <div className="bg-gradient-to-br from-orange-500/10 to-yellow-400/10 border border-orange-500/30 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-amber-400 font-semibold uppercase">{state?.name} Government</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{sg.party_name}</h2>
                <p className="text-sm text-zinc-400">{sg.head_title}: {sg.head_player_name}</p>
                {gameCfg && (
                  <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Term: {formatTerm(termRemainingMs(sg, gameCfg))} · of {GOV_TERM_HOURS}h
                  </p>
                )}
                {cab?.total_seats != null && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-500/20 text-orange-400">{cab.status || "Government"}</span>
                    <span className="text-xs text-zinc-500">{cab.total_seats} seats · Majority {cab.majority_mark ?? "?"}</span>
                  </div>
                )}
              </div>
            ) : !pr ? (
              <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-4 text-center">
                <Landmark className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">No government formed in {state?.name} yet</p>
                <p className="text-xs text-zinc-600 mt-1">Forms after the Assembly election completes.</p>
              </div>
            ) : null}

            <GovStatsGrid treasury={stateData?.treasury} popularity={stateData?.popularity} />
            <GovSectionLinks title={`${state?.name || "State"} Sections`} />
          </>
        );
      })() : (
        <>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">All States · tap to open the state dashboard</h2>
          <div className="space-y-2">
            {BHARAT_STATES.map(s => {
              const g = governments.find(x => x.state_id === s.id && x.is_active !== false);
              const spr = presidentRules.find(p => p.state_id === s.id);
              return (
                <button key={s.id} onClick={() => setSelectedState(s.id)}
                  className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">{s.id}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    {spr ? (
                      <p className="text-[11px] text-red-400">President's Rule active</p>
                    ) : g ? (
                      <p className="text-[11px] text-zinc-400 truncate">{g.party_name} · {g.head_title}: {g.head_player_name}</p>
                    ) : (
                      <p className="text-[11px] text-zinc-600">No government formed yet</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}