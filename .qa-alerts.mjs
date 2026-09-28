export default async function run(page, ui) {
  const fs = await import("fs");
  const token = fs.readFileSync("C:/Users/Lenovo/Desktop/DeepSea/.tok.txt", "utf8").trim();

  await page.context().addCookies([
    { name: "auth-token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
  ]);

  const dupKey = [];
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("same key")) dupKey.push(m.text().slice(0, 120));
  });

  // Load the dashboard, which subscribes to SSE and pushes live alerts into the
  // store — the exact path that used to produce duplicate keys.
  await page.goto("http://localhost:3111/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(10000);

  // Inspect the rendered alert list for duplicate keys / repeated content.
  const info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="rounded-lg"][class*="border"]'));
    const texts = cards
      .map((c) => c.innerText || "")
      .filter((t) => t.includes("AI Anomaly") || t.includes("SPILL") || t.includes("pH"));
    return {
      alertCards: texts.length,
      uniqueAlertTexts: new Set(texts).size,
      sample: texts.slice(0, 3),
    };
  });

  // Also verify the /alerts page renders rows with unique keys.
  await page.goto("http://localhost:3111/alerts", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  const alertsPage = await page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/(\d+)\s+alert(s)?\s+shown/i) || body.match(/(\d+)\s+open/i);
    return { countText: m ? m[0] : null, hasEmptyState: body.includes("No alerts match") };
  });

  return {
    duplicateKeyErrors: dupKey.length,
    dashboard: info,
    alertsPage,
  };
}