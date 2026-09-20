import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Newspaper, Tv, AlertCircle } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function News() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    loadNews();
  }, []);

  useAutoRefresh(refreshNews, 60000);

  async function loadNews() {
    // Only real game events are shown — no randomly generated news.
    await refreshNews();
  }

  async function refreshNews() {
    const items = await base44.entities.NewsItem.list('-created_date', 50);
    // Drop old randomly generated ambient stories — only real game events
    // (elections, laws, protests, deals, parties) are valid news.
    setNews(items.filter(n => (n.related_type || "") !== "ambient"));
    setLoading(false);
  }

  const categories = ["all", "breaking", "election", "politics", "development", "economy", "opinion_poll"];
  const filtered = tab === "all" ? news : news.filter(n => n.category === tab);

  const catColors = {
    breaking: "bg-red-500/20 text-red-400",
    election: "bg-blue-500/20 text-blue-400",
    politics: "bg-purple-500/20 text-purple-400",
    development: "bg-green-500/20 text-green-400",
    economy: "bg-yellow-500/20 text-yellow-400",
    opinion_poll: "bg-cyan-500/20 text-cyan-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Tv className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bharat News</h1>
          <p className="text-xs text-zinc-500">Live game updates from across the Bharat Union</p>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className="text-xs text-red-400 font-semibold">LIVE</span>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {categories.map(c => (
          <button key={c} onClick={() => setTab(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap capitalize
              ${tab === c ? "bg-orange-500/20 text-amber-400 border border-orange-500/30" : "bg-zinc-800 text-zinc-500"}`}>
            {c === "opinion_poll" ? "Opinion Polls" : c}
          </button>
        ))}
      </div>

      {/* News Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Newspaper className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500">No news in this category yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${catColors[item.category] || "bg-zinc-700 text-zinc-400"}`}>
                  {item.category}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(item.created_date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} · {item.source || "TV99"}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-400">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}