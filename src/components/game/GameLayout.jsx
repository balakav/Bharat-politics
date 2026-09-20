
import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "@/components/game/BottomNav";
import { ArrowLeft } from "lucide-react";

// Global back button: every screen can go back to the previous page.
// Hidden on the six bottom-nav root screens (they have nowhere to go back to).

const ROOT_PATHS = ["/", "/parliament", "/nation", "/elections", "/news", "/profile"];

export default function GameLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const canGoBack = typeof window.history.state?.idx === "number" && window.history.state.idx > 0;
  const showBack = !ROOT_PATHS.includes(pathname) && canGoBack;

  return (
    <div className={`min-h-screen bg-zinc-950 text-white pb-20 ${showBack ? "pt-16" : ""}`}>
      {showBack && (
        <button type="button" onClick={() => navigate(-1)}
          className="fixed top-2 left-2 z-40 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full pl-3.5 pr-5 py-2.5 hover:border-zinc-700 active:scale-95 transition-all shadow-lg">
          <ArrowLeft className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-medium text-zinc-300">Back</span>
        </button>
      )}
      <Outlet />
      <BottomNav />
    </div>
  );
}