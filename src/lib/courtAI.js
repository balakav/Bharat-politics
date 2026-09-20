
import { base44 } from "@/api/base44Client";
import { getCurrentGameTime } from "./gameTime";
import { logAction } from "./audit";

// Court AI (spec #16). Advances CourtCases through stages:
// filed → hearing → judgment → closed. Verdict from evidence strength + noise.

export async function fileCourtCase(investigationId, actor) {
  const inv = await base44.entities.Investigation.get(investigationId);
  if (inv.status !== "proven") throw new Error("Investigation must be proven before filing a court case.");
  // fetch all and filter client-side (filter may not support $ne)
  const all = await base44.entities.CourtCase.filter({ investigation_id: investigationId });
  const open = all.find(c => c.status !== "closed");
  if (open) return open;
  const now = (await getCurrentGameTime()).toISOString();
  const rec = await base44.entities.CourtCase.create({
    scope: inv.scope || "national", state_id: "",
    complainant: "Enforcement Directorate",
    defendant_id: inv.target_player_id, defendant_name: inv.target_player_name,
    charges: "Disproportionate assets / corruption",
    evidence: inv.evidence || inv.reason || "",
    witness_info: "", investigation_id: investigationId,
    status: "filed", filed_game_time: now,
    fine_amount: inv.estimated_amount || 0,
  });
  logAction({
    actor_id: actor?.id || "court_ai", actor_name: actor?.name || "Court AI", actor_role: actor?.role || "ai",
    action: "court_case_filed", scope: inv.scope || "national",
    related_entity: "CourtCase", related_id: rec.id, details: `vs ${inv.target_player_name}`,
  });
  await base44.entities.NewsItem.create({
    title: `⚖️ Court case filed against ${inv.target_player_name}`,
    content: `The ED has filed a court case alleging disproportionate assets worth ${(inv.estimated_amount || 0).toLocaleString()}.`,
    category: "legal", source: "TV99 Bharat", related_type: "court_case", related_id: rec.id,
  });
  return rec;
}

function computeVerdict(c) {
  const evidenceLen = (c.evidence || "").length;
  const baseStrength = evidenceLen > 80 ? 0.75 : evidenceLen > 30 ? 0.6 : 0.45;
  const guilty = Math.random() < baseStrength;
  return guilty;
}

// Advance a single case one stage. Returns the updated case + verdict info.
export async function advanceCourtCase(caseId, actor) {
  const c = await base44.entities.CourtCase.get(caseId);
  if (c.status === "closed") return { case: c, changed: false };
  const now = (await getCurrentGameTime()).toISOString();
  let patch = {};
  let verdictInfo = null;
  if (c.status === "filed") {
    patch = { status: "hearing" };
  } else if (c.status === "hearing") {
    const guilty = computeVerdict(c);
    const fine = guilty ? Math.max(1000000, c.fine_amount || 0) : 0;
    patch = {
      status: "judgment",
      judgment: guilty ? "Guilty" : "Acquitted",
      punishment: guilty ? "Fine + reputation loss" : "None",
      fine_amount: fine,
    };
    verdictInfo = { guilty, fine };
    // Apply punishment to defendant profile
    const profiles = await base44.entities.PlayerProfile.filter({ player_id: c.defendant_id });
    if (profiles[0]) {
      const p = profiles[0];
      const newRep = guilty ? Math.max(0, (p.reputation || 50) - 25) : Math.min(100, (p.reputation || 50) + 5);
      const newCoins = guilty ? Math.max(0, (p.e_coins || 0) - fine) : (p.e_coins || 0);
      await base44.entities.PlayerProfile.update(p.id, { reputation: newRep, e_coins: newCoins });
    }
  } else if (c.status === "judgment") {
    patch = { status: "closed" };
  }
  const updated = await base44.entities.CourtCase.update(caseId, patch);
  logAction({
    actor_id: actor?.id || "court_ai", actor_name: actor?.name || "Court AI", actor_role: actor?.role || "ai",
    action: "court_case_advanced", related_entity: "CourtCase", related_id: caseId,
    new_value: patch.status, details: patch.judgment ? `Verdict: ${patch.judgment}` : "",
  });
  if (verdictInfo) {
    await base44.entities.NewsItem.create({
      title: `⚖️ ${c.defendant_name} ${verdictInfo.guilty ? "found GUILTY" : "ACQUITTED"}`,
      content: `The court has delivered its verdict in the case against ${c.defendant_name}. ${verdictInfo.guilty ? `Fined ${verdictInfo.fine.toLocaleString()}.` : "Charges dropped."}`,
      category: "legal", source: "TV99 Bharat", related_type: "court_verdict", related_id: caseId,
    });
  }
  return { case: updated, changed: true, verdict: verdictInfo };
}

// Advance every non-closed case one stage (the court docket).
export async function runCourtDocket(actor) {
  const all = await base44.entities.CourtCase.list("-filed_game_time", 500);
  const open = all.filter(c => c.status !== "closed");
  let verdicts = 0;
  for (const c of open) {
    const r = await advanceCourtCase(c.id, actor);
    if (r.verdict) verdicts++;
  }
  return { advanced: open.length, verdicts };
}