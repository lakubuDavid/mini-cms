import { expect, test } from "@playwright/test";
import { createPasswordMember, waitForHydration } from "../common";

const password = "Password@1";

// The suite talks to a remote Turso database, so every server round trip is
// network bound. Give the UI time to settle before asserting.
const UI_TIMEOUT = 30_000;

test.describe.configure({ timeout: 120_000 });

/**
 * Each run gets its own email address. The suite runs against a shared
 * database, so reusing a fixed address would either collide with an existing
 * account or, on cleanup, delete a real one.
 */
function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("web app e2e", () => {
  test("authenticated user can open dashboard and workspace page", async ({
    context,
    page,
  }) => {
    const organizationName = "Lakubu Studio";
    const organizationSlug = `lakubu-studio-${Date.now()}`;

    const member = await createPasswordMember({
      email: uniqueEmail("workspace"),
      password,
      name: "David Lakubu",
      organizationName,
      organizationSlug,
    });

    try {
      const cookies = await member.test.getCookies({
        userId: member.user.id,
        domain: "127.0.0.1",
      });
      await context.addCookies(cookies);

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Collections" }),
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(
        page.getByRole("heading", { name: organizationName }),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      await page.goto("/dashboard/workspace");
      await expect(page).toHaveURL(/\/dashboard\/workspace$/);
      await expect(
        page.getByRole("heading", { name: "Workspace" }),
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(
        page.locator(`input[value="${organizationName}"]`),
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(
        page.locator(`input[value="${organizationSlug}"]`),
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText("Workspace ID")).toBeVisible({
        timeout: UI_TIMEOUT,
      });
    } finally {
      await member.cleanup();
    }
  });

  test("login page accepts the provided credentials", async ({ page }) => {
    const email = uniqueEmail("login");
    const organizationName = "Login Studio";

    const member = await createPasswordMember({
      email,
      password,
      name: "David Lakubu",
      organizationName,
      organizationSlug: `login-studio-${Date.now()}`,
    });

    try {
      await page.goto("/login");
      // The login form is server-rendered, so it must hydrate before a click
      // reaches the React submit handler.
      await waitForHydration(page);
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);

      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: UI_TIMEOUT });
      await expect(
        page.getByRole("heading", { name: organizationName }),
      ).toBeVisible({ timeout: UI_TIMEOUT });
    } finally {
      await member.cleanup();
    }
  });
});
