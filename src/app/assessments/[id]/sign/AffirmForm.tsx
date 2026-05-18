"use client";

/**
 * Client wrapper around the affirmation form. Provides:
 *
 *   - The same fields the server-rendered form had (signer name/title/email,
 *     acknowledgement checkbox, hidden assessmentId).
 *   - An animated 6-step checklist overlay that runs while the server action
 *     is pending. Each step lights up sequentially so the user feels the
 *     platform "putting it together" before the redirect to /assessments/[id].
 *   - Inline error surfacing: if the server action redirects back with
 *     ?error=..., we map the message to the step that failed and mark that
 *     step red instead of green. The actual error text shows in the panel.
 *
 * The server action (submitAffirmationAction) keeps redirecting on both
 * success (-> /assessments/[id]?signed=1) and validation failure (-> /sign?
 * error=...), so this is purely a presentation upgrade — the no-JS path
 * still works.
 */

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { submitAffirmationAction } from "../../actions";

type Props = {
  assessmentId: string;
  organizationName: string;
  disabled: boolean;
  submitError: string | null;
};

type StepStatus = "idle" | "running" | "done" | "failed";

const STEPS: ReadonlyArray<{
  label: string;
  detail: string;
  /** Lower-cased substrings that mean "this step is the one that failed". */
  matchers: string[];
}> = [
  {
    label: "Verifying Affirming Official",
    detail: "Name, title, work email, acknowledgement.",
    matchers: ["signer", "affirming official", "acknowledge", "business profile", "piee", "sprs cyber vendor"],
  },
  {
    label: "Checking every practice",
    detail: "All 15 CMMC L1 requirements answered, met or covered.",
    matchers: [
      "answer every",
      "block the affirmation",
      "not met",
      "partial",
      "pending review",
    ],
  },
  {
    label: "Validating evidence",
    detail: "Every uploaded artifact passed Platform review.",
    matchers: [
      "evidence review",
      "artifact",
      "narrative",
      "passing artifact",
    ],
  },
  {
    label: "Confirming FCI boundary",
    detail: "SSP § 1.2 boundary diagram, flows, out-of-scope, AO ack.",
    matchers: ["fci boundary", "boundary"],
  },
  {
    label: "Sealing attestation packet",
    detail: "SHA-256 fingerprints, HMAC signature, KMS encryption.",
    matchers: ["fingerprint", "couldn't complete", "encrypt"],
  },
  {
    label: "Filing on the assessment record",
    detail: "Status → attested · CMMC Status → Final Level 1 (Self).",
    matchers: ["assessment not found", "amend"],
  },
];

const STEP_DELAY_MS = 520;

function classifyError(message: string): number {
  const m = message.toLowerCase();
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].matchers.some((tok) => m.includes(tok))) return i;
  }
  return STEPS.length - 1; // fallback: last step caught it
}

export function AffirmForm({
  assessmentId,
  organizationName,
  disabled,
  submitError,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [stepStatus, setStepStatus] = useState<StepStatus[]>(() =>
    STEPS.map(() => "idle"),
  );
  const [showOverlay, setShowOverlay] = useState(false);

  // Sequential check animation while the action is pending. Each step turns
  // green ~520ms after the previous one. If the action returns (redirects)
  // before we reach the last step, that's fine — the page navigates and the
  // overlay unmounts.
  useEffect(() => {
    if (!isPending) return;
    setShowOverlay(true);
    setActiveStep(0);
    setStepStatus(STEPS.map(() => "idle"));
    let cancelled = false;
    const tick = (i: number) => {
      if (cancelled) return;
      if (i >= STEPS.length) return;
      setActiveStep(i);
      setStepStatus((prev) => {
        const next = [...prev];
        next[i] = "running";
        return next;
      });
      window.setTimeout(() => {
        if (cancelled) return;
        setStepStatus((prev) => {
          const next = [...prev];
          next[i] = "done";
          return next;
        });
        tick(i + 1);
      }, STEP_DELAY_MS);
    };
    tick(0);
    return () => {
      cancelled = true;
    };
  }, [isPending]);

  // If we land back on /sign with ?error=..., flash the failing step red so
  // the user immediately knows where the gate caught them.
  useEffect(() => {
    if (!submitError) return;
    const idx = classifyError(submitError);
    setShowOverlay(true);
    setStepStatus((prev) => {
      const next = STEPS.map((_, i) =>
        i < idx ? ("done" as StepStatus) : i === idx ? ("failed" as StepStatus) : ("idle" as StepStatus),
      );
      return next;
    });
    setActiveStep(idx);
  }, [submitError]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await submitAffirmationAction(formData);
    });
  };

  const dismissOverlay = () => {
    if (isPending) return;
    setShowOverlay(false);
  };

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="space-y-6 border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="assessmentId" value={assessmentId} />

        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Affirming Official
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Per 32 CFR § 170.22, the Affirming Official must be a senior
            officer of the organization with authority to bind it. Their name,
            title, email, and the affirmation date are submitted to SPRS and
            visible to contracting officers under DFARS 252.204-7021.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Full legal name
            </span>
            <input
              type="text"
              name="signerName"
              required
              placeholder="Jane Doe"
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Title
            </span>
            <input
              type="text"
              name="signerTitle"
              required
              placeholder="Chief Executive Officer"
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Work email
            </span>
            <input
              type="email"
              name="affirmingOfficialEmail"
              required
              placeholder="ceo@yourcompany.com"
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              Required. SPRS routes the affirmation to this address when you
              click <strong>Transfer to AO</strong>, and it appears on the
              signed attestation memo. Must be the senior official&rsquo;s
              personal work address — not <code>info@</code>, <code>hello@</code>,
              or any shared inbox.
            </span>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-slate-900">
              Assessment completion date{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input
              type="date"
              name="selfAssessmentCompletedAt"
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              The day you finished walking the 15 requirements. SPRS asks for
              this separately from the affirmation date. Leave blank if you
              completed the work today.
            </span>
          </label>
        </div>

        <div className="border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            PIEE &amp; SPRS readiness
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            We can&rsquo;t see your PIEE account, so please confirm these three
            facts about your SPRS access before signing. If any is{" "}
            <em>no</em>, head to{" "}
            <Link
              href="/sprs-guide"
              className="font-medium underline decoration-amber-400 underline-offset-2"
            >
              the SPRS walkthrough
            </Link>{" "}
            first.
          </p>
          <div className="mt-3 space-y-2.5 text-sm text-slate-800">
            <label className="flex gap-3">
              <input
                type="checkbox"
                name="pieeAcct"
                required
                className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
              />
              <span>
                I have a PIEE account at{" "}
                <code className="bg-white px-1 py-0.5 text-[12px]">
                  piee.eb.mil
                </code>
                .
              </span>
            </label>
            <label className="flex gap-3">
              <input
                type="checkbox"
                name="pieeRole"
                required
                className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
              />
              <span>
                My PIEE account has the{" "}
                <strong>SPRS Cyber Vendor User</strong> role (or I&rsquo;ve
                submitted the request and my company&rsquo;s{" "}
                <strong>Contractor Account Manager (CAM)</strong> has
                activated it).
              </span>
            </label>
            <label className="flex gap-3">
              <input
                type="checkbox"
                name="pieeSeesCage"
                required
                className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
              />
              <span>
                I&rsquo;ve logged into SPRS &rarr; Cyber Reports and I can see
                my CAGE in the hierarchy dropdown.
              </span>
            </label>
          </div>
          <details className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-900 hover:text-slate-700">
              Can&rsquo;t check one of these? &mdash; 30-second fixes
            </summary>
            <ul className="mt-2 space-y-2 pl-4 text-[13px] leading-relaxed">
              <li>
                <strong>No PIEE account?</strong> Go to{" "}
                <a
                  href="https://piee.eb.mil"
                  target="_blank"
                  rel="noopener"
                  className="font-medium underline decoration-amber-400 underline-offset-2"
                >
                  piee.eb.mil
                </a>{" "}
                &rarr; <em>Register</em> &rarr; <em>Vendor</em>. CAGE is
                required at signup, takes ~10 min.
              </li>
              <li>
                <strong>No SPRS Cyber Vendor User role?</strong> In PIEE, hit{" "}
                <em>My Account</em> &rarr; <em>Add Roles</em> &rarr; SPRS
                &rarr; <strong>Cyber Vendor User</strong>. Your company&rsquo;s
                Contractor Account Manager (CAM) approves it. No CAM yet? The
                first user to register a CAGE becomes the CAM automatically.
              </li>
              <li>
                <strong>CAGE missing from SPRS hierarchy dropdown?</strong>{" "}
                Usually means CAM hasn&rsquo;t approved your role yet, or
                you&rsquo;re logged in under a different CAGE. Recheck the
                CAM status, then refresh SPRS.
              </li>
              <li>
                Need the full walkthrough?{" "}
                <Link
                  href="/sprs-guide"
                  className="font-medium underline decoration-amber-400 underline-offset-2"
                >
                  Open the SPRS guide &rarr;
                </Link>
              </li>
            </ul>
          </details>
        </div>

        <div className="border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Affirmation statement
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            I affirm that <strong>{organizationName}</strong> implements all
            15 CMMC Level 1 basic safeguarding requirements (FAR
            52.204-21(b)(1)(i)–(b)(1)(xv)) as described in the accompanying
            System Security Plan, and that the information provided is
            accurate and complete as of today. I understand that this
            affirmation is a material representation of fact upon which the
            Government relies and that knowingly false statements may subject
            me and the organization to criminal and civil penalties under the
            False Claims Act and 18 U.S.C. § 1001.
          </p>
          <label className="mt-4 flex gap-3 text-sm">
            <input
              type="checkbox"
              name="acknowledged"
              required
              className="mt-0.5 h-4 w-4 flex-none accent-slate-900"
            />
            <span className="text-slate-800">
              I have read the statement above and am authorized to affirm on
              behalf of <strong>{organizationName}</strong>.
            </span>
          </label>
        </div>

        <div className="border border-emerald-200 bg-emerald-50/60 p-5">
          <h3 className="text-sm font-semibold text-emerald-900">
            What happens after you click Sign
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-emerald-900">
            <li>
              Custodia seals your affirmation memo and System Security Plan
              into a tamper-evident attestation packet (HMAC-signed,
              SHA-256-fingerprinted, KMS-encrypted at rest).
            </li>
            <li>
              <strong>Custodia does not submit to SPRS for you.</strong>{" "}
              Under the CMMC Final Rule (32 CFR § 170), only the Affirming
              Official can post the affirmation, and they must do it
              themselves inside PIEE/SPRS. There is no API for vendors to
              auto-submit.
            </li>
            <li>
              On the next page we give you a white-glove{" "}
              <em>&ldquo;Copy these into SPRS&rdquo;</em> card — every
              field the SPRS form asks for, in order, with a one-click copy
              button. The whole posting takes about 10 minutes.
            </li>
            <li>
              Paste back the CMMC Status Date SPRS shows you and we&rsquo;ll
              email you a Statement of Compliance and put you on the annual
              renewal calendar.
            </li>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          {/*
            Loud red banner directly above the Sign button. The earlier
            "What happens after you click Sign" section mentions in passing
            that Custodia doesn't auto-submit, but it lives inside a green
            box that reads as "everything is fine" reassurance — users were
            walking out the door thinking we'd posted to SPRS for them.
            This banner makes the boundary impossible to miss: the
            submission to SPRS is yours to make, not ours, period.
          */}
          <div className="w-full border-l-4 border-[#7a2e1c] bg-[#fdecea] p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-[#7a2e1c]">
              ⚠ Custodia does NOT submit to SPRS for you
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#5a1f10]">
              After you sign, log into PIEE at{" "}
              <a
                href="https://piee.eb.mil"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                https://piee.eb.mil
              </a>{" "}
              and file your CMMC Level 1 self-assessment in SPRS yourself —
              only your Senior Official&rsquo;s PIEE account can post the
              affirmation (32 CFR § 170.22). Custodia generates the artifacts
              and the copy-paste card, but an unsubmitted affirmation is
              invisible to contracting officers.
            </p>
          </div>
          <button
            type="submit"
            disabled={disabled || isPending}
            className="inline-flex items-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Spinner /> Sealing affirmation…
              </>
            ) : (
              <>Sign and affirm &rarr;</>
            )}
          </button>
          <Link
            href={`/assessments/${assessmentId}`}
            className="border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      {showOverlay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0e2a23]/70 p-4 backdrop-blur-sm"
          onClick={dismissOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Affirmation in progress"
        >
          <div
            className="w-full max-w-xl border border-[#cfe3d9] bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              {isPending
                ? "Affirmation in progress"
                : submitError
                  ? "Affirmation paused"
                  : "Affirmation ready"}
            </div>
            <h3 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
              {isPending
                ? `Filing for ${organizationName}…`
                : submitError
                  ? "We caught a gap before signing"
                  : `Filing for ${organizationName}`}
            </h3>
            <p className="mt-1 text-sm text-[#456c5f]">
              {isPending
                ? "Each check below has to pass before the affirmation memo is sealed and posted to your assessment record."
                : submitError
                  ? "Your data is safe. Fix the highlighted check and try again — nothing was filed."
                  : "These are the checks the Platform runs every time you sign."}
            </p>

            <ol className="mt-5 space-y-3">
              {STEPS.map((step, i) => {
                const status = stepStatus[i];
                const isActive = activeStep === i && status === "running";
                return (
                  <li
                    key={step.label}
                    className={`flex gap-3 border px-3 py-2.5 transition-colors ${
                      status === "failed"
                        ? "border-rose-300 bg-rose-50"
                        : status === "done"
                          ? "border-[#cfe3d9] bg-[#f1f6f3]"
                          : isActive
                            ? "border-[#2f8f6d] bg-white"
                            : "border-slate-200 bg-white"
                    }`}
                  >
                    <StepIcon status={status} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold ${
                          status === "failed"
                            ? "text-rose-900"
                            : "text-[#10231d]"
                        }`}
                      >
                        {step.label}
                      </div>
                      <div className="text-xs text-[#456c5f]">{step.detail}</div>
                      {status === "failed" && submitError && (
                        <div className="mt-1.5 text-xs font-medium text-rose-800">
                          {submitError}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {!isPending && submitError && (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={dismissOverlay}
                  className="border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#2f8f6d] text-[10px] font-bold text-white"
      >
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white"
      >
        ✕
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center text-[#2f8f6d]"
      >
        <Spinner />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-400"
    >
      ·
    </span>
  );
}
