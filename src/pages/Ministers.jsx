import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { BHARAT_STATES, getStateById, NATION } from "@/lib/bharatStates";
import { ArrowLeft, MessageCircle, Crown, Send, Globe2, Landmark, Loader, Bot } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const positionLabel = (p) => ({ pm: "PM", cm: "CM", speaker: "Speaker", deputy_cm: "Deputy CM", union_minister: "Union Minister", minister: "Minister" }[p] || "Minister");

export default function Ministers() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("NAT");
  const [loading, setLoading] = useState(true);
  const [ministers, setMinisters] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  const loadData = useCallback(async () => {
    const isNat = selected === "NAT";
    const stateId = isNat ? "" : selected;
    const scope = isNat ? "national" : "state";
    const govs = await base44.entities.Government.filter({ type: scope, is_active: true }, "-created_date", 50);
    const gov = govs.find(g => isNat ? g.type === "national" : g.state_id === stateId) || govs[0];
    let mins = [];
    if (gov) mins = await base44.entities.Minister.filter({ government_id: gov.id, is_active: true });
    setMinisters(mins);
    setLoading(false);
  }, [selected]);

  useEffect(() => { setLoading(true); setActive(null); setMessages([]); loadData(); }, [loadData]);
  useAutoRefresh(loadData, 30000);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, typing]);

  const isNat = selected === "NAT";
  const state = isNat ? null : getStateById(selected);
  const scopeName = isNat ? NATION.name : state?.name;

  async function send() {
    const text = input.trim();
    if (!text || !active || typing) return;
    const userMsg = { role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setTyping(true);
    try {
      const res = await base44.functions.invoke("ministerChat", {
        minister: { player_name: active.player_name, position: active.position, portfolio: active.portfolio, party_name: active.party_name },
        scopeName,
        history: next.map(m => ({ role: m.role, text: m.text })),
      });
      const reply = res.data?.reply || "(The minister is unavailable right now.)";
      setMessages([...next, { role: "assistant", text: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", text: "(The minister is unavailable right now.)" }]);
    } finally { setTyping(false); }
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Minister Chat</h1>
      </div>
      <p className="text-xs text-zinc-500 mb-3">Talk directly with your elected ministers. Each responds in character.</p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setSelected("NAT")} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${selected === "NAT" ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}><Globe2 className="w-3 h-3" /> National</button>
        {BHARAT_STATES.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selected === s.id ? "bg-red-500/20 text-yellow-400 border border-red-500/30" : "bg-zinc-800 text-zinc-500"}`}>{s.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>
      ) : ministers.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 text-center">
          <Landmark className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-white">No government formed yet</p>
          <p className="text-xs text-zinc-500 mt-1">Ministers appear after an election completes and the Governor AI forms a government.</p>
        </div>
      ) : active ? (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500/15 to-yellow-500/15 p-3 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full flex items-center justify-center"><Crown className="w-5 h-5 text-white" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{active.player_name}</p>
              <p className="text-[11px] text-zinc-400">{active.portfolio} · {positionLabel(active.position)} · {active.party_name}</p>
            </div>
            <button onClick={() => { setActive(null); setMessages([]); }} className="text-[11px] text-zinc-500">Close</button>
          </div>
          <div ref={scrollRef} className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
            {messages.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">Ask {active.player_name} anything about {active.portfolio}…</p>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-gradient-to-r from-red-500 to-yellow-500 text-white" : "bg-zinc-800 text-zinc-200"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {typing && <div className="flex justify-start"><div className="bg-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-500 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> typing…</div></div>}
          </div>
          <div className="p-3 border-t border-zinc-800 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Message ${active.player_name}…`} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
            <button onClick={send} disabled={typing || !input.trim()} className="bg-gradient-to-r from-red-500 to-yellow-500 text-white px-3 rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {ministers.map(m => (
            <button key={m.id} onClick={() => { setActive(m); setMessages([]); }} className="w-full bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                {m.position === "cm" || m.position === "pm" ? <Crown className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{m.player_name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{m.portfolio} · {m.party_name}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 uppercase flex-shrink-0">{positionLabel(m.position)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}