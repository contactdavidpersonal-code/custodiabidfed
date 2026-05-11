/**
 * Blog visual library — original SVG illustrations referenced from blog posts.
 *
 * Design rules:
 * - Light theme, palette anchored on Custodia's emerald/mint (#2f8f6d, #8dd2b1, #bdf2cf, #f7fcf9, #08201a).
 * - All shapes inline SVG so they render in AI-indexed HTML, work with no JS,
 *   and stay crisp at any size.
 * - Each visual exports a single React component with an aria-label.
 * - Every component sits inside <figure> with a <figcaption> so AI engines
 *   index the alt text alongside the post.
 */

import type { ReactNode } from "react";

function Figure({
  caption,
  children,
}: {
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="mt-10 not-prose">
      <div className="overflow-hidden border border-[#cfe3d9] bg-white p-4 md:p-6">
        {children}
      </div>
      <figcaption className="mt-3 text-center text-xs italic leading-relaxed text-[#5a7d70]">
        {caption}
      </figcaption>
    </figure>
  );
}

/**
 * Visual #1 — The CMMC Level Decision Tree.
 *
 * Does the contractor handle FCI? CUI? Critical CUI? Routes to L1 / L2 / L3 /
 * Not subject. Drawn as a horizontal flow so it reads in a single glance on
 * desktop and stacks readably on mobile.
 */
