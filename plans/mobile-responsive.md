# Mobile-Ready Plan — Custodia Bidfed

**Goal.** Keep the desktop experience exactly as is. When the viewport drops to tablet (≤1024px) or phone (≤640px), the platform morphs into a liquid, app-feeling experience: full-bleed sheets, bottom nav, swipe-friendly cards, slide-in chat, animated transitions. No separate mobile app — same Next.js, same routes, different layout primitives that activate at breakpoints.

**Stack alignment.** Tailwind v4 (already in use), `motion/react` (already in use), Next.js 16 App Router, Clerk. No new heavy dependencies. We may add `@use-gesture/react` for swipe (lightweight, ~3kb gz) and that is it.

---

## Breakpoint contract

```
mobile     ≤  640px   (Tailwind `sm:` is "640px and up", so unprefixed = mobile)
tablet     641–1024px (Tailwind `md:` 768, `lg:` 1024)
desktop    ≥ 1025px   (Tailwind `lg:` and up — current behavior is preserved here)
```

**Rule.** Anything `lg:` and up is the existing desktop. Below `lg`, we re-layout. Below `sm`, we reach for app patterns (bottom tab bar, full-screen sheets, swipe).

---

## Phase 1 — Foundation (one PR, no visible UI change yet)

Pure plumbing. Lays down the primitives every later phase will use.

1. **Viewport + theming.** [src/app/layout.tsx](src/app/layout.tsx)
   - Add `viewport` export with `width=device-width, initialScale=1, viewportFit=cover, themeColor=#0d2e25`.
   - Add `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style=black-translucent` so when added to home screen it looks like an app.
   - Ship a `manifest.webmanifest` with the Custodia shield, theme color, standalone display mode.

2. **Safe-area utilities.** [src/app/globals.css](src/app/globals.css)
   - `env(safe-area-inset-*)` CSS vars exposed as Tailwind utilities (`pb-safe`, `pt-safe`, `pl-safe`, `pr-safe`).
   - `100dvh` height utility (Tailwind v4 has `h-dvh` natively — use it).
   - `overscroll-behavior: contain` defaults on scroll containers we mark as sheets.

3. **Hooks.** New `src/lib/use-breakpoint.ts`
   - `useBreakpoint()` returns `'mobile' | 'tablet' | 'desktop'` via `matchMedia`. SSR-safe (default `'desktop'`, hydrate client-side).
   - `useReducedMotion()` wrapper around motion's hook so we kill animations for users who ask.
   - Keep these client-only; server components stay pure.

4. **Primitives.** New `src/components/mobile/`
   - `Sheet.tsx` — bottom sheet with drag-to-dismiss (motion + spring). Backdrop blur, snap points (peek / half / full).
   - `BottomNav.tsx` — fixed bottom tab bar, 4–5 destinations, safe-area padded, active-tab spring.
   - `SwipeStack.tsx` — horizontal pager for objective cards (used in PracticeQuiz on mobile).
   - `MobileTopBar.tsx` — shrinks-on-scroll header with back button + page title.

5. **Acceptance.** No route looks different yet. Lighthouse Mobile score baseline captured. PWA installable.

---

## Phase 2 — Landing page (`src/app/page.tsx`)

The marketing page is mostly responsive thanks to existing `md:` breakpoints, but a few sections break or look cramped on phones.

| Section | Mobile change |
| --- | --- |
| Hero | Headline drops to `text-[2rem] leading-[1.05]`, image-frame stays but URL bar truncates earlier. CTA stack vertical (already is). Demo image: tighter padding. |
| Stats strip | 2 columns on phone (already is) — confirm no overflow. |
| The deal / opportunity | Cards stack 1-col below `md` already. Add `snap-x` horizontal scroll on phone for any 3-up grid that currently goes 1-col so user can swipe. |
| Pricing | Pricing cards already stack. Add a mobile-only sticky "Start trial" CTA at bottom that auto-hides on scroll-up, reappears on scroll-down. |
| FAQ | Convert to native `<details>` with smooth height animation on phone (one open at a time). |
| Footer | Already simple. Add safe-area bottom padding. |

**Animations.** Motion stagger on hero stays; on phone reduce to a single fade (less jank on weaker devices).

