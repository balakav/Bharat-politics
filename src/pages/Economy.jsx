import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { bharat01 } from "@/api/bharat01Client";
import { BHARAT_STATES, NATION, getStateById } from "@/lib/bharatStates";
import { getTreasury } from "@/lib/treasury";
import { getActiveTaxes, createTaxConfig, toggleTax } from "@/lib/taxSystem";
import { formatCoins } from "@/lib/gameData";
import { ArrowLeft, Landmark, Globe2, Coins, Percent, Plus, CheckCircle, XCircle, Wallet } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const TAX_TYPES = ["income", "property", "business", "transaction", "vehicle", "custom"];

export default function Economy() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState("NAT");
  const [treasury, setTreasury] = useState(null);
  const [taxes, setTaxes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", tax_type: "income", rate: 5, scope: "national", state_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const me = await bharat01.auth.me().catch(() => ({ role: "user" }));
    setIsAdmin(me.role === "admin");
    const isNat = selected === "NAT";
    const stateId = isNat ? "" : selected;
    const scope = isNat ? "national" : "state";
    const t = await getTreasury(scope, stateId);
    setTreasury(t);
    const tx = await getActiveTaxes(scope, stateId);
    setTaxes(tx);
    setLoading(false);
  }, [selected]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  const isNat = selected === "NAT";
  const state = isNat ? null : getStateById(selected);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const data = { ...form, rate: Number(form.rate), scope: isNat ? "national" : "state", state_id: isNat ? "" : selected };
      await createTaxConfig(data, { id: "admin", name: "Admin", role: "admin" });
      setShowForm(false);
      setForm({ name: "", tax_type: "income", rate: 5, scope: "national", state_id: "" });
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to create tax");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Economy</h1>
      </div>

      {/* Scope selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setSelected("NAT")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${selected === "NAT" ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>
          <Globe2 className="w-3 h-3" /> National
        </button>
        {BHARAT_STATES.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selected === s.id ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>{s.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Treasury */}
          <div className="bg-gradient-to-br from-red-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              {isNat ? <Globe2 className="w-5 h-5 text-yellow-400" /> : <Landmark className="w-5 h-5 text-yellow-400" />}
              <h2 className="text-sm font-semibold text-white">{isNat ? "National Treasury" : `${state.name} Treasury`}</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                <p className="text-lg font-bold text-yellow-400">{formatCoins(treasury?.balance || 0)}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Balance</p>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold text-green-400">{formatCoins(treasury?.total_revenue || 0)}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Revenue</p>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold text-red-400">{formatCoins(treasury?.total_expenditure || 0)}</p>
                <p className="text-[9px] text-zinc-500 uppercase">Spending</p>
              </div>
            </div>
          </div>

          {/* Taxes */}
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2"><Percent className="w-4 h-4" /> Active Taxes ({taxes.length})</h3>
              {isAdmin && (
                <button onClick={() => setShowForm(v => !v)} className="text-[10px] bg-red-500/20 text-yellow-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 border border-red-500/30">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>

            {showForm && isAdmin && (
              <div className="bg-zinc-800/60 rounded-xl p-3 mb-3 space-y-2">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tax name (e.g. Income Tax)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.tax_type} onChange={e => setForm({ ...form, tax_type: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="Rate %" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                {error && <p className="text-[11px] text-red-400">{error}</p>}
                <button onClick={handleSave} disabled={saving || !form.name} className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50">Create Tax</button>
              </div>
            )}

            {taxes.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-3">No taxes configured for this scope.</p>
            ) : (
              <div className="space-y-1.5">
                {taxes.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{t.name}</p>
                      <p className="text-[10px] text-zinc-500 capitalize">{t.tax_type} · {t.scope}{t.scope === "state" ? ` · ${getStateById(t.state_id)?.name || t.state_id}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-yellow-400">{t.rate}%</span>
                      {isAdmin && (
                        <button onClick={async () => { await toggleTax(t.id, !t.is_active); await loadData(); }} className="text-[10px] text-zinc-400">
                          {t.is_active ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-zinc-600" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}