export function CMMCLevelDecisionTree() {
  return (
    <Figure caption="The CMMC level decision tree: which level applies based on the data you handle. Source: 32 CFR Part 170 §170.14.">
      <svg
        viewBox="0 0 880 460"
        role="img"
        aria-label="CMMC level decision tree. Branch 1: Do you handle Federal Contract Information? If no, you are not subject to CMMC. If yes, do you handle Controlled Unclassified Information? If no, Level 1 applies. If yes, is the program a high-priority DoD program? If no, Level 2. If yes, Level 3."
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
      >
        <defs>
          <marker
            id="dt-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#2f8f6d" />
          </marker>
        </defs>

        {/* Start */}
        <g>
          <rect x="20" y="200" width="160" height="60" rx="6" fill="#08201a" />
          <text
            x="100"
            y="226"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#bdf2cf"
          >
            Federal contract
          </text>
          <text
            x="100"
            y="244"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#bdf2cf"
          >
            in your name?
          </text>
        </g>

        {/* Arrow Start → Q1 */}
        <line
          x1="180"
          y1="230"
          x2="218"
          y2="230"
          stroke="#2f8f6d"
          strokeWidth="2"
          markerEnd="url(#dt-arrow)"
        />

        {/* Q1: Handle FCI? */}
        <g>
          <rect
            x="220"
            y="190"
            width="180"
            height="80"
            rx="6"
            fill="#f7fcf9"
            stroke="#2f8f6d"
            strokeWidth="2"
          />
          <text
            x="310"
            y="222"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            Do you receive
          </text>
          <text
            x="310"
            y="240"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            non-public contract
          </text>
          <text
            x="310"
            y="258"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            info (FCI)?
          </text>
        </g>

        {/* Q1 No → Not subject */}
        <path
          d="M 310 270 Q 310 360 230 380"
          stroke="#94a8a0"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="270"
          y="320"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#5a7d70"
        >
          NO
        </text>
        <g>
          <rect
            x="40"
            y="370"
            width="190"
            height="60"
            rx="6"
            fill="#eef2f0"
            stroke="#94a8a0"
            strokeWidth="2"
          />
          <text
            x="135"
            y="396"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#1d3a30"
          >
            Not subject
          </text>
          <text
            x="135"
            y="414"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="11"
            fill="#5a7d70"
          >
            to CMMC
          </text>
        </g>

        {/* Q1 Yes → Q2 */}
        <line
          x1="400"
          y1="230"
          x2="438"
          y2="230"
          stroke="#2f8f6d"
          strokeWidth="2"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="410"
          y="222"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#2f8f6d"
        >
          YES
        </text>

        {/* Q2: Handle CUI? */}
        <g>
          <rect
            x="440"
            y="190"
            width="180"
            height="80"
            rx="6"
            fill="#f7fcf9"
            stroke="#2f8f6d"
            strokeWidth="2"
          />
          <text
            x="530"
            y="222"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            Does any of it
          </text>
          <text
            x="530"
            y="240"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            carry a CUI
          </text>
          <text
            x="530"
            y="258"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            marking?
          </text>
        </g>

        {/* Q2 No → Level 1 */}
        <path
          d="M 530 270 Q 530 360 460 380"
          stroke="#2f8f6d"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="490"
          y="320"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#5a7d70"
        >
          NO
        </text>
        <g>
          <rect
            x="270"
            y="370"
            width="190"
            height="60"
            rx="6"
            fill="#bdf2cf"
            stroke="#1f5c47"
            strokeWidth="2"
          />
          <text
            x="365"
            y="395"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="15"
            fontWeight="700"
            fill="#0c2219"
          >
            CMMC Level 1
          </text>
          <text
            x="365"
            y="415"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="11"
            fill="#1f5c47"
          >
            Self-assessed annually
          </text>
        </g>

        {/* Q2 Yes → Q3 */}
        <line
          x1="620"
          y1="230"
          x2="658"
          y2="230"
          stroke="#2f8f6d"
          strokeWidth="2"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="630"
          y="222"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#2f8f6d"
        >
          YES
        </text>

        {/* Q3: high-priority program? */}
        <g>
          <rect
            x="660"
            y="190"
            width="200"
            height="80"
            rx="6"
            fill="#f7fcf9"
            stroke="#2f8f6d"
            strokeWidth="2"
          />
          <text
            x="760"
            y="222"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            Designated as
          </text>
          <text
            x="760"
            y="240"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            high-priority
          </text>
          <text
            x="760"
            y="258"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="13"
            fontWeight="700"
            fill="#10231d"
          >
            DoD program?
          </text>
        </g>

        {/* Q3 No → Level 2 */}
        <path
          d="M 760 270 Q 760 360 690 380"
          stroke="#2f8f6d"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="720"
          y="320"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#5a7d70"
        >
          NO
        </text>
        <g>
          <rect
            x="500"
            y="370"
            width="190"
            height="60"
            rx="6"
            fill="#fff8e8"
            stroke="#a07c2e"
            strokeWidth="2"
          />
          <text
            x="595"
            y="395"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="15"
            fontWeight="700"
            fill="#5d4f30"
          >
            CMMC Level 2
          </text>
          <text
            x="595"
            y="415"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="11"
            fill="#5d4f30"
          >
            C3PAO every 3 years
          </text>
        </g>

        {/* Q3 Yes → Level 3 */}
        <path
          d="M 760 270 Q 800 360 800 380"
          stroke="#2f8f6d"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#dt-arrow)"
        />
        <text
          x="800"
          y="320"
          fontFamily="ui-monospace"
          fontSize="11"
          fontWeight="700"
          fill="#2f8f6d"
        >
          YES
        </text>
        <g>
          <rect
            x="700"
            y="370"
            width="170"
            height="60"
            rx="6"
            fill="#fbe2e2"
            stroke="#a04a4a"
            strokeWidth="2"
          />
          <text
            x="785"
            y="395"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="15"
            fontWeight="700"
            fill="#702626"
          >
            CMMC Level 3
          </text>
          <text
            x="785"
            y="415"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui"
            fontSize="11"
            fill="#702626"
          >
            DIBCAC assessed
          </text>
        </g>
      </svg>
    </Figure>
  );
}

/**
 * Visual #2 — FCI vs CUI side-by-side cards.
 */
