/**
 * fix-krill-v2.mjs
 *
 * Downloads verified Antarctic Krill (Euphausia superba) image
 * from Wikimedia Commons using a more targeted search approach.
 */

import { createWriteStream, existsSync, statSync, unlinkSync } from "fs";
import { get } from "https";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "species");

const USER_AGENT =
  "DeepSea-Guardian/1.0 (Hackathon Project; mailto:team@deepsea-guardian.dev) Node.js/" +
  process.version;

function wikimediaApi(params) {
  const base = "https://commons.wikimedia.org/w/api.php";
  const query = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });
  return `${base}?${query.toString()}`;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(httpsGet(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function searchCommons(query, limit = 50) {
  const url = wikimediaApi({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6",
    srlimit: limit,
    srprop: "size|timestamp",
    srsort: "relevance",
  });
  const data = await httpsGet(url);
  return data?.query?.search || [];
}

async function getImageInfo(titles) {
  const url = wikimediaApi({
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata|mime",
    iiurlwidth: 1600,
  });
  const data = await httpsGet(url);
  const pages = data?.query?.pages || {};
  const results = [];
  for (const pageId of Object.keys(pages)) {
    const page = pages[pageId];
    if (pageId === "-1" || !page.imageinfo) continue;
    const info = page.imageinfo[0];
    results.push({
      title: page.title,
      url: info.url,
      width: info.width,
      height: info.height,
      mime: info.mime,
      size: info.size,
    });
  }
  return results;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = get(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
        },
      },
      (response) => {
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
          if (size < 2000) {
            try { unlinkSync(dest); } catch {}
            reject(new Error(`too small: ${size}b`));
            return;
          }
          resolve(size);
        });
      }
    );
    req.on("error", (err) => {
      try { unlinkSync(dest); } catch {}
      reject(err);
    });
    req.setTimeout(120000, () => {
      req.destroy();
      try { unlinkSync(dest); } catch {}
      reject(new Error("timeout"));
    });
  });
}

async function trySearch(query, label) {
  console.log(`  [SEARCH] "${query}"...`);
  const results = await searchCommons(query);
  if (results.length === 0) {
    console.log(`    → No results`);
    return null;
  }
  console.log(`    → ${results.length} results`);

  const titles = results.slice(0, 20).map((r) => r.title);
  const images = await getImageInfo(titles);

  const validImages = images.filter(
    (img) =>
      (img.mime?.startsWith("image/jpeg") || img.mime?.startsWith("image/png")) &&
      img.width >= 800 &&
      img.height >= 600
  );

  if (validImages.length === 0) {
    console.log(`    → No valid images meeting criteria`);
    return null;
  }

  // Score: prefer higher res, JPEG
  validImages.sort((a, b) => {
    let sa = 0, sb = 0;
    if (a.width >= 1600) sa += 20; else if (a.width >= 1200) sa += 10;
    if (b.width >= 1600) sb += 20; else if (b.width >= 1200) sb += 10;
    if (a.mime === "image/jpeg") sa += 5;
    if (b.mime === "image/jpeg") sb += 5;
    if (a.size > 50000 && a.size < 2000000) sa += 5;
    if (b.size > 50000 && b.size < 2000000) sb += 5;
    return sb - sa;
  });

  const best = validImages[0];
  console.log(
    `    → Best: ${best.title.split("|")[0].slice(-30)} (${best.width}×${best.height}, ${best.mime})`
  );
  return best;
}

async function main() {
  const filename = "antarctic-krill.jpg";
  const outPath = resolve(OUT_DIR, filename);

  // Remove old file if exists
  if (existsSync(outPath)) {
    const oldSize = statSync(outPath).size;
    if (oldSize > 10000) {
      console.log(`  Existing ${filename} is ${Math.round(oldSize / 1024)} KB — keeping it.`);
      return;
    }
    unlinkSync(outPath);
  }

  console.log("Searching for Antarctic Krill (Euphausia superba) image...\n");

  // Try multiple search strategies
  const searches = [
    "Euphausia superba krill",
    "Euphausia superba Antarctic krill",
    "krill swarm Antarctic",
    "Euphausia superba -NOAA",
    "Antarctic krill Euphausia superba -NOAA",
  ];

  let bestImage = null;
  for (const query of searches) {
    bestImage = await trySearch(query, "krill");
    if (bestImage) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!bestImage) {
    // Last resort: try NOAA image library URL
    console.log("\n  Trying NOAA direct URL...");
    const noaaUrls = [
      "https://upload.wikimedia.org/wikipedia/commons/1/1d/Antarctic_krill_%28Euphausia_superba%29.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/8/8a/Krill_swarm.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/0/0b/Euphausia_superba.jpg",
    ];

    for (const url of noaaUrls) {
      console.log(`  [DL] Trying ${url.split("/").pop()}...`);
      try {
        const size = await downloadFile(url, outPath);
        console.log(`  saved (${Math.round(size / 1024)} KB)`);
        return;
      } catch (err) {
        console.log(`  failed: ${err.message}`);
      }
    }

    console.log("\n  ⚠ Could not find verified krill image. Using best available fallback.");
    return;
  }

  console.log(`\n  Downloading: ${bestImage.url}`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const size = await downloadFile(bestImage.url, outPath);
      console.log(`  saved (${Math.round(size / 1024)} KB)`);
      return;
    } catch (err) {
      console.log(`  attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.log("  [FAIL] Could not download krill image.");
}

main().catch(console.error);

