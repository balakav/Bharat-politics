import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { formatCoins } from "@/lib/gameData";
import { ArrowLeft, Search, Send, ArrowDownLeft, ArrowUpRight, Smartphone, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UPI() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiverId, setReceiverId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const me = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
    if (profiles.length === 0) { setLoading(false); return; }
    const myProfile = profiles[0];
    setProfile(myProfile);

    const [allProfiles, sent, received] = await Promise.all([
      base44.entities.PlayerProfile.list('-created_date', 100),
      base44.entities.Transaction.filter({ sender_id: myProfile.player_id }),
      base44.entities.Transaction.filter({ receiver_id: myProfile.player_id }),
    ]);
    setContacts(allProfiles.filter(p => p.player_id !== myProfile.player_id));
    const allTxns = [...sent, ...received].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    setTransactions(allTxns);
    setLoading(false);
  }

  async function sendMoney() {
    setError("");
    const amt = parseInt(amount);
    if (!receiverId.trim()) { setError("Enter a valid Player ID"); return; }
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > (profile?.e_coins || 0)) { setError("Insufficient balance"); return; }

    const receiver = contacts.find(c => c.player_id === receiverId.trim());
    if (!receiver) { setError("Player not found. Check the ID."); return; }

    setSending(true);
    await base44.entities.PlayerProfile.update(profile.id, {
      e_coins: (profile.e_coins || 0) - amt,
      net_worth: (profile.net_worth || 0) - amt,
    });
    await base44.entities.PlayerProfile.update(receiver.id, {
      e_coins: (receiver.e_coins || 0) + amt,
      net_worth: (receiver.net_worth || 0) + amt,
    });
    await base44.entities.Transaction.create({
      sender_id: profile.player_id,
      sender_name: profile.username,
      receiver_id: receiver.player_id,
      receiver_name: receiver.username,
      amount: amt,
      note: note.trim(),
      transaction_type: "transfer",
    });
    setSending(false);
    setReceiverId("");
    setAmount("");
    setNote("");
    setSelectedContact(null);
    loadData();
  }

  const filteredContacts = search
    ? contacts.filter(c =>
        c.username?.toLowerCase().includes(search.toLowerCase()) ||
        c.player_id?.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">

      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">UPI</h1>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-orange-500/20 to-yellow-400/10 border border-orange-500/30 rounded-2xl p-5 mb-6">
        <p className="text-sm text-zinc-400">Available Balance</p>
        <p className="text-3xl font-bold text-white mt-1">{formatCoins(profile?.e_coins || 0)}</p>
        <p className="text-xs text-zinc-500 mt-1">Your ID: {profile?.player_id}</p>
      </div>

      {/* Send Money */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-yellow-400" /> Send Money
        </h2>
        {selectedContact && (
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2 mb-3">
            <UserCheck className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white">{selectedContact.username}</span>
            <span className="text-xs text-zinc-500">({selectedContact.player_id})</span>
            <button onClick={() => { setSelectedContact(null); setReceiverId(""); }}
              className="ml-auto text-zinc-500 hover:text-red-400 text-xs">✕</button>
          </div>
        )}
        <div className="space-y-3">
          <input
            type="text"
            value={receiverId}
            onChange={e => { setReceiverId(e.target.value); setSelectedContact(null); }}
            placeholder="Enter Player ID"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={sendMoney} disabled={sending}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send Money"}
          </button>
        </div>
      </div>

      {/* Contacts */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contacts</h2>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ID..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </div>
      <div className="space-y-1 mb-6 max-h-60 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-4">No contacts found</p>
        ) : (
          filteredContacts.slice(0, 20).map(c => (
            <button key={c.id}
              onClick={() => { setSelectedContact(c); setReceiverId(c.player_id); window.scrollTo(0, 0); }}
              className="w-full flex items-center gap-3 bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all text-left">
              <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-bold text-white">
                {c.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{c.username}</p>
                <p className="text-xs text-zinc-500">{c.player_id}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Transaction History */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Transaction History</h2>
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-4">No transactions yet</p>
        ) : (
          transactions.map(t => {
            const isCredit = t.receiver_id === profile?.player_id;
            return (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  {isCredit ? <ArrowDownLeft className="w-5 h-5 text-green-400" /> : <ArrowUpRight className="w-5 h-5 text-red-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{isCredit ? t.sender_name : t.receiver_name}</p>
                  <p className="text-xs text-zinc-500">{t.note || (isCredit ? "Received" : "Sent")} · {new Date(t.created_date).toLocaleDateString()}</p>
                </div>
                <p className={`text-sm font-bold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                  {isCredit ? "+" : "-"}{formatCoins(t.amount)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}