/**
 * Custodia brand theme for Clerk's prebuilt components.
 * Mirrors the landing-page palette: mint primary (#bdf2cf) on deep green (#0c2219),
 * cream surfaces (#f7fcf9), Lora serif for headings.
 *
 * Uses current variable names per Clerk docs (April 2026). Older deprecated
 * names (colorText, colorInputBackground, colorTextSecondary, ...) are NOT used.
 */
export const clerkAppearance = {
  variables: {
    // Primary CTA — mint button with deep-green text, matching the landing CTAs
    colorPrimary: "#bdf2cf",
    colorPrimaryForeground: "#0c2219",

    // Surface + text
    colorBackground: "#f7fcf9",
    colorForeground: "#10231d",
    colorMutedForeground: "#5a7d70",
    colorMuted: "#eaf3ee",

    // Inputs
    colorInput: "#ffffff",
    colorInputForeground: "#10231d",

    // Structure
    colorBorder: "#cfe3d9",
    colorNeutral: "#0e2a23",
    colorRing: "#2f8f6d",
    colorShadow: "rgba(14, 48, 37, 0.18)",
    colorModalBackdrop: "rgba(8, 20, 16, 0.65)",

    // Status
    colorDanger: "#b03a2e",
    colorSuccess: "#2f8f6d",
    colorWarning: "#a06b1a",

    // Type
    fontFamily: "var(--font-manrope), 'Segoe UI', sans-serif",
    fontFamilyButtons: "var(--font-manrope), 'Segoe UI', sans-serif",
    fontSize: "0.9rem",
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    borderRadius: "0.875rem",
    spacing: "1rem",
  },
  elements: {
    rootBox: "w-full",
    card:
      "bg-[#f7fcf9] border border-[#cfe3d9] shadow-[0_18px_50px_rgba(14,48,37,0.18)] rounded-3xl",
    cardBox: "rounded-3xl",
    headerTitle:
      "font-serif text-[#10231d] tracking-tight",
    headerSubtitle: "text-[#5a7d70]",
    socialButtonsBlockButton:
      "border border-[#cfe3d9] bg-white text-[#10231d] hover:bg-[#eaf3ee] transition-colors",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-[#cfe3d9]",
    dividerText: "text-[#7a9c90] uppercase tracking-[0.18em] text-[10px] font-bold",
    formFieldLabel: "text-[#10231d] font-semibold",
    formFieldInput:
      "bg-white border border-[#cfe3d9] text-[#10231d] placeholder:text-[#9ab8ac] focus:border-[#2f8f6d] focus:ring-2 focus:ring-[#2f8f6d]/30",
    formButtonPrimary:
      "bg-[#bdf2cf] text-[#0c2219] font-bold tracking-tight hover:bg-[#a8e6c0] shadow-[0_10px_30px_rgba(189,242,207,0.35)] normal-case",
    formButtonReset:
      "text-[#2f8f6d] hover:text-[#0e2a23] font-medium",
    footer: "bg-transparent",
    footerAction: "text-[#5a7d70]",
    footerActionLink: "text-[#0e2a23] font-bold hover:text-[#2f8f6d]",
    identityPreviewEditButtonIcon: "text-[#2f8f6d]",
    formFieldAction: "text-[#2f8f6d] hover:text-[#0e2a23]",
    otpCodeFieldInput:
      "bg-white border border-[#cfe3d9] text-[#10231d] focus:border-[#2f8f6d]",
    badge: "bg-[#eaf3ee] text-[#0e2a23]",
    avatarBox: "ring-2 ring-[#bdf2cf]",
    userButtonPopoverCard:
      "bg-[#f7fcf9] border border-[#cfe3d9] shadow-[0_18px_50px_rgba(14,48,37,0.18)]",
    userButtonPopoverActionButton:
      "text-[#10231d] hover:bg-[#eaf3ee]",
    userButtonPopoverFooter: "bg-transparent",
  },
};
