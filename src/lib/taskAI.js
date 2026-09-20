
import { base44 } from "@/api/base44Client";
import { getCurrentGameTime, getGameConfig } from "./gameTime";
import { logAction } from "./audit";

// Task AI (spec #14). Generates role-based tasks with choices, time limits,
// rewards (reputation / e_coins) and risks. Players choose → outcome applied.

const TEMPLATES = {
  mla: [
    { title: "Constituency Road Audit", objective: "Review pothole complaints across your constituency.", choices: [
      { label: "Approve repair funds", reputation: 8, e_coins: -100000 },
      { label: "Defer to next quarter", reputation: -4 },
      { label: "Hold a public consultation", reputation: 5, e_coins: -20000 },
    ]},
    { title: "School Infrastructure Visit", objective: "Inspect condition of local schools.", choices: [
      { label: "Sanction upgrade funds", reputation: 7, e_coins: -150000 },
      { label: "Submit an inspection report", reputation: 2 },
    ]},
    { title: "Flood Relief Coordination", objective: "Manage a relief camp after heavy rains.", choices: [
      { label: "Personally oversee the camp", reputation: 10, e_coins: -50000 },
      { label: "Delegate to officials", reputation: 3 },
      { label: "Ignore the situation", reputation: -8, risk: "scandal" },
    ]},
  ],
  mp: [
    { title: "Parliament Debate Prep", objective: "Prepare for a key Lok Sabha debate.", choices: [
      { label: "Research thoroughly", reputation: 6 },
      { label: "Deliver a fiery speech", reputation: 8, e_coins: -30000 },
      { label: "Skip the session", reputation: -5 },
    ]},
    { title: "Central Scheme Launch", objective: "Launch a centrally-sponsored scheme in your seat.", choices: [
      { label: "Full rollout with fanfare", reputation: 9, e_coins: -200000 },
      { label: "Quiet pilot launch", reputation: 4 },
    ]},
  ],
  minister: [
    { title: "Portfolio Policy Draft", objective: "Draft a new policy for your ministry.", choices: [
      { label: "Consult experts & stakeholders", reputation: 7 },
      { label: "Fast-track your own draft", reputation: 3, risk: "controversy" },
    ]},
    { title: "Department Audit", objective: "Audit your department for inefficiencies.", choices: [
      { label: "Root out corruption", reputation: 10, e_coins: -100000 },
      { label: "Surface-level review", reputation: 2 },
    ]},
    { title: "Scheme Rollout in Your Constituency", objective: "Launch your ministry's flagship scheme in your constituency.", choices: [
      { label: "Full rollout with camps", reputation: 9, e_coins: -80000 },
      { label: "Pilot in two wards first", reputation: 4 },
    ]},
    { title: "Grievance Camp", objective: "Hold a ministry grievance camp in your constituency.", choices: [
      { label: "Solve cases on the spot", reputation: 8 },
      { label: "Collect and forward them", reputation: 3 },
    ]},
    { title: "Constituency Road File", objective: "Clear your ministry's pending road project file for your constituency.", choices: [
      { label: "Expedite the file", reputation: 7 },
      { label: "Send it for re-survey", reputation: 2 },
    ]},
    { title: "Water Pipeline Extension", objective: "Extend the constituency's water pipeline network.", choices: [
      { label: "Sanction the full budget", reputation: 8, e_coins: -150000 },
      { label: "Phase it over the year", reputation: 4 },
    ]},
    { title: "School Upgrade File", objective: "Approve the pending school upgrade file for your constituency.", choices: [
      { label: "Approve with lab & library", reputation: 8, e_coins: -100000 },
      { label: "Approve basic repairs only", reputation: 4, e_coins: -30000 },
    ]},
    { title: "Flood Control Coordination", objective: "Coordinate ministry engineers for pre-monsoon work in your constituency.", choices: [
      { label: "Complete it before monsoon", reputation: 10, e_coins: -120000 },
      { label: "Partial desilting only", reputation: 3 },
    ]},
    { title: "Power Outage Complaints", objective: "Rising outage complaints on your constituency's feeder lines.", choices: [
      { label: "Order feeder upgrades", reputation: 7, e_coins: -90000 },
      { label: "Temporary load-shedding", reputation: -3 },
    ]},
    { title: "Skill Centre Proposal", objective: "Open a ministry skill development centre in your constituency.", choices: [
      { label: "Sanction the centre", reputation: 8, e_coins: -70000 },
      { label: "Defer to next fiscal year", reputation: -2 },
    ]},
    { title: "Ministry Budget Defense", objective: "Defend your ministry's budget before the house.", choices: [
      { label: "Data-driven defense", reputation: 6 },
      { label: "Political counterattack", reputation: 3, risk: "controversy" },
    ]},
  ],
  cm: [
    { title: "Cabinet Reshuffle", objective: "Consider reshuffling your cabinet.", choices: [
      { label: "Reward performers", reputation: 6 },
      { label: "Keep stability", reputation: 3 },
      { label: "Sack underperformers", reputation: 5, risk: "dissidence" },
    ]},
    { title: "State Investment Summit", objective: "Host an investor summit.", choices: [
      { label: "Sign big MoUs", reputation: 10, e_coins: -500000 },
      { label: "Modest event", reputation: 4 },
    ]},
  ],
  pm: [
    { title: "National Address", objective: "Address the nation on a key issue.", choices: [
      { label: "Unifying, policy-focused", reputation: 8 },
      { label: "Partisan tone", reputation: -2, risk: "polarization" },
    ]},
    { title: "Crisis Management", objective: "Handle a national security situation.", choices: [
      { label: "Decisive action", reputation: 10, e_coins: -1000000 },
      { label: "Form a committee", reputation: 3 },
    ]},
  ],
  speaker: [
    { title: "Disorder in the House", objective: "Manage disruptions during a session.", choices: [
      { label: "Suspend unruly members", reputation: 4, risk: "opposition-anger" },
      { label: "Adjourn briefly", reputation: 2 },
    ]},
  ],
  citizen: [
    { title: "Community Volunteer Drive", objective: "Organize a local cleanliness drive.", choices: [
      { label: "Lead it yourself", reputation: 4 },
      { label: "Donate instead", reputation: 2, e_coins: -20000 },
    ]},
  ],
};

