
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckSquare, AlertTriangle, Users, Vote, Newspaper } from "lucide-react";

// Header notification bell: the badge counts pending activity; the panel lists
// today's ticket requests, tasks, investigation alerts, live elections and news.

export default function NotificationBell({ overview = {}, news = [], pendingTickets = 0, partyId }) {
  const [open, setOpen] = useState(false);
  const total = (overview.tasks || 0) + (overview.alerts || 0) + (overview.meetings || 0) + pendingTickets;

  const items = [];
  if (pendingTickets > 0) items.push({ icon: Users, label: `${pendingTickets} pending party ticket request${pendingTickets > 1 ? "s" : ""}`, path: partyId ? `/parties/${partyId}` : "", color: "#fbbf24" });
  if ((overview.tasks || 0) > 0) items.push({ icon: CheckSquare, label: `${overview.tasks} open task${overview.tasks > 1 ? "s" : ""}`, path: "/tasks", color: "#f59e0b" });
  if ((overview.alerts || 0) > 0) items.push({ icon: AlertTriangle, label: `${overview.alerts} active investigation alert${overview.alerts > 1 ? "s" : ""}`, path: "/legal", color: "#fb7185" });
  if ((overview.meetings || 0) > 0) items.push({ icon: Vote, label: `${overview.meetings} election voting live now`, path: "/elections", color: "#f97316" });
  for (const n of news.slice(0, 3)) items.push({ icon: Newspaper, label: n.title, path: "/news", color: "#fb923c" });

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center hover:border-zinc-700">
        <Bell className="w-5 h-5 text-amber-400" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {total}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-xl">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold px-2 py-1">Notifications</p>
            {items.length === 0 && <p className="text-xs text-zinc-500 text-center py-4">You're all caught up</p>}
            {items.map((it, i) => {
              const Icon = it.icon;
              const content = (
                <div className="flex items-start gap-2.5 px-2 py-2 hover:bg-zinc-800/60 rounded-xl">
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: it.color }} />
                  <p className="text-[11px] text-zinc-200 leading-snug line-clamp-2">{it.label}</p>
                </div>
              );
              return it.path
                ? <Link key={i} to={it.path} onClick={() => setOpen(false)} className="block">{content}</Link>
                : <div key={i}>{content}</div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}