import { useState, useEffect } from "react";
import { bharat01 } from "@/api/bharat01Client";
import { resolvePlayerRole } from "@/lib/permissions";

// Resolves the current player's political role once per mount.
// Returns { primary, positions, loading }.
export function usePlayerRole() {
  const [role, setRole] = useState({
    primary: { role: "citizen", label: "Citizen" },
    positions: [],
    loading: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await bharat01.auth.me();
        const profiles = await bharat01.entities.PlayerProfile.filter({ created_by_id: me.id });
        const profile = profiles[0];
        const resolved = await resolvePlayerRole(profile, me.id);
        if (!active) return;
        setRole({ ...resolved, loading: false });
      } catch (e) {
        if (active) setRole({ primary: { role: "citizen", label: "Citizen" }, positions: [], loading: false });
      }
    })();
    return () => { active = false; };
  }, []);

  return role;
}