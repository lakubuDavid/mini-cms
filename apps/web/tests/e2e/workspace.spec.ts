import { expect, test } from "@playwright/test";
import { createPasswordMember } from "../common";

const email = "contact@lakubudavid.me";
const password = "Password@1";

test.describe("web app e2e", () => {
  test("authenticated user can open dashboard and workspace page", async ({
    context,
    page,
  }) => {
    const member = await createPasswordMember({
      email,
      password,
      name: "David Lakubu",
      organizationName: "Lakubu Studio",
      organizationSlug: "lakubu-studio",
    });

    try {
      const cookies = await member.test.getCookies({
        userId: member.user.id,
        domain: "127.0.0.1",
      });
      await context.addCookies(cookies);

      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
      await expect(page.getByText("Lakubu Studio")).toBeVisible();

      await page.getByRole("link", { name: "Workspace" }).click();
      await expect(page).toHaveURL(/\/dashboard\/workspace$/);
      await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
      await expect(page.locator('input[value="Lakubu Studio"]')).toBeVisible();
      await expect(page.locator('input[value="lakubu-studio"]')).toBeVisible();
      await expect(page.getByText("Workspace ID")).toBeVisible();
    } finally {
      await member.cleanup();
    }
  });

  test("login page accepts the provided credentials", async ({ page }) => {
    const member = await createPasswordMember({
      email,
      password,
      name: "David Lakubu",
      organizationName: "Lakubu Studio",
      organizationSlug: "lakubu-studio",
    });

    try {
      await page.goto("/login");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);

      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByText("Lakubu Studio")).toBeVisible();
    } finally {
      await member.cleanup();
    }
  });
});
