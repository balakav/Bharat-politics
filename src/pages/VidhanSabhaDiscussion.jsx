import React, { useState, useEffect, useRef } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { useNavigate } from "react-router-dom";
import SeatingGrid from "@/components/vidhan-sabha/SeatingGrid";
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Send, Gavel,
  Check, X, Minus, Sparkles, MessageSquare, Loader2
} from "lucide-react";

const CHANNEL = "vidhan_sabha_discussion";
const VOTE_CHANNEL = "vs_vote";
const SESSION_CHANNEL = "vs_session";
const JITSI_ROOM = "https://meet.jit.si/tn-vidhan-sabha";

export default function VidhanSabhaDiscussion() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [mlas, setMlas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [sessionState, setSessionState] = useState("idle");
  const [currentMotion, setCurrentMotion] = useState("");
  const [votes, setVotes] = useState({});
  const [motionInput, setMotionInput] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [askingAi, setAskingAi] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const me = await bharat01.auth.me();
    const [profiles, elections] = await Promise.all([
      bharat01.entities.PlayerProfile.filter({ created_by_id: me.id }),
      bharat01.entities.Election.filter({ election_type: "vidhan_sabha", results_declared: true }),
    ]);

    if (profiles.length > 0) {
      const p = profiles[0];
      setProfile(p);
      await bharat01.entities.PlayerProfile.update(p.id, { last_active: new Date().toISOString() });

      const latestElection = elections.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      if (latestElection) {
        const winners = await bharat01.entities.Candidature.filter(
          { election_id: latestElection.id, result: "won" },
          "-votes_received",
          500
        );
        setMlas(winners);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    loadMessages();
    loadVotes();
    loadSessionState();
    const unsubscribe = bharat01.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel === CHANNEL) {
        loadMessages();
      } else if (event.data?.channel === VOTE_CHANNEL) {
        loadVotes();
      } else if (event.data?.channel === SESSION_CHANNEL) {
        loadSessionState();
      }
    });
    return unsubscribe;
  }, [profile]);

  async function loadMessages() {
    const msgs = await bharat01.entities.ChatMessage.filter({ channel: CHANNEL });
    msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setMessages(msgs);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function loadVotes() {
    const voteMsgs = await bharat01.entities.ChatMessage.filter({ channel: VOTE_CHANNEL });
    const voteMap = {};
    voteMsgs.forEach(v => {
      const parts = v.message.split("|");
      if (parts.length === 2) voteMap[parts[0]] = parts[1];
    });
    setVotes(voteMap);
  }

  async function loadSessionState() {
    const sessionMsgs = await bharat01.entities.ChatMessage.filter({ channel: SESSION_CHANNEL });
    if (sessionMsgs.length === 0) return;
    const latest = sessionMsgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    const parts = latest.message.split("|");
    if (parts[0] === "OPEN") {
      setSessionState("open");
      setCurrentMotion("");
    } else if (parts[0] === "VOTE_START") {
      setSessionState("voting");
      setCurrentMotion(parts.slice(1).join("|"));
      loadVotes();
    } else if (parts[0] === "VOTE_END") {
      setSessionState("open");
      setCurrentMotion("");
    }
  }

  const isMLA = mlas.some(m => m.player_id === profile?.player_id);
  const speaker = mlas.length > 0
    ? mlas.reduce((a, b) => (a.votes_received || 0) > (b.votes_received || 0) ? a : b)
    : null;
  const isSpeaker = speaker?.player_id === profile?.player_id;

  async function sendMessage() {
    if (!input.trim() || !profile) return;
    const msg = input.trim();
    setInput("");
    await bharat01.entities.ChatMessage.create({
      channel: CHANNEL,
      sender_id: profile.player_id,
      sender_name: profile.username,
      sender_photo: profile.photo_url || "",
      message: msg,
      message_type: "text",
    });
  }

  async function openSession() {
    setSessionState("open");
    await bharat01.entities.ChatMessage.create({
      channel: SESSION_CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: "OPEN", message_type: "system",
    });
    await bharat01.entities.ChatMessage.create({
      channel: CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: "Session opened. MLAs may now speak.", message_type: "system",
    });
  }

  async function startVote() {
    if (!motionInput.trim()) return;
    const motion = motionInput.trim();
    setCurrentMotion(motion);
    setSessionState("voting");
    setVotes({});
    await bharat01.entities.ChatMessage.create({
      channel: SESSION_CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: `VOTE_START|${motion}`, message_type: "system",
    });
    await bharat01.entities.ChatMessage.create({
      channel: CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: `Voting started: "${motion}". MLAs, cast your vote.`, message_type: "system",
    });
    setMotionInput("");
  }

  async function castVote(vote) {
    if (!profile || sessionState !== "voting") return;
    await bharat01.entities.ChatMessage.create({
      channel: VOTE_CHANNEL, sender_id: profile.player_id, sender_name: profile.username,
      message: `${profile.player_id}|${vote}`, message_type: "system",
    });
    setVotes(prev => ({ ...prev, [profile.player_id]: vote }));
  }

  async function endVote() {
    const yesCount = Object.values(votes).filter(v => v === "yes").length;
    const noCount = Object.values(votes).filter(v => v === "no").length;
    const abstainCount = Object.values(votes).filter(v => v === "abstain").length;
    const result = yesCount > noCount ? "PASSED" : "FAILED";

    setSessionState("open");
    setCurrentMotion("");
    setVotes({});
    await bharat01.entities.ChatMessage.create({
      channel: SESSION_CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: "VOTE_END", message_type: "system",
    });
    await bharat01.entities.ChatMessage.create({
      channel: CHANNEL, sender_id: "system", sender_name: "Speaker",
      message: `Vote ${result} — YES: ${yesCount}, NO: ${noCount}, ABSTAIN: ${abstainCount}`,
      message_type: "system",
    });
  }

  async function askAI() {
    if (!aiQuestion.trim()) return;
    setAskingAi(true);
    try {
      const response = await bharat01.functions.invoke("electionQna", { question: aiQuestion });
      setAiAnswer(response.data?.answer || "No answer available.");
    } catch (e) {
      setAiAnswer("Error fetching answer. Please try again.");
    }
    setAskingAi(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMLA) {
    return (
      <div className="p-4 max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center">
        <Gavel className="w-16 h-16 text-zinc-600 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-zinc-400 text-center text-sm">Only current MLAs can enter this session.</p>
      </div>
    );
  }

  const yesCount = Object.values(votes).filter(v => v === "yes").length;
  const noCount = Object.values(votes).filter(v => v === "no").length;
  const abstainCount = Object.values(votes).filter(v => v === "abstain").length;
  const myVote = votes[profile?.player_id];

  return (
    <div className="flex flex-col h-screen bg-zinc-950 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="font-bold text-white text-sm">Legislative Assembly Discussion</h1>
            <p className="text-xs text-zinc-500">
              {sessionState === "idle" ? "Session not started" :
               sessionState === "open" ? "Session in progress" :
               sessionState === "voting" ? "Voting in progress" : "Results"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCameraOn(!cameraOn)}
            className={`p-2 rounded-lg ${cameraOn ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-500"}`}>
            {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setMicOn(!micOn)}
            className={`p-2 rounded-lg ${micOn ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
            {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video Meeting (Jitsi) */}
      {cameraOn && (
        <div className="bg-black border-b border-zinc-800">
          <iframe
            src={`${JITSI_ROOM}#config.prejoinPageEnabled=false&config.subject=Legislative Assembly Meeting`}
            allow="camera; microphone; autoplay; fullscreen; display-capture"
            style={{ width: "100%", height: "280px", border: "none" }}
            title="Legislative Assembly Video Meeting"
          />
          <p className="text-[10px] text-zinc-500 text-center py-1 bg-zinc-900">
            Video powered by Jitsi — allow camera & mic when prompted
          </p>
        </div>
      )}

      {/* Speaker Controls */}
      {isSpeaker && (
        <div className="p-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-medium">Speaker</span>
          {sessionState === "idle" && (
            <button onClick={openSession} className="ml-auto bg-gradient-to-r from-red-500 to-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              Open Session
            </button>
          )}
          {sessionState === "open" && (
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                value={motionInput}
                onChange={e => setMotionInput(e.target.value)}
                placeholder="Enter motion..."
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs w-32 focus:outline-none focus:border-red-500"
              />
              <button onClick={startVote} disabled={!motionInput.trim()}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
                Start Vote
              </button>
            </div>
          )}
          {sessionState === "voting" && (
            <button onClick={endVote} className="ml-auto bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              End Vote
            </button>
          )}
        </div>
      )}

      {/* Seating Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <SeatingGrid mlas={mlas} speaker={speaker} currentPlayerId={profile?.player_id} />
      </div>

      {/* Voting Panel */}
      {sessionState === "voting" && (
        <div className="p-3 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-yellow-400 font-medium mb-2">Motion: {currentMotion}</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 text-center">
              <p className="text-xs text-zinc-500">YES</p>
              <p className="text-lg font-bold text-green-400">{yesCount}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-zinc-500">NO</p>
              <p className="text-lg font-bold text-red-400">{noCount}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-zinc-500">ABSTAIN</p>
              <p className="text-lg font-bold text-zinc-400">{abstainCount}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => castVote("yes")} disabled={myVote === "yes"}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 ${myVote === "yes" ? "bg-green-500/30 text-green-400 border border-green-500/50" : "bg-green-600 text-white"}`}>
              <Check className="w-4 h-4" /> Yes
            </button>
            <button onClick={() => castVote("no")} disabled={myVote === "no"}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 ${myVote === "no" ? "bg-red-500/30 text-red-400 border border-red-500/50" : "bg-red-600 text-white"}`}>
              <X className="w-4 h-4" /> No
            </button>
            <button onClick={() => castVote("abstain")} disabled={myVote === "abstain"}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 ${myVote === "abstain" ? "bg-zinc-700/50 text-zinc-400 border border-zinc-600" : "bg-zinc-700 text-zinc-300"}`}>
              <Minus className="w-4 h-4" /> Abstain
            </button>
          </div>
        </div>
      )}

      {/* Bottom Tabs */}
      <div className="flex border-t border-zinc-800 bg-zinc-900">
        <button onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${activeTab === "chat" ? "text-yellow-400 border-t-2 border-yellow-400" : "text-zinc-500"}`}>
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button onClick={() => setActiveTab("ask")}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 ${activeTab === "ask" ? "text-yellow-400 border-t-2 border-yellow-400" : "text-zinc-500"}`}>
          <Sparkles className="w-4 h-4" /> Ask AI
        </button>
      </div>

      {/* Chat / Ask AI Panel */}
      <div className="h-64 border-t border-zinc-800 bg-zinc-900 flex flex-col">
        {activeTab === "chat" ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-4">No messages yet</p>
              ) : (
                messages.map(m => {
                  const isMe = m.sender_id === profile?.player_id;
                  const isSystem = m.message_type === "system";
                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center">
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">{m.message}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl p-2.5 ${isMe ? "bg-red-500/20" : "bg-zinc-800"}`}>
                        {!isMe && <p className="text-xs font-medium text-yellow-400 mb-0.5">{m.sender_name}</p>}
                        <p className="text-sm text-white">{m.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-zinc-800 flex gap-2 safe-area-bottom">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Message..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              />
              <button onClick={sendMessage} disabled={!input.trim()}
                className="bg-gradient-to-r from-red-500 to-yellow-500 text-white rounded-xl px-3 py-2 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col p-3">
            <p className="text-xs text-zinc-500 mb-2">Ask about election results (MLA, Nagarsevak, Nagaradhyaksh, Sarpanch)</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && askAI()}
                placeholder="e.g. Who is the MLA of Chennai?"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
              />
              <button onClick={askAI} disabled={!aiQuestion.trim() || askingAi}
                className="bg-gradient-to-r from-red-500 to-yellow-500 text-white rounded-xl px-3 py-2 disabled:opacity-50">
                {askingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
            {aiAnswer && (
              <div className="bg-zinc-800 rounded-xl p-3 text-sm text-zinc-300 overflow-y-auto flex-1">
                {aiAnswer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}