/**
 * Free public SPRS Self-Assessment quiz scoring.
 *
 * The Defense Department's SPRS scoring model for the NIST SP 800-171 r2
 * controls is well-documented (DoD Assessment Methodology v1.2.1):
 * each unmet control deducts a fixed weight (1, 3, or 5) from a 110-point
 * maximum. CMMC Level 1 covers a subset (the 17 FAR 52.204-21 practices)
 * but customers care about the FULL SPRS number because primes ask for it.
 *
 * For the lead-gen quiz we use a friendly proxy:
 *   - 12 plain-English diagnostic questions tied to L1 control families
 *   - Each weighted by SPRS impact (1 / 3 / 5)
 *   - Output is a 0-110 SPRS-style score plus a per-control gap list
 *
 * This is NOT a substitute for the full assessment — disclaim clearly.
 */

export type QuizQuestionId =
  | "ac_authorized_users"
  | "ac_external_systems"
  | "ac_public_posting"
  | "ia_unique_ids"
  | "ia_passwords"
  | "mp_media_disposal"
  | "pe_physical_access"
  | "pe_visitor_log"
  | "sc_boundary"
  | "sc_public_resources"
  | "si_av_updates"
  | "si_patching";

export type QuizAnswer = "yes" | "partial" | "no" | "unsure";

export type QuizQuestion = {
  id: QuizQuestionId;
  controlId: string;
  family: string;
  weight: 1 | 3 | 5;
  question: string;
  helper: string;
};

export const SPRS_MAX_SCORE = 110;

/**
 * The 12 quiz questions. Weights mirror the official DoD Assessment
 * Methodology weights for the underlying NIST controls.
 */
export const QUIZ_QUESTIONS: ReadonlyArray<QuizQuestion> = [
  {
    id: "ac_authorized_users",
    controlId: "AC.L1-3.1.1",
    family: "Access Control",
    weight: 5,
    question: "Do you keep a current list of every person who can log into a company computer or cloud account?",
    helper:
      "A simple spreadsheet of who has access to email, file storage, and any system handling federal info — kept up to date when people join or leave.",
  },
  {
    id: "ac_external_systems",
    controlId: "AC.L1-3.1.20",
    family: "Access Control",
    weight: 1,
    question: "Do you control which outside services (Dropbox, personal Gmail, partner portals) can touch federal contract info?",
    helper: "You don't have to ban them — you just need a written rule for what's allowed and what isn't.",
  },
  {
    id: "ac_public_posting",
    controlId: "AC.L1-3.1.22",
    family: "Access Control",
    weight: 1,
    question: "Before anyone posts content publicly (website, social, blog), is there a quick check that nothing federal-sensitive sneaks in?",
    helper: "One person reviews. A short checklist counts.",
  },
  {
    id: "ia_unique_ids",
    controlId: "IA.L1-3.5.1",
    family: "Identification & Auth",
    weight: 5,
    question: "Does every employee have their own login (no shared accounts) for email and key systems?",
    helper: "Shared logins are the #1 reason auditors fail small companies. Each person, their own account.",
  },
  {
    id: "ia_passwords",
    controlId: "IA.L1-3.5.2",
    family: "Identification & Auth",
    weight: 5,
    question: "Are passwords required, and is multi-factor (MFA / 2FA) turned on for email and admin accounts?",
    helper: "MFA on Google Workspace or Microsoft 365 covers the vast majority of this.",
  },
  {
    id: "mp_media_disposal",
    controlId: "MP.L1-3.8.3",
    family: "Media Protection",
    weight: 3,
    question: "When a laptop, hard drive, or USB stick is retired, do you wipe or destroy it before it leaves your possession?",
    helper: "A signed disposal log + a wipe tool (or a shredding service receipt) is enough.",
  },
  {
    id: "pe_physical_access",
    controlId: "PE.L1-3.10.1",
    family: "Physical",
    weight: 5,
    question: "Is your office (or wherever computers live) locked when no one's there?",
    helper: "Home office counts. Door locks + a who-has-keys list.",
  },
  {
    id: "pe_visitor_log",
    controlId: "PE.L1-3.10.3",
    family: "Physical",
    weight: 1,
    question: "When someone visits the office (cleaner, contractor, guest), do you escort or sign them in?",
    helper: "A visitor log on a clipboard is fine. Cleaning crew with a badge counts as escorted.",
  },
  {
    id: "sc_boundary",
    controlId: "SC.L1-3.13.1",
    family: "Sys & Comms Protection",
    weight: 5,
    question: "Is there a firewall (the one in your router counts) between your business network and the internet?",
    helper: "Default consumer/business router firewalls satisfy this. Just confirm it's on.",
  },
  {
    id: "sc_public_resources",
    controlId: "SC.L1-3.13.5",
    family: "Sys & Comms Protection",
    weight: 5,
    question: "Are public-facing systems (your website, marketing forms) on a separate network or service from your internal files?",
    helper: "If your website is on Vercel / Squarespace / WordPress.com and your files are on Google Drive — yes, that's separate.",
  },
  {
    id: "si_av_updates",
    controlId: "SI.L1-3.14.4",
    family: "System & Info Integrity",
    weight: 5,
    question: "Do all company laptops run antivirus / endpoint protection that updates itself automatically?",
    helper: "Built-in Windows Defender or macOS XProtect counts if you haven't turned it off.",
  },
  {
    id: "si_patching",
    controlId: "SI.L1-3.14.1",
    family: "System & Info Integrity",
    weight: 5,
    question: "Are operating system updates installed within a reasonable time (say, 30 days)?",
    helper: "If you have automatic updates on, you're already there.",
  },
];

