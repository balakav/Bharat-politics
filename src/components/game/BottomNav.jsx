
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Landmark, Newspaper, User, Globe2, Vote } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/parliament", icon: Landmark, label: "Parliament" },
  { path: "/nation", icon: Globe2, label: "Nation" },
  { path: "/elections", icon: Vote, label: "Elections" },
  { path: "/news", icon: Newspaper, label: "News" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all min-w-0 flex-1
                ${active ? "text-amber-400" : "text-zinc-500 hover:text-zinc-400"}`}
            >
              <span className={`flex items-center justify-center w-10 h-7 rounded-full transition-all
                ${active ? "bg-gradient-to-r from-orange-500/25 to-yellow-400/25" : ""}`}>
                <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" : ""}`} />
              </span>
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}