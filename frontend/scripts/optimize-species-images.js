const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "species");
const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      /\.(jpg|jpeg|png)$/i.test(f) && f !== "README.md" && f !== "fallback.webp"
  );

const MAX_WIDTH = 1000;
const QUALITY = 78;

(async () => {
  for (const f of files) {
    const full = path.join(dir, f);
    const before = fs.statSync(full).size;
    const img = sharp(full, { failOn: "none" });
    const meta = await img.metadata();
    const width = meta.width && meta.width > MAX_WIDTH ? MAX_WIDTH : meta.width;

    // Convert to .webp
    const webpName = f.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const webpPath = path.join(dir, webpName);

    await img
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(webpPath);

    const after = fs.statSync(webpPath).size;
    const savedPct =
      before > 0 ? ((1 - after / before) * 100).toFixed(0) : "?";
    console.log(
      `${f.padEnd(28)} ${meta.width}x${meta.height}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (${savedPct}% smaller)`
    );

    // Remove the source JPG
    fs.unlinkSync(full);
  }

  // Verify all expected .webp files
  console.log("\n── Verifying final files ──");
  const webpFiles = fs
    .readdirSync(dir)
    .filter((f) => /\.webp$/i.test(f) && f !== "README.md");
  for (const f of webpFiles.sort()) {
    const full = path.join(dir, f);
    const size = fs.statSync(full).size;
    const sizeKB = Math.round(size / 1024);
    const label = size < 10000 ? "⚠️ small" : "✅";
    console.log(`${label} ${f.padEnd(28)} ${sizeKB} KB`);
  }

  console.log("\nDone! All species images optimized to WebP.");
})();

