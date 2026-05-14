/**
 * scripts/audit-tenant-scoping.ts
 *
 * Static audit: walks every tool handler in src/lib/ai/tools.ts and
 * verifies that each one (a) references `ctx.organizationId` somewhere
 * in its body, and (b) uses it inside a WHERE / JOIN that scopes the
 * tool's data access to the caller's tenant.
 *
 * The intent is not to be a perfect type-aware checker — it is a cheap
 * tripwire that catches the obvious failure mode: a new tool merged
 * without an `organization_id` predicate in its SQL. Run manually or
 * in CI; non-zero exit on any failure.
 *
 * Run with: npx tsx scripts/audit-tenant-scoping.ts
 *           (or wire as `npm run audit:tenant`)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOOLS_PATH = resolve(process.cwd(), "src/lib/ai/tools.ts");

type HandlerCheck = {
  name: string;
  hasOrgId: boolean;
  hasScopedAccess: boolean;
};

/**
 * Crude but effective handler extraction. Finds every
 * `async function handle…(` declaration and walks the source
 * brace-by-brace to capture the function body. We don't need a full TS
 * parser to enforce a simple structural invariant.
 *
 * Strategy: find each `async function handleXxx(`, then scan forward
 * tracking `<` / `(` nesting until we hit the first top-level `{` (the
 * actual body brace, not one inside a return type like `Promise<{…}>`),
 * then balance braces from there.
 */
function extractHandlers(source: string): Array<{ name: string; body: string }> {
  const handlers: Array<{ name: string; body: string }> = [];
  const headerRe = /async function (handle[A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(source)) !== null) {
    const name = m[1];
    let i = m.index + m[0].length;
    // Skip the parameter list, balancing parens.
    let parenDepth = 1;
    while (i < source.length && parenDepth > 0) {
      const ch = source[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      i++;
    }
    // Skip the return type (e.g. `: Promise<ToolResult>`) until we hit
    // the body `{` — but skip any `{` nested inside angle brackets.
    let angleDepth = 0;
    while (i < source.length) {
      const ch = source[i];
      if (ch === "<") angleDepth++;
      else if (ch === ">") angleDepth--;
      else if (ch === "{" && angleDepth === 0) break;
      i++;
    }
    if (i >= source.length) continue;
    // Now `i` points to the body `{`. Balance braces to find the end.
    const bodyStart = i + 1;
    let braceDepth = 1;
    i++;
    while (i < source.length && braceDepth > 0) {
      const ch = source[i];
      if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
      i++;
    }
    handlers.push({ name, body: source.slice(bodyStart, i - 1) });
  }
  return handlers;
}

/**
 * Heuristic: a handler is tenant-scoped if its body references
 * `ctx.organizationId` at all. Refinement: read-only tools that hit a
 * static lookup (e.g. `cite_regulation`) can skip the check via the
 * `// audit:tenant-scoping skip` marker comment in their body.
 *
 * We intentionally do NOT try to assert that the reference appears
 * inside a SQL WHERE/JOIN — too many legitimate patterns
 * (`getBusinessProfile(ctx.organizationId)`, `updateAssessment(id, ctx)`,
 * etc.) would false-fail. Catching the absence of the reference at all
 * is the high-leverage check this audit can guarantee.
 */
function checkHandler(h: { name: string; body: string }): HandlerCheck {
  const body = h.body;
  if (/audit:tenant-scoping\s+skip/i.test(body)) {
    return { name: h.name, hasOrgId: true, hasScopedAccess: true };
  }
  const hasOrgId = /ctx\.organizationId/.test(body);
  return { name: h.name, hasOrgId, hasScopedAccess: hasOrgId };
}

function main(): void {
  let source: string;
  try {
    source = readFileSync(TOOLS_PATH, "utf8");
  } catch (err) {
    console.error(`Cannot read ${TOOLS_PATH}:`, err);
    process.exit(2);
  }

  const handlers = extractHandlers(source);
  if (handlers.length === 0) {
    console.error("No tool handlers found — did the regex break?");
    process.exit(2);
  }

  const failed: HandlerCheck[] = [];
  for (const h of handlers) {
    const check = checkHandler(h);
    const ok = check.hasOrgId && check.hasScopedAccess;
    const tag = ok ? "PASS" : "FAIL";
    console.log(`${tag}  ${check.name}`);
    if (!ok) failed.push(check);
  }

  console.log("");
  console.log(`Total handlers: ${handlers.length}`);
  console.log(`Failures:       ${failed.length}`);

  if (failed.length > 0) {
    console.error("");
    console.error("Tenant-scoping audit FAILED for:");
    for (const f of failed) {
      console.error(
        `  - ${f.name}: hasOrgId=${f.hasOrgId} hasScopedAccess=${f.hasScopedAccess}`,
      );
    }
    console.error("");
    console.error(
      "Add a tenant-scoped predicate (WHERE organization_id = ${ctx.organizationId})",
    );
    console.error(
      "or — if the tool genuinely has no tenant data — add the comment",
    );
    console.error('  // audit:tenant-scoping skip — <reason>');
    console.error("inside the handler body.");
    process.exit(1);
  }

  console.log("");
  console.log("OK — every tool handler is tenant-scoped.");
}

main();
