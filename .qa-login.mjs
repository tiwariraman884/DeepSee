const URL = "http://localhost:3000";

export default async function run(page, ui) {
  const t0 = Date.now();
  await page.goto(URL + "/login", { waitUntil: "domcontentloaded" });
  const pageLoadMs = Date.now() - t0;

  const t1 = Date.now();
  await page.fill("#email", "admin@deepsea.io");
  await page.fill("#password", "[REDACTED]");
  // The submit button is gated on hydration — wait for it like a real user.
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 30000 });
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(URL + "/dashboard", { timeout: 45000 });
  } catch {
    return { stalledAt: page.url(), pageLoadMs, submitToDashboardMs: Date.now() - t1 };
  }
  // Wait for real dashboard content (fetchSummary resolved)
  const submitToDashboardMs = Date.now() - t1;

  return { pageLoadMs, submitToDashboardMs, title: await page.title() };
}
