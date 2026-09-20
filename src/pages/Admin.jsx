import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import GameConfigEditor from "@/components/admin/GameConfigEditor";
import SalaryConfigEditor from "@/components/admin/SalaryConfigEditor";
import AuditViewer from "@/components/admin/AuditViewer";
import BulkImport from "@/components/admin/BulkImport";
import UserInvite from "@/components/admin/UserInvite";
import SeatConfigEditor from "@/components/admin/SeatConfigEditor";
import FormationAdmin from "@/components/admin/FormationAdmin";
import TestUsers from "@/components/admin/TestUsers";
import ParliamentSetupForm from "@/components/admin/ParliamentSetupForm";
import MapColorEditor from "@/components/admin/MapColorEditor";
import AccessManager from "@/components/admin/AccessManager";
import DataWipe from "@/components/admin/DataWipe";
import { Settings, Sliders, Wallet, ScrollText, Upload, Database, UserPlus, Megaphone, Bot, BarChart3, ArrowLeft, ShieldCheck, Landmark, Crown, Users, TrendingUp, CheckSquare, Map, Trash2, KeyRound } from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "game", label: "Game Config", icon: Sliders },
  { key: "salary", label: "Salaries", icon: Wallet },
  { key: "audit", label: "Audit Log", icon: ScrollText },
  { key: "import", label: "Bulk Import", icon: Upload },
  { key: "users", label: "Invite Users", icon: UserPlus },
  { key: "seats", label: "Seats", icon: Landmark },
  { key: "formation", label: "Formation", icon: Crown },
  { key: "testusers", label: "Test Users", icon: Users },
  { key: "parliament", label: "Parliament", icon: Landmark },
  { key: "access", label: "Access", icon: KeyRound },
  { key: "mapcolors", label: "Map Colors", icon: Map },
  { key: "wipe", label: "Danger Zone", icon: Trash2 },
];

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    (async () => {
      const me = await bharat01.auth.me().catch(() => ({ role: "user" }));
      setIsAdmin(me.role === "admin");
      if (me.role !== "admin") return;
      // quick entity counts for the overview
      const names = ["Election", "Candidature", "Government", "Minister", "PlayerProfile", "PoliticalParty", "Bill", "Law", "Budget", "Treasury", "TaxConfig", "Task", "Investigation", "CourtCase", "PopularityScore", "NewsItem", "AuditLog"];
      const counts = {};
      for (const n of names) {
        try { const list = await bharat01.entities[n].filter({}); counts[n] = list.length; } catch (e) { counts[n] = "—"; }
      }
      setStats(counts);
    })();
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-20">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-white">Admins only</p>
          <p className="text-xs text-zinc-500 mt-1">You need an admin account to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const actor = { id: "admin", name: "Admin", role: "admin" };

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
      </div>

      {/* Quick links to other admin tools */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => navigate("/admin/elections")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <Megaphone className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">Election Commission</p><p className="text-[9px] text-zinc-500">Election Commissioner (admin)</p></div>
        </button>
        <button onClick={() => navigate("/admin/ai")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <Bot className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">AI Systems</p><p className="text-[9px] text-zinc-500">Task · Court · News AI</p></div>
        </button>
        <button onClick={() => navigate("/salary")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <Wallet className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">Salary</p><p className="text-[9px] text-zinc-500">Salaries & collections</p></div>
        </button>
        <button onClick={() => navigate("/formation-requests")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <Crown className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">Formation</p><p className="text-[9px] text-zinc-500">Governor (admin) · floor test</p></div>
        </button>
        <button onClick={() => navigate("/popularity")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">Popularity</p><p className="text-[9px] text-zinc-500">Scores & trends</p></div>
        </button>
        <button onClick={() => navigate("/tasks")} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-2 text-left">
          <CheckSquare className="w-5 h-5 text-amber-400" />
          <div><p className="text-xs text-white font-semibold">Tasks</p><p className="text-[9px] text-zinc-500">Role-based tasks</p></div>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${tab === t.key ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats).map(([name, count]) => (
            <div key={name} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[10px] text-zinc-500 uppercase">{name}</p>
            </div>
          ))}
        </div>
      )}
      {tab === "game" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><GameConfigEditor actor={actor} /></div>}
      {tab === "salary" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><SalaryConfigEditor actor={actor} /></div>}
      {tab === "audit" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><AuditViewer /></div>}
      {tab === "import" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><BulkImport /></div>}
      {tab === "users" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><UserInvite /></div>}
      {tab === "seats" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><SeatConfigEditor actor={actor} /></div>}
      {tab === "formation" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><FormationAdmin actor={actor} /></div>}
      {tab === "testusers" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><TestUsers actor={actor} /></div>}
      {tab === "parliament" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><ParliamentSetupForm actor={actor} /></div>}
      {tab === "access" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><AccessManager /></div>}
      {tab === "mapcolors" && <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800"><MapColorEditor actor={actor} /></div>}
      {tab === "wipe" && <div className="bg-zinc-900 rounded-2xl p-4 border border-red-500/30"><DataWipe actor={actor} /></div>}
    </div>
  );
}