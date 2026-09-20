import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
        const me = await base44.auth.me();
        const profiles = await base44.entities.PlayerProfile.filter({ created_by_id: me.id });
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