export function FCIvsCUI() {
  return (
    <Figure caption="FCI vs CUI — the single decision that puts you in Level 1 or Level 2. Source: 32 CFR Part 2002 §2002.4 (CUI definition); FAR 4.1901 (FCI definition).">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-[#cfe3d9] bg-[#f7fcf9] p-5">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            FCI &mdash; Level 1
          </div>
          <h4 className="mt-2 font-serif text-lg font-bold text-[#10231d]">
            Federal Contract Information
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-[#1d3a30]">
            Non-public information you receive or generate <em>under</em> a
            federal contract, but that the government has not specifically
            designated for protection.
          </p>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#5a7d70]">
            Examples
          </div>
          <ul className="mt-1 space-y-1 text-sm text-[#1d3a30]">
            <li>&middot; A delivery schedule for non-classified parts</li>
            <li>&middot; A statement of work for routine IT support</li>
            <li>&middot; Pricing on a maintenance contract</li>
            <li>&middot; Email about a janitorial scope of work on a base</li>
          </ul>
        </div>
        <div className="border-2 border-[#a07c2e] bg-[#fff8e8] p-5">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a07c2e]">
            CUI &mdash; Level 2
          </div>
          <h4 className="mt-2 font-serif text-lg font-bold text-[#10231d]">
            Controlled Unclassified Information
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-[#1d3a30]">
            Information the government has specifically designated for
            safeguarding under the CUI program (32 CFR Part 2002). Usually
            carries a banner marking like{" "}
            <code className="font-mono text-xs">CUI//SP-EXPT</code>.
          </p>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#5d4f30]">
            Examples
          </div>
          <ul className="mt-1 space-y-1 text-sm text-[#1d3a30]">
            <li>&middot; A technical drawing marked CUI//SP-EXPT</li>
            <li>&middot; Export-controlled (ITAR) technical data</li>
            <li>&middot; PII from a DoD personnel records contract</li>
            <li>&middot; A vulnerability assessment of a DoD system</li>
          </ul>
        </div>
      </div>
    </Figure>
  );
}

/**
 * Visual #3 — The 15 FAR safeguarding requirements grouped by domain.
 */
const REQS: { id: string; domain: string; title: string }[] = [
  { id: "AC.L1-3.1.1", domain: "Access Control", title: "Limit access to authorized users" },
  { id: "AC.L1-3.1.2", domain: "Access Control", title: "Limit functions per user" },
  { id: "AC.L1-3.1.20", domain: "Access Control", title: "Control external connections" },
  { id: "AC.L1-3.1.22", domain: "Access Control", title: "Control public information" },
  { id: "IA.L1-3.5.1", domain: "Identification & Auth", title: "Identify users & devices" },
  { id: "IA.L1-3.5.2", domain: "Identification & Auth", title: "Authenticate users & devices" },
  { id: "MP.L1-3.8.3", domain: "Media Protection", title: "Sanitize media before disposal" },
  { id: "PE.L1-3.10.1", domain: "Physical Protection", title: "Limit physical access" },
  { id: "PE.L1-3.10.3", domain: "Physical Protection", title: "Escort & monitor visitors" },
  { id: "PE.L1-3.10.4", domain: "Physical Protection", title: "Physical access logs" },
  { id: "PE.L1-3.10.5", domain: "Physical Protection", title: "Manage physical access devices" },
  { id: "SC.L1-3.13.1", domain: "System & Comms", title: "Monitor communications at boundary" },
  { id: "SC.L1-3.13.5", domain: "System & Comms", title: "Public-system subnetworks" },
  { id: "SI.L1-3.14.1", domain: "System & Info Integrity", title: "Identify & correct system flaws" },
  { id: "SI.L1-3.14.2", domain: "System & Info Integrity", title: "Malicious code protection" },
];

export function FifteenRequirements() {
  const byDomain = REQS.reduce<Record<string, typeof REQS>>((acc, r) => {
    (acc[r.domain] ||= []).push(r);
    return acc;
  }, {});
  return (
    <Figure caption="The 15 FAR 52.204-21(b)(1) safeguarding requirements, grouped by the six CMMC Level 1 domains. Source: 48 CFR §52.204-21; DoD CMMC Scoping Guide — Level 1, v2.13 (Sept 2024).">
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(byDomain).map(([domain, items]) => (
          <div key={domain} className="border border-[#cfe3d9] bg-[#f7fcf9] p-4">
            <div className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              {domain} &mdash; {items.length}{" "}
              {items.length === 1 ? "requirement" : "requirements"}
            </div>
            <ul className="space-y-1.5">
              {items.map((r) => (
                <li key={r.id} className="flex items-baseline gap-2">
                  <code className="font-mono text-[11px] font-bold text-[#1f5c47]">
                    {r.id}
                  </code>
                  <span className="text-[13px] leading-snug text-[#1d3a30]">
                    {r.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Figure>
  );
}
