/**
 * Plain-English yes/no checks for each CMMC L1 practice.
 *
 * The goal is to take a non-technical small-business owner and walk them
 * through 2–3 questions they can answer without help. Their answers route
 * them to the right status:
 *   - all yes → Met
 *   - all no → Not met
 *   - mixed → Partial
 *
 * Each "no" carries a `gap` string we surface as a remediation hint so
 * they know exactly what to fix before signing.
 */
export type PracticeQuizQuestion = {
  id: string;
  prompt: string;
  yesMeans: string;
  gap: string;
};

export type PracticeQuiz = {
  controlId: string;
  questions: PracticeQuizQuestion[];
};

export const practiceQuizzes: Record<string, PracticeQuizQuestion[]> = {
  "AC.L1-3.1.1": [
    {
      id: "list",
      prompt:
        "Can you produce a current list of every person who can log in to the systems where you handle government contract info?",
      yesMeans: "You have a roster of authorized users.",
      gap: "Build a one-page roster: name, email, what they can access. Even a signed PDF works.",
    },
    {
      id: "former",
      prompt:
        "When someone leaves the company or a project ends, do their logins get disabled within a few days?",
      yesMeans: "Off-boarding actually happens.",
      gap: "Add an off-boarding step: disable accounts within 7 days of departure. Document who is responsible.",
    },
  ],
  "AC.L1-3.1.2": [
    {
      id: "roles",
      prompt:
        "Does each person only have access to the apps and folders they actually need for their job?",
      yesMeans: "Access is scoped, not everyone-sees-everything.",
      gap: "Pick at least one shared drive or app and tighten permissions so only the right roles can open it.",
    },
    {
      id: "admin",
      prompt:
        "Are admin / owner accounts limited to the few people who really need them (not given to everyone)?",
      yesMeans: "Admin rights are the exception, not the default.",
      gap: "Demote anyone who doesn't need admin rights. List who keeps them and why.",
    },
  ],
  "AC.L1-3.1.20": [
    {
      id: "wifi",
      prompt:
        "Is your work Wi-Fi password-protected (not the open public network)?",
      yesMeans: "Outside connections need a password.",
      gap: "Move work devices off the open guest network. Use WPA2/WPA3 with a strong password.",
    },
    {
      id: "vendors",
      prompt:
        "When outside vendors or contractors connect to your systems, do they use accounts you control (not a shared password)?",
      yesMeans: "External access is identifiable and revocable.",
      gap: "Give outside helpers their own named login. Stop sharing one password.",
    },
  ],
  "AC.L1-3.1.22": [
    {
      id: "public",
      prompt:
        "Have you confirmed that nothing related to a government contract is sitting on a public website, social media, or shared link that anyone can open?",
      yesMeans: "Federal contract info is not public.",
      gap: "Audit your public website, social media, and 'anyone with the link' shares for contract details. Lock or remove anything sensitive.",
    },
    {
      id: "review",
      prompt:
        "Before posting case studies, success stories, or photos online, does someone check that no contract details slip out?",
      yesMeans: "There is a review step before posting.",
      gap: "Add a quick approval: marketing / posts get reviewed before publishing.",
    },
  ],
  "IA.L1-3.5.1": [
    {
      id: "unique",
      prompt:
        "Does every person sign in with their own personal account (no shared logins)?",
      yesMeans: "Each user is uniquely identified.",
      gap: "Stop sharing accounts. Create individual logins for every person.",
    },
    {
      id: "devices",
      prompt:
        "Are work laptops or phones tied to a specific person (not a generic device anyone can grab)?",
      yesMeans: "Devices have an owner of record.",
      gap: "Assign each device to a named user. Keep a simple device roster.",
    },
  ],
  "IA.L1-3.5.2": [
    {
      id: "password",
      prompt:
        "Does every login require a password (or a passkey / biometric, not just a username)?",
      yesMeans: "Authentication is enforced.",
      gap: "Turn on password requirements for every system that handles contract info.",
    },
    {
      id: "mfa",
      prompt:
        "Is two-factor (MFA) turned on for email and your main work apps?",
      yesMeans: "A stolen password alone is not enough.",
      gap: "Turn on MFA — text code, authenticator app, or hardware key — for email at minimum.",
    },
  ],
  "MP.L1-3.8.3": [
    {
      id: "disposal",
      prompt:
        "When you throw away old laptops, hard drives, USB sticks, or paper with contract info, do you wipe or shred them first?",
      yesMeans: "Media is sanitized before disposal.",
      gap: "Pick a method: factory-reset + wipe for drives, cross-cut shred for paper. Document it.",
    },
    {
      id: "log",
      prompt:
        "Do you keep a short record of what was destroyed and when (even just a notebook or spreadsheet)?",
      yesMeans: "There is proof the disposal happened.",
      gap: "Start a one-line log: date, what was destroyed, how, who did it.",
    },
  ],
  "PE.L1-3.10.1": [
    {
      id: "lock",
      prompt:
        "Is the office, room, or area where work happens locked when nobody's there?",
      yesMeans: "Physical space is controlled.",
      gap: "Add a lock — a deadbolt, key fob, or alarm. Make sure it's actually used.",
    },
    {
      id: "keys",
      prompt:
        "Do you know who has keys, fobs, or alarm codes — and do former employees no longer have them?",
      yesMeans: "Physical access is tracked and revoked.",
      gap: "Make a list of who holds keys/fobs/codes. Collect anything from former staff.",
    },
  ],
  "PE.L1-3.10.3": [
    {
      id: "escort",
      prompt:
        "When clients, delivery people, or repair techs visit, are they not left alone in the work area?",
      yesMeans: "Visitors are escorted in sensitive areas.",
      gap: "Adopt a simple rule: outside visitors are accompanied while in work areas.",
    },
  ],
  "PE.L1-3.10.4": [
    {
      id: "log",
      prompt:
        "Do you keep some record of who came into the office (sign-in sheet, calendar invite, badge log, doorbell cam)?",
      yesMeans: "Visitor activity is logged.",
      gap: "Pick one method — sign-in sheet, calendar, or video — and use it consistently.",
    },
  ],
  "PE.L1-3.10.5": [
    {
      id: "manage",
      prompt:
        "Is there a process for issuing and collecting back keys, fobs, or alarm codes (not handing them out and forgetting)?",
      yesMeans: "Physical credentials are managed.",
      gap: "Track each key/fob/code: who has it, when issued, when returned.",
    },
  ],
  "SC.L1-3.13.1": [
    {
      id: "firewall",
      prompt:
        "Is there a firewall or router between your work network and the public internet (the standard ISP router counts)?",
      yesMeans: "There is a boundary device.",
      gap: "Confirm your router's firewall is on. Replace consumer hardware that can't be configured.",
    },
    {
      id: "guest",
      prompt:
        "Do guests / personal devices stay on a separate Wi-Fi from your work devices?",
      yesMeans: "Trusted vs untrusted traffic is split.",
      gap: "Turn on the guest Wi-Fi network. Move personal phones / visitor devices off the main network.",
    },
  ],
  "SC.L1-3.13.5": [
    {
      id: "public_systems",
      prompt:
        "If you host any public service (website, online store, customer portal), is it separated from where you handle contract info?",
      yesMeans: "Public-facing systems aren't mixed with sensitive ones.",
      gap: "Use a hosted website (e.g. Squarespace, Wix, Vercel) so your public site doesn't share infrastructure with contract data — or document the separation.",
    },
  ],
  "SI.L1-3.14.1": [
    {
      id: "patches",
      prompt:
        "Do operating system updates (Windows / macOS) install regularly — at least monthly?",
      yesMeans: "OS patches actually land.",
      gap: "Turn on automatic OS updates on every work device.",
    },
    {
      id: "apps",
      prompt:
        "Do your main work apps (browser, email, Office / Google Workspace) auto-update?",
      yesMeans: "App vulnerabilities get patched.",
      gap: "Enable auto-update for browsers and productivity apps. Restart devices weekly so updates apply.",
    },
  ],
  "SI.L1-3.14.2": [
    {
      id: "av",
      prompt:
        "Is antivirus / anti-malware turned on on every work computer (Windows Defender counts)?",
      yesMeans: "Endpoints have malicious-code protection.",
      gap: "Turn on Windows Defender / built-in malware protection. Don't disable it.",
    },
    {
      id: "realtime",
      prompt: "Is real-time protection enabled (not just on-demand scans)?",
      yesMeans: "Threats are blocked as they happen.",
      gap: "Open antivirus settings and enable real-time / on-access protection.",
    },
  ],
  "SI.L1-3.14.4": [
    {
      id: "auto_update",
      prompt:
        "Does your antivirus update its definitions automatically (you haven't disabled it)?",
      yesMeans: "Malware definitions stay current.",
      gap: "Enable automatic definition / signature updates in your antivirus.",
    },
  ],
  "SI.L1-3.14.5": [
    {
      id: "scheduled",
      prompt:
        "Is a full antivirus scan scheduled to run at least weekly on each work computer?",
      yesMeans: "Periodic scans are happening.",
      gap: "Schedule a weekly full scan in your antivirus tool.",
    },
    {
      id: "downloads",
      prompt:
        "Are downloaded files scanned automatically when they hit the device?",
      yesMeans: "Real-time file scanning is on.",
      gap: "Confirm 'scan downloads' / 'scan files on access' is enabled.",
    },
  ],
};
