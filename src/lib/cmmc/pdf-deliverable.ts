/**
 * PDF deliverable renderer for Charlie-generated evidence artifacts.
 *
 * Why this exists: the user pointed at rhetorich.ai and asked for the
 * documents Charlie produces to feel like that — premium, serif, cream &
 * navy, the kind of artifact a CMMC assessor flips to and immediately
 * registers "this firm is buttoned-up." Plain `.md` files don't carry
 * that signal. Styled PDFs do.
 *
 * Implementation notes:
 *   - PDFKit is used (not Puppeteer / headless Chrome) because this runs
 *     in Vercel serverless lambdas. PDFKit has no native deps, ~1.5 MB,
 *     and emits to a streaming Buffer.
 *   - No external fonts: PDFKit ships with Times-Roman / Times-Bold /
 *     Times-Italic / Helvetica built in. We use Times for body (the
 *     legal/professional read) and Helvetica-Bold sparingly for the
 *     wordmark + section eyebrows.
 *   - The input `body` is treated as lightweight Markdown: `#`/`##`/`###`
 *     headings, `- ` bullets, `1. ` numbered items, blank-line paragraph
 *     breaks. We deliberately do NOT pull in a full Markdown parser —
 *     Claude writes the body, and this constrained subset covers every
 *     procedure / roster summary / scoping statement we generate.
 */

import PDFDocument from "pdfkit";

export type DeliverableMeta = {
  /** Organization legal name (printed in the metadata box). */
  organizationName: string;
  /** Document title — sets the cover headline. */
  title: string;
  /** Optional short italic subtitle below the title. */
  subtitle?: string | null;
  /** CMMC control id this deliverable supports (e.g. AC.L1-3.1.1). */
  controlId: string;
  /** Plain-English control title (e.g. "Authorized Access Control"). */
  controlTitle?: string | null;
  /** Effective / "as of" date. ISO string ok; we format it. */
  effectiveDate?: Date | string | null;
  /** Free-text classifier shown in the metadata box. */
  documentType?: string | null;
  /** Owner / point of contact, optional. */
  owner?: string | null;
};

// ── Theme (rhetorich.ai-adjacent: cream paper, deep navy, gold accent) ──

const THEME = {
  paper: "#FAF7F2",
  ink: "#1E293B",
  navy: "#0B1F3A",
  navyMuted: "#3E5B7E",
  rule: "#C9BFA8",
  accent: "#B8924A",
  meta: "#5E5246",
} as const;

const MARGIN = 64; // points (~0.89")
const PAGE_W = 612; // letter
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;

/**
 * Render a `DeliverableMeta` + Markdown body into a styled PDF Buffer.
 */
export async function renderDeliverablePdf(args: {
  meta: DeliverableMeta;
  body: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: args.meta.title,
        Author: args.meta.organizationName,
        Subject: `${args.meta.controlId} — ${args.meta.controlTitle ?? "CMMC Level 1 evidence"}`,
        Producer: "Custodia BidFedCMMC",
        Creator: "Custodia BidFedCMMC",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    paintBackground(doc);
    doc.on("pageAdded", () => paintBackground(doc));

    renderHeader(doc, args.meta);
    renderTitleBlock(doc, args.meta);
    renderMetaBox(doc, args.meta);
    renderBody(doc, args.body);
    renderFooters(doc, args.meta);

    doc.end();
  });
}

// ── Painters ────────────────────────────────────────────────────────

function paintBackground(doc: PDFKit.PDFDocument): void {
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(THEME.paper);
  doc.restore();
}

function renderHeader(doc: PDFKit.PDFDocument, meta: DeliverableMeta): void {
  doc.save();
  // Eyebrow: brand wordmark + classifier on a single baseline.
  doc.font("Helvetica-Bold").fontSize(10).fillColor(THEME.navy);
  doc.text("CUSTODIA · BIDFEDCMMC", MARGIN, MARGIN - 24, {
    characterSpacing: 1.8,
    lineBreak: false,
  });
  const eyebrowRight = (meta.documentType ?? "EVIDENCE DELIVERABLE").toUpperCase();
  doc.font("Helvetica").fontSize(9).fillColor(THEME.meta);
  doc.text(eyebrowRight, MARGIN, MARGIN - 24, {
    width: CONTENT_W,
    align: "right",
    characterSpacing: 1.5,
    lineBreak: false,
  });
  // Hairline rule.
  const ruleY = MARGIN - 8;
  doc
    .moveTo(MARGIN, ruleY)
    .lineTo(PAGE_W - MARGIN, ruleY)
    .lineWidth(0.5)
    .strokeColor(THEME.rule)
    .stroke();
  doc.restore();
  doc.y = MARGIN + 4;
}

