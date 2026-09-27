// Admin Media Library: proves an image can be uploaded once via the
// MediaPicker (from a Category form), saved as that field's image, and then
// reused (selected, not re-uploaded) on a second admin form (a Banner) —
// confirming "Browse Library" genuinely lists previously uploaded assets.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIXEL_PATH = path.join(__dirname, "fixtures", "pixel.png");

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";

const RUN_ID = Date.now();
const ASSET_TITLE = `E2E Media Asset ${RUN_ID}`;
const CATEGORY_NAME = `E2E Media Category ${RUN_ID}`;
const BANNER_NAME = `E2E Media Banner ${RUN_ID}`;

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await expect(page.locator('a:has-text("Products")').first()).toBeVisible();
}

test("admin uploads a new image via MediaPicker and it's set as the Category image", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/categories");
  await expect(page.locator("h1")).toContainText("Category Hierarchy");

  await page.getByPlaceholder("e.g. Wall Decor").fill(CATEGORY_NAME);

  // Open the MediaPicker attached to the first image field ("Category
  // Image" is the first ImagePickerInput on this form).
  const pickerButtons = page.locator('button:has-text("Choose from Media Library")');
  const categoryImageInput = page.locator('input[placeholder*="Media Library"]').nth(0);
  await pickerButtons.nth(0).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Switch to the Upload tab and upload a tiny real PNG fixture.
  await dialog.locator('button:has-text("Upload New File")').click();
  await dialog.locator("#media-picker-file").setInputFiles(PIXEL_PATH);
  await dialog.getByPlaceholder("Describe image content").fill("E2E pixel asset");
  await dialog.getByPlaceholder("Asset title").fill(ASSET_TITLE);
  await dialog.locator('button:has-text("Upload to Library")').click();

  // Upload success flips the picker back to the Browse tab with the new
  // asset pre-selected.
  await expect(dialog.locator(`text=${ASSET_TITLE}`)).toBeVisible({ timeout: 15000 });
  await dialog.locator('button:has-text("Select Image")').click();
  await expect(dialog).not.toBeVisible();

  // The field's text input now holds the uploaded asset's URL.
  await expect(categoryImageInput).not.toHaveValue("");

  await page.locator('button:has-text("Create Category")').click();
  await expect(page.locator("td", { hasText: CATEGORY_NAME }).first()).toBeVisible({ timeout: 10000 });
});

test("the same image is selectable (not re-uploaded) from a second admin form (Banner)", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/banners");
  await expect(page.locator("h1")).toContainText("Banners");

  await page.locator('button:has-text("+ Create Banner")').click();
  await expect(page.locator('text=Create New Banner')).toBeVisible();

  await page.getByPlaceholder("e.g. Autumn Brassware Hero").fill(BANNER_NAME);

  // "Desktop Image *" is the first ImagePickerInput on the banner form.
  const desktopImageInput = page.getByPlaceholder("https://images.unsplash.com/...");
  await page.locator('button:has-text("Choose from Media Library")').nth(0).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Stay on the default Browse Library tab and search for the asset
  // created by the previous test — proves it's really listed, not just
  // freshly uploaded in-session.
  await dialog.locator("#media-picker-search").fill(ASSET_TITLE);
  const assetTile = dialog.locator("div[role='button']", { hasText: ASSET_TITLE });
  await expect(assetTile).toBeVisible({ timeout: 10000 });
  await assetTile.click();
  await dialog.locator('button:has-text("Select Image")').click();
  await expect(dialog).not.toBeVisible();

  await expect(desktopImageInput).not.toHaveValue("");

  await page.locator('button:has-text("Save Banner")').click();
  await expect(page.locator(`text=${BANNER_NAME}`).first()).toBeVisible({ timeout: 10000 });
});
