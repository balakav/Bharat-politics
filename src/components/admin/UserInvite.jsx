
import React, { useState } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { UserPlus, CheckCircle } from "lucide-react";

export default function UserInvite() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function invite() {
    setBusy(true); setMsg(""); setError("");
    try {
      await bharat01.users.inviteUser(email.trim(), role);
      setMsg(`Invitation sent to ${email}.`);
      setEmail("");
    } catch (e) {
      setError(e.message || "Failed to invite user");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">Invite a new player. They'll receive an email to join the Bharatvarsha Union.</p>
      <div className="space-y-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@example.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white" />
        <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white">
          <option value="user">Player (user)</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={invite} disabled={busy || !email} className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          <UserPlus className="w-4 h-4" /> {busy ? "Sending…" : "Send Invitation"}
        </button>
      </div>
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mt-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /><p className="text-xs text-green-400">{msg}</p></div>}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}