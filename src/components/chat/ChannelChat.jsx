
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send } from "lucide-react";

// Realtime group chat over a ChatMessage channel — shared by the party
// group chat (PartyHQ) and the alliance chat (seat sharing).
export default function ChannelChat({ channel, meId, meName, heightClass = "h-64" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!channel) return;
    loadChat();
    const unsub = base44.entities.ChatMessage.subscribe(e => {
      if (e.data?.channel === channel) loadChat();
    });
    return unsub;
  }, [channel]);

  async function loadChat() {
    const msgs = await base44.entities.ChatMessage.filter({ channel }).catch(() => []);
    setMessages([...msgs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function send() {
    if (!input.trim()) return;
    await base44.entities.ChatMessage.create({
      channel,
      sender_id: meId || "guest",
      sender_name: meName || "Guest",
      message: input.trim(),
      message_type: "text",
    });
    setInput("");
    // Close the on-screen keyboard after sending.
    document.activeElement?.blur?.();
    loadChat();
  }

  return (
    <div className="flex flex-col">
      <div className={`${heightClass} overflow-y-auto space-y-2 pr-1`}>
        {messages.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-6">No messages yet — say hello!</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === meId ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl p-2 ${m.sender_id === meId ? "bg-orange-500/20" : "bg-zinc-800"}`}>
              {m.sender_id !== meId && <p className="text-[10px] font-medium text-amber-400">{m.sender_name}</p>}
              <p className="text-[11px] text-white break-words">{m.message}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
        <button onClick={send} disabled={!input.trim()}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-3 disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}