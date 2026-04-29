"use client";

import { useMemo, useState, useTransition } from "react";
import {
  bidProfileCompleteness,
  newPastPerformanceEntry,
  setAsideLabels,
  type BidProfile,
  type PastPerformanceEntry,
  type SetAside,
} from "@/lib/bid-profile";

type Props = {
  initial: BidProfile;
  saveAction: (formData: FormData) => Promise<void>;
  draftCapabilityAction: (formData: FormData) => Promise<string>;
  draftDifferentiatorsAction: (formData: FormData) => Promise<string>;
};

export function BidProfileForm({
  initial,
  saveAction,
  draftCapabilityAction,
  draftDifferentiatorsAction,
}: Props) {
  const [profile, setProfile] = useState<BidProfile>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(
    initial.updated_at ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [draftingCap, setDraftingCap] = useState(false);
  const [draftingDiff, setDraftingDiff] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runDraft(
    action: (fd: FormData) => Promise<string>,
    onResult: (text: string) => void,
    setLoading: (v: boolean) => void,
  ) {
    setAiError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(profile));
      const text = await action(fd);
      if (text.trim()) onResult(text);
      else setAiError("AI returned an empty draft. Try again or fill more profile facts first.");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setLoading(false);
    }
  }

  const { score, missing } = useMemo(
    () => bidProfileCompleteness(profile),
    [profile],
  );

  function setField<K extends keyof BidProfile>(key: K, value: BidProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setInsurance<K extends keyof BidProfile["insurance"]>(
    key: K,
    value: BidProfile["insurance"][K],
  ) {
    setProfile((p) => ({ ...p, insurance: { ...p.insurance, [key]: value } }));
  }

  function setBonding<K extends keyof BidProfile["bonding"]>(
    key: K,
    value: BidProfile["bonding"][K],
  ) {
    setProfile((p) => ({ ...p, bonding: { ...p.bonding, [key]: value } }));
  }

  function toggleSetAside(s: SetAside) {
    setProfile((p) => ({
      ...p,
      set_asides: p.set_asides.includes(s)
        ? p.set_asides.filter((x) => x !== s)
        : [...p.set_asides, s],
    }));
  }

  function updatePP(id: string, patch: Partial<PastPerformanceEntry>) {
    setProfile((p) => ({
      ...p,
      past_performance: p.past_performance.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  }

  function addPP() {
    setProfile((p) => ({
      ...p,
      past_performance: [...p.past_performance, newPastPerformanceEntry()],
    }));
  }

  function removePP(id: string) {
    setProfile((p) => ({
      ...p,
      past_performance: p.past_performance.filter((e) => e.id !== id),
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("payload", JSON.stringify(profile));
    startTransition(async () => {
      try {
        await saveAction(fd);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ReadinessBanner score={score} missing={missing} />

      <Card title="Capability statement" subtitle="What you do, in your own words. Shown on the cover of every packet.">
        <Field
          label="Capability statement"
          hint="2–4 short paragraphs. Describe the services you provide, who you serve, and the outcomes you deliver. 200 character minimum for a usable packet."
        >
          <textarea
            value={profile.capability_statement}
            onChange={(e) => setField("capability_statement", e.target.value)}
            rows={6}
            className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none"
            placeholder="Acme Federal Solutions provides managed IT services to federal civilian agencies, with a focus on secure cloud migration, identity governance, and CMMC-compliant managed endpoint services for primes and subcontractors..."
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <CharCount value={profile.capability_statement} min={200} />
            <button
              type="button"
              disabled={draftingCap}
              onClick={() =>
                runDraft(
                  draftCapabilityAction,
                  (text) => setField("capability_statement", text),
                  setDraftingCap,
                )
              }
              className="rounded-sm border border-[#2f8f6d] bg-white px-3 py-1.5 text-xs font-semibold text-[#2f8f6d] hover:bg-[#f1f9f4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {draftingCap ? "Drafting…" : profile.capability_statement.trim() ? "↻ Re-draft with AI" : "✨ Draft with AI"}
            </button>
          </div>
        </Field>

        <Field
          label="Core competencies"
          hint="One per line. The 4–8 capabilities you want a contracting officer to remember."
        >
          <textarea
            value={profile.core_competencies}
            onChange={(e) => setField("core_competencies", e.target.value)}
            rows={5}
            className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none"
            placeholder={"Managed CMMC L1 compliance services\nIdentity & access management (SSO, MFA)\nSecure cloud migration (Azure GovCloud)\nIncident response & tabletop exercises"}
          />
        </Field>

        <Field
          label="Differentiators"
          hint="What makes you different from the next 50 vendors. Bullets or one paragraph — your call."
        >
          <textarea
            value={profile.differentiators}
            onChange={(e) => setField("differentiators", e.target.value)}
            rows={4}
            className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none"
            placeholder="Veteran-led with 20+ years of DoD experience. CMMC L1 attested. 24/7 CONUS support. Average ticket resolution under 4 hours."
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={draftingDiff}
              onClick={() =>
                runDraft(
                  draftDifferentiatorsAction,
                  (text) => setField("differentiators", text),
                  setDraftingDiff,
                )
              }
              className="rounded-sm border border-[#2f8f6d] bg-white px-3 py-1.5 text-xs font-semibold text-[#2f8f6d] hover:bg-[#f1f9f4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {draftingDiff ? "Drafting…" : profile.differentiators.trim() ? "↻ Re-draft with AI" : "✨ Draft with AI"}
            </button>
          </div>
        </Field>
        {aiError ? (
          <p className="text-xs font-semibold text-[#b03a2e]">{aiError}</p>
        ) : null}
      </Card>

      <Card title="Point of contact" subtitle="The person a contracting officer or prime should call about a bid.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input
              value={profile.poc_name}
              onChange={(v) => setField("poc_name", v)}
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Title">
            <Input
              value={profile.poc_title}
              onChange={(v) => setField("poc_title", v)}
              placeholder="Director of Federal Programs"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={profile.poc_email}
              onChange={(v) => setField("poc_email", v)}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={profile.poc_phone}
              onChange={(v) => setField("poc_phone", v)}
              placeholder="(703) 555-0100"
            />
          </Field>
          <Field label="Website" hint="Optional. Shown on the cover.">
            <Input
              type="url"
              value={profile.website}
              onChange={(v) => setField("website", v)}
              placeholder="https://example.com"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Set-aside certifications"
        subtitle="Tick the ones you've actually been awarded. These render as badges on the packet — false claims are False Claims Act exposure."
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {(Object.keys(setAsideLabels) as SetAside[]).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2 text-sm transition-colors ${
                profile.set_asides.includes(s)
                  ? "border-[#2f8f6d] bg-[#f1f9f4]"
                  : "border-[#cfe3d9] bg-white hover:bg-[#f7fcf9]"
              }`}
            >
              <input
                type="checkbox"
                checked={profile.set_asides.includes(s)}
                onChange={() => toggleSetAside(s)}
                className="mt-0.5 h-4 w-4 accent-[#2f8f6d]"
              />
              <span>{setAsideLabels[s]}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card
        title="Insurance & bonding"
        subtitle="Most federal solicitations and prime questionnaires ask for these. Capture them once."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Insurance carrier">
            <Input
              value={profile.insurance.carrier}
              onChange={(v) => setInsurance("carrier", v)}
              placeholder="Hiscox / Travelers / etc."
            />
          </Field>
          <Field label="Policy number">
            <Input
              value={profile.insurance.policy_number}
              onChange={(v) => setInsurance("policy_number", v)}
              placeholder="POL-12345-AB"
            />
          </Field>
          <Field label="General liability limit">
            <Input
              value={profile.insurance.general_liability_limit}
              onChange={(v) => setInsurance("general_liability_limit", v)}
              placeholder="$1,000,000 / $2,000,000"
            />
          </Field>
          <Field label="Professional liability limit">
            <Input
              value={profile.insurance.professional_liability_limit}
              onChange={(v) =>
                setInsurance("professional_liability_limit", v)
              }
              placeholder="$1,000,000"
            />
          </Field>
          <Field label="Policy expiration">
            <Input
              type="date"
              value={profile.insurance.expiration_date}
              onChange={(v) => setInsurance("expiration_date", v)}
            />
          </Field>
          <div />
          <Field label="Bonding company" hint="Leave blank if you don't carry bonding.">
            <Input
              value={profile.bonding.bonding_company}
              onChange={(v) => setBonding("bonding_company", v)}
              placeholder="Liberty Mutual Surety"
            />
          </Field>
          <Field label="Bonding capacity (USD)">
            <Input
              value={profile.bonding.bonding_capacity_usd}
              onChange={(v) => setBonding("bonding_capacity_usd", v)}
              placeholder="$5,000,000 single / $10,000,000 aggregate"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Past performance"
        subtitle="Government and commercial contracts that demonstrate you can deliver. Three relevant entries beats ten generic ones."
      >
        {profile.past_performance.length === 0 ? (
          <p className="rounded-sm border border-dashed border-[#cfe3d9] bg-[#f7fcf9] px-4 py-6 text-center text-sm text-[#456c5f]">
            No past-performance entries yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {profile.past_performance.map((entry, idx) => (
              <li
                key={entry.id}
                className="rounded-md border border-[#cfe3d9] bg-[#f7fcf9] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f8f6d]">
                    Entry #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePP(entry.id)}
                    className="text-xs font-semibold text-[#b03a2e] hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Agency / customer">
                    <Input
                      value={entry.agency}
                      onChange={(v) => updatePP(entry.id, { agency: v })}
                      placeholder="DHS / GSA / Acme Prime"
                    />
                  </Field>
                  <Field label="Contract / PO #">
                    <Input
                      value={entry.contract_no}
                      onChange={(v) => updatePP(entry.id, { contract_no: v })}
                      placeholder="HSHQDC-22-C-00123"
                    />
                  </Field>
                  <Field label="NAICS">
                    <Input
                      value={entry.naics}
                      onChange={(v) => updatePP(entry.id, { naics: v })}
                      placeholder="541512"
                    />
                  </Field>
                  <Field label="Contract value (USD)">
                    <Input
                      value={entry.value_usd}
                      onChange={(v) => updatePP(entry.id, { value_usd: v })}
                      placeholder="$485,000"
                    />
                  </Field>
                  <Field label="Period — start">
                    <Input
                      type="date"
                      value={entry.period_start}
                      onChange={(v) => updatePP(entry.id, { period_start: v })}
                    />
                  </Field>
                  <Field label="Period — end">
                    <Input
                      type="date"
                      value={entry.period_end}
                      onChange={(v) => updatePP(entry.id, { period_end: v })}
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Scope summary" hint="2–3 sentences.">
                    <textarea
                      value={entry.scope}
                      onChange={(e) =>
                        updatePP(entry.id, { scope: e.target.value })
                      }
                      rows={3}
                      className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none"
                      placeholder="Migrated 200 endpoints to Azure GovCloud and stood up a CMMC L1 compliance program from scratch in 6 months."
                    />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Customer reference — name">
                    <Input
                      value={entry.customer_name}
                      onChange={(v) => updatePP(entry.id, { customer_name: v })}
                    />
                  </Field>
                  <Field label="Reference email">
                    <Input
                      type="email"
                      value={entry.customer_email}
                      onChange={(v) =>
                        updatePP(entry.id, { customer_email: v })
                      }
                    />
                  </Field>
                  <Field label="Reference phone">
                    <Input
                      type="tel"
                      value={entry.customer_phone}
                      onChange={(v) =>
                        updatePP(entry.id, { customer_phone: v })
                      }
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={addPP}
          className="mt-4 rounded-sm border border-[#2f8f6d] bg-white px-4 py-2 text-sm font-semibold text-[#2f8f6d] hover:bg-[#f1f9f4]"
        >
          + Add past-performance entry
        </button>
      </Card>

      <div className="sticky bottom-0 -mx-6 border-t border-[#cfe3d9] bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="text-xs text-[#456c5f]">
            {savedAt ? (
              <>Last saved {new Date(savedAt).toLocaleString()}</>
            ) : (
              <>Not saved yet</>
            )}
            {error ? (
              <span className="ml-3 font-semibold text-[#b03a2e]">
                {error}
              </span>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-[#10231d] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0e2a23] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save bid profile"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ReadinessBanner({
  score,
  missing,
}: {
  score: number;
  missing: string[];
}) {
  const tone =
    score >= 80
      ? "bg-[#f1f9f4] border-[#2f8f6d] text-[#0e2a23]"
      : score >= 50
        ? "bg-[#fff7e8] border-[#a06b1a] text-[#5a3d0a]"
        : "bg-white border-[#cfe3d9] text-[#10231d]";
  return (
    <div className={`rounded-md border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-bold">
          Profile readiness: {score}/100
        </h3>
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">
          {score >= 80
            ? "Ready to generate"
            : score >= 50
              ? "Minimum viable"
              : "Needs more"}
        </span>
      </div>
      {missing.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm">
          Every section has enough content to render a clean packet.
        </p>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[#cfe3d9] bg-white p-5">
      <header className="mb-4">
        <h2 className="font-serif text-lg font-bold">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-[#456c5f]">{subtitle}</p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[11px] text-[#456c5f]">{hint}</span>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none"
    />
  );
}

function CharCount({ value, min }: { value: string; min: number }) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <p
      className={`mt-1 text-[11px] ${ok ? "text-[#2f8f6d]" : "text-[#456c5f]"}`}
    >
      {len} characters {ok ? "✓" : `· ${min - len} more for minimum`}
    </p>
  );
}
