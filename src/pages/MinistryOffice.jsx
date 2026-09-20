import React, { useState, useEffect, useCallback } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Link } from "react-router-dom";
import { Briefcase, Building2, Layers, Users, MapPin, ChevronDown } from "lucide-react";
import { getStateById, NATION } from "@/lib/bharatStates";
import { getDepartments } from "@/lib/ministryDepartments";
import { generateTasksForPlayer, resolveTask, expireOverdueTasks } from "@/lib/taskAI";
import FileWorkflow from "@/components/ministry/FileWorkflow";
import OfficeTasks from "@/components/ministry/OfficeTasks";

// Ministry Office dashboard: the personal workspace of every appointed
// minister — departments of the portfolio, role-based office tasks (rewards
// and risks), and the file workflow (Submitted → Under Review → Approved /
// Rejected). Appointments come from cabinet formation in Party HQ.

export default function MinistryOffice() {
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [offices, setOffices] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const [ministry, setMinistry] = useState(null);
  const [files, setFiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [team, setTeam] = useState(null);

  const office = offices[selIdx];

  // The state/nation name sits above the office; tapping it shows the current
  // minister list of that government.
  const officeRegion = office
    ? (office.scope === "national" ? NATION.name : getStateById(office.state_id)?.name || office.state_id)
    : "";

  async function toggleTeam() {
    if (!office) return;
    if (showTeam) { setShowTeam(false); return; }
    const t = await bharat01.entities.Minister.filter({
      scope: office.scope, state_id: office.scope === "national" ? "" : office.state_id || "", is_active: true,
    }).catch(() => []);
    const rank = { pm: 0, cm: 0, deputy_cm: 1, speaker: 2, whip: 3 };
    setTeam([...t].sort((a, b) => (rank[a.position] ?? 4) - (rank[b.position] ?? 4)));
    setShowTeam(true);
  }

  const load = useCallback(async () => {
    const me = await bharat01.auth.me();
    setIsAdmin(me?.role === "admin");
    const ps = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }).catch(() => []);
    if (!ps[0]) { setLoading(false); return; }
    setProfile(ps[0]);
    await expireOverdueTasks(ps[0].player_id).catch(() => {});
    const [offs, tks] = await Promise.all([
      bharat01.entities.Minister.filter({ player_id: ps[0].player_id, is_active: true }).catch(() => []),
      bharat01.entities.Task.filter({ player_id: ps[0].player_id, status: "pending" }).catch(() => []),
    ]);
    setOffices(offs);
    setTasks(tks);
    setLoading(false);
  }, []);

  // Office-scoped data (files + matching Ministry record) reloads on switch.
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (office) loadOffice(); }, [office?.id]);

  async function loadOffice() {
    if (!office) return;
    const [mins, fls] = await Promise.all([
      bharat01.entities.Ministry.filter({ government_id: office.government_id || "" }).catch(() => []),
      bharat01.entities.MinistryFile.filter({ ministry_name: office.portfolio, scope: office.scope }, "-created_date", 100).catch(() => []),
    ]);
    setMinistry(mins.find(m => m.name === office.portfolio) || null);
    setFiles(fls.filter(f => (f.state_id || "") === (office.state_id || "")));
  }

  const isHead = true; // this page is only reachable for office holders

  async function submitFile(title, summary) {
    if (busy || !office) return;
    setBusy(true); setMsg("");
    try {
      await bharat01.entities.MinistryFile.create({
        ministry_id: ministry?.id || "",
        ministry_name: office.portfolio,
        scope: office.scope,
        state_id: office.state_id || "",
        title, summary,
        status: "submitted",
        submitted_by_id: profile.player_id,
        submitted_by_name: profile.username,
      });
      document.activeElement?.blur?.();
      await loadOffice();
    } catch (e) { setMsg("Error: " + (e.message || "could not submit file")); }
    setBusy(false);
  }

  async function actOnFile(f, status, note) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      await bharat01.entities.MinistryFile.update(f.id, {
        status, decision_note: note, handled_by_name: profile.username,
      });
      setMsg(`File "${f.title}" ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "taken up for review"}.`);
      await loadOffice();
    } catch (e) { setMsg("Error: " + (e.message || "action failed")); }
    setBusy(false);
  }

  async function generate() {
    if (busy || !profile || !office) return;
    setBusy(true); setMsg("");
    try {
      const roleMap = { cm: "cm", pm: "pm", speaker: "speaker", deputy_cm: "cm" };
      const created = await generateTasksForPlayer(profile.player_id, roleMap[office.position] || "minister", office.scope, office.state_id || "", 3, 3);
      setMsg(created.length > 0 ? `${created.length} new office task(s) generated.` : "You already have open tasks — finish them first.");
      const tks = await bharat01.entities.Task.filter({ player_id: profile.player_id, status: "pending" }).catch(() => []);
      setTasks(tks);
    } catch (e) { setMsg("Error: " + (e.message || "could not generate tasks")); }
    setBusy(false);
  }

  async function resolve(taskId, choiceIndex) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const choice = await resolveTask(taskId, choiceIndex);
      setMsg(`Task resolved: ${choice.label} (${(choice.reputation || 0) > 0 ? "+" : ""}${choice.reputation || 0} rep).`);
      await load();
    } catch (e) { setMsg("Error: " + (e.message || "could not resolve task")); }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (offices.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Ministry Office</h1>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Building2 className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No ministry yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-3">Your office appears here once you are appointed to a ministry through cabinet formation.</p>
          <Link to="/party-hq" className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg">
            Go to Party HQ
          </Link>
        </div>
      </div>
    );
  }

  const departments = getDepartments(office.portfolio);
  const openFiles = files.filter(f => f.status === "submitted" || f.status === "under_review").length;

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-1">
        <Briefcase className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold text-white">Ministry Office</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Your departments, office tasks and file workflow</p>

      {/* Portfolio switcher */}
      {offices.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
          {offices.map((o, i) => (
            <button key={o.id} onClick={() => { setSelIdx(i); setShowTeam(false); }}
              className={`text-[10px] px-3 py-1.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 transition-all
                ${i === selIdx ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              {o.portfolio}
            </button>
          ))}
        </div>
      )}

      {/* Office header — the state/nation name sits above the portfolio and
          opens the current minister list for that government. */}
      <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-2xl p-3 border border-amber-500/20 mb-2">
        <button onClick={toggleTeam} className="w-full flex items-center justify-between gap-2 mb-1">
          <p className="text-[11px] font-bold text-amber-400 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" /> {officeRegion} {office.scope === "state" ? "State" : "· National Government"}
          </p>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform ${showTeam ? "rotate-180" : ""}`} />
        </button>
        <p className="text-sm font-bold text-white">{office.portfolio}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">{office.position.replace(/_/g, " ")}</p>
        {office.party_name && <p className="text-[10px] text-zinc-500 mt-0.5">Party: {office.party_name}</p>}
        {ministry?.description && <p className="text-[10px] text-zinc-500 mt-0.5">{ministry.description}</p>}
      </div>

      {/* Current minister list of the tapped state/nation */}
      {showTeam && (
        <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3">
          <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2">
            Ministers · {officeRegion} {office.scope === "state" ? "State Government" : "Union Government"}
          </p>
          {!team ? (
            <p className="text-[11px] text-zinc-500">Loading…</p>
          ) : team.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No ministers appointed yet.</p>
          ) : (
            <div className="space-y-1.5">
              {team.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium truncate">{m.player_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{m.portfolio}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-semibold flex-shrink-0 ml-2">
                    {m.position.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          [Layers, "Departments", departments.length],
          [Building2, "Open Files", openFiles],
          [Users, "Open Tasks", tasks.length],
        ].map(([Icon, label, val]) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-2 border border-zinc-800 text-center">
            <Icon className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-white">{val}</p>
            <p className="text-[8px] text-zinc-500 uppercase">{label}</p>
          </div>
        ))}
      </div>

      {msg && <p className="text-[11px] text-green-400 mb-3">{msg}</p>}

      {/* Departments */}
      <div className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 mb-3">
        <p className="text-[10px] text-zinc-500 uppercase font-semibold mb-2 flex items-center gap-1"><Layers className="w-3 h-3" /> Departments</p>
        <div className="grid grid-cols-2 gap-1.5">
          {departments.map(d => (
            <div key={d} className="bg-zinc-800/60 rounded-lg px-2.5 py-2 border border-zinc-700/50">
              <p className="text-[11px] text-white font-medium leading-tight">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <FileWorkflow files={files} isHead={isHead} busy={busy} onAction={actOnFile} onSubmit={submitFile} />
        <OfficeTasks tasks={tasks} busy={busy} onResolve={resolve} onGenerate={generate} />
      </div>
    </div>
  );
}