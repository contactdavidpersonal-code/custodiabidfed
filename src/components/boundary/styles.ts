/**
 * Shared CSS for the Boundary diagram artifact. Lifted verbatim from
 * public/boundary-diagram-preview.html (the approved visual contract) so
 * the React render and the standalone HTML export are byte-equivalent.
 */
export const BOUNDARY_CSS = `:root {
  --ink: #10231d;
  --ink-soft: #44695c;
  --line: #cfe3d9;
  --green: #2f8f6d;
  --green-dk: #0e2a23;
  --green-bg: #f7fcf9;
  --amber: #a06b1a;
  --amber-bg: #fff8e8;
  --red: #b3261e;
  --red-bg: #fdecea;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: #f5f5f1;
  color: var(--ink);
  padding: 32px 16px 80px;
}
.page {
  max-width: 1040px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 20px 60px rgba(14, 48, 37, 0.08);
  padding: 40px 48px;
}
.doc-header {
  border-bottom: 2px solid var(--green-dk);
  padding-bottom: 16px;
  margin-bottom: 28px;
}
.doc-header .eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--green);
}
.doc-header h1 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 28px;
  margin: 6px 0 4px;
  line-height: 1.15;
}
.doc-header .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 12px;
  color: var(--ink-soft);
}
.doc-header .meta b { color: var(--ink); }
.diagram-wrap {
  border: 1px solid var(--line);
  background: #fafdfb;
  padding: 18px;
  margin: 18px 0 26px;
}
svg.boundary { display: block; width: 100%; height: auto; }
.legend {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px 20px;
  margin: 18px 0 28px;
  font-size: 12px;
  color: var(--ink-soft);
}
.legend .swatch {
  display: inline-block;
  width: 14px; height: 14px;
  margin-right: 8px;
  vertical-align: -2px;
  border: 1px solid rgba(0,0,0,0.12);
}
h2.boundary {
  font-family: Georgia, serif;
  font-size: 18px;
  margin: 28px 0 8px;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
  padding-bottom: 4px;
}
table.boundary {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 8px;
}
table.boundary th, table.boundary td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.boundary th {
  background: var(--green-bg);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--green-dk);
  border-bottom: 1px solid var(--green);
}
table.boundary tr:last-child td { border-bottom: none; }
.pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pill-in    { background: #e3f5ec; color: var(--green-dk); }
.pill-esp   { background: #e8eef9; color: #1f3d7a; }
.pill-out   { background: #f0eee8; color: #5b554a; }
.pill-hot   { background: var(--amber-bg); color: var(--amber); }
.validation {
  margin-top: 26px;
  border: 1px solid var(--line);
  background: #fbfcfa;
}
.validation-row {
  display: flex;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.validation-row:last-child { border-bottom: none; }
.validation-row .icon {
  flex: none;
  width: 22px; height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 800;
  font-size: 12px;
  color: #fff;
}
.v-pass .icon { background: var(--green); }
.v-warn .icon { background: var(--amber); }
.v-fail .icon { background: var(--red); }
.footer-note {
  margin-top: 32px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--ink-soft);
  line-height: 1.55;
}
.source-stamp {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: var(--green-bg);
  color: var(--green-dk);
  font-size: 10px;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  border: 1px solid var(--line);
}
`;