---

## Phase 3 — Workspace shell (`src/app/assessments/layout.tsx`)

This is where most real users live. The desktop layout is `[main content][sticky chat rail]` with a top header full of nav links.

**Desktop (≥ lg).** Unchanged — header stays, ComplianceOfficerRail docks right.

**Tablet (md–lg).** Header collapses to logo + hamburger + UserButton. Nav links move into a slide-in left drawer. Compliance rail becomes a floating action button (FAB) lower-right that opens it as a right-edge sheet.

**Phone (< sm).**
- **Top bar.** Logo + page title + 3-dot menu. Shrinks on scroll.
- **Bottom nav.** Replaces top nav. 4 tabs:
  1. **Workspace** (`/assessments/[id]`)
  2. **Bids** (`/opportunities`)
  3. **Tickets** (`/assessments/tickets`) — with unread count badge
  4. **Profile** (`/profile/bid-ready` + UserButton in a sheet)
- **Charlie chat rail → Charlie FAB.** A circular green button with the Charlie shield, lower-right, above the bottom nav. Tap → full-screen sheet (drag down to dismiss). Unread/active state pulses.
- Hide the existing left CourseSidebar; replace with a "Practices" sheet triggered from the top bar on `[id]/controls/[controlId]` pages.

Acceptance: every existing route is reachable from the bottom nav + page-level controls within ≤ 2 taps.

---

## Phase 4 — Practice quiz (`PracticeQuiz.tsx`)

The quiz is the heart of the product. Today's sticky header is anchored at `top-[60px]` below the workspace nav. On phone, the workspace nav is gone (replaced with the new top bar), so the quiz can claim the full screen.

**Mobile rebuild (same component, mobile branch driven by `useBreakpoint()`):**

1. **Full-screen quiz mode.** When mobile, render quiz inside a `dvh` container with a compact top bar (back arrow, "AC.L1-3.1.1" pill, MET/NOT MET badge). Progress bar stays under it.
2. **One question per "card".** Each step becomes a swipeable card (Tinder-style stack). User can swipe left to go back if no answer required, motion physics with spring.
3. **Multiple-choice as bottom sheet.** Tap a question → answer sheet rises from bottom with options as large tap targets (min 56px). Selecting auto-dismisses + advances with a 250ms slide-out.
4. **Evidence picker as full-screen sheet.** Five paths (connector / vault / template / upload / skip) become a vertical card list, each ~88px tall with icon + title + hint. Connector cards show their connection status as a pill. Vault form pushes onto a second sheet level.
5. **Vault forms.** Each row becomes a card. Add row = "+" FAB. Reorder by long-press. Save commits a CSV via the existing server action.
6. **Charlie speech bubble.** Stays at top of card; long messages collapse to 4 lines with "Read more". Long-press = copy text.
7. **Connector pill.** Already wired in sticky header; on phone it lives next to the MET badge in the compact top bar.

**Animations.** Motion: card swipe spring `{ stiffness: 380, damping: 32 }`. Sheet rise: 280ms ease-out. Status badge cross-fade on verdict change. All disabled under `prefers-reduced-motion`.

---

## Phase 5 — Opportunities + bid profile

- Opportunities list (`/opportunities`): grid → vertical card stack on phone with native pull-to-refresh (CSS `overscroll-behavior` + a small refresh indicator). Each card has a swipe-left action: "Save" / swipe-right "Tailor".
- Tailor screen (`/opportunities/[id]/tailor`): two columns become tabs ("Overview", "Tailor draft", "Submit") on phone, with bottom-anchored primary action.
- Bid profile (`/profile/bid-ready`): long form becomes accordion sections; each "fix me" row gets a tap-to-expand row with action button anchored bottom.

---

## Phase 6 — Dashboard, deliverables, ancillary pages

- Dashboard: KPI cards stack 1-col, charts use `ResponsiveContainer` (recharts already if we use it; otherwise render as cards-with-numbers on phone).
- Deliverables / SSP / sign / verified: use system PDF viewer with iframe `pointer-events: auto` and momentum scrolling. Add a "Share" button that uses `navigator.share` on mobile.
- Tickets: thread view becomes a chat-style stream with the input docked above the keyboard (use `interactive-widget=resizes-content` viewport hint).
- Sign-in / sign-up: Clerk modals already responsive — verify with appearance overrides for mobile.