/**
 * Map an answer to the SPRS-style point deduction for a given question
 * weight. "yes" loses 0, "partial" loses half ( up), "no" loses
 * full weight, "unsure" is treated as "no" (defensive — primes do the same).
 */
function deduction(answer: QuizAnswer, weight: 1 | 3 | 5): number {
  switch (answer) {
    case "yes":
      return 0;
    case "partial":
      return Math.ceil(weight / 2);
    case "no":
    case "unsure":
      return weight;
  }
}

export type QuizResult = {
  score: number;
  maxScore: typeof SPRS_MAX_SCORE;
  bidEligibleThreshold: 88;
  bidEligible: boolean;
  totalDeductions: number;
  gaps: ReadonlyArray<{
    questionId: QuizQuestionId;
    controlId: string;
    family: string;
    answer: QuizAnswer;
    pointsLost: number;
    question: string;
  }>;
};

export function scoreQuiz(answers: Partial<Record<QuizQuestionId, QuizAnswer>>): QuizResult {
  const gaps: QuizResult["gaps"][number][] = [];
  let totalDeductions = 0;

  for (const q of QUIZ_QUESTIONS) {
    const a = answers[q.id] ?? "unsure";
    const lost = deduction(a, q.weight);
    if (lost > 0) {
      gaps.push({
        questionId: q.id,
        controlId: q.controlId,
        family: q.family,
        answer: a,
        pointsLost: lost,
        question: q.question,
      });
    }
    totalDeductions += lost;
  }

  const score = Math.max(SPRS_MAX_SCORE - totalDeductions, -203);

  return {
    score,
    maxScore: SPRS_MAX_SCORE,
    bidEligibleThreshold: 88,
    bidEligible: score >= 88,
    totalDeductions,
    gaps,
  };
}

/**
 * Validate a raw answers payload from the public quiz form. Throws on
 * any unknown question id or invalid answer value. Returns a typed map.
 */
export function parseQuizAnswers(raw: unknown): Partial<Record<QuizQuestionId, QuizAnswer>> {
  if (!raw || typeof raw !== "object") {
    throw new Error("answers must be an object");
  }
  const allowedQ = new Set<string>(QUIZ_QUESTIONS.map((q) => q.id));
  const allowedA: ReadonlySet<string> = new Set(["yes", "partial", "no", "unsure"]);
  const out: Partial<Record<QuizQuestionId, QuizAnswer>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowedQ.has(k)) throw new Error(`unknown question: ${k}`);
    if (typeof v !== "string" || !allowedA.has(v)) {
      throw new Error(`invalid answer for ${k}`);
    }
    out[k as QuizQuestionId] = v as QuizAnswer;
  }
  return out;
}
