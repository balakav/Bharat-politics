import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BUSINESS_LISTINGS, formatCoins } from "@/lib/gameData";
import { Briefcase, TrendingUp, ShoppingCart, Building2 } from "lucide-react";

const riskConfig = {
  low: { color: "bg-green-500/20 text-green-400", label: "Low Risk" },
  medium: { color: "bg-yellow-500/20 text-yellow-400", label: "Medium Risk" },
  high: { color: "bg-red-500/20 text-red-400", label: "High Risk" },
};

export default function Business() {
  const [businesses, setBusinesses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("market");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await base44.auth.me();
    const [biz, profiles] = await Promise.all([
      base44.entities.Business.list(),
      base44.entities.PlayerProfile.filter({ created_by_id: me.id }),
    ]);
    setBusinesses(biz);
    if (profiles.length > 0) setProfile(profiles[0]);
    setLoading(false);
  }

  async function seedBusinesses() {
    for (const b of BUSINESS_LISTINGS) {
      await base44.entities.Business.create({ ...b, for_sale: true });
    }
    loadData();
  }

  async function buyBusiness(biz) {
    if (!profile || profile.e_coins < biz.share_price) return;
    setBuying(biz.id);
    const annualReturn = Math.floor(biz.share_price * biz.return_rate);
    await base44.entities.Business.update(biz.id, { owner_id: profile.player_id, owner_name: profile.username, for_sale: false });
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: profile.e_coins - biz.share_price,
      net_worth: (profile.net_worth || 0) + annualReturn,
    });
    setProfile(prev => ({ ...prev, e_coins: prev.e_coins - biz.share_price, net_worth: (prev.net_worth || 0) + annualReturn }));
    setBuying(null);
    loadData();
  }

  const marketBiz = businesses.filter(b => b.for_sale);
  const myBiz = businesses.filter(b => b.owner_id === profile?.player_id);
  const displayed = tab === "market" ? marketBiz : myBiz;

  const totalReturns = myBiz.reduce((sum, b) => sum + Math.floor(b.share_price * b.return_rate), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Business & Investments</h1>
      </div>

      {tab === "portfolio" && myBiz.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-400">Annual returns: {formatCoins(totalReturns)}</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[{ key: "market", label: "Market" }, { key: "portfolio", label: "My Portfolio" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {businesses.length === 0 && tab === "market" && (
        <div className="text-center py-8">
          <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-4">No businesses listed</p>
          <button onClick={seedBusinesses} className="bg-zinc-800 text-yellow-400 px-6 py-3 rounded-xl text-sm font-bold border border-zinc-700">
            Load Company Listings
          </button>
        </div>
      )}

      {tab === "portfolio" && myBiz.length === 0 && (
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No investments yet. Check the market!</p>
        </div>
      )}

      <div className="space-y-3">
        {displayed.map(biz => {
          const risk = riskConfig[biz.risk_level] || riskConfig.medium;
          const annualReturn = Math.floor(biz.share_price * biz.return_rate);
          const returnPct = (biz.return_rate * 100).toFixed(0);
          return (
            <div key={biz.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{biz.name}</h3>
                    <p className="text-xs text-zinc-500">{biz.sector}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${risk.color}`}>
                  {risk.label}
                </span>
              </div>
              {biz.description && <p className="text-xs text-zinc-400 mb-3">{biz.description}</p>}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-yellow-400">{formatCoins(biz.share_price)}</p>
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="w-3 h-3" /> {returnPct}% return · {formatCoins(annualReturn)}/yr
                  </div>
                </div>
                {tab === "market" && biz.for_sale && (
                  <button
                    onClick={() => buyBusiness(biz)}
                    disabled={buying === biz.id || (profile?.e_coins || 0) < biz.share_price}
                    className="bg-gradient-to-r from-red-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <ShoppingCart className="w-4 h-4" /> Invest
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}