function pick(arr, n) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

// Generate up to `count` new tasks for a player if they have fewer than `maxActive`.
export async function generateTasksForPlayer(playerId, role, scope = "state", stateId = "", count = 3, maxActive = 2) {
  const active = await base44.entities.Task.filter({ player_id: playerId, status: "pending" });
  if (active.length >= maxActive) return [];
  // Fresh tasks only: skip every template the player has already received
  // (open or resolved), so the office never repeats the same task.
  const seen = new Set(active.map(t => t.title));
  const past = await base44.entities.Task.filter({ player_id: playerId, status: "completed" }, "-created_date", 100).catch(() => []);
  for (const t of past) seen.add(t.title);
  const all = TEMPLATES[role] || TEMPLATES.citizen;
  const fresh = all.filter(t => !seen.has(t.title));
  const pool = fresh.length > 0 ? fresh : all;
  const chosen = pick(pool, Math.min(count, pool.length));
  const config = await getGameConfig();
  const now = await getCurrentGameTime();
  const cycleH = config.salary_cycle_hours || 24;
  const toCreate = chosen.map(t => ({
    player_id: playerId, role: role || "citizen", title: t.title, objective: t.objective,
    scope, state_id: scope === "state" ? stateId : "",
    choices: JSON.stringify(t.choices),
    time_limit_hours: cycleH,
    deadline_game_time: new Date(now.getTime() + cycleH * 3600 * 1000).toISOString(),
    status: "pending",
  }));
  if (toCreate.length === 0) return [];
  return await base44.entities.Task.bulkCreate(toCreate);
}

// Resolve a task by applying the chosen option's rewards/penalties to the player.
export async function resolveTask(taskId, chosenIndex) {
  const task = await base44.entities.Task.get(taskId);
  if (task.status !== "pending") throw new Error("Task already resolved or expired.");
  const choices = JSON.parse(task.choices || "[]");
  const choice = choices[chosenIndex];
  if (!choice) throw new Error("Invalid choice.");
  const profiles = await base44.entities.PlayerProfile.filter({ player_id: task.player_id });
  const p = profiles[0];
  if (p) {
    const newRep = Math.max(0, Math.min(100, (p.reputation || 50) + (choice.reputation || 0)));
    const newCoins = (p.e_coins || 0) + (choice.e_coins || 0);
    await base44.entities.PlayerProfile.update(p.id, { reputation: newRep, e_coins: newCoins });
  }
  await base44.entities.Task.update(taskId, {
    status: "completed", chosen_option: choice.label,
    reward_reputation: choice.reputation || 0, reward_e_coins: choice.e_coins || 0,
    risk: choice.risk || "",
  });
  logAction({
    actor_id: task.player_id, actor_name: p?.username || "Player", actor_role: task.role,
    action: "task_resolved", scope: task.scope, scope_id: task.state_id || "",
    related_entity: "Task", related_id: taskId, details: `${task.title} → ${choice.label}`,
  });
  return choice;
}

// Expire tasks past their deadline.
export async function expireOverdueTasks(playerId) {
  const pending = await base44.entities.Task.filter({ player_id: playerId, status: "pending" });
  const now = await getCurrentGameTime();
  const expired = pending.filter(t => t.deadline_game_time && new Date(t.deadline_game_time) < now);
  for (const t of expired) await base44.entities.Task.update(t.id, { status: "expired" });
  return expired.length;
}