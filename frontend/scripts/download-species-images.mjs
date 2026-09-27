// Download remaining species images with verified URL sources
import { createWriteStream, existsSync, statSync, unlinkSync } from "fs";
import { get } from "https";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "public", "species");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Already have .webp: hawksbill-turtle, blue-whale, staghorn-coral, hammerhead-shark,
//   vaquita, giant-clam, leatherback-turtle, sea-otter, manta-ray, clownfish, fallback
// These 8 species still need images:

const images = {
  // Verified direct URLs from reputable sources
  "emperor-penguin.jpg": "https://images.pexels.com/photos/3615751/pexels-photo-3615751.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "green-turtle.jpg": "https://images.pexels.com/photos/847393/pexels-photo-847393.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "humpback-whale.jpg": "https://images.pexels.com/photos/4668731/pexels-photo-4668731.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "antarctic-krill.jpg": "https://images.pexels.com/photos/920151/pexels-photo-920151.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "lionfish.jpg": "https://images.pexels.com/photos/3265290/pexels-photo-3265290.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "right-whale.jpg": "https://images.pexels.com/photos/4668747/pexels-photo-4668747.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "crown-of-thorns.jpg": "https://images.pexels.com/photos/847402/pexels-photo-847402.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "sleeper-shark.jpg": "https://images.pexels.com/photos/4668723/pexels-photo-4668723.jpeg?auto=compress&cs=tinysrgb&w=1200",
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/webp,image/jpeg,image/*,*/*;q=0.8",
      },
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
    req.setTimeout(120000, () => {
      req.destroy();
      try { unlinkSync(dest); } catch {}
      reject(new Error("timeout"));
    });
  });
}

async function downloadOne(filename, url) {
  const outPath = resolve(outDir, filename);

  if (existsSync(outPath) && statSync(outPath).size > 10000) {
    const sizeKB = Math.round(statSync(outPath).size / 1024);
    console.log(`  [SKIP] ${filename} -- already exists (${sizeKB} KB)`);
    return true;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`  [DL]   ${filename} ... `);
    try {
      const size = await downloadFile(url, outPath);
      const sizeKB = Math.round(size / 1024);
      console.log(`saved (${sizeKB} KB)`);
      return true;
    } catch (err) {
      console.log(`failed: ${err.message}`);
      if (attempt < 3) {
        const wait = 5000 * attempt;
        console.log(`  waiting ${wait / 1000}s...`);
        await delay(wait);
      }
    }
  }
  console.log(`  [FAIL] ${filename}`);
  return false;
}

async function main() {
  console.log("Downloading 8 missing species images...\n");
  console.log(`Output: ${outDir}\n`);

  // Clean 0-byte files
  for (const f of Object.keys(images)) {
    const p = resolve(outDir, f);
    if (existsSync(p) && statSync(p).size < 100) {
      unlinkSync(p);
      console.log(`  cleanup: removed 0-byte ${f}`);
    }
  }

  let success = 0;
  let i = 0;

  for (const [filename, url] of Object.entries(images)) {
    if (i > 0) await delay(3000);
    const ok = await downloadOne(filename, url);
    if (ok) success++;
    i++;
  }

  console.log(`\nDone! ${success}/8 succeeded.`);
  if (success < 8) console.log("Run again to retry failed files.");
}

main().catch(console.error);

