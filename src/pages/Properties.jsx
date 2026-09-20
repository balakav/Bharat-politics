import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { generatePropertyNews } from "@/lib/newsGenerator";
import { formatCoins } from "@/lib/gameData";
import { Building2, MapPin, ShoppingCart, Wallet, Car, Star, Wrench, Home as HomeIcon, Plus, Tag, X } from "lucide-react";

// Properties & Vehicles merged into one asset hub. NO static data — every
// listing is created and priced by players. Buying pays the current owner,
// and owners can list their own assets for sale anytime.

const PROP_TYPES = ["all", "house", "flat", "villa", "bungalow", "shop", "office", "hotel", "factory", "farm", "land"];
const VEH_CATS = ["all", "scooter", "bike", "car", "suv", "truck", "bus", "helicopter", "private_jet"];

export default function Properties() {
  const [asset, setAsset] = useState("properties");
  const [tab, setTab] = useState("market");
  const [filter, setFilter] = useState("all");
  const [properties, setProperties] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [collectingRent, setCollectingRent] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [formErr, setFormErr] = useState("");
  const [listing, setListing] = useState(false);

  const isProps = asset === "properties";

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const me = await base44.auth.me();
    const [props, vehs, profiles] = await Promise.all([
      base44.entities.Property.list(),
      base44.entities.Vehicle.list(),
      base44.entities.PlayerProfile.filter({ created_by_id: me.id }),
    ]);
    setProperties(props);
    setVehicles(vehs);
    if (profiles.length > 0) setProfile(profiles[0]);
    setLoading(false);
  }

  async function paySeller(ownerId, amount, countField) {
    if (!ownerId) return;
    const sellers = await base44.entities.PlayerProfile.filter({ player_id: ownerId }).catch(() => []);
    if (sellers[0]) {
      await base44.entities.PlayerProfile.update(sellers[0].id, {
        e_coins: (sellers[0].e_coins || 0) + amount,
        [countField]: Math.max(0, (sellers[0][countField] || 0) - 1),
      }).catch(() => {});
    }
  }

  async function buyProperty(prop) {
    if (!profile || (profile.e_coins || 0) < prop.market_value || prop.owner_id === profile.player_id) return;
    setBuying(prop.id);
    await paySeller(prop.owner_id, prop.market_value, "properties_owned");
    await base44.entities.Property.update(prop.id, { owner_id: profile.player_id, owner_name: profile.username, for_sale: false });
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: profile.e_coins - prop.market_value,
      properties_owned: (profile.properties_owned || 0) + 1,
      net_worth: (profile.net_worth || 0) + (prop.rental_income || 0) * 12,
    });
    setProfile(prev => ({ ...prev, e_coins: prev.e_coins - prop.market_value, properties_owned: (prev.properties_owned || 0) + 1 }));
    await generatePropertyNews(prop, profile.username);
    setBuying(null);
    loadData();
  }

  async function buyVehicle(veh) {
    if (!profile || (profile.e_coins || 0) < veh.price || veh.owner_id === profile.player_id) return;
    setBuying(veh.id);
    await paySeller(veh.owner_id, veh.price, "vehicles_owned");
    await base44.entities.Vehicle.update(veh.id, { owner_id: profile.player_id, owner_name: profile.username, for_sale: false });
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: profile.e_coins - veh.price,
      vehicles_owned: (profile.vehicles_owned || 0) + 1,
    });
    setProfile(prev => ({ ...prev, e_coins: prev.e_coins - veh.price, vehicles_owned: (prev.vehicles_owned || 0) + 1 }));
    setBuying(null);
    loadData();
  }

  // Owners list / de-list their own assets on the market anytime.
  async function toggleSale(item) {
    const entity = isProps ? base44.entities.Property : base44.entities.Vehicle;
    await entity.update(item.id, { for_sale: !item.for_sale });
    loadData();
  }

  // List a brand-new asset on the market (player-created, player-priced).
  async function submitListing() {
    if (!profile || listing) return;
    if (isProps) {
      if (!form.name?.trim() || !form.type || !Number(form.market_value)) {
        setFormErr("Name, type and price are required."); return;
      }
      setListing(true); setFormErr("");
      await base44.entities.Property.create({
        name: form.name.trim(),
        type: form.type,
        location: (form.location || "").trim() || "Bharat Union",
        market_value: Number(form.market_value),
        rental_income: Number(form.rental_income) || 0,
        owner_id: profile.player_id,
        owner_name: profile.username,
        for_sale: true,
        description: "",
      });
    } else {
      if (!form.name?.trim() || !form.category || !Number(form.price)) {
        setFormErr("Name, category and price are required."); return;
      }
      setListing(true); setFormErr("");
      await base44.entities.Vehicle.create({
        name: form.name.trim(),
        category: form.category,
        brand: (form.brand || "").trim(),
        model: (form.model || "").trim(),
        price: Number(form.price),
        prestige: Number(form.prestige) || 5,
        maintenance_cost: Number(form.maintenance_cost) || 0,
        owner_id: profile.player_id,
        owner_name: profile.username,
        for_sale: true,
        description: "",
      });
    }
    setListing(false); setShowForm(false); setForm({});
    loadData();
  }

  const myProps = properties.filter(p => p.owner_id === profile?.player_id);
  const myVehs = vehicles.filter(v => v.owner_id === profile?.player_id);

  const lastRent = profile?.last_rent_collected ? new Date(profile.last_rent_collected) : null;
  const canCollectRent = !lastRent || (Date.now() - lastRent.getTime() >= 5 * 60 * 1000);

  async function collectRent() {
    if (!canCollectRent || !profile || collectingRent) return;
    const totalRent = myProps.reduce((sum, p) => sum + (p.rental_income || 0), 0);
    if (totalRent === 0) return;
    setCollectingRent(true);
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: (profile.e_coins || 0) + totalRent,
      net_worth: (profile.net_worth || 0) + totalRent,
      last_rent_collected: new Date().toISOString(),
    });
    setProfile(prev => ({ ...prev, e_coins: (prev.e_coins || 0) + totalRent, last_rent_collected: new Date().toISOString() }));
    setCollectingRent(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const filterOptions = isProps ? PROP_TYPES : VEH_CATS;
  const marketItems = isProps ? properties.filter(p => p.for_sale) : vehicles.filter(v => v.for_sale);
  const ownedItems = isProps ? myProps : myVehs;
  const displayed = tab === "market" ? marketItems : ownedItems;
  const filtered = filter === "all" ? displayed : displayed.filter(i => (isProps ? i.type : i.category) === filter);

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500";

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <h1 className="text-2xl font-bold text-white mb-4">Assets</h1>

      {/* Asset toggle: Properties | Vehicles */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "properties", label: "Properties", icon: HomeIcon },
          { key: "vehicles", label: "Vehicles", icon: Car },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setAsset(t.key); setTab("market"); setFilter("all"); setShowForm(false); setForm({}); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${asset === t.key ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              <Icon className="w-4 h-4" /> {t.label}
              <span className="text-[10px] opacity-70">({t.key === "properties" ? properties.length : vehicles.length})</span>
            </button>
          );
        })}
      </div>

      {/* Market / Owned tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "market", label: isProps ? "Marketplace" : "Showroom" },
          { key: "owned", label: isProps ? "My Properties" : "My Vehicles" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {filterOptions.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap capitalize
              ${filter === f ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>
            {f === "private_jet" ? "Private Jet" : f}
          </button>
        ))}
      </div>

      {/* List a new asset (market tab) — all listings are player-created */}
      {tab === "market" && (
        showForm ? (
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">List a New {isProps ? "Property" : "Vehicle"}</h3>
              <button onClick={() => { setShowForm(false); setForm({}); setFormErr(""); }}
                className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <input type="text" placeholder="Name" value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
            {isProps ? (
              <>
                <select value={form.type || ""} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                  <option value="">Choose type…</option>
                  {PROP_TYPES.slice(1).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
                <input type="text" placeholder="Location" value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputCls} />
                <input type="number" placeholder="Price (₹)" value={form.market_value || ""} onChange={e => setForm(f => ({ ...f, market_value: e.target.value }))} className={inputCls} />
                <input type="number" placeholder="Monthly rent (₹, optional)" value={form.rental_income || ""} onChange={e => setForm(f => ({ ...f, rental_income: e.target.value }))} className={inputCls} />
              </>
            ) : (
              <>
                <select value={form.category || ""} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                  <option value="">Choose category…</option>
                  {VEH_CATS.slice(1).map(c => <option key={c} value={c} className="capitalize">{c === "private_jet" ? "Private Jet" : c}</option>)}
                </select>
                <input type="text" placeholder="Brand (optional)" value={form.brand || ""} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inputCls} />
                <input type="text" placeholder="Model (optional)" value={form.model || ""} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={inputCls} />
                <input type="number" placeholder="Price (₹)" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputCls} />
                <input type="number" placeholder="Prestige 1-100 (optional)" value={form.prestige || ""} onChange={e => setForm(f => ({ ...f, prestige: e.target.value }))} className={inputCls} />
                <input type="number" placeholder="Monthly maintenance (₹, optional)" value={form.maintenance_cost || ""} onChange={e => setForm(f => ({ ...f, maintenance_cost: e.target.value }))} className={inputCls} />
              </>
            )}
            {formErr && <p className="text-[11px] text-red-400">{formErr}</p>}
            <button onClick={submitListing} disabled={listing}
              className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {listing ? "Listing…" : "List for Sale"}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full bg-zinc-900 border border-dashed border-zinc-700 text-yellow-400 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 mb-4">
            <Plus className="w-4 h-4" /> List a New {isProps ? "Property" : "Vehicle"}
          </button>
        )
      )}

      {/* Rent collection (properties owned) */}
      {isProps && tab === "owned" && myProps.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-green-600/10 border border-emerald-500/20 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm text-zinc-400">Property Rent</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{formatCoins(myProps.reduce((sum, p) => sum + (p.rental_income || 0), 0))}</p>
              <p className="text-xs text-zinc-500">From {myProps.length} properties</p>
            </div>
            <button onClick={collectRent} disabled={!canCollectRent || collectingRent}
              className="bg-[#00c853] text-black px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
              {collectingRent ? "..." : canCollectRent ? "Collect" : "On Cooldown"}
            </button>
          </div>
        </div>
      )}

      {/* Empty states */}
      {filtered.length === 0 && (
        <div className="text-center py-8">
          {isProps ? <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" /> : <Car className="w-12 h-12 text-zinc-600 mx-auto mb-3" />}
          <p className="text-zinc-400">
            {tab === "market"
              ? `No ${isProps ? "properties" : "vehicles"} listed on the market yet${filter !== "all" ? " in this category" : ""} — list the first one!`
              : `You don't own any ${isProps ? "properties" : "vehicles"} yet.`}
          </p>
        </div>
      )}

      {/* Listing cards */}
      <div className="space-y-3">
        {filtered.map(item => isProps ? (
          <div key={item.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {item.photo_url && <img src={item.photo_url} alt={item.name} className="w-full h-40 object-cover" />}
            <div className="p-4">
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-medium">{item.type}</span>
              <h3 className="font-semibold text-white mt-1">{item.name}</h3>
              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {item.location}</p>
              {item.owner_name && <p className="text-[11px] text-zinc-600 mt-0.5">Owner: {item.owner_name}</p>}
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-lg font-bold text-yellow-400">{formatCoins(item.market_value)}</p>
                  {item.rental_income > 0 && <p className="text-xs text-[#00c853]">Rent: {formatCoins(item.rental_income)}/mo</p>}
                </div>
                {tab === "market" && item.for_sale && (
                  <button onClick={() => buyProperty(item)} disabled={buying === item.id || !profile || (profile?.e_coins || 0) < item.market_value || item.owner_id === profile?.player_id}
                    className="bg-gradient-to-r from-red-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50">
                    <ShoppingCart className="w-4 h-4" /> {item.owner_id === profile?.player_id ? "Your Listing" : "Buy"}
                  </button>
                )}
                {tab === "owned" && (
                  <button onClick={() => toggleSale(item)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1
                      ${item.for_sale ? "bg-zinc-800 text-green-400 border border-green-500/30" : "bg-gradient-to-r from-red-500 to-yellow-500 text-white"}`}>
                    <Tag className="w-4 h-4" /> {item.for_sale ? "Cancel Sale" : "Sell"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key={item.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {item.photo_url && <img src={item.photo_url} alt={item.name} className="w-full h-40 object-cover" />}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-medium">{item.category}</span>
                <span className="text-[10px] text-zinc-500">{item.brand}</span>
              </div>
              <h3 className="font-semibold text-white">{item.name}</h3>
              <p className="text-xs text-zinc-500">{item.model}</p>
              {item.owner_name && <p className="text-[11px] text-zinc-600 mt-0.5">Owner: {item.owner_name}</p>}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-yellow-400 flex items-center gap-1"><Star className="w-3 h-3" /> {item.prestige || 0}</span>
                <span className="text-xs text-zinc-500 flex items-center gap-1"><Wrench className="w-3 h-3" /> {formatCoins(item.maintenance_cost || 0)}/mo</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-lg font-bold text-yellow-400">{formatCoins(item.price)}</p>
                {tab === "market" && item.for_sale && (
                  <button onClick={() => buyVehicle(item)} disabled={buying === item.id || !profile || (profile?.e_coins || 0) < item.price || item.owner_id === profile?.player_id}
                    className="bg-gradient-to-r from-red-500 to-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50">
                    <ShoppingCart className="w-4 h-4" /> {item.owner_id === profile?.player_id ? "Your Listing" : "Buy"}
                  </button>
                )}
                {tab === "owned" && (
                  <button onClick={() => toggleSale(item)}
                    className={`text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1
                      ${item.for_sale ? "bg-zinc-800 text-green-400 border border-green-500/30" : "bg-gradient-to-r from-red-500 to-yellow-500 text-white"}`}>
                    <Tag className="w-4 h-4" /> {item.for_sale ? "Cancel Sale" : "Sell"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}