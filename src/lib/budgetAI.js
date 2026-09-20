
// Budget AI (spec #20). Scores a budget 0–100. Minimum score (default 70,
// configurable via GameConfig.budget_min_score) is required to present it.

export function scoreBudget(budget) {
  const revenue = budget.revenue || 0;
  const expenditure = budget.expenditure || 0;
  const deficit = Math.max(0, expenditure - revenue);
  let score = 50;

  if (revenue > 0) {
    const deficitRatio = deficit / revenue;
    if (deficitRatio <= 0) score += 30;        // surplus / balanced
    else if (deficitRatio <= 0.1) score += 20;
    else if (deficitRatio <= 0.25) score += 10;
    else if (deficitRatio <= 0.5) score -= 5;
    else score -= 20;                           // runaway deficit
  } else if (expenditure > 0) {
    score -= 15; // spending with no revenue
  }

  const devWelfare = (budget.development_spending || 0) + (budget.welfare_spending || 0);
  if (expenditure > 0) {
    const share = devWelfare / expenditure;
    if (share >= 0.4) score += 15;
    else if (share >= 0.25) score += 8;
    else if (share < 0.1) score -= 5;

    const salShare = (budget.salary_spending || 0) / expenditure;
    if (salShare > 0.5) score -= 10;
    else if (salShare <= 0.3) score += 5;
  }

  if (deficit === 0 && revenue > 0) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function budgetProblems(budget, score, minScore) {
  const problems = [];
  const revenue = budget.revenue || 0;
  const expenditure = budget.expenditure || 0;
  if (expenditure > revenue) problems.push("Deficit: expenditure exceeds revenue.");
  const devWelfare = (budget.development_spending || 0) + (budget.welfare_spending || 0);
  if (expenditure > 0 && devWelfare / expenditure < 0.25) problems.push("Low development & welfare allocation.");
  if (expenditure > 0 && (budget.salary_spending || 0) / expenditure > 0.5) problems.push("Salary spending too high relative to outlay.");
  if (score < minScore) problems.push(`Score ${score}% is below the required ${minScore}%.`);
  return problems;
}