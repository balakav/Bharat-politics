
import { bharat01 } from "@/api/bharat01Client";
import { scoreBudget, budgetProblems } from "./budgetAI";
import { getGameConfig } from "./gameTime";
import { treasuryDebit } from "./treasury";
import { logAction } from "./audit";

// Budget workflow (spec #19/#20):
// Finance Minister → Prepare → Budget AI verification (≥70%) → Present → Vote → Approve/Reject

export async function createBudget(data, actor) {
  const deficit = (data.expenditure || 0) - (data.revenue || 0);
  const rec = await bharat01.entities.Budget.create({ ...data, deficit, status: "draft", ai_score: 0 });
  logAction({
    actor_id: actor?.id || "finance_minister", actor_name: actor?.name || "Finance Minister", actor_role: actor?.role || "minister",
    action: "budget_created", scope: data.scope, scope_id: data.state_id || "",
    related_entity: "Budget", related_id: rec.id,
  });
  return rec;
}

// Budget AI verification. Sets status to "ai_review" (≥ minScore) or "returned".
export async function runBudgetAI(budgetId) {
  const b = await bharat01.entities.Budget.get(budgetId);
  const config = await getGameConfig();
  const minScore = config.budget_min_score || 70;
  const score = scoreBudget(b);
  const problems = budgetProblems(b, score, minScore);
  const status = score >= minScore ? "ai_review" : "returned";
  const updated = await bharat01.entities.Budget.update(budgetId, {
    ai_score: score, ai_notes: problems.join(" "), status,
  });
  logAction({
    actor_id: "budget_ai", actor_name: "Budget AI", actor_role: "ai",
    action: "budget_reviewed", scope: b.scope, scope_id: b.state_id || "",
    related_entity: "Budget", related_id: budgetId, new_value: String(score), details: problems.join(" "),
  });
  return { score, problems, status, minScore, budget: updated };
}

export async function presentBudget(budgetId, actor) {
  const b = await bharat01.entities.Budget.get(budgetId);
  if (b.status !== "ai_review") throw new Error("Budget must pass Budget AI review (≥ min score) before presentation.");
  await bharat01.entities.Budget.update(budgetId, { status: "voting" });
  logAction({
    actor_id: actor?.id, actor_name: actor?.name, actor_role: actor?.role || "minister",
    action: "budget_presented", scope: b.scope, scope_id: b.state_id || "",
    related_entity: "Budget", related_id: budgetId,
  });
  await bharat01.entities.NewsItem.create({
    title: `📊 Budget presented in ${b.scope === "national" ? "Parliament" : "Assembly"}`,
    content: `Budget scored ${b.ai_score}% by Budget AI. Now up for vote. Fiscal year ${b.fiscal_year}.`,
    category: "economy", source: "TV99 Bharat", related_type: "budget_presented", related_id: budgetId,
  });
}

// Tally the assembly/parliament vote. On approval, expenditure is debited from treasury.
export async function voteOnBudget(budgetId, votesFor, votesAgainst, actor) {
  const b = await bharat01.entities.Budget.get(budgetId);
  const passed = votesFor > votesAgainst;
  const status = passed ? "approved" : "rejected";
  await bharat01.entities.Budget.update(budgetId, {
    assembly_votes_for: votesFor, assembly_votes_against: votesAgainst, status,
  });
  if (passed) {
    await treasuryDebit(b.scope, b.state_id || "", b.expenditure || 0, `Budget approved (${b.fiscal_year})`, actor);
  }
  await bharat01.entities.NewsItem.create({
    title: passed ? `✅ Budget approved (${votesFor}-${votesAgainst})` : `❌ Budget rejected (${votesFor}-${votesAgainst})`,
    content: `${b.scope === "national" ? "National" : "State"} budget for ${b.fiscal_year} ${passed ? "passed" : "failed"} the vote.`,
    category: "economy", source: "TV99 Bharat", related_type: "budget_vote", related_id: budgetId,
  });
  logAction({
    actor_id: actor?.id || "assembly", actor_name: actor?.name || "Assembly", actor_role: actor?.role || "ai",
    action: passed ? "budget_approved" : "budget_rejected", scope: b.scope, scope_id: b.state_id || "",
    related_entity: "Budget", related_id: budgetId, new_value: status,
  });
  return { passed, status };
}