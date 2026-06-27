/**
 * Standalone Playwright network performance scanner.
 * Run: node tests/perf-scan.mjs
 * Requires: PLAYWRIGHT_BROWSERS_PATH or npx playwright install chromium
 */
import { chromium } from "@playwright/test";
import { createPasswordMember } from "./common.js";

const BASE_URL = "http://127.0.0.1:3000";
const EMAIL = "contact@lakubudavid.me";
const PASSWORD = "Password@1";

const DASHBOARD_ROUTES = [
  { label: "Dashboard Home",   path: "/dashboard" },
  { label: "Projects",         path: "/dashboard/projects" },
  { label: "API Keys",         path: "/dashboard/api-keys" },
  { label: "Team",             path: "/dashboard/team" },
  { label: "Workspace",        path: "/dashboard/workspace" },
  { label: "Profile",          path: "/dashboard/profile" },
  { label: "Analytics",        path: "/dashboard/analytics" },
  { label: "Assets",           path: "/dashboard/assets" },
];

async function run() {
  // Create test user and authenticate
  console.log("Creating test member...");
  const member = await createPasswordMember({
    email: EMAIL,
    password: PASSWORD,
    name: "Perf Scan User",
    organizationName: "Perf Scan WS",
    organizationSlug: "perf-scan-ws",
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });

    // Inject auth cookies
    const cookies = await member.test.getCookies({
      userId: member.user.id,
      domain: new URL(BASE_URL).hostname,
    });
    await context.addCookies(cookies);

    const page = await context.newPage();

    // Overall results
    const results = [];

    for (const route of DASHBOARD_ROUTES) {
      console.log(`\n========== ${route.label} (${route.path}) ==========`);

      const requests = [];

      // Intercept responses
      page.on("response", (res) => {
        const req = res.request();
        const timing = req.timing();
        requests.push({
          url: req.url(),
          method: req.method(),
          status: res.status(),
          contentType: res.headers()["content-type"] || "",
          size: Number(res.headers()["content-length"] || 0),
          startTime: timing.startTime || 0,
          domainLookupStart: timing.domainLookupStart || 0,
          domainLookupEnd: timing.domainLookupEnd || 0,
          connectStart: timing.connectStart || 0,
          connectEnd: timing.connectEnd || 0,
          requestStart: timing.requestStart || 0,
          responseStart: timing.responseStart || 0,
          responseEnd: timing.responseEnd || 0,
        });
      });

      const t0 = performance.now();
      await page.goto(route.path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1000);
      const t1 = performance.now();
      const totalMs = t1 - t0;

      // Filter to meaningful requests (skip static assets)
      const dataReqs = requests.filter(r =>
        !r.url.match(/\.(js|css|ico|woff2?|png|jpg|svg|webp|gif)$/) &&
        !r.url.includes("__vite_ping") &&
        !r.url.includes("favicon") &&
        !r.url.includes("fonts.googleapis")
      );

      // Sort by duration
      dataReqs.sort((a, b) => (b.responseEnd - b.startTime) - (a.responseEnd - a.startTime));

      console.log(`  Total page load: ${totalMs.toFixed(0)}ms, ${dataReqs.length} data requests`);

      // Print slowest requests
      for (const r of dataReqs) {
        const dur = r.responseEnd > 0 ? (r.responseEnd - r.startTime).toFixed(0) : "?";
        const label = truncateUrl(r.url, 70);
        if (Number(dur) > 100) {
          console.log(`  ⏱ ${dur}ms  ${r.method} ${r.status}  ${label}`);
        }
      }

      // Detect waterfall gaps
      const sortedByStart = [...dataReqs].filter(r => r.startTime > 0).sort((a, b) => a.startTime - b.startTime);
      let waterfallGaps = 0;
      let lastEnd = 0;
      for (const r of sortedByStart) {
        const rEnd = r.startTime + (r.responseEnd - r.startTime);
        if (lastEnd > 0 && r.startTime > lastEnd + 100) {
          waterfallGaps += r.startTime - lastEnd;
          console.log(`  🔻 Waterfall gap: ${(r.startTime - lastEnd).toFixed(0)}ms before ${truncateUrl(r.url, 50)}`);
        }
        lastEnd = Math.max(lastEnd, rEnd);
      }

      // Categorize
      const cat = categorize(totalMs, dataReqs.length, dataReqs);
      console.log(`  → ${cat.label}`);

      results.push({
        route: route.path,
        label: route.label,
        totalMs: Math.round(totalMs),
        requestCount: dataReqs.length,
        slowestDur: dataReqs.length > 0 ? Math.round((dataReqs[0].responseEnd - dataReqs[0].startTime)) : 0,
        waterfallGaps: Math.round(waterfallGaps),
        category: cat.label,
        issue: cat.issue,
      });
    }

    // Summary
    console.log("\n\n========== BOTTLENECK SUMMARY ==========");
    console.log("Route".padEnd(25), "Time".padEnd(8), "Req".padEnd(5), "Slowest".padEnd(10), "Waterfall".padEnd(12), "Issue");
    console.log("-".repeat(90));
    for (const r of results) {
      console.log(
        r.label.padEnd(25),
        `${r.totalMs}ms`.padEnd(8),
        String(r.requestCount).padEnd(5),
        `${r.slowestDur}ms`.padEnd(10),
        `${r.waterfallGaps}ms`.padEnd(12),
        r.issue
      );
    }

  } finally {
    if (browser) await browser.close();
    await member.cleanup();
  }
}

function categorize(totalMs, count, requests) {
  const slowReqs = requests.filter(r => (r.responseEnd - r.startTime) > 500);

  if (totalMs > 5000) {
    return { label: "🔴 SLOW", issue: `>5s load (${slowReqs.length} requests over 500ms)` };
  }
  if (totalMs > 3000) {
    return { label: "🟡 MEDIUM", issue: `>3s load, check ${slowReqs.length} slow request(s)` };
  }
  if (count > 10) {
    return { label: "🟡 MANY REQS", issue: `${count} requests — could batch or prefetch` };
  }
  if (slowReqs.length > 0) {
    return { label: "🟡 HAS SLOW", issue: `${slowReqs.length} request(s) over 500ms` };
  }
  return { label: "✅ OK", issue: "No major bottleneck" };
}

function truncateUrl(url, maxLen) {
  try {
    const u = new URL(url);
    let path = u.pathname + u.search;
    return path.length > maxLen ? path.slice(0, maxLen - 3) + "..." : path;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 3) + "..." : url;
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