function renderTitleBlock(doc: PDFKit.PDFDocument, meta: DeliverableMeta): void {
  doc.moveDown(0.6);
  // Control id eyebrow (small, gold).
  doc.font("Helvetica-Bold").fontSize(9).fillColor(THEME.accent);
  doc.text(
    meta.controlTitle
      ? `${meta.controlId} · ${meta.controlTitle.toUpperCase()}`
      : meta.controlId.toUpperCase(),
    { characterSpacing: 1.6 },
  );
  doc.moveDown(0.35);

  // Title (Times-Bold, large).
  doc.font("Times-Bold").fontSize(26).fillColor(THEME.navy);
  doc.text(meta.title, { width: CONTENT_W, lineGap: 2 });

  if (meta.subtitle) {
    doc.moveDown(0.25);
    doc.font("Times-Italic").fontSize(13).fillColor(THEME.navyMuted);
    doc.text(meta.subtitle, { width: CONTENT_W, lineGap: 1 });
  }
  doc.moveDown(0.6);
}

function renderMetaBox(doc: PDFKit.PDFDocument, meta: DeliverableMeta): void {
  const entries: Array<[string, string]> = [];
  entries.push(["Organization", meta.organizationName || "—"]);
  entries.push([
    "Effective date",
    formatDate(meta.effectiveDate ?? new Date()),
  ]);
  if (meta.owner) entries.push(["Owner", meta.owner]);
  entries.push([
    "Practice",
    meta.controlTitle
      ? `${meta.controlId} — ${meta.controlTitle}`
      : meta.controlId,
  ]);

  const rowH = 18;
  const boxH = rowH * entries.length + 16;
  const boxY = doc.y;
  doc.save();
  // Top + bottom hairline (no full border — feels heavier than rhetorich).
  doc
    .moveTo(MARGIN, boxY)
    .lineTo(PAGE_W - MARGIN, boxY)
    .lineWidth(0.5)
    .strokeColor(THEME.rule)
    .stroke();
  doc
    .moveTo(MARGIN, boxY + boxH)
    .lineTo(PAGE_W - MARGIN, boxY + boxH)
    .lineWidth(0.5)
    .strokeColor(THEME.rule)
    .stroke();
  doc.restore();

  const labelX = MARGIN + 6;
  const valueX = MARGIN + 130;
  let y = boxY + 10;
  for (const [k, v] of entries) {
    doc.font("Helvetica").fontSize(8).fillColor(THEME.meta);
    doc.text(k.toUpperCase(), labelX, y, {
      width: 120,
      characterSpacing: 1.2,
      lineBreak: false,
    });
    doc.font("Times-Roman").fontSize(11).fillColor(THEME.ink);
    doc.text(v, valueX, y - 1, {
      width: CONTENT_W - 130,
      lineBreak: false,
    });
    y += rowH;
  }
  doc.y = boxY + boxH + 14;
  doc.x = MARGIN;
}

// ── Markdown-ish body renderer ──────────────────────────────────────

