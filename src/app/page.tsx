"use client";

import { useState } from "react";

const BOOTCAMP_DAYS = [
  {
    day: "Day 1",
    title: "Foundation & SAM.gov Registration",
    items: [
      "Register your business on SAM.gov (System for Award Management)",
      "Obtain a CAGE Code and UEI number",
      "Identify your NAICS codes for defense/federal work",
      "Set up your secure business email and document storage",
    ],
  },
  {
    day: "Day 2",
    title: "CMMC Level 1 Requirements",
    items: [
      "Understand the 17 CMMC Level 1 practices (FAR 52.204-21)",
      "Audit your current IT environment against each control",
      "Identify gaps across access control, media protection, and incident response",
      "Create your System Security Plan (SSP) draft",
    ],
  },
  {
    day: "Day 3",
    title: "Access Control & Identity",
    items: [
      "Implement multi-factor authentication (MFA) on all accounts",
      "Establish least-privilege access policies",
      "Configure password management and session controls",
      "Document user accounts and access rights",
    ],
  },
  {
    day: "Day 4",
    title: "Data Protection & Media",
    items: [
      "Identify and label all Federal Contract Information (FCI)",
      "Implement encryption for data at rest and in transit",
      "Establish removable media policies",
      "Set up secure data disposal procedures",
    ],
  },
  {
    day: "Day 5",
    title: "Configuration & Patching",
    items: [
      "Establish baseline configurations for all systems",
      "Implement automated patch management",
      "Disable unnecessary services and ports",
      "Document your configuration management process",
    ],
  },
  {
    day: "Day 6",
    title: "Incident Response & Audit",
    items: [
      "Draft your Incident Response Plan (IRP)",
      "Enable audit logging on all critical systems",
      "Set up log retention (minimum 90 days)",
      "Test your incident reporting process with DFARS clause 252.204-7012",
    ],
  },
  {
    day: "Day 7",
    title: "First Bid & Go-Live",
    items: [
      "Review and finalize your System Security Plan",
      "Complete your self-attestation for CMMC Level 1",
      "Search SAM.gov for active solicitations matching your NAICS codes",
      "Submit your first bid with full compliance documentation",
    ],
  },
];

const MANAGED_FEATURES = [
  {
    icon: "🔒",
    title: "Continuous Monitoring",
    desc: "We watch your 17 CMMC Level 1 controls 24/7 and alert you the moment anything drifts out of compliance.",
  },
  {
    icon: "📋",
    title: "Policy Maintenance",
    desc: "Your SSP, IRP, and all compliance docs stay current. We update them as regulations change — you never touch a policy document again.",
  },
  {
    icon: "🛡️",
    title: "Incident Response Support",
    desc: "If a cyber incident occurs, we handle the DFARS reporting to DoD within the required 72 hours, protecting your contracts.",
  },
  {
    icon: "📊",
    title: "Monthly Compliance Reports",
    desc: "Audit-ready reports on your compliance posture sent monthly — ready to show contracting officers on demand.",
  },
  {
    icon: "🔄",
    title: "Patch & Config Management",
    desc: "We track your patch status and system configurations against CMMC baselines so you are always bid-ready.",
  },
  {
    icon: "📞",
    title: "Dedicated Compliance Advisor",
    desc: "One point of contact for every compliance question, contract requirement, and audit request. No ticket queues.",
  },
];

function WaitlistForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("You are on the list! We will be in touch within 24 hours.");
        setForm({ name: "", email: "", company: "" });
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md mx-auto">
      <input
        type="text"
        placeholder="Your name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
      <input
        type="email"
        required
        placeholder="Work email *"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
      <input
        type="text"
        placeholder="Company name"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-60 text-gray-900 font-bold py-3 px-8 rounded-lg transition-colors text-lg"
      >
        {status === "loading" ? "Submitting..." : "Apply for the Bootcamp →"}
      </button>
      {message && (
        <p className={`text-sm text-center font-medium ${status === "success" ? "text-green-400" : "text-red-400"}`}>
          {message}
        </p>
      )}
    </form>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-[family-name:var(--font-geist-sans)]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Custodia<span className="text-amber-400">.</span>
          </span>
          <a
            href="#apply"
            className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Apply Now
          </a>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6 bg-[#0a0f1e] text-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 text-amber-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            Now accepting applications - Cohort 1
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-6">
            Win Your First <span className="text-amber-400">Government Contract</span> in One Week
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            The intensive 7-day bootcamp that takes your startup from zero to <strong className="text-white">CMMC Level 1 compliant</strong> — registered, documented, and ready to bid on federal contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="#apply" className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg transition-colors">
              Apply for the Bootcamp →
            </a>
            <a href="#program" className="text-gray-300 hover:text-white font-medium px-8 py-4 transition-colors">
              See the program ↓
            </a>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { stat: "7 days", label: "to first bid" },
              { stat: "CMMC 1", label: "compliant" },
              { stat: "$0", label: "penalties risk" },
            ].map(({ stat, label }) => (
              <div key={stat} className="text-center">
                <div className="text-3xl font-black text-amber-400">{stat}</div>
                <div className="text-sm text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
            The $900B federal market is <span className="text-red-500">locked</span> behind compliance walls
          </h2>
          <p className="text-gray-500 text-center text-lg mb-16 max-w-2xl mx-auto">
            Most startups never bid on government contracts — not because they lack the product, but because they do not know how to navigate CMMC, SAM.gov, and federal procurement.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { emoji: "😰", title: "Compliance is overwhelming", desc: "CMMC, DFARS, NIST 800-171 — the acronyms alone stop most founders before they start." },
              { emoji: "💸", title: "Consultants cost $50k+", desc: "Traditional compliance firms charge enterprise rates. Startups cannot afford to even get in the room." },
              { emoji: "⏳", title: "Years of waiting", desc: "Most companies take 12-18 months to get contract-ready. By then, competitors have the relationships." },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-4xl mb-4">{emoji}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-amber-50 text-amber-700 font-semibold text-sm px-4 py-1.5 rounded-full mb-6">
            The Custodia Method
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
            We built the fastest path from <span className="text-amber-400">startup to contractor</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-16 leading-relaxed">
            Custodia compresses what takes most companies a year into a structured 7-day bootcamp — live workshops, done-for-you documentation, and expert guidance every step of the way.
          </p>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            {[
              { before: "18 months of DIY compliance", after: "7 days with expert guidance" },
              { before: "$50k+ traditional consulting", after: "Accessible bootcamp pricing" },
              { before: "Generic NIST frameworks", after: "CMMC Level 1 — exactly what DoD requires" },
              { before: "Compliance then forget", after: "Managed year-round so you stay bid-ready" },
            ].map(({ before, after }) => (
              <div key={after} className="flex items-start gap-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex-1">
                  <div className="text-red-400 text-sm line-through mb-1">{before}</div>
                  <div className="text-green-600 font-semibold">✓ {after}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="program" className="py-24 px-6 bg-[#0a0f1e] text-white scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold text-sm px-4 py-1.5 rounded-full mb-6">
              The 7-Day Bootcamp
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">Your week, day by day</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Every day has a specific deliverable. By end of Day 7, you are compliant and your first bid is submitted.
            </p>
          </div>
          <div className="space-y-4">
            {BOOTCAMP_DAYS.map((d, i) => (
              <div key={d.day} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center font-black text-gray-900 text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">{d.day}</div>
                    <h3 className="font-bold text-lg mb-3">{d.title}</h3>
                    <ul className="space-y-1.5">
                      {d.items.map((item) => (
                        <li key={item} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              What is <span className="text-amber-500">CMMC Level 1</span>?
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              The Cybersecurity Maturity Model Certification (CMMC) is the Department of Defense framework for protecting Federal Contract Information (FCI). Level 1 is the entry point — required for any company handling non-sensitive federal data.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8">
            <h3 className="font-bold text-xl mb-6 text-center">The 17 CMMC Level 1 Practices (FAR 52.204-21)</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                "Limit system access to authorized users",
                "Limit system access to authorized transactions",
                "Verify and control external system connections",
                "Control CUI posted to publicly accessible systems",
                "Identify and authenticate system users",
                "Sanitize or destroy media before disposal",
                "Limit physical access to authorized individuals",
                "Escort visitors and monitor physical access",
                "Maintain audit logs of system activity",
                "Perform periodic scans for malicious code",
                "Update malicious code protection mechanisms",
                "Perform ad-hoc scans of files from external sources",
                "Identify, report, and correct information flaws",
                "Provide training on security awareness",
                "Establish baseline configurations",
                "Restrict, disable, or prevent wireless access",
                "Control wireless access using authentication",
              ].map((practice, i) => (
                <div key={practice} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="text-amber-500 font-bold flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  {practice}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <p className="text-amber-800 font-medium">
              <strong>Bottom line:</strong> If your startup handles any federal contract information, CMMC Level 1 is not optional. It is a contract requirement as of 2025. Without it, you cannot bid.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-amber-50 text-amber-700 font-semibold text-sm px-4 py-1.5 rounded-full mb-6">
              Monthly Managed Service
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              We keep you compliant <span className="text-amber-500">year-round</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Winning the first contract is day one. Keeping your CMMC compliance active — while you focus on executing contracts and winning more — is where Custodia becomes your unfair advantage.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MANAGED_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Simple pricing, serious results</h2>
            <p className="text-gray-500 text-lg">No hidden fees. No long-term lock-in on the bootcamp.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0a0f1e] text-white rounded-2xl p-8 flex flex-col">
              <div className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-2">The Bootcamp</div>
              <div className="text-4xl font-black mb-1">Coming Soon</div>
              <div className="text-gray-400 text-sm mb-6">One-time · 7 days</div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "7 live daily workshop sessions",
                  "Done-for-you System Security Plan",
                  "SAM.gov registration walkthrough",
                  "CMMC Level 1 self-attestation guide",
                  "First bid submission support",
                  "30-day post-bootcamp access",
                ].map((f) => (
                  <li key={f} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 flex-shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="#apply" className="block text-center bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold py-3 px-6 rounded-xl transition-colors">
                Apply Now →
              </a>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col">
              <div className="text-amber-500 text-sm font-bold uppercase tracking-widest mb-2">Managed Compliance</div>
              <div className="text-4xl font-black mb-1">Coming Soon</div>
              <div className="text-gray-400 text-sm mb-6">Per month · Cancel anytime</div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Continuous CMMC Level 1 monitoring",
                  "All policy documents maintained",
                  "Monthly compliance reports",
                  "DFARS incident response support",
                  "Configuration and patch tracking",
                  "Dedicated compliance advisor",
                  "Audit-ready documentation on demand",
                ].map((f) => (
                  <li key={f} className="text-gray-600 text-sm flex items-start gap-2">
                    <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="#apply" className="block text-center bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-colors">
                Join Waitlist →
              </a>
            </div>
          </div>
          <p className="text-center text-gray-400 text-sm mt-6">
            Bootcamp graduates receive priority access and a discount on the Managed Compliance plan.
          </p>
        </div>
      </section>

      <section id="apply" className="py-24 px-6 bg-[#0a0f1e] text-white scroll-mt-16">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-block bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold text-sm px-4 py-1.5 rounded-full mb-6">
            Limited spots · Cohort 1
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4">Ready to bid on federal contracts?</h2>
          <p className="text-gray-300 text-lg mb-10">
            Apply now and we will reach out within 24 hours to confirm your spot in the next bootcamp cohort.
          </p>
          <WaitlistForm />
          <p className="text-gray-500 text-xs mt-4">
            No spam. No credit card required to apply. We will reach out to discuss fit.
          </p>
        </div>
      </section>

      <footer className="bg-[#07091a] text-gray-500 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-white font-bold text-lg">Custodia<span className="text-amber-400">.</span></div>
          <p className="text-sm text-center">CMMC Level 1 Bootcamp and Managed Compliance for Government Contractors</p>
          <p className="text-sm">© {new Date().getFullYear()} Custodia. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
