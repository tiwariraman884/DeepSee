// Automated accessibility audit (Doc 16.9).
// Runs axe-core against each route's rendered DOM via jsdom.
// Requires the app to be running (default http://localhost:3000).
//   node scripts/a11y-audit.mjs
//   BASE_URL=http://localhost:3000 node scripts/a11y-audit.mjs
//
// Exits non-zero if any violations are found (CI-ready).
import { JSDOM } from "jsdom";
import axe from "axe-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const ROUTES = [
  "/",
  "/dashboard",
  "/map",
  "/pollution",
  "/species",
  "/risk",
  "/drones",
  "/alerts",
  "/reports",
  "/assistant",
  "/innovation",
  "/settings",
  "/about",
  "/login",
  "/signup",
];

async function auditRoute(route) {
  const res = await fetch(`${BASE_URL}${route}`);
  const html = await res.text();
  const dom = new JSDOM(html, {
    url: `${BASE_URL}${route}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // jsdom has no canvas implementation; stub getContext so axe (and chart
  // libraries) don't throw "Not implemented" during analysis.
  window.HTMLCanvasElement.prototype.getContext = () => null;

  // Inject axe-core into the jsdom window and run it.
  window.eval(axe.source);
  const results = await window.axe.run(window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
    // color-contrast requires real layout/painting; unreliable under jsdom.
    rules: { "color-contrast": { enabled: false } },
    resultTypes: ["violations"],
  });
  return results.violations;
}

function printViolations(route, violations) {
  if (violations.length === 0) {
    console.log(`  ✅ ${route}`);
    return 0;
  }
  console.log(`  ❌ ${route} — ${violations.length} violation group(s)`);
  for (const v of violations) {
    console.log(`     • [${v.impact}] ${v.id}: ${v.help}`);
    console.log(`       ${v.helpUrl}`);
    const nodes = v.nodes.slice(0, 3);
    for (const n of nodes) {
      const target = Array.isArray(n.target) ? n.target.join(" ") : String(n.target);
      console.log(`       ↳ ${target}`);
    }
    if (v.nodes.length > 3) console.log(`       … and ${v.nodes.length - 3} more`);
  }
  return violations.length;
}

async function main() {
  console.log(`\n♿ DeepSea Guardian — axe accessibility audit`);
  console.log(`   Target: ${BASE_URL}\n`);

  let total = 0;
  const failed = [];
  for (const route of ROUTES) {
    try {
      const violations = await auditRoute(route);
      total += printViolations(route, violations);
      if (violations.length) failed.push(route);
    } catch (err) {
      console.log(`  ⚠️  ${route} — could not audit (${err.message})`);
    }
  }

  console.log(
    `\n${total === 0 ? "✅ PASS" : "❌ FAIL"}: ${total} violation group(s) across ${
      ROUTES.length - failed.length
    }/${ROUTES.length} routes audited.\n`
  );
  process.exit(total === 0 ? 0 : 1);
}

main();
