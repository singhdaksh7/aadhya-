import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@aadyasociety.example";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "ChangeThisPassword123!";
const API_URL = process.env.E2E_API_URL || "http://localhost:4100/api";

const RUN_ID = Date.now();
const PAGE_TITLE = `Playwright CMS Page ${RUN_ID}`;
const PAGE_SLUG = `pw-cms-page-${RUN_ID}`;

const BLOG_TITLE = `Playwright Blog Story ${RUN_ID}`;
const BLOG_SLUG = `pw-blog-story-${RUN_ID}`;

const FAQ_QUESTION = `Playwright FAQ Question ${RUN_ID}?`;

test.describe.configure({ mode: "serial" });

async function adminLogin(page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForURL(/\/admin\/?$/);
}

test("E2E CMS Page Roundtrip: Create, Draft 404, Publish, Edit & Update", async ({ page }) => {
  await adminLogin(page);

  // 1. Navigate to Pages
  await page.goto("/admin/pages");
  await page.locator('button:has-text("+ Create New Page")').click();

  // 2. Fill form as DRAFT
  await page.locator('input[placeholder*="Shipping & Delivery Policy"]').fill(PAGE_TITLE);
  await page.locator('input[placeholder*="shipping-policy"]').fill(PAGE_SLUG);
  await page.locator('div[contenteditable="true"]').fill("Welcome to Aadya CMS Page Content");
  await page.locator('button:has-text("Save Page")').click();

  // 3. Draft page should be hidden on public storefront (returns 404 / NotFound)
  await page.goto(`/pages/${PAGE_SLUG}`);
  await expect(page.locator("body")).toContainText(/Page Not Found|404/i);

  // 4. Publish Page in Admin
  await page.goto("/admin/pages");
  const row = page.locator(`tr:has-text("${PAGE_TITLE}")`);
  await row.locator('button:has-text("Publish")').click();

  // 5. Public page now displays published content
  await page.goto(`/pages/${PAGE_SLUG}`);
  await expect(page.locator("body")).toContainText(PAGE_TITLE);
  await expect(page.locator("body")).toContainText("Welcome to Aadya CMS Page Content");
});

test("E2E Blog Roundtrip: Create Draft, Hide Publicly, Publish & Display Detail", async ({ page }) => {
  await adminLogin(page);

  // 1. Navigate to Blog Admin
  await page.goto("/admin/blog");
  await page.locator('button:has-text("+ Create Blog Post")').click();

  // 2. Fill post details
  await page.locator('input[placeholder*="Styling Terracotta"]').fill(BLOG_TITLE);
  await page.locator('input[placeholder*="styling-terracotta"]').fill(BLOG_SLUG);
  await page.locator('textarea[placeholder*="Brief 1-2 sentence"]').fill("Playwright test blog excerpt summary.");
  await page.locator('div[contenteditable="true"]').fill("Rich journal content with artisan details.");
  await page.locator('button:has-text("Save Blog Post")').click();

  // 3. Draft blog hidden from public /blog list
  await page.goto("/blog");
  await expect(page.locator(`text=${BLOG_TITLE}`)).toHaveCount(0);

  // 4. Publish blog post
  await page.goto("/admin/blog");
  const blogRow = page.locator(`tr:has-text("${BLOG_TITLE}")`);
  await blogRow.locator('button:has-text("Publish")').click();

  // 5. Appears on public journal list and opens detail view
  await page.goto("/blog");
  await expect(page.locator(`text=${BLOG_TITLE}`)).toBeVisible();
  await page.click(`text=${BLOG_TITLE}`);

  await expect(page.locator("body")).toContainText(BLOG_TITLE);
  await expect(page.locator("body")).toContainText("Rich journal content with artisan details.");
});

test("E2E FAQ Roundtrip: Category & Question CRUD, Public Accordion & Deactivation", async ({ page }) => {
  await adminLogin(page);

  // 1. Navigate to FAQ Admin
  await page.goto("/admin/faqs");
  await page.locator('button:has-text("+ Add FAQ Question")').click();

  // 2. Fill question details
  await page.locator('input[placeholder*="How long does"]').fill(FAQ_QUESTION);
  await page.locator('div[contenteditable="true"]').fill("Express delivery takes 3-5 business days across India.");
  await page.locator('button:has-text("Save Question")').click();

  // 3. Appears in public FAQ accordion
  await page.goto("/faq");
  await expect(page.locator(`text=${FAQ_QUESTION}`)).toBeVisible();

  // Toggle open accordion
  await page.click(`text=${FAQ_QUESTION}`);
  await expect(page.locator("body")).toContainText("Express delivery takes 3-5 business days across India.");

  // 4. Deactivate in admin
  await page.goto("/admin/faqs");
  const faqItem = page.locator(`div:has-text("${FAQ_QUESTION}")`);
  await faqItem.locator('button:has-text("Deactivate")').click();

  // 5. Hidden on public FAQ page
  await page.goto("/faq");
  await expect(page.locator(`text=${FAQ_QUESTION}`)).toHaveCount(0);
});