function renderBody(doc: PDFKit.PDFDocument, body: string): void {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let inList = false;

  const flushSpace = () => {
    if (inList) {
      doc.moveDown(0.3);
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushSpace();
      doc.moveDown(0.4);
      continue;
    }

    if (line.startsWith("### ")) {
      flushSpace();
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(THEME.accent);
      doc.text(line.slice(4).toUpperCase(), {
        width: CONTENT_W,
        characterSpacing: 1.4,
      });
      doc.moveDown(0.15);
      continue;
    }
    if (line.startsWith("## ")) {
      flushSpace();
      doc.moveDown(0.6);
      doc.font("Times-Bold").fontSize(16).fillColor(THEME.navy);
      doc.text(line.slice(3), { width: CONTENT_W, lineGap: 1 });
      doc.moveDown(0.1);
      // thin accent rule under section header
      const ry = doc.y;
      doc
        .moveTo(MARGIN, ry)
        .lineTo(MARGIN + 36, ry)
        .lineWidth(1.2)
        .strokeColor(THEME.accent)
        .stroke();
      doc.moveDown(0.5);
      continue;
    }
    if (line.startsWith("# ")) {
      flushSpace();
      doc.moveDown(0.6);
      doc.font("Times-Bold").fontSize(20).fillColor(THEME.navy);
      doc.text(line.slice(2), { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.3);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      inList = true;
      drawBullet(doc, "•", bullet[1]);
      continue;
    }
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      inList = true;
      drawBullet(doc, `${numbered[1]}.`, numbered[2]);
      continue;
    }

    // Plain paragraph.
    flushSpace();
    doc.font("Times-Roman").fontSize(11).fillColor(THEME.ink);
    renderInline(doc, line, { width: CONTENT_W, lineGap: 2 });
  }
}

function drawBullet(
  doc: PDFKit.PDFDocument,
  marker: string,
  text: string,
): void {
  const markerW = 18;
  const startY = doc.y;
  doc.font("Times-Roman").fontSize(11).fillColor(THEME.accent);
  doc.text(marker, MARGIN, startY, {
    width: markerW,
    lineBreak: false,
  });
  doc.font("Times-Roman").fontSize(11).fillColor(THEME.ink);
  renderInline(doc, text, {
    indent: 0,
    width: CONTENT_W - markerW,
    lineGap: 2,
    x: MARGIN + markerW,
    y: startY,
  });
  doc.moveDown(0.15);
}

/**
 * Lightweight inline emphasis: `**bold**` and `*italic*` segments. Keeps
 * Times-Roman as the body face and swaps to Times-Bold / Times-Italic for
 * the marked runs. Skips any other Markdown inline syntax.
 */
function renderInline(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: {
    width: number;
    lineGap?: number;
    indent?: number;
    x?: number;
    y?: number;
  },
): void {
  type Seg = { text: string; font: "Times-Roman" | "Times-Bold" | "Times-Italic" };
  const segs: Seg[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        segs.push({ text: text.slice(i + 2, end), font: "Times-Bold" });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        segs.push({ text: text.slice(i + 1, end), font: "Times-Italic" });
        i = end + 1;
        continue;
      }
    }
    // accumulate plain run until next marker
    let next = text.length;
    const bb = text.indexOf("**", i);
    const ii = text.indexOf("*", i);
    if (bb >= 0) next = Math.min(next, bb);
    if (ii >= 0) next = Math.min(next, ii);
    segs.push({ text: text.slice(i, next), font: "Times-Roman" });
    i = next;
  }

  if (opts.x !== undefined && opts.y !== undefined) {
    doc.x = opts.x;
    doc.y = opts.y;
  }
  segs.forEach((s, idx) => {
    doc.font(s.font);
    doc.text(s.text, {
      continued: idx < segs.length - 1,
      width: opts.width,
      lineGap: opts.lineGap,
    });
  });
}

function renderFooters(
  doc: PDFKit.PDFDocument,
  meta: DeliverableMeta,
): void {
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    const y = PAGE_H - MARGIN + 18;
    doc.save();
    doc
      .moveTo(MARGIN, y - 10)
      .lineTo(PAGE_W - MARGIN, y - 10)
      .lineWidth(0.5)
      .strokeColor(THEME.rule)
      .stroke();
    doc.font("Helvetica").fontSize(8).fillColor(THEME.meta);
    doc.text(
      `${meta.organizationName} · ${meta.controlId} · ${formatDate(meta.effectiveDate ?? new Date())}`,
      MARGIN,
      y,
      { width: CONTENT_W * 0.7, lineBreak: false, characterSpacing: 0.8 },
    );
    doc.text(
      `Page ${p - range.start + 1} of ${range.count}`,
      MARGIN,
      y,
      { width: CONTENT_W, align: "right", lineBreak: false },
    );
    doc.restore();
  }
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
