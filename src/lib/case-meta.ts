export const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  under_review: "Under review",
  hearing_scheduled: "Hearing scheduled",
  decided: "Decided",
  appealed: "Appealed",
  closed: "Closed",
};

export const STATUS_TONE: Record<string, string> = {
  reported: "bg-warning/15 text-warning-foreground border-warning/40",
  under_review: "bg-accent text-accent-foreground border-accent",
  hearing_scheduled: "bg-chart-1/15 text-chart-1 border-chart-1/40",
  decided: "bg-success/15 text-success-foreground border-success/40",
  appealed: "bg-destructive/15 text-destructive border-destructive/40",
  closed: "bg-muted text-muted-foreground border-border",
};

export const SEVERITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/20 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

export const OFFENSE_CATEGORIES = [
  "Academic Misconduct",
  "Examination Malpractice",
  "Plagiarism",
  "Assault / Violence",
  "Theft",
  "Drug / Substance Use",
  "Sexual Misconduct",
  "Property Damage",
  "Cyber Misconduct",
  "Disorderly Conduct",
  "Forgery",
  "Other",
] as const;

export const SANCTION_LABELS: Record<string, string> = {
  warning: "Official Warning",
  probation: "Probation",
  community_service: "Community Service",
  fine: "Fine",
  suspension: "Suspension",
  expulsion: "Expulsion",
  dismissed: "Case Dismissed",
};

export type SanctionPreset = {
  label: string;
  type: keyof typeof SANCTION_LABELS;
  duration_semesters?: number;
  description: string;
};

export const SANCTION_PRESETS: SanctionPreset[] = [
  { label: "Official Warning", type: "warning", description: "Official written warning" },
  { label: "1 Semester Suspension", type: "suspension", duration_semesters: 1, description: "One (1) semester suspension" },
  { label: "2 Semester Suspension", type: "suspension", duration_semesters: 2, description: "Two (2) semester suspension" },
  { label: "Expulsion", type: "expulsion", description: "Permanent expulsion from the institution" },
];

export function formatSanction(s: { type: string; duration_semesters?: number | null; duration_days?: number | null; description?: string | null }) {
  const base = SANCTION_LABELS[s.type] ?? s.type;
  if (s.duration_semesters) return `${base} · ${s.duration_semesters} semester${s.duration_semesters > 1 ? "s" : ""}`;
  if (s.duration_days) return `${base} · ${s.duration_days} day${s.duration_days > 1 ? "s" : ""}`;
  return base;
}

