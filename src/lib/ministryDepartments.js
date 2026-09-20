
// Departments under each portfolio — matched by keyword so both the national
// and state ministry names resolve, with a standard set as fallback.

const DEPARTMENT_MAP = [
  ["prime minister", ["General Administration", "Personnel & Appointments", "Cabinet Coordination", "Public Grievances"]],
  ["chief minister", ["General Administration", "Personnel & Appointments", "Cabinet Coordination", "Public Grievances"]],
  ["home", ["Police Administration", "Law & Justice", "Prisons & Corrections", "Fire & Emergency Services", "Disaster Response"]],
  ["finance", ["Treasury Operations", "Revenue & Taxation", "Budget & Planning", "Economic Analysis", "Audit & Accounts"]],
  ["external affairs", ["Diplomatic Missions", "Trade Diplomacy", "Consular Services"]],
  ["defence", ["Army Coordination", "Navy Coordination", "Air Force Coordination", "Defence Production"]],
  ["education", ["School Education", "Higher Education", "Skill Development", "Scholarships & Welfare"]],
  ["health", ["Public Health", "Hospitals & Medical Services", "Drug Regulation", "Family Welfare"]],
  ["agricult", ["Crop & Horticulture", "Irrigation Support", "Farm Credit & Insurance", "Mandis & Marketing"]],
  ["farmers", ["Crop & Horticulture", "Irrigation Support", "Farm Credit & Insurance", "Mandis & Marketing"]],
  ["rural development", ["Village Infrastructure", "Employment Programs", "Rural Housing"]],
  ["industry", ["Industrial Licensing", "Trade Facilitation", "Employment & Labour"]],
  ["commerce", ["Industrial Licensing", "Trade Facilitation", "Employment & Labour"]],
  ["trade", ["Industrial Licensing", "Trade Facilitation", "Employment & Labour"]],
  ["employment", ["Industrial Licensing", "Trade Facilitation", "Employment & Labour"]],
  ["infrastructure", ["Roads & Highways", "Public Transport", "Housing & Urban Works", "Rail Coordination"]],
  ["transport", ["Roads & Highways", "Public Transport", "Housing & Urban Works", "Rail Coordination"]],
  ["housing", ["Roads & Highways", "Public Transport", "Housing & Urban Works"]],
  ["energy", ["Power Distribution", "Water Supply", "Minerals & Mining", "Renewable Energy"]],
  ["water", ["Power Distribution", "Water Supply", "Minerals & Mining", "Renewable Energy"]],
  ["natural resources", ["Power Distribution", "Water Supply", "Minerals & Mining", "Renewable Energy"]],
  ["environment", ["Pollution Control", "Climate Initiatives", "Disaster Management", "Forests & Wildlife"]],
  ["social justice", ["Women & Child Welfare", "Youth Affairs", "Community Programs"]],
  ["women", ["Women & Child Welfare", "Youth Affairs", "Community Programs"]],
  ["youth", ["Women & Child Welfare", "Youth Affairs", "Community Programs"]],
  ["culture", ["Heritage & Museums", "Tourism Promotion", "Sports Development", "Language & Arts"]],
  ["tourism", ["Heritage & Museums", "Tourism Promotion", "Sports Development"]],
  ["sports", ["Heritage & Museums", "Sports Development"]],
  ["science", ["Research Programs", "Digital Services", "Startup & Innovation", "Cyber Coordination"]],
  ["digital", ["Research Programs", "Digital Services", "Startup & Innovation", "Cyber Coordination"]],
  ["innovation", ["Research Programs", "Digital Services", "Startup & Innovation"]],
];

const DEFAULT_DEPARTMENTS = ["General Administration", "Finance & Accounts", "Policy & Planning", "Public Grievances"];

export function getDepartments(ministryName) {
  const lower = (ministryName || "").toLowerCase();
  for (const [key, deps] of DEPARTMENT_MAP) {
    if (lower.includes(key)) return deps;
  }
  return DEFAULT_DEPARTMENTS;
}