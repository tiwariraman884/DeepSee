export default async function run(page, ui) {
  const fs = await import("fs");
  const token = fs.readFileSync("C:/Users/Lenovo/Desktop/DeepSea/.tok.txt", "utf8").trim();

  await page.context().addCookies([
    { name: "auth-token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
  ]);

  const dupKey = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("same key")) dupKey.push(m.text().slice(0, 100));
  });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 150)));

  await page.setViewportSize({ width: 1600, height: 1000 });

  const shots = [
    ["/dashboard", "dashboard"],
    ["/map", "map"],
    ["/species", "species"],
    ["/ai-center", "ai-center"],
  ];

  const results = [];
  for (const [path, name] of shots) {
    try {
      await page.goto("http://localhost:3111" + path, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `C:/Users/Lenovo/Desktop/DeepSea/.demo-${name}.png`, fullPage: false });
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
      results.push({ path, ok: true, heading: txt.split("\n").filter(Boolean)[0] || null });
    } catch (e) {
      results.push({ path, ok: false, err: String(e).slice(0, 120) });
    }
  }

  return { results, duplicateKeyErrors: dupKey.length, pageErrors };
}