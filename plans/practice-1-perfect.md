# Practice 1 — Perfect for the actual user

**Target user:** a non-technical small-business contractor — a gardener, an
HVAC tech, a one-truck handyman who just won a $25K federal contract. They
do not know what CMMC is. They do not know what FCI is. They do not know
what an "IdP" is. They are here because the federal government made it
mandatory and someone told them they need this checkbox to keep bidding.

**North star:** Charlie does the work. The user answers questions a human
would actually ask — "what email do you use?", "is it just you, or does
someone else help?" — and Charlie maps those answers into the assessor-grade
artifacts.

The current Practice 1 (AC.L1-3.1.1) intake fails this test. It hands a
gardener five multiple-choice options that include "Microsoft 365
(SharePoint / OneDrive / Teams / Outlook)" and "On-prem file share / NAS"
and expects them to self-classify. That is wrong. We fix it.

---

## What's wrong, ranked by how badly it hurts a $25K-contract gardener

| # | Problem | Why it kills onboarding |
|---|---|---|
| 1 | Intake is a 4-question quiz with technical labels | User reads "IdP groups" and freezes. Every option requires self-classification a non-IT person cannot do. |
| 2 | Charlie is on the right rail but doesn't drive the intake | The user is asked to self-serve when they came here because they can't self-serve. |
| 3 | No "I don't know — help me pick" affordance | The only option to ask Charlie is to type into chat. A non-technical user won't articulate the right question. |
| 4 | Artifacts are not auto-drafted after intake | After answering 4 questions, the user still has to ask Charlie one-by-one to draft each artifact. Charlie should produce all five immediately. |
| 5 | Enforcement-proof step is opaque | "Upload a screenshot" — but where does this gardener take it from? Needs a step-by-step with example image per FCI-location answer. |
| 6 | "Why we ask" reg quotes are visible by default | Regulatory citation is anxiety-inducing for the target user. Keep it collapsed (it already is) — make sure it stays collapsed. ✅ already correct |

---

## Phased plan

### Phase 1 — Charlie drives the intake (this commit)

Goal: the user can complete Practice 1 without ever reading a technical
multiple-choice label.

1. **"Let Charlie pick this one for me" button on every intake question.**
   Big, prominent, above the option list. Clicking it sends Charlie a
   focused directive: the question text + the options + values + a strict
   instruction to ask ONE plain-English question, then call
   `set_intake_answer` to fill the answer.
2. **New `set_intake_answer` tool.** Charlie writes one intake answer into
   `practice_conversations.intake_answers`. Server validates: question_id
   exists, value matches an option. UI subscribes to the same row and
   reflects the answer (radio auto-selects, Next button enables).
3. **Auto-welcome on first practice load.** When the practice has zero
   messages AND intake isn't started, Charlie greets the user warmly:
   "Hi — I'm Charlie. I'll handle the technical bits. Want me to walk you
   through Practice 1 in plain English? It's about who's allowed into your
   email and files for the federal contract." No tool call, just a 2-line
   intro and a closing question.
4. **Auto-draft all artifacts on intake completion.** Strengthen the
   existing "INTAKE COMPLETE" directive so Charlie auto-calls
   `generate_evidence_artifact` for every required generate-able slot
   before asking the user for the one thing they must do themselves
   (the enforcement-proof screenshot).
5. **Plain-English Charlie persona during intake.** When Charlie is in
   intake-helping mode, system prompt picks up a tone instruction: "no
   acronyms, no compliance jargon, ask one short question at a time, use
   gardener-grade words."

### Phase 2 — Boss screenshot guidance (next commit)

1. For the enforcement-proof slot, Charlie generates a per-user one-page
   instruction sheet: "Open Proton Mail → Settings → Security → Sessions
   → take a screenshot of this page → drag it here." Generated PDF lives
   next to the artifact in the user's vault.
2. Inline example image in the slot card (`/public/screenshots/`).

### Phase 3 — Sole-operator fast-path (next next commit)

If intake answers come back as solo + just-me everywhere, fold the four
intake questions into ONE confirmation: "Looks like it's just you, working
on a laptop, using a personal-style mailbox. Confirm?" → one click → all
four answers stamped → all artifacts auto-drafted.

---

## What this commit changes (Phase 1)

- `src/lib/ai/tools.ts`
  - Add `set_intake_answer` tool: { question_id, value }. Server validates
    against `getPracticeSpec(ctx.activeControlId).intake.questions`, then
    UPSERTs into `practice_conversations.intake_answers`.
- `src/app/assessments/[id]/controls/[controlId]/GuidedPracticeQuiz.tsx`
  - Add "Let Charlie pick" button above the option list per question.
  - Subscribe to intake-answer updates so the radio reflects Charlie's
    pick (poll-on-focus or window event from chat panel).
- `src/lib/cmmc/practice-chat.ts` (or system prompt builder)
  - Add intake-mode tone clause.
  - Tighten INTAKE COMPLETE directive to auto-generate every required
    generable artifact.
- `src/lib/cmmc/narrative-copilot.ts`
  - When practice has zero saved messages AND no intake answers, prepend
    an auto-welcome directive so the FIRST Charlie message is a warm
    plain-English greeting.

---

## Done means

- A test user with no technical background can complete Practice 1 by
  answering 4–6 plain-English questions Charlie asks them, then taking
  one screenshot Charlie tells them exactly how to capture.
- They never read the words "IdP", "SharePoint", "NAS", "RMM", "SAML",
  or "Conditional Access".
- All five required artifacts plus the enforcement screenshot are in
  the vault, verifier-approved, with the practice ready to lock.
