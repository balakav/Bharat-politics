
import React, { useState, useMemo } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { Users, Send, CheckCircle, AlertTriangle } from "lucide-react";

// Bulk test-user creation: invites N test players at once using Gmail-style
// plus-addressing (you@gmail.com → you+test1@gmail.com … you+testN@gmail.com),
// so all test accounts land in the admin's own inbox.

function plusAlias(email, tag) {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return `${email.slice(0, at)}+${tag}${email.slice(at)}`;
}

export default function TestUsers() {
  const [baseEmail, setBaseEmail] = useState("");
  const [count, setCount] = useState(3);
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  const generated = useMemo(() => {
    const list = [];
    for (let i = 1; i <= count; i++) list.push(plusAlias(baseEmail.trim(), `test${i}`));
    return list;
  }, [baseEmail, count]);

  async function inviteAll() {
    setBusy(true); setResults([]);
    for (const email of generated) {
      if (!email) continue;
      try {
        await bharat01.users.inviteUser(email, role);
        setResults(r => [...r, { email, ok: true }]);
      } catch (e) {
        setResults(r => [...r, { email, ok: false, error: e.message || "failed" }]);
      }
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-yellow-400" />
        <p className="text-xs text-zinc-400">Create multiple test users at once. Enter your own email — we generate +test1, +test2… aliases (Gmail-style), so every invite lands in your inbox.</p>
      </div>
      <div className="space-y-2 mb-3">
        <input type="email" value={baseEmail} onChange={e => setBaseEmail(e.target.value)} placeholder="yourname@gmail.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white" />
        <div className="flex gap-2">
          <select value={count} onChange={e => setCount(Number(e.target.value))} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} test user{n > 1 ? "s" : ""}</option>)}
          </select>
          <select value={role} onChange={e => setRole(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="user">Player (user)</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {baseEmail.includes("@") && (
        <div className="bg-zinc-800/40 rounded-xl p-3 mb-3">
          <p className="text-[10px] text-zinc-500 uppercase mb-1.5">These accounts will be invited:</p>
          {generated.map(e => <p key={e} className="text-[11px] text-zinc-400 truncate">{e || "—"}</p>)}
        </div>
      )}

      <button onClick={inviteAll} disabled={busy || !baseEmail.includes("@")}
        className="w-full bg-gradient-to-r from-red-500 to-yellow-500 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
        <Send className="w-4 h-4" /> {busy ? "Inviting…" : `Invite ${count} Test User${count > 1 ? "s" : ""}`}
      </button>

      {results.length > 0 && (
        <div className="mt-3 space-y-1">
          {results.map(r => (
            <div key={r.email} className={`flex items-center gap-2 rounded-lg p-2 text-[11px] ${r.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {r.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span className="truncate flex-1">{r.email}</span>
              <span>{r.ok ? "invited" : (r.error || "failed")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}