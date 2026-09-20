
import { base44 } from "@/api/base44Client";

// News AI (spec #17). Generates political news. Event-driven helpers are called
// from the various flows; generateNewsBatch produces periodic flavor news so the
// feed always feels alive. Rule-based to avoid integration-credit cost.

const FLAVOR_TEMPLATES = [
  { title: "Rising Tensions in the Assembly", content: "Opposition leaders walked out today amid heated debate over the new policy package.", category: "politics" },
  { title: "Farmers' Rally Draws Thousands", content: "A massive farmers' rally in the state capital put pressure on the ruling party ahead of the next session.", category: "politics" },
  { title: "Stock Market Reacts to Policy Rumours", content: "Markets swung sharply as traders reacted to rumours of an upcoming tax reform.", category: "economy" },
  { title: "New Infrastructure Project Announced", content: "The government unveiled plans for a major highway expansion connecting key districts.", category: "economy" },
  { title: "Youth Wing Protests Unemployment", content: "Party youth wings took to the streets demanding new job-creation schemes.", category: "politics" },
  { title: "Cabinet Meets on Law & Order", content: "An emergency cabinet meeting reviewed the law-and-order situation after recent incidents.", category: "politics" },
  { title: "Trade Body Welcomes Budget Signals", content: "Industry associations welcomed early signals from the finance ministry's budget preparations.", category: "economy" },
  { title: "Civic Groups Demand Transparency", content: "Civil society organizations called for greater transparency in public spending.", category: "politics" },
];

// Generate `count` flavor news items (no duplicates within the last hour).
export async function generateNewsBatch(count = 3) {
  const recent = await base44.entities.NewsItem.list("-created_date", 20);
  const recentTitles = new Set(recent.map(n => n.title));
  const pool = FLAVOR_TEMPLATES.filter(t => !recentTitles.has(t.title));
  const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const created = [];
  for (const t of chosen) {
    const rec = await base44.entities.NewsItem.create({
      title: t.title, content: t.content, category: t.category,
      source: "TV99 Bharat", related_type: "news_ai", related_id: "",
    });
    created.push(rec);
  }
  return created;
}

// Event-driven helper (used by other flows that want a custom headline).
export async function generateNewsFromEvent(title, content, category = "politics", relatedType = "event", relatedId = "") {
  return await base44.entities.NewsItem.create({
    title, content, category, source: "TV99 Bharat", related_type: relatedType, related_id: relatedId,
  });
}