---

## Phase 7 — Touch + input polish

- All tap targets ≥ 44×44px (Apple HIG).
- Replace hover-only affordances (`hover:` reveals) with always-visible variants below `md`.
- Inputs: `inputMode`, `autocomplete`, `enterkeyhint` set everywhere. Date inputs use `type=date`.
- File upload: on phone, surface camera capture (`accept="image/*" capture="environment"`) for screenshot evidence flows.
- Keyboard handling: when an input focuses inside a sheet, scroll the sheet so the field sits above the keyboard (use `visualViewport` API).
- Long-press menus on cards (vault rows, opportunity cards): native-feeling context menu via a small custom popover.

---

## Phase 8 — Performance + a11y

- **Bundle.** Audit landing-page bundle. Split motion variants into a separate chunk. Lazy-load `ComplianceOfficerRail` (chat) — already-deferred is good but verify mobile-bundle weight.
- **Images.** All `next/image` with proper `sizes`. Demo screenshot uses `priority` only on desktop hero; on mobile lazy-load to keep LCP < 2.5s on 4G.
- **Fonts.** Already self-hosted (assumed). If not, swap to `next/font` to kill render-blocking.
- **Lighthouse Mobile target.** Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95, PWA pass.
- **A11y.** Trap focus inside sheets, `aria-modal`, restore focus on dismiss. Bottom nav uses `<nav aria-label="Primary">` with `aria-current="page"`. Skip-to-content link visible on focus.
- **Reduced motion.** Respect `prefers-reduced-motion: reduce` everywhere; motion already supports this — wire a single `useReducedMotion()` consumer that swaps spring → linear 150ms.

---

## Phase 9 — QA matrix

Run the `/browse` skill at three viewports against the canary deploy:

```
mobile-portrait  390 × 844   (iPhone 14)
tablet-portrait  820 × 1180  (iPad Air)
desktop          1440 × 900  (regression)
```

Per route, capture: hero, primary CTA tap, sheet open/close, form submit, animation timing. Diff before/after. Fail loud on any horizontal scroll or off-screen tap target.

---

## Rollout order (suggested PR cadence)

1. **PR 1 — Phase 1** plumbing (viewport, manifest, hooks, primitives). Invisible.
2. **PR 2 — Phase 3** workspace shell mobile (bottom nav + Charlie FAB + drawer). Highest user-value, smallest blast radius once primitives exist.
3. **PR 3 — Phase 4** practice quiz mobile rebuild. Owns the core flow.
4. **PR 4 — Phase 2** landing page polish.
5. **PR 5 — Phase 5** opportunities + bid profile.
6. **PR 6 — Phase 6** ancillary pages.
7. **PR 7 — Phase 7** touch polish.
8. **PR 8 — Phase 8 + 9** perf + a11y + QA sweep, ship.

Each PR is independently shippable — desktop never regresses because every mobile branch hides behind `useBreakpoint() !== 'desktop'` or Tailwind `lg:` reset utilities.

---

## What we are explicitly NOT doing

- No native iOS/Android app.
- No separate `/m/*` route tree — single source of truth, responsive only.
- No CSS framework swap. Tailwind v4 stays.
- No SSR breakpoint detection (avoids hydration mismatch); first paint = desktop layout, hydrates to correct breakpoint via `matchMedia`. Acceptable because mobile users see the desktop layout for ~50ms before snap, and we ship a CSS-only fallback that already approximates mobile via Tailwind classes.

---

## Open decisions to confirm before PR 1

1. **Bottom nav vs. hamburger as primary on phone** — proposal: bottom nav (modern, app-feel). Confirm.
2. **Charlie FAB location on phone** — proposal: bottom-right, 16px above bottom nav. Confirm vs. integrating Charlie as a fifth tab.
3. **`@use-gesture/react`** — OK to add for swipe-to-dismiss and card swipes? ~3kb gz. Alternative: hand-roll with motion's `pan` listeners (slightly more code, no dep).
4. **Reduced-motion default** — keep all animations on by default and respect OS setting? (recommended yes).
