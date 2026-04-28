/**
 * Custodia brand theme for Clerk's prebuilt components.
 * Finance-firm aesthetic: cream surfaces, deep-green primary CTA, sharp edges,
 * Lora-serif headings. Modeled after rhetorich.ai's restraint, not a soft SaaS pill.
 *
 * Uses current variable names per Clerk docs (April 2026). Older deprecated
 * names (colorText, colorInputBackground, colorTextSecondary, ...) are NOT used.
 */
export const clerkAppearance = {
  variables: {
    // Primary CTA — deep green ink with mint type, like a brokerage "Continue" button
    colorPrimary: "#0e2a23",
    colorPrimaryForeground: "#bdf2cf",

    // Surface + text
    colorBackground: "#ffffff",
    colorForeground: "#10231d",
    colorMutedForeground: "#5a7d70",
    colorMuted: "#f1f6f3",

    // Inputs
    colorInput: "#ffffff",
    colorInputForeground: "#10231d",

    // Structure
    colorBorder: "#cfe3d9",
    colorNeutral: "#0e2a23",
    colorRing: "#2f8f6d",
    colorShadow: "rgba(14, 48, 37, 0.12)",
    colorModalBackdrop: "rgba(8, 20, 16, 0.7)",

    // Status
    colorDanger: "#b03a2e",
    colorSuccess: "#2f8f6d",
    colorWarning: "#a06b1a",

    // Type — finance-firm, not bubbly
    fontFamily: "var(--font-manrope), 'Segoe UI', sans-serif",
    fontFamilyButtons: "var(--font-manrope), 'Segoe UI', sans-serif",
    fontSize: "0.9rem",
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    borderRadius: "0.25rem",
    spacing: "1rem",
  },
  elements: {
    rootBox: "w-full",
    card:
      "bg-white border border-[#cfe3d9] shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)] rounded-md",
    cardBox: "rounded-md",
    headerTitle:
      "font-serif text-[#10231d] tracking-tight",
    headerSubtitle: "text-[#5a7d70]",
    socialButtonsBlockButton:
      "rounded-sm border border-[#cfe3d9] bg-white text-[#10231d] hover:bg-[#f1f6f3] transition-colors",
    socialButtonsBlockButtonText: "font-semibold tracking-tight",
    dividerLine: "bg-[#cfe3d9]",
    dividerText: "text-[#7a9c90] uppercase tracking-[0.2em] text-[10px] font-bold",
    formFieldLabel: "text-[#10231d] font-semibold tracking-tight",
    formFieldInput:
      "rounded-sm bg-white border border-[#cfe3d9] text-[#10231d] placeholder:text-[#9ab8ac] focus:border-[#2f8f6d] focus:ring-2 focus:ring-[#2f8f6d]/20",
    formButtonPrimary:
      "rounded-sm bg-[#0e2a23] text-[#bdf2cf] font-bold tracking-tight hover:bg-[#10231d] shadow-none normal-case",
    formButtonReset: "text-[#2f8f6d] hover:text-[#0e2a23] font-medium",
    footer: "bg-transparent",
    footerAction: "text-[#5a7d70]",
    footerActionLink: "text-[#0e2a23] font-bold hover:text-[#2f8f6d]",
    identityPreviewEditButtonIcon: "text-[#2f8f6d]",
    formFieldAction: "text-[#2f8f6d] hover:text-[#0e2a23]",
    otpCodeFieldInput:
      "rounded-sm bg-white border border-[#cfe3d9] text-[#10231d] focus:border-[#2f8f6d]",
    badge: "rounded-sm bg-[#eaf3ee] text-[#0e2a23]",
    avatarBox: "ring-2 ring-[#bdf2cf]",
    userButtonPopoverCard:
      "rounded-md bg-white border border-[#cfe3d9] shadow-[0_18px_50px_rgba(14,48,37,0.18)]",
    userButtonPopoverActionButton:
      "text-[#10231d] hover:bg-[#f1f6f3]",
    userButtonPopoverFooter: "bg-transparent",
  },
};
