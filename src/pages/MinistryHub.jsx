import React, { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { getStateById, BHARAT_STATES } from "@/lib/bharatStates";
import { NATIONAL_MINISTRIES, STATE_MINISTRIES } from "@/lib/ministries";
import { Building2, CheckCircle, Circle, ChevronRight, MapPin, Plus, FileCheck } from "lucide-react";

// Ministries — the FULL directory of the national and every state government.
// Every ministry from the canonical lists always shows. Live data (the
// appointed minister, office works and ministry files from the Ministry
// Office) connects once a government is formed; without a government NO
// minister name is displayed. Only that government's ministers (or an admin)
// can manage a ministry's office works.

export default function MinistryHub() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [myOffices, setMyOffices] = useState([]);
  const [records, setRecords] = useState([]);
  const [ministers, setMinisters] = useState([]);
  const [files, setFiles] = useState([]);
  const [scope, setScope] = useState("national");
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [workInputs, setWorkInputs] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    const me = await bharat01.auth.me().catch(() => null);
    setIsAdmin(me?.role === "admin");
    if (me) {
      const ps = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
      if (ps[0]) {
        const offices = await bharat01.entities.Minister.filter({ player_id: ps[0].player_id, is_active: true }).catch(() => []);
        setMyOffices(offices);
      }
    }
    const [recs, mins, fls] = await Promise.all([
      bharat01.entities.Ministry.list("-created_date", 500).catch(() => []),
      bharat01.entities.Minister.filter({ is_active: true }).catch(() => []),
      bharat01.entities.MinistryFile.list("-created_date", 500).catch(() => []),
    ]);
    setRecords(recs);
    setMinisters(mins);
    setFiles(fls);
    setLoading(false);
  }

  function parseWorks(m) { try { return m?.works ? JSON.parse(m.works) : []; } catch (e) { return []; } }

  // Edit rights: an active minister holding office at this scope (and state).
  function canEdit(scopeId, stateId) {
    return isAdmin || myOffices.some(o => o.is_active !== false && o.scope === scopeId && (scopeId === "national" || o.state_id === stateId));
  }

  async function addWork(m) {
    const title = (workInputs[m.id] || "").trim();
    if (!title) return;
    const works = parseWorks(m);
    works.push({ title, status: "pending" });
    await bharat01.entities.Ministry.update(m.id, { works: JSON.stringify(works) });
    setWorkInputs(p => ({ ...p, [m.id]: "" }));
    load();
  }

  async function toggleWork(m, i) {
    const works = parseWorks(m);
    works[i] = { ...works[i], status: works[i].status === "done" ? "pending" : "done" };
    await bharat01.entities.Ministry.update(m.id, { works: JSON.stringify(works) });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const MinistryCard = ({ name, scopeId, stateId, editable }) => {
    const record = records.find(m => m.scope === scopeId && (scopeId === "national" || m.state_id === stateId) && m.name === name);
    const head = ministers.find(x => x.portfolio === name && x.scope === scopeId && (scopeId === "national" || x.state_id === stateId));
    const govtFormed = !!head;
    const mFiles = files.filter(f => f.ministry_name === name && f.scope === scopeId && (scopeId === "national" || f.state_id === stateId));
    const approved = mFiles.filter(f => f.status === "approved");
    const openFiles = mFiles.filter(f => f.status === "submitted" || f.status === "under_review");
    const works = parseWorks(record);
    const worksDone = works.filter(w => w.status === "done").length;
    return (
      <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800">
        <h3 className="text-sm font-bold text-white truncate flex items-center gap-2 mb-1.5">
          <Building2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> {name.replace(/^Ministry of /, "")}
        </h3>

        {/* Minister — displayed ONLY once a government is formed and this
            portfolio is appointed. No government → no minister name. */}
        {govtFormed ? (
          <p className="text-[10px] text-zinc-400 mb-1.5">
            Minister: <span className="text-white font-medium">{head.player_name}</span>{head.party_name ? ` · ${head.party_name}` : ""}
          </p>
        ) : (
          <p className="text-[10px] text-zinc-600 italic mb-1.5">No government formed — minister not appointed yet.</p>
        )}

        {/* The minister's work — office works + ministry files */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[
            ["Works Done", record ? `${worksDone}/${works.length}` : "—"],
            ["Files Approved", approved.length],
            ["Open Files", openFiles.length],
          ].map(([label, val]) => (
            <div key={label} className="bg-zinc-800/60 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-white">{val}</p>
              <p className="text-[8px] text-zinc-500 uppercase">{label}</p>
            </div>
          ))}
        </div>

        {approved.length > 0 && (
          <div className="mb-2 space-y-1">
            <p className="text-[9px] text-zinc-500 uppercase font-semibold">Recent Work by the Minister</p>
            {approved.slice(0, 3).map(f => (
              <p key={f.id} className="text-[10px] text-zinc-400 flex items-center gap-1 truncate">
                <FileCheck className="w-3 h-3 text-green-400 flex-shrink-0" /> {f.title} — {f.handled_by_name || "office"}
              </p>
            ))}
          </div>
        )}

        <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-1.5">Office Works ({works.length})</p>
        <div className="space-y-1.5 mb-2">
          {!record && <p className="text-[11px] text-zinc-600">Works open once the ministry is constituted by the government.</p>}
          {record && works.length === 0 && <p className="text-[11px] text-zinc-600">No works assigned yet.</p>}
          {works.map((w, i) => (
            <button key={i} onClick={() => editable && toggleWork(record, i)} disabled={!editable}
              className={`w-full flex items-center gap-2 bg-zinc-800/60 rounded-lg px-2.5 py-1.5 text-left ${editable ? "hover:bg-zinc-800" : "cursor-default"}`}>
              {w.status === "done" ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <Circle className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
              <span className={`text-xs ${w.status === "done" ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{w.title}</span>
            </button>
          ))}
        </div>
        {editable && record ? (
          <div className="flex gap-2">
            <input value={workInputs[record.id] || ""} onChange={e => setWorkInputs(p => ({ ...p, [record.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addWork(record)} placeholder="Add office work..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-orange-500" />
            <button onClick={() => addWork(record)} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg px-2.5">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : govtFormed ? (
          <p className="text-[10px] text-zinc-600">View mode — works are managed by this government's ministers.</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Ministries</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">The full ministry directory of the national and every state government</p>

      {/* Scope tabs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setScope("national")}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
            ${scope === "national" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          National
        </button>
        <button onClick={() => { setScope("state"); setSelectedState(""); }}
          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
            ${scope === "state" ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
          State
        </button>
      </div>

      {scope === "national" ? (
        <>
          {(() => {
            const formed = NATIONAL_MINISTRIES.filter(n => ministers.some(x => x.portfolio === n && x.scope === "national")).length;
            return (
              <p className="text-[10px] text-zinc-600 mb-3">
                {formed} of {NATIONAL_MINISTRIES.length} ministries have an appointed minister.
                {canEdit("national", "") ? " You can manage national works." : ""}
              </p>
            );
          })()}
          <div className="space-y-3">
            {NATIONAL_MINISTRIES.map(n => (
              <MinistryCard key={n} name={n} scopeId="national" stateId="" editable={canEdit("national", "")} />
            ))}
          </div>
        </>
      ) : !selectedState ? (
        <>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">All States · tap to view its ministries</h2>
          <div className="space-y-2">
            {BHARAT_STATES.map(s => {
              const formed = STATE_MINISTRIES.filter(n => ministers.some(x => x.portfolio === n && x.scope === "state" && x.state_id === s.id)).length;
              return (
                <button key={s.id} onClick={() => setSelectedState(s.id)}
                  className="w-full text-left bg-zinc-900 rounded-2xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">{s.id}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-zinc-500">{formed} of {STATE_MINISTRIES.length} ministries constituted</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      ) : (() => {
        const st = getStateById(selectedState);
        const editable = canEdit("state", selectedState);
        const formed = STATE_MINISTRIES.filter(n => ministers.some(x => x.portfolio === n && x.scope === "state" && x.state_id === selectedState)).length;
        return (
          <>
            <button onClick={() => setSelectedState("")} className="text-[11px] text-yellow-400 mb-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 rotate-180" /> All States
            </button>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">{st?.name} Ministries</h2>
            </div>
            <p className="text-[10px] text-zinc-600 mb-3">
              {formed} of {STATE_MINISTRIES.length} ministries constituted.
              {editable ? " You hold a ministry here — you can manage the works." : ""}
            </p>
            <div className="space-y-3">
              {STATE_MINISTRIES.map(n => (
                <MinistryCard key={n} name={n} scopeId="state" stateId={selectedState} editable={editable} />
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}