import React, { useState, useEffect, useRef } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Globe, Users, Lock } from "lucide-react";

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState(null);
  const [channel, setChannel] = useState("global");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [channel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadData() {
    const me = await bharat01.auth.me();
    const [profiles, msgs] = await Promise.all([
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.ChatMessage.filter({ channel }, '-created_date', 50),
    ]);
    if (profiles.length > 0) setProfile(profiles[0]);
    setMessages(msgs.reverse());
  }

  useEffect(() => {
    const unsub = bharat01.entities.ChatMessage.subscribe(event => {
      if (event.type === "create" && event.data.channel === channel) {
        setMessages(prev => [...prev, event.data]);
      }
    });
    return unsub;
  }, [channel]);

  async function sendMessage() {
    if (!input.trim() || !profile || sending) return;
    setSending(true);
    await bharat01.entities.ChatMessage.create({
      channel,
      sender_id: profile.player_id,
      sender_name: profile.username,
      sender_photo: profile.photo_url || "",
      message: input.trim(),
      message_type: "text",
    });
    setInput("");
    setSending(false);
  }

  const channels = [
    { key: "global", label: "Global", icon: Globe },
    { key: "party", label: "Party", icon: Users },
  ];

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
        <h1 className="text-lg font-bold text-white flex-1">Chat</h1>
        <div className="flex gap-1">
          {channels.map(ch => (
            <button key={ch.key} onClick={() => setChannel(ch.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1
                ${channel === ch.key ? "bg-red-500/20 text-yellow-400" : "bg-zinc-800 text-zinc-500"}`}>
              <ch.icon className="w-3 h-3" /> {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const isMe = msg.sender_id === profile?.player_id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMe ? "bg-red-500/20 border border-red-500/20" : "bg-zinc-800 border border-zinc-700"}`}>
                {!isMe && <p className="text-xs text-yellow-400 font-semibold mb-0.5">{msg.sender_name}</p>}
                <p className="text-sm text-white">{msg.message}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800 pb-20">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="bg-gradient-to-r from-red-500 to-yellow-500 text-white rounded-xl px-4 disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}