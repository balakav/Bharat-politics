
// Shared bill-workflow maps + the status flow, used by the Bills screen and
// the Speaker's Office. Workflow: a member (MLA for state / MP for national)
// introduces a bill → Speaker's Office admission → debate & voting on the
// house floor (Speaker opens/closes; the Voting Agent tallies) → Speaker's
// certification → Governor (state) / President (national).

export const BILL_STATUS_LABEL = {
  draft: "Draft",
  speaker_review: "Speaker's Office · Admission",
  speaker_rejected: "Rejected by Speaker",
  speaker_office: "With Speaker · Passed",
  assembly_vote: "Debate & Voting",
  assembly_passed: "Passed by the House",
  assembly_rejected: "Rejected by the House",
  rajya_vote: "Rajya Sabha Vote",
  rajya_passed: "Passed · Rajya Sabha",
  rajya_rejected: "Rejected · Rajya Sabha",
  governor_review: "With Governor",
  governor_approved: "Governor Approved",
  governor_rejected: "Governor Rejected",
  president_review: "With President",
  president_approved: "President Approved",
  president_rejected: "President Rejected",
  president_returned: "Returned by President",
  law: "Enacted Law",
  withdrawn: "Withdrawn",
};

export const BILL_STATUS_COLOR = {
  draft: "bg-zinc-700 text-zinc-300",
  speaker_review: "bg-yellow-500/20 text-yellow-400",
  speaker_rejected: "bg-red-500/20 text-red-400",
  speaker_office: "bg-amber-500/20 text-amber-400",
  assembly_vote: "bg-yellow-500/20 text-yellow-400",
  assembly_passed: "bg-green-500/20 text-green-400",
  assembly_rejected: "bg-red-500/20 text-red-400",
  rajya_vote: "bg-yellow-500/20 text-yellow-400",
  rajya_passed: "bg-green-500/20 text-green-400",
  rajya_rejected: "bg-red-500/20 text-red-400",
  governor_review: "bg-orange-500/20 text-orange-400",
  governor_approved: "bg-green-500/20 text-green-400",
  governor_rejected: "bg-red-500/20 text-red-400",
  president_review: "bg-amber-500/20 text-amber-400",
  president_approved: "bg-green-500/20 text-green-400",
  president_rejected: "bg-red-500/20 text-red-400",
  president_returned: "bg-yellow-500/20 text-yellow-400",
  law: "bg-green-500/30 text-green-300",
  withdrawn: "bg-zinc-700 text-zinc-400",
};

// Manual/admin fallback steps for each status. The Speaker's Office and the
// Voting Agent drive the main flow; these power the quick-advance buttons.
export function billNextSteps(b) {
  const FLOW = {
    state: {
      draft: [["Send to Speaker's Office", "speaker_review"]],
      speaker_review: [["Admit for Debate & Vote", "assembly_vote"], ["Reject", "speaker_rejected"]],
      assembly_vote: [["Passed by the House", "assembly_passed"], ["Rejected by the House", "assembly_rejected"]],
      assembly_passed: [["Send to Speaker's Office", "speaker_office"]],
      speaker_office: [["Certify → Governor", "governor_review"]],
      president_returned: [["Re-introduce in Assembly", "assembly_vote"]],
    },
    national: {
      draft: [["Send to Speaker's Office", "speaker_review"]],
      speaker_review: [["Admit for Debate & Vote", "assembly_vote"], ["Reject", "speaker_rejected"]],
      assembly_vote: [["Passed by Lok Sabha", "assembly_passed"], ["Rejected by Lok Sabha", "assembly_rejected"]],
      assembly_passed: [["Send to Speaker's Office", "speaker_office"]],
      speaker_office: [["Certify → President", "president_review"]],
      rajya_vote: [["Rajya Sabha Passed", "rajya_passed"], ["Rajya Sabha Rejected", "rajya_rejected"]],
      rajya_passed: [["Send to President", "president_review"]],
      president_returned: [["Re-introduce in Lok Sabha", "assembly_vote"]],
    },
  };
  return (FLOW[b.scope] || {})[b.status] || [];
}

// Constitutional Amendment bills need a 2/3 majority of the house's total
// strength; every other bill a simple majority (half + 1 — e.g. 220 MLAs → 111).
export function isConstitutionalBill(b) {
  const s = `${b?.category || ""} ${b?.title || ""}`.toLowerCase();
  return s.includes("constitut");
}

export function requiredVotesFor(totalSeats, constitutional) {
  if (!totalSeats) return 0;
  return constitutional ? Math.ceil((totalSeats * 2) / 3) : Math.floor(totalSeats / 2) + 1;
}