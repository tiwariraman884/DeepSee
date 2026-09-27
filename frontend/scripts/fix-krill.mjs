// Download antarctic krill from alternative source
import { createWriteStream, existsSync, statSync, unlinkSync } from "fs";
import { get } from "https";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "species");

const urls = [
  "https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=1200",
  "https://images.pexels.com/photos/920151/pexels-photo-920151.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://cdn.pixabay.com/photo/2016/11/29/05/55/ocean-1867934_1280.jpg",
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        try { unlinkSync(dest); } catch {}
        resolve(downloadFile(response.headers.location, dest));
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        try { unlinkSync(dest); } catch {}
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        const size = statSync(dest).size;
        if (size < 1000) {
          try { unlinkSync(dest); } catch {}
          reject(new Error(`too small: ${size}b`));
          return;
        }
        resolve(size);
      });
    });
    req.on("error", (err) => { try { unlinkSync(dest); } catch {} reject(err); });
    req.setTimeout(30000, () => {
      req.destroy();
      try { unlinkSync(dest); } catch {}
      reject(new Error("timeout"));
    });
  });
}

async function main() {
  const filename = "antarctic-krill.jpg";
  const outPath = resolve(outDir, filename);

  if (existsSync(outPath)) unlinkSync(outPath);

  for (const url of urls) {
    console.log(`  [DL]   ${filename} ... `);
    try {
      const size = await downloadFile(url, outPath);
      console.log(`  saved (${Math.round(size / 1024)} KB)`);
      return;
    } catch (err) {
      console.log(`  failed: ${err.message}`);
    }
  }
  console.log("  [FAIL] all sources exhausted");
}

main().catch(console.error);

