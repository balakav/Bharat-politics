import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { BHARAT_STATES, getStateById, NATION } from "@/lib/bharatStates";
import { createBudget, runBudgetAI, presentBudget, voteOnBudget } from "@/lib/budgetService";
import { formatCoins } from "@/lib/gameData";
import { usePlayerRole } from "@/hooks/usePlayerRole";
import { ArrowLeft, FileBarChart, Globe2, Landmark, Play, Gavel, CheckCircle, XCircle, AlertTriangle, Coins } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const statusColor = {
  draft: "bg-zinc-700 text-zinc-300",
  ai_review: "bg-green-500/20 text-green-400",
  returned: "bg-red-500/20 text-red-400",
  voting: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

export default function BudgetPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("NAT");
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const role = usePlayerRole();
  const [form, setForm] = useState({ fiscal_year: "FY-1", revenue: 0, expenditure: 0, development_spending: 0, welfare_spending: 0, infrastructure_spending: 0, salary_spending: 0 });

  const canPrepare = role.primary?.role === "admin" || role.primary?.role === "cm" || role.primary?.role === "pm" || role.primary?.role === "minister";

  const loadData = useCallback(async () => {
    const isNat = selected === "NAT";
    const stateId = isNat ? "" : selected;
    const scope = isNat ? "national" : "state";
    const all = await base44.entities.Budget.list("-created_date", 50);
    setBudgets(all.filter(b => b.scope === scope && (isNat || b.state_id === stateId)));
    setLoading(false);
  }, [selected]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  const isNat = selected === "NAT";
  const state = isNat ? null : getStateById(selected);
  const latest = budgets[0];

  async function handlePrepare() {
    setBusy(true);
    try {
      const data = {
        scope: isNat ? "national" : "state",
        state_id: isNat ? "" : selected,
        fiscal_year: form.fiscal_year,
        finance_minister_id: "", finance_minister_name: role.primary?.label || "Finance Minister",
        revenue: Number(form.revenue), expenditure: Number(form.expenditure),
        development_spending: Number(form.development_spending), welfare_spending: Number(form.welfare_spending),
        infrastructure_spending: Number(form.infrastructure_spending), salary_spending: Number(form.salary_spending),
      };
      await createBudget(data, { id: "finance_minister", name: role.primary?.label || "Finance Minister", role: role.primary?.role });
      await loadData();
    } finally { setBusy(false); }
  }

  async function handleAI(id) { setBusy(true); try { await runBudgetAI(id); await loadData(); } finally { setBusy(false); } }
  async function handlePresent(id) { setBusy(true); try { await presentBudget(id, { id: "finance_minister", name: role.primary?.label, role: role.primary?.role }); await loadData(); } finally { setBusy(false); } }

  async function handleVote(id) {
    setBusy(true);
    try {
      // Derive assembly/parliament vote from latest completed election winners.
      const electionType = isNat ? "national" : "vidhan_sabha";
      const filterQuery = isNat ? { election_type: "national", results_declared: true } : { state_id: selected, election_type: "vidhan_sabha", results_declared: true };
      const els = await base44.entities.Election.filter(filterQuery, "-created_date", 10);
      const el = els[0];
      let votesFor = 0, votesAgainst = 0;
      if (el) {
        const winners = await base44.entities.Candidature.filter({ election_id: el.id, result: "won" }, "-votes_received", 5000);
        const b = budgets.find(x => x.id === id);
        const ruling = (b?.coalition_parties?.length ? b.coalition_parties : (b?.party_name || "").split(" + ")).filter(Boolean);
        // If budget has no explicit party, use government record
        let rulingSet;
        if (ruling.length) rulingSet = new Set(ruling);
        else {
          const govs = await base44.entities.Government.filter({ type: isNat ? "national" : "state", is_active: true });
          const g = govs[0];
          rulingSet = new Set((g?.coalition_parties?.length ? g.coalition_parties : (g?.party_name || "").split(" + ")).filter(Boolean));
        }
        for (const w of winners) {
          if (rulingSet.has(w.party_name)) votesFor++; else votesAgainst++;
        }
      } else {
        votesFor = Math.floor(Math.random() * 100) + 50; votesAgainst = Math.floor(Math.random() * 80) + 20;
      }
      await voteOnBudget(id, votesFor, votesAgainst, { id: "assembly", name: "Assembly", role: "ai" });
      await loadData();
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <FileBarChart className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Budget</h1>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setSelected("NAT")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${selected === "NAT" ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}><Globe2 className="w-3 h-3" /> National</button>
        {BHARAT_STATES.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selected === s.id ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>{s.name}</button>
        ))}
      </div>

      {/* Prepare budget */}
      {canPrepare && (
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Coins className="w-4 h-4 text-yellow-400" /> Prepare Budget ({isNat ? "National" : state?.name})</h3>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.fiscal_year} onChange={e => setForm({ ...form, fiscal_year: e.target.value })} placeholder="Fiscal Year" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
            <div />
            {[
              ["revenue", "Revenue"], ["expenditure", "Expenditure"], ["development_spending", "Development"],
              ["welfare_spending", "Welfare"], ["infrastructure_spending", "Infrastructure"], ["salary_spending", "Salaries"],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="text-[10px] text-zinc-500">{label}</label>
                <input type="number" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            ))}
          </div>
          <button onClick={handlePrepare} disabled={busy} className="w-full mt-3 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50">Prepare Budget</button>
        </div>
      )}

      {/* Budgets list */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : budgets.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <FileBarChart className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No budgets yet</p>
          <p className="text-xs text-zinc-500 mt-1">{canPrepare ? "Prepare a budget above." : "The Finance Minister will prepare one."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => (
            <div key={b.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{b.fiscal_year}</p>
                  <p className="text-[10px] text-zinc-500">{b.finance_minister_name || "Finance Minister"}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${statusColor[b.status]}`}>{b.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                <div className="bg-zinc-800/50 rounded-lg p-2"><span className="text-zinc-500">Revenue:</span> <span className="text-green-400 font-medium">{formatCoins(b.revenue)}</span></div>
                <div className="bg-zinc-800/50 rounded-lg p-2"><span className="text-zinc-500">Expenditure:</span> <span className="text-red-400 font-medium">{formatCoins(b.expenditure)}</span></div>
                <div className="bg-zinc-800/50 rounded-lg p-2"><span className="text-zinc-500">Deficit:</span> <span className="text-white font-medium">{formatCoins(b.deficit)}</span></div>
                <div className="bg-zinc-800/50 rounded-lg p-2"><span className="text-zinc-500">AI Score:</span> <span className={`font-bold ${(b.ai_score || 0) >= 70 ? "text-green-400" : "text-red-400"}`}>{b.ai_score || 0}%</span></div>
              </div>

              {b.ai_notes && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2 mb-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300">{b.ai_notes}</p>
                </div>
              )}

              {/* Workflow actions */}
              <div className="flex gap-2 flex-wrap">
                {b.status === "draft" && canPrepare && (
                  <button onClick={() => handleAI(b.id)} disabled={busy} className="flex-1 text-[11px] bg-zinc-800 text-yellow-400 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Play className="w-3 h-3" /> Run Budget AI</button>
                )}
                {b.status === "returned" && canPrepare && (
                  <button onClick={() => handleAI(b.id)} disabled={busy} className="flex-1 text-[11px] bg-zinc-800 text-yellow-400 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Play className="w-3 h-3" /> Re-run Budget AI</button>
                )}
                {b.status === "ai_review" && canPrepare && (
                  <button onClick={() => handlePresent(b.id)} disabled={busy} className="flex-1 text-[11px] bg-yellow-500/20 text-yellow-400 py-2 rounded-lg font-semibold flex items-center justify-center gap-1 border border-yellow-500/30 disabled:opacity-50"><Gavel className="w-3 h-3" /> Present</button>
                )}
                {b.status === "voting" && (
                  <button onClick={() => handleVote(b.id)} disabled={busy} className="flex-1 text-[11px] bg-gradient-to-r from-red-500 to-yellow-500 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Gavel className="w-3 h-3" /> Tally Vote</button>
                )}
                {b.status === "approved" && <div className="flex items-center gap-1 text-[11px] text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Approved {b.assembly_votes_for}-{b.assembly_votes_against}</div>}
                {b.status === "rejected" && <div className="flex items-center gap-1 text-[11px] text-red-400"><XCircle className="w-3.5 h-3.5" /> Rejected {b.assembly_votes_for}-{b.assembly_votes_against}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}