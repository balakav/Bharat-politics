import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, Ban, Trash2, Check, CheckCheck, Phone, Video,
  MoreVertical, Search, Camera, Settings, Sparkles, X, Loader2, UserPlus
} from "lucide-react";

const AI_ASSISTANT_ID = "AI_ASSISTANT";
const AI_ASSISTANT_NAME = "Election AI Assistant";

function Avatar({ photo_url, name, size = 40, isAI }) {
  if (photo_url) {
    return (
      <img src={photo_url} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: isAI ? "#8B5CF6" : "#F97316", fontSize: size * 0.4 }}>
      {isAI ? <Sparkles className="w-1/2 h-1/2" /> : (name?.charAt(0)?.toUpperCase() || "?")}
    </div>
  );
}

function isOnline(lastActive) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
}

export default function PrivateMessages() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [allMessages, setAllMessages] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list, chat, profile, contacts
  const [showOptions, setShowOptions] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callType, setCallType] = useState("audio"); // audio or video
  const [search, setSearch] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [uploadingDP, setUploadingDP] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await base44.auth.me();
    const [profiles, allProfiles] = await Promise.all([
      base44.entities.PlayerProfile.filter({ created_by_id: me.id }),
      base44.entities.PlayerProfile.list(),
    ]);
    if (profiles.length > 0) {
      const p = profiles[0];
      setProfile(p);
      await base44.entities.PlayerProfile.update(p.id, { last_active: new Date().toISOString() });
    }
    setAllPlayers(allProfiles);
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadMessages();
    const unsubscribe = base44.entities.PrivateMessage.subscribe(() => {
      loadMessages();
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (activeChat) {
      loadMessages();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [activeChat]);

  async function loadMessages() {
    if (!profile) return;
    const [sent, received] = await Promise.all([
      base44.entities.PrivateMessage.filter({ sender_id: profile.player_id }),
      base44.entities.PrivateMessage.filter({ receiver_id: profile.player_id }),
    ]);
    const all = [...sent, ...received].filter(m => !(m.hidden_for || []).includes(profile.player_id));
    all.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setAllMessages(all);

    const unread = received.filter(m => !m.read && !(m.hidden_for || []).includes(profile.player_id) && m.sender_id === activeChat && m.sender_id !== AI_ASSISTANT_ID);
    for (const msg of unread) {
      await base44.entities.PrivateMessage.update(msg.id, { read: true });
    }
  }

  const conversations = [...new Set(allMessages.map(m =>
    m.sender_id === profile?.player_id ? m.receiver_id : m.sender_id
  ))];

  const chatMessages = allMessages.filter(m =>
    (m.sender_id === profile?.player_id && m.receiver_id === activeChat) ||
    (m.sender_id === activeChat && m.receiver_id === profile?.player_id)
  );

  const blockedPlayers = profile?.blocked_players || [];

  async function sendMessage() {
    if (!input.trim() || !profile || !activeChat) return;
    const msg = input.trim();
    setInput("");
    const receiver = activeChat === AI_ASSISTANT_ID
      ? { username: AI_ASSISTANT_NAME }
      : allPlayers.find(p => p.player_id === activeChat);

    await base44.entities.PrivateMessage.create({
      sender_id: profile.player_id,
      sender_name: profile.username,
      receiver_id: activeChat,
      receiver_name: receiver?.username || "Unknown",
      message: msg,
      message_type: "text",
      read: false,
    });

    // If AI Assistant, get response
    if (activeChat === AI_ASSISTANT_ID) {
      setAiThinking(true);
      try {
        const records = await base44.entities.ElectionRecord.list("-election_date", 500);
        const context = records.map(r =>
          `${r.position_title} - ${r.constituency}${r.seat_type && r.seat_type !== "general" ? ` (${r.seat_type})` : ""}: ${r.winner_name} (${r.winner_party}), Votes: ${r.winner_votes}, Runner-up: ${r.runner_up_name || "N/A"}, Margin: ${r.vote_margin}, Date: ${r.election_date}`
        ).join("\n");

        const response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an AI assistant for a Tamil Nadu political simulation game. Answer the following question using ONLY the election data below. If the data doesn't contain the answer, say "No data available for this query." Be concise and conversational.\n\nElection Records:\n${context}\n\nQuestion: ${msg}`,
          response_json_schema: { type: "object", properties: { answer: { type: "string" } } },
        });

        await base44.entities.PrivateMessage.create({
          sender_id: AI_ASSISTANT_ID,
          sender_name: AI_ASSISTANT_NAME,
          receiver_id: profile.player_id,
          receiver_name: profile.username,
          message: response.answer || "I couldn't find an answer.",
          message_type: "text",
          read: false,
        });
      } catch (e) {
        await base44.entities.PrivateMessage.create({
          sender_id: AI_ASSISTANT_ID,
          sender_name: AI_ASSISTANT_NAME,
          receiver_id: profile.player_id,
          receiver_name: profile.username,
          message: "Sorry, I couldn't process your request right now.",
          message_type: "text",
          read: false,
        });
      }
      setAiThinking(false);
    }
  }

  async function changeDP(file) {
    if (!file || !profile) return;
    setUploadingDP(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.PlayerProfile.update(profile.id, { photo_url: file_url });
      setProfile(prev => ({ ...prev, photo_url: file_url }));
    } catch (e) {
      console.error("Failed to upload DP:", e);
    }
    setUploadingDP(false);
  }

  async function blockPlayer() {
    if (!activeChat || !profile || activeChat === AI_ASSISTANT_ID) return;
    const updated = [...new Set([...(profile.blocked_players || []), activeChat])];
    await base44.entities.PlayerProfile.update(profile.id, { blocked_players: updated });
    setProfile(prev => ({ ...prev, blocked_players: updated }));
    setActiveChat(null);
    setView("list");
  }

  async function deleteConversation() {
    if (!activeChat || !profile) return;
    const toHide = allMessages.filter(m =>
      (m.sender_id === profile.player_id && m.receiver_id === activeChat) ||
      (m.sender_id === activeChat && m.receiver_id === profile.player_id)
    );
    for (const msg of toHide) {
      const hiddenFor = [...new Set([...(msg.hidden_for || []), profile.player_id])];
      await base44.entities.PrivateMessage.update(msg.id, { hidden_for: hiddenFor });
    }
    setActiveChat(null);
    setView("list");
  }

  function startCall(type) {
    setCallType(type);
    setCalling(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1E1024]">
        <div className="w-10 h-10 border-4 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
      </div>
    );
  }

  // Call overlay
  if (calling) {
    const partner = allPlayers.find(p => p.player_id === activeChat);
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center z-50 max-w-lg mx-auto">
        <Avatar photo_url={partner?.photo_url} name={partner?.username} size={96} />
        <p className="text-white text-xl font-medium mt-4">{partner?.username || "Unknown"}</p>
        <p className="text-zinc-400 text-sm mt-1">{callType === "video" ? "Video calling..." : "Calling..."}</p>
        <button onClick={() => setCalling(false)} className="mt-10 bg-red-600 text-white p-4 rounded-full animate-pulse">
          <Phone className="w-6 h-6" />
        </button>
      </div>
    );
  }

  // Profile view
  if (view === "profile") {
    return (
      <div className="min-h-screen bg-[#1E1024] max-w-lg mx-auto">
        <div className="bg-[#2E1B38] flex items-center gap-3 p-3 border-b border-[#3E2550]">
          <button onClick={() => setView("list")} className="text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-sm">Profile</h1>
        </div>

        <div className="flex flex-col items-center p-8">
          <div className="relative">
            <Avatar photo_url={profile?.photo_url} name={profile?.username} size={128} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDP}
              className="absolute bottom-0 right-0 bg-[#F97316] p-2.5 rounded-full border-2 border-[#1E1024] disabled:opacity-50"
            >
              {uploadingDP ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files[0] && changeDP(e.target.files[0])}
            />
          </div>
          <h2 className="text-white text-xl font-bold mt-4">{profile?.username}</h2>
          <p className="text-zinc-400 text-sm mt-1">{profile?.bio || "No bio"}</p>
          <p className="text-zinc-500 text-xs mt-2">Player ID: {profile?.player_id}</p>
        </div>

        <div className="px-4 space-y-1">
          <div className="bg-[#2E1B38] rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">About</p>
            <p className="text-sm text-white">{profile?.bio || "No bio yet"}</p>
          </div>
          <div className="bg-[#2E1B38] rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Position</p>
            <p className="text-sm text-white">{profile?.position_held || "None"}</p>
          </div>
          <div className="bg-[#2E1B38] rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Party</p>
            <p className="text-sm text-white">{profile?.party_name || "Independent"}</p>
          </div>
        </div>
      </div>
    );
  }

  // Contacts view
  if (view === "contacts") {
    const filteredPlayers = allPlayers
      .filter(p => p.player_id !== profile?.player_id && !blockedPlayers.includes(p.player_id))
      .filter(p => !search || p.username?.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="min-h-screen bg-[#1E1024] max-w-lg mx-auto">
        <div className="bg-[#2E1B38] flex items-center gap-3 p-3 border-b border-[#3E2550] sticky top-0 z-10">
          <button onClick={() => setView("list")} className="text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-sm flex-1">Select Contact</h1>
          <span className="text-xs text-zinc-500">{filteredPlayers.length} players</span>
        </div>

        <div className="p-2">
          <div className="flex items-center gap-2 bg-[#2E1B38] rounded-xl px-3 py-2 mb-3">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            />
          </div>

          <button
            onClick={() => { setActiveChat(AI_ASSISTANT_ID); setView("chat"); setSearch(""); }}
            className="w-full flex items-center gap-3 p-3 hover:bg-[#2E1B38] rounded-xl transition-all"
          >
            <Avatar name={AI_ASSISTANT_NAME} size={48} isAI />
            <div className="flex-1 text-left">
              <h3 className="text-white font-medium text-sm">{AI_ASSISTANT_NAME}</h3>
              <p className="text-xs text-[#F97316]">Ask about election results</p>
            </div>
          </button>

          <p className="text-xs text-zinc-500 px-3 py-2 mt-2">All Players</p>

          {filteredPlayers.map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveChat(p.player_id); setView("chat"); setSearch(""); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#2E1B38] rounded-xl transition-all"
            >
              <Avatar photo_url={p.photo_url} name={p.username} size={48} />
              <div className="flex-1 text-left">
                <h3 className="text-white font-medium text-sm">{p.username}</h3>
                <p className="text-xs text-zinc-500">
                  {isOnline(p.last_active) ? "🟢 Online" : p.position_held || "Player"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Chat view
  if (view === "chat" && activeChat) {
    const chatPartner = activeChat === AI_ASSISTANT_ID
      ? { username: AI_ASSISTANT_NAME, player_id: AI_ASSISTANT_ID }
      : allPlayers.find(p => p.player_id === activeChat);
    const isAI = activeChat === AI_ASSISTANT_ID;
    const isBlocked = blockedPlayers.includes(activeChat);
    const partnerOnline = isOnline(chatPartner?.last_active);

    return (
      <div className="flex flex-col h-screen bg-[#1E1024] max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-[#2E1B38] flex items-center gap-2 p-2 border-b border-[#3E2550]">
          <button onClick={() => { setView("list"); setActiveChat(null); }} className="text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar photo_url={chatPartner?.photo_url} name={chatPartner?.username} size={40} isAI={isAI} />
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-sm truncate">{chatPartner?.username || "Unknown"}</h2>
            <p className="text-xs text-zinc-500 truncate">
              {isAI ? "Powered by GPT + election data" : isBlocked ? "Blocked" : partnerOnline ? "online" : "offline"}
            </p>
          </div>
          {!isBlocked && !isAI && (
            <>
              <button onClick={() => startCall("video")} className="p-2 text-zinc-400 hover:text-white">
                <Video className="w-5 h-5" />
              </button>
              <button onClick={() => startCall("audio")} className="p-2 text-zinc-400 hover:text-white">
                <Phone className="w-5 h-5" />
              </button>
            </>
          )}
          <div className="relative">
            <button onClick={() => setShowOptions(!showOptions)} className="p-2 text-zinc-400 hover:text-white">
              <MoreVertical className="w-5 h-5" />
            </button>
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[#3A2247] rounded-lg shadow-xl border border-[#3E2550] py-1 z-50 min-w-[160px]">
                  {!isAI && (
                    <button onClick={() => { blockPlayer(); setShowOptions(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#251430]">
                      Block
                    </button>
                  )}
                  <button onClick={() => { deleteConversation(); setShowOptions(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#251430]">
                    Delete Chat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1"
          style={{ backgroundImage: "linear-gradient(rgba(30,16,36,0.9), rgba(30,16,36,0.9))" }}>
          {chatMessages.length === 0 ? (
            <div className="text-center py-8">
              {isAI ? (
                <>
                  <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">Ask me about election results!</p>
                  <p className="text-zinc-500 text-xs mt-1">e.g. "Who is the MLA of Chennai?"</p>
                </>
              ) : (
                <p className="text-zinc-500 text-sm">No messages yet. Say hello!</p>
              )}
            </div>
          ) : (
            chatMessages.map(m => {
              const isMe = m.sender_id === profile?.player_id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMe ? "bg-gradient-to-r from-orange-500 to-pink-600 text-white" : "bg-[#2E1B38] text-white"}`}>
                    <p className="text-sm">{m.message}</p>
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      <span className="text-[10px] text-zinc-400">
                        {new Date(m.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMe && (
                        m.read ? <CheckCheck className="w-3 h-3 text-[#F9A8D4]" /> : <Check className="w-3 h-3 text-zinc-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {aiThinking && (
            <div className="flex justify-start">
              <div className="bg-[#2E1B38] rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!isBlocked && (
          <div className="bg-[#2E1B38] p-2 flex items-center gap-2 safe-area-bottom border-t border-[#3E2550]">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={isAI ? "Ask about elections..." : "Message"}
              className="flex-1 bg-[#3E2550] rounded-full px-4 py-2.5 text-white text-sm focus:outline-none"
            />
            <button onClick={sendMessage} disabled={!input.trim() || aiThinking}
              className="bg-[#F97316] text-white rounded-full p-2.5 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Chat list view (default)
  return (
    <div className="min-h-screen bg-[#1E1024] max-w-lg mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#2E1B38] flex items-center justify-between p-3 border-b border-[#3E2550] sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg">Messages</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setView("contacts")} className="p-2 text-zinc-400 hover:text-white">
            <UserPlus className="w-5 h-5" />
          </button>
          <button onClick={() => setView("profile")} className="p-2 text-zinc-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* AI Assistant Banner */}
      <button
        onClick={() => { setActiveChat(AI_ASSISTANT_ID); setView("chat"); }}
        className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-violet-600/10 border-b border-[#3E2550] hover:bg-purple-500/5 transition-all"
      >
        <Avatar name={AI_ASSISTANT_NAME} size={48} isAI />
        <div className="flex-1 text-left">
          <h3 className="text-white font-medium text-sm">{AI_ASSISTANT_NAME}</h3>
          <p className="text-xs text-purple-400">Ask about MLA, Nagarsevak, Nagaradhyaksh, Sarpanch results</p>
        </div>
      </button>

      {/* Conversations */}
      <div className="divide-y divide-[#2A1636]">
        {conversations.filter(c => c !== AI_ASSISTANT_ID).map(pid => {
          const player = allPlayers.find(p => p.player_id === pid);
          const lastMsg = [...allMessages].reverse().find(m =>
            (m.sender_id === pid && m.receiver_id === profile.player_id) ||
            (m.sender_id === profile.player_id && m.receiver_id === pid)
          );
          const unreadCount = allMessages.filter(m =>
            m.sender_id === pid && m.receiver_id === profile.player_id && !m.read
          ).length;
          return (
            <button
              key={pid}
              onClick={() => { setActiveChat(pid); setView("chat"); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#2E1B38] transition-all text-left"
            >
              <Avatar photo_url={player?.photo_url} name={player?.username} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium text-sm truncate">{player?.username || "Unknown"}</h3>
                  {lastMsg && (
                    <span className="text-[10px] text-zinc-500 flex-shrink-0">
                      {new Date(lastMsg.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500 truncate">{lastMsg?.message || "Tap to chat"}</p>
                  {unreadCount > 0 && (
                    <span className="bg-[#F97316] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {conversations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">No conversations yet</p>
            <button onClick={() => setView("contacts")} className="mt-3 text-[#F97316] text-sm font-medium">
              Start a new chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}