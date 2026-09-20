
import React from "react";
import { Link } from "react-router-dom";
import {
  Map as MapIcon, Crown, Flag, Home as HomeIcon, Briefcase,
  Handshake, Database, Smartphone, Mail, Landmark as LandmarkIcon,
  Share2, Building2, Users, Scale, ShieldCheck, PieChart, Megaphone, Hammer, Building,
} from "lucide-react";

// Dashboard quick actions, grouped into 4 admin-defined sections.
// "System" is rendered only for admins. Colors match the existing dashboard palette.

const CORE_SECTIONS = [
  {
    title: "Govt & Core",
    actions: [
      { icon: MapIcon, label: "States", path: "/states", color: "#fb923c" },
      { icon: Crown, label: "Govt", path: "/government", color: "#fbbf24" },
      { icon: Database, label: "Data", path: "/election-data", color: "#fbbf24" },
      { icon: Building2, label: "Ministries", path: "/ministries", color: "#fb923c" },
      { icon: LandmarkIcon, label: "Parliament", path: "/parliament", color: "#f97316" },
      { icon: Scale, label: "Legal", path: "/legal", color: "#fbbf24" },
      { icon: Hammer, label: "Constituency", path: "/constituency-work", color: "#f59e0b" },
      { icon: Building, label: "My Office", path: "/ministry-office", color: "#fbbf24" },
    ],
  },
  {
    title: "Political",
    actions: [
      { icon: Flag, label: "Parties", path: "/parties", color: "#f97316" },
      { icon: Handshake, label: "Alliance", path: "/alliances", color: "#f59e0b" },
      { icon: Users, label: "PartyHQ", path: "/party-hq", color: "#f59e0b" },
      { icon: PieChart, label: "Seat Share", path: "/seat-sharing", color: "#fb923c" },
      { icon: Megaphone, label: "Protest", path: "/protests", color: "#ef4444" },
    ],
  },
  {
    title: "People & Business",
    actions: [
      { icon: HomeIcon, label: "Assets", path: "/properties", color: "#f97316" },
      { icon: Briefcase, label: "Business", path: "/business", color: "#fb923c" },
      { icon: Share2, label: "Social", path: "/social", color: "#f97316" },
      { icon: Mail, label: "Messages", path: "/messages", color: "#fb923c" },
      { icon: Smartphone, label: "UPI", path: "/upi", color: "#f59e0b" },
    ],
  },
];

const SYSTEM_SECTION = {
  title: "System",
  actions: [
    { icon: ShieldCheck, label: "Admin", path: "/admin", color: "#fbbf24" },
  ],
};

export default function QuickActionSections({ isAdmin }) {
  const sections = isAdmin ? [...CORE_SECTIONS, SYSTEM_SECTION] : CORE_SECTIONS;

  return (
    <div className="space-y-4 mb-5">
      {sections.map(section => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">{section.title}</h2>
          <div className="grid grid-cols-4 gap-3">
            {section.actions.map(({ icon: Icon, label, path, color }) => (
              <Link key={path} to={path} className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 active:scale-95 transition-all">
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <span className="text-[10px] text-zinc-400 font-medium text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}