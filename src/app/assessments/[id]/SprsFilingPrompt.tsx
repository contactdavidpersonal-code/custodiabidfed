import Link from "next/link";
import { publishVerifiedPageAction, recordSprsFilingAction } from "../actions";
import { CopyButton } from "@/components/CopyButton";

/**
 * Post-filing receipt card. The CMMC Status Date SPRS posted is the
 * authoritative federal artifact; the optional internal reference is a
 * free-form customer-side note (ticket #, screenshot ID, PIEE handle).
 * Both fields stay editable in case of a typo on first paste, and every
 * change is audit-logged on the server.
 */
export function SprsFilingReceiptCard({
  assessmentId,
  fiscalYear,
  sprsFiledAt,
  sprsStatusDate,
  sprsInternalReference,
  custodiaVerificationId,
}: {
  assessmentId: string;
  fiscalYear: number;
  sprsFiledAt: string;
  /** ISO yyyy-mm-dd from the DATE column. May be null for legacy filings. */
  sprsStatusDate: string | null;
  /** Legacy/internal reference string. May be null. */
  sprsInternalReference: string | null;
  custodiaVerificationId: string | null;
}) {
  const filed = new Date(sprsFiledAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  // Display the CMMC Status Date prominently. For legacy filings that
  // pre-date this column we fall back to showing the user's old reference
  // string in the same slot so existing records still render meaningfully.
  const statusDateDisplay = sprsStatusDate
    ? new Date(`${sprsStatusDate}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const nextDue = new Date(
    Date.UTC((fiscalYear ?? new Date().getUTCFullYear()) + 1, 8, 30),
  ).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="border border-emerald-300 bg-emerald-50/70 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Filed in SPRS · FY{fiscalYear}
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-emerald-900">
            You&rsquo;re bid-eligible for this fiscal year.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Your CMMC Level 1 annual affirmation is on record with the federal
            government. Custodia will monitor your connectors, push freshness
            reminders, and nudge you 60 / 30 / 14 days before your next
            re-affirmation.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Custodia ID
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold text-emerald-900">
                {custodiaVerificationId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                CMMC Status Date
              </dt>
              <dd className="mt-1 font-semibold text-emerald-900">
                {statusDateDisplay ?? sprsInternalReference ?? "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Filed
              </dt>
              <dd className="mt-1 font-semibold text-emerald-900">{filed}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Next re-affirmation
              </dt>
              <dd className="mt-1 font-semibold text-emerald-900">{nextDue}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/assessments/${assessmentId}/statement`}
            className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Download Statement of Compliance
          </Link>
          <Link
            href="/opportunities"
            className="border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 transition-colors hover:border-emerald-400"
          >
            Find bids →
          </Link>
        </div>
      </div>

      <form
        action={recordSprsFilingAction}
        className="mt-6 border-t border-emerald-200 pt-5"
      >
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor="statusDate"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              CMMC Status Date
            </label>
            <input
              id="statusDate"
              name="statusDate"
              type="date"
              required
              defaultValue={sprsStatusDate ?? ""}
              className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="confirmationNumber"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Internal reference{" "}
              <span className="font-normal normal-case text-slate-500">(optional)</span>
            </label>
            <input
              id="confirmationNumber"
              name="confirmationNumber"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              pattern="[A-Za-z0-9_\-]+"
              defaultValue={sprsInternalReference ?? ""}
              className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Save changes
          </button>
          <p className="text-xs leading-snug text-slate-500">
            SPRS does not issue a confirmation number — the CMMC Status Date is the federal artifact. Use the internal reference for your own tracking. Every change is audit-logged.
          </p>
        </div>
      </form>
    </div>
  );
}

/**
 * Custodia Verified offer card — only shown on the bid-packet page (step 6)
 * after the user has filed in SPRS. Two states: not-yet-published (offer +
 * benefits + Publish button) and published (live page receipt + manage link).
 * The customer's CMMC Status Date and any internal reference are NEVER shown
 * on the public page; the public identifier is the human-friendly Custodia
 * Verification ID.
 */
