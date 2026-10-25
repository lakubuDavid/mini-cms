import { test, expect } from "@playwright/test";
import "../setup-env";
import { createPasswordMember, getAuthTestHelpers } from "../common";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOTS_DIR = resolve(__dirname, "../../../../screenshots/invite-flow");
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const adminEmail = `admin-invite-${Date.now()}@example.com`;
const adminPassword = "AdminPass@1";
const mikelEmail = "mikel@example.com";
const mikelPassword = "Pass@12345";
const mikelName = "Mikel";
const orgName = "Invite Demo Workspace";
const orgSlug = `invite-demo-${Date.now()}`;

async function shot(page: import("@playwright/test").Page, name: string) {
  const path = resolve(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  // eslint-disable-next-line no-console
  console.log(`📸 screenshots/invite-flow/${name}.png`);
}

async function getInviteIdByEmail(email: string): Promise<string> {
  const { db } = await import("../../src/db");
  const { invitations } = await import("../../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(eq(invitations.email, email));
  const inv = rows[0];
  if (!inv) throw new Error(`No invitation found for ${email}`);
  return inv.id;
}

test.describe.serial("invite flow — Mikel (unauthenticated invite acceptance)", () => {
  let inviteUrl: string;
  let adminUserId: string;
  let organizationId: string;

  test("admin creates workspace and invite for Mikel", async ({
    context,
    page,
  }) => {
    // ── 1. Create the admin member + workspace via Better Auth test helpers ──
    const member = await createPasswordMember({
      email: adminEmail,
      password: adminPassword,
      name: "David Admin",
      organizationName: orgName,
      organizationSlug: orgSlug,
      role: "admin",
    });
    adminUserId = member.user.id;
    organizationId = String(member.organization.id);

    // Log in as admin via the actual login form to ensure cookies are set correctly
    // First, try with cookies directly (faster, more reliable)
    const cookiesForLogin = await member.test.getCookies({
      userId: adminUserId,
    });
    // eslint-disable-next-line no-console
    console.log("Cookies to add:", cookiesForLogin.length, cookiesForLogin.map(c => ({ name: c.name, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite })));
    await context.addCookies(cookiesForLogin);

    // Try to visit the dashboard
    await page.goto("/dashboard");
    // Wait and check what page we got
    await page.waitForLoadState("domcontentloaded");
    const currentUrl1 = page.url();
    // eslint-disable-next-line no-console
    console.log("URL after going to /dashboard with cookies:", currentUrl1);
    if (new URL(currentUrl1).pathname !== "/dashboard") {
      // eslint-disable-next-line no-console
      console.log("Cookies didn't work, falling back to login form");
      // Visit login form
      await page.goto("/login");
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500); // wait for hydration
      // Use pressSequentially for proper React event handling
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();
      await emailInput.pressSequentially(adminEmail, { delay: 10 });
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.click();
      await passwordInput.pressSequentially(adminPassword, { delay: 10 });
      // Press Enter to submit the form
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 30000 }),
        passwordInput.press("Enter"),
      ]);
    }

    // ── 2. Screenshot: admin dashboard ──
    await expect(page.getByRole("link", { name: "Collections" }).first()).toBeVisible({ timeout: 10000 });
    await shot(page, "01-admin-dashboard");

    // ── 3. Screenshot: team page (before invite) ──
    await page.goto("/dashboard/team");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("David Admin").first()).toBeVisible({ timeout: 10000 });
    await shot(page, "02-admin-team-before-invite");

    // ── 4. Fill the invite form for Mikel ──
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(mikelEmail);
    await shot(page, "03-admin-invite-form-filled");

    // Submit
    await page.getByRole("button", { name: /^invite$/i }).click();

    // ── 5. Screenshot: pending invite visible in table ──
    await expect(page.getByText(mikelEmail)).toBeVisible({ timeout: 10000 });
    await shot(page, "04-admin-pending-invite");

    // ── 6. Capture the invite URL from the DB ──
    const inviteId = await getInviteIdByEmail(mikelEmail);
    inviteUrl = `/invite/${inviteId}`;
    // eslint-disable-next-line no-console
    console.log(`🔗 Invite URL: http://localhost:3000${inviteUrl}`);
  });

  test("Mikel opens invite link while NOT logged in", async ({ browser }) => {
    // Completely fresh, unauthenticated browser context
    const context = await browser.newContext();
    const page = await context.newPage();

    // ── 7. Visit the invite URL while logged out — the bug fix! ──
    await page.goto(inviteUrl);
    await expect(
      page.getByRole("heading", { name: /accept your invitation/i }),
    ).toBeVisible();
    await shot(page, "05-mikel-invite-not-logged-in");

    // Verify the page shows workspace name + role + the create/sign-in options
    await expect(page.getByText(orgName, { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText(/sign in with your invited account, or create one/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^create account$/i }).first(),
    ).toBeVisible();
  });

  test("Mikel clicks 'Create account' button (redirected to signup)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(inviteUrl);
    // Wait for hydration
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("heading", { name: /accept your invitation/i }),
    ).toBeVisible();

    // ── 8. Click "Create account" → redirect to /signup with ?redirect=/invite/... ──
    await Promise.all([
      page.waitForURL(/\/signup\?redirect=/, { timeout: 15000 }),
      page
        .getByRole("button", { name: /^create account$/i })
        .first()
        .click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await shot(page, "06-signup-page-with-redirect-back-to-invite");

    await context.close();
  });

  test("Mikel creates account via inline form and joins workspace", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Go back to the invite page (where the inline form lives)
    await page.goto(inviteUrl);
    // Wait for hydration
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("heading", { name: /accept your invitation/i }),
    ).toBeVisible();

    // ── 9. Fill in the inline sign-up form on the invite page ──
    const nameInput = page.getByLabel(/full name/i);
    const emailInput = page.getByLabel(/^email$/i);
    const passwordInput = page.getByLabel(/^password$/i);

    // Use pressSequentially for proper React event handling
    await nameInput.click();
    await nameInput.pressSequentially(mikelName, { delay: 10 });
    await emailInput.click();
    await emailInput.pressSequentially(mikelEmail, { delay: 10 });
    await passwordInput.click();
    await passwordInput.pressSequentially(mikelPassword, { delay: 10 });
    await shot(page, "07-invite-inline-form-filled");

    // ── 10. Submit — should create account and accept the invite ──
    // Use Enter key on password field to trigger form submission
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30000 }),
      passwordInput.press("Enter"),
    ]);
    // Wait for dashboard to be fully loaded
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "08-mikel-joined-dashboard");

    // Verify Mikel is now signed in to the dashboard
    await expect(page.getByText(orgName, { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // ── 11. Visit the team page to confirm Mikel is now a member ──
    await page.goto("/dashboard/team");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await expect(page.getByText(mikelName).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(mikelEmail).first()).toBeVisible({ timeout: 15000 });
    await shot(page, "09-team-page-confirms-mikel-is-member");

    await context.close();
  });

  test("cleanup", async () => {
    const { test } = await getAuthTestHelpers();
    try {
      await test.deleteOrganization?.(organizationId);
    } catch (e) {
      console.warn("Org cleanup warning:", e);
    }
    try {
      await test.deleteUser(adminUserId);
    } catch (e) {
      console.warn("User cleanup warning:", e);
    }
    // Delete the Mikel user via the test helper if available, or skip
    try {
      const { db } = await import("../../src/db");
      const { users } = await import("../../src/db/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(users).where(eq(users.email, mikelEmail));
    } catch (e) {
      console.warn("Mikel cleanup warning:", e);
    }
    // eslint-disable-next-line no-console
    console.log("🧹 Cleanup complete");
  });
});
