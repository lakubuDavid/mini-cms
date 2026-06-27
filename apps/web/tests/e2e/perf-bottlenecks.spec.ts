import { test } from "@playwright/test";

const EMAIL = "contact@lakubudavid.me";
const PASSWORD = "Password@1";

test.describe("Dashboard performance", () => {

  test("identify slow pages and API bottlenecks", async ({ page }) => {
    test.setTimeout(180000);
    const results: {
      route: string;
      totalMs: number;
      htmlKB: number;
      apiCalls: { method: string; path: string; ms: number; status: number }[];
    }[] = [];

    // --- Log in ---
    console.log("\n========== LOGIN ==========");
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log("  Logged in");

    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(300);

    const routes = [
      "/dashboard",
      "/dashboard/projects",
      "/dashboard/api-keys",
      "/dashboard/team",
      "/dashboard/workspace",
      "/dashboard/profile",
      "/dashboard/analytics",
      "/dashboard/assets",
    ];

    for (const route of routes) {
      console.log(`\n========== ${route}`);
      const responses: { method: string; url: string; status: number; ms: number }[] = [];

      page.on("response", (res) => {
        const req = res.request();
        const t = req.timing();
        responses.push({
          method: req.method(),
          url: req.url(),
          status: res.status(),
          ms: t.responseEnd && t.requestStart ? Math.round(t.responseEnd - t.requestStart) : 0,
        });
      });

      const t0 = performance.now();
      await page.goto(route, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(1000);
      const totalMs = Math.round(performance.now() - t0);

      // Only real API calls: /api/* paths, _server calls, JSON content-type
      const apiCalls = responses.filter(r => {
        const path = r.url;
        return (
          path.includes("/api/auth/") ||
          path.includes("/api/schema/") ||
          path.includes("/api/collections/") ||
          path.includes("_server") ||
          (r.method === "POST" && !path.match(/\.\w+(\?|$)/) && !path.includes("__vite_ping"))
        );
      }).map(r => ({
        method: r.method,
        path: r.url.replace(/.*\/api\//, "/api/").replace(/\?.*$/, ""),
        ms: r.ms,
        status: r.status,
      }));

      const html = await page.content();
      const htmlKB = Math.round(html.length / 1024);

      // Print findings
      console.log(`  Load: ${totalMs}ms  HTML: ${htmlKB}KB  API calls: ${apiCalls.length}`);

      // Print API calls sorted by duration
      const sorted = [...apiCalls].sort((a, b) => b.ms - a.ms);
      if (sorted.length > 0) {
        console.log(`  API calls by duration:`);
        for (const a of sorted) {
          const flag = a.ms > 500 ? "🔴" : a.ms > 200 ? "🟡" : "";
          console.log(`    ${flag} ${a.ms.toString().padStart(4)}ms  ${a.method} ${a.status}  ${a.path}`);
        }
      } else {
        console.log(`  (no API calls detected — may all be SSR)`);
      }

      results.push({ route, totalMs, htmlKB, apiCalls });
    }

    // Summary
    console.log("\n\n═══════════════════════════════════════════════════════");
    console.log("                BOTTLENECK IDENTIFICATION");
    console.log("═══════════════════════════════════════════════════════\n");

    // Sort by total time descending
    const sorted = [...results].sort((a, b) => b.totalMs - a.totalMs);

    console.log(`${"Route".padEnd(25)} ${"Load".padEnd(8)} ${"HTML".padEnd(7)} ${"API".padEnd(5)}  Verdict`);
    console.log("-".repeat(75));

    for (const r of sorted) {
      // In dev mode, 5-7s is normal due to Vite HMR. Focus on API patterns instead.
      const hasSlowApi = r.apiCalls.some(a => a.ms > 500);
      const apiCount = r.apiCalls.length;
      let verdict = "✅ Dev mode — production will be faster";
      if (hasSlowApi) verdict = `🔴 ${r.apiCalls.filter(a => a.ms > 500).length} slow API(s)`;
      else if (apiCount > 5) verdict = `🟡 ${apiCount} API calls — could batch`;
      console.log(`${r.route.padEnd(25)} ${`${r.totalMs}ms`.padEnd(8)} ${`${r.htmlKB}KB`.padEnd(7)} ${String(apiCount).padEnd(5)} ${verdict}`);
    }

    // Analysis
    console.log("\n\n─── KEY FINDINGS ───");
    // Check for API call patterns
    const allCalls = results.flatMap(r => r.apiCalls);
    const uniquePaths = [...new Set(allCalls.map(a => a.path))];
    console.log(`Total unique API endpoints hit: ${uniquePaths.length}`);
    console.log(`Endpoints: ${uniquePaths.join(", ")}`);

    const slowest = [...allCalls].sort((a, b) => b.ms - a.ms).slice(0, 3);
    if (slowest.length > 0 && slowest[0].ms > 200) {
      console.log(`\nSlowest API calls:`);
      for (const s of slowest) {
        console.log(`  ${s.ms}ms  ${s.method} ${s.path} (${s.status})`);
      }
    }
  });
});