export function VerifiedPageOfferCard({
  assessmentId,
  custodiaVerificationId,
  verifiedPagePublic,
  verifiedPageSlug,
}: {
  assessmentId: string;
  custodiaVerificationId: string | null;
  verifiedPagePublic: boolean;
  verifiedPageSlug: string | null;
}) {
  if (verifiedPagePublic && verifiedPageSlug) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
    ).replace(/\/$/, "");
    const publicUrl = `${appUrl}/verified/${verifiedPageSlug}`;
    const badgeImg = `${appUrl}/custodia-logo.png`;
    const altText = `CMMC Level 1 — Custodia Verified${
      custodiaVerificationId ? ` — ${custodiaVerificationId}` : ""
    }`;
    const embedHtml = `<a href="${publicUrl}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;font-family:system-ui,sans-serif"><img src="${badgeImg}" alt="${altText}" width="96" height="115" style="display:block;height:auto"/><div style="margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#10231d">CMMC Level 1 · Verified</div></a>`;
    const embedMarkdown = `[![${altText}](${badgeImg})](${publicUrl})`;

    return (
      <div className="border border-emerald-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Custodia Verified · Live
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
              Your public Verified page is live.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Share your page or badge with primes and contracting officers.
              The page updates automatically as Custodia&rsquo;s monitoring
              signals change. Your CMMC Status Date and any internal
              reference you logged stay private — only your Custodia ID is
              shown publicly.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono font-semibold text-emerald-900">
                {custodiaVerificationId ?? "—"}
              </span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 underline hover:text-emerald-800"
              >
                View public page →
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/assessments/${assessmentId}/verified`}
              className="bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Manage Verified page
            </Link>
          </div>
        </div>

        {/* Badge embed — the actual Custodia shield logo, exactly as it
            appears in the header, that the customer can drop on their site,
            email signature, or capability statement. Click → their public
            Verified page. */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            Your Custodia badge
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-full max-w-xs flex-col items-center gap-2 border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/custodia-logo.png"
              alt={altText}
              width={96}
              height={115}
              className="h-24 w-auto"
            />
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#10231d]">
              CMMC Level 1 · Verified
            </div>
          </a>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Click to preview where the badge links.
          </p>
          <p className="mt-4 text-sm text-slate-700">
            Drop this on your website footer, capability statement, or email
            signature. Clicking opens your live Custodia Verified page so
            primes can confirm your CMMC Level 1 status in seconds.
          </p>
          <EmbedSnippet label="HTML" code={embedHtml} />
          <EmbedSnippet label="Markdown" code={embedMarkdown} />
          <EmbedSnippet label="Direct link" code={publicUrl} />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-amber-50/40 shadow-sm">
      <div className="p-6 lg:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            New · Available now
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Your Custodia Verified page is ready.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A live, federally-professional profile primes can use to vet you
            in 30 seconds. Continuously monitored. Updates automatically when
            your evidence freshens or your Microsoft 365 / Google Workspace
            tenant signals drift.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                <strong>Custodia ID:</strong>{" "}
                <span className="font-mono">
                  {custodiaVerificationId ?? "—"}
                </span>{" "}
                — your public identifier (your SPRS number stays private).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                UEI, CAGE, NAICS, set-asides — pulled from your bid-ready
                profile.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                Live <em>Healthy</em> badge with a timestamped freshness
                signal.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                &ldquo;Verify on SAM.gov&rdquo; + &ldquo;Verify SPRS by
                UEI&rdquo; outbound links so primes can independently confirm
                your federal record.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>
                Embeddable badge for your website, capability statement, and
                email signature.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-emerald-700">✓</span>
              <span>500-character custom about section — your words.</span>
            </li>
          </ul>
          <p className="mt-4 border border-slate-200 bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
            <strong>Privacy:</strong> your CMMC Status Date and any internal
            reference are never shown on the public page or in the URL. The Custodia Verification
            ID is the only public identifier and reveals nothing private. You
            can unpublish, customize, or rotate the ID any time from{" "}
            <em>Manage Verified page</em>.
          </p>
        </div>
        <div className="border-t border-slate-200 bg-white p-6 lg:p-8">
          <h3 className="text-sm font-bold text-slate-900">
            Publish your page
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            One click. You can review and edit content from the manage panel
            after publishing.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={publishVerifiedPageAction}>
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <button
                type="submit"
                className="bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
              >
                Publish my Verified page
              </button>
            </form>
            <Link
              href={`/assessments/${assessmentId}/verified`}
              className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400"
            >
              Preview &amp; customize first
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Not now? You can publish any time from this bid-ready packet page.
          </p>
        </div>
    </div>
  );
}

/**
 * Prompt card for the SPRS filing step. Rendered ONLY on the bid-packet
 * page (step 6) — the overview shows just a small pointer until the user
 * has filed.
 */
export function SprsFilingPromptCard({
  assessmentId,
  fiscalYear,
}: {
  assessmentId: string;
  fiscalYear: number;
}) {
  return (
    <div className="border border-amber-300 bg-amber-50/60 p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Final step · File in SPRS
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            One last step the government has to see — file your affirmation in
            SPRS.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            CMMC Level 1 is annual self-attestation, not third-party
            certification. Your signed affirmation memo isn&rsquo;t the
            federal record — the SPRS posting is. Log into PIEE, post your
            assessment in SPRS, then come back and paste the CMMC Status
            Date SPRS returns. We&rsquo;ll record it with your assessment
            and email you a Statement of Compliance.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              <strong>Confirm your PIEE role first.</strong> You need the{" "}
              <code className="bg-slate-100 px-1 py-0.5 text-[12px]">SPRS Cyber Vendor User</code>{" "}
              role on your CAGE (the{" "}
              <code className="bg-slate-100 px-1 py-0.5 text-[12px]">Contractor/Vendor (Support Role)</code>{" "}
              is view-only and cannot file). New role requests are activated
              by your company&rsquo;s CAM — this can take 1–5 business days.
            </li>
            <li>
              Open{" "}
              <a
                href="https://piee.eb.mil"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-emerald-700 underline hover:text-emerald-800"
              >
                piee.eb.mil
              </a>{" "}
              → click the <strong>SPRS</strong> tile → click{" "}
              <strong>Cyber Reports</strong>.
            </li>
            <li>
              Pick your HLO from the hierarchy dropdown (SAM imports this
              automatically — your CAGE should appear with an asterisk if
              your Cyber Vendor User role is active).
            </li>
            <li>
              Open the <strong>CMMC Assessments</strong> tab → click{" "}
              <strong>Add New Level 1 CMMC Self-Assessment</strong>.
            </li>
            <li>
              Fill in the assessment details (Custodia gives you every value
              to copy — see the &ldquo;Copy these into SPRS&rdquo; card on
              this page). Click <strong>Continue to Affirmation</strong>.
            </li>
            <li>
              If you are the Affirming Official, click <strong>Affirm</strong>.
              Otherwise enter the AO&rsquo;s email and click{" "}
              <strong>Transfer to AO</strong> — SPRS will email them to
              come affirm.
            </li>
            <li>
              Status flips to{" "}
              <code className="bg-emerald-50 px-1 py-0.5 text-[12px] text-emerald-900">Final Level 1 Self-Assessment</code>{" "}
              (the only status visible to government personnel). Note the
              CMMC Status Date SPRS shows.
            </li>
            <li>
              Paste that CMMC Status Date in the form on the right for
              FY{fiscalYear}.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Don&rsquo;t have a PIEE account yet? Register at{" "}
            <a
              href="https://piee.eb.mil/xhtml/unauth/web/homepage/vendorRegistration.xhtml"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-emerald-700 underline hover:text-emerald-800"
            >
              piee.eb.mil registration
            </a>{" "}
            — same login you use for SAM.gov contracting workflows. If you
            are the only CAM on your CAGE and need self-activation, email{" "}
            <code className="bg-slate-100 px-1 py-0.5 text-[11px]">disa.global.servicedesk.mbx.eb-ticket-requests@mail.mil</code>.
          </p>
        </div>
        <form
          action={recordSprsFilingAction}
          className="min-w-0 border border-amber-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <label
            htmlFor="statusDate"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            CMMC Status Date
          </label>
          <input
            id="statusDate"
            name="statusDate"
            type="date"
            required
            className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <p className="mt-2 text-xs leading-snug text-slate-500">
            The posting date SPRS shows on your assessment record once status flips to{" "}
            <em>Final Level 1 Self-Assessment</em>. SPRS does not issue a confirmation number — this date is the federal artifact.
          </p>
          <label
            htmlFor="confirmationNumber"
            className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Internal reference{" "}
            <span className="font-normal normal-case text-slate-500">(optional)</span>
          </label>
          <input
            id="confirmationNumber"
            name="confirmationNumber"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            pattern="[A-Za-z0-9_\-]+"
            placeholder="e.g. ticket # or screenshot ID"
            className="mt-2 block w-full min-w-0 border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Optional customer-side tracking string. Letters, numbers, dashes, underscores.
          </p>
          <button
            type="submit"
            className="mt-4 w-full bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            Record SPRS filing
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            We&rsquo;ll email you a receipt + Statement of Compliance.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * Tiny pointer shown on the overview when attested-but-unfiled. Sends the
 * user back to step 6 (Bid-ready packet) to do the actual SPRS filing.
 */
export function SprsFilingPointer({ assessmentId }: { assessmentId: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border border-amber-300 bg-amber-50/60 p-5 shadow-sm">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Final step · File in SPRS
        </div>
        <p className="mt-1 text-sm text-slate-800">
          Your affirmation is signed and locked. Head to the{" "}
          <strong>Bid-ready packet</strong> step to file in SPRS and record
          the confirmation number.
        </p>
      </div>
      <Link
        href={`/assessments/${assessmentId}/bid-packet`}
        className="bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
      >
        Go to Bid-ready packet →
      </Link>
    </div>
  );
}
/**
 * Read-only code snippet block with a label. Used for embed snippets on
 * the bid-packet page. Customers can hand-copy or use browser's select-all.
 */
function EmbedSnippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <CopyButton code={code} />
      </div>
      <pre className="mt-1 max-h-32 overflow-auto border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}