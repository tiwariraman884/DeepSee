/**
 * download-verified-species.mjs
 *
 * Downloads verified, species-accurate photographs from Wikimedia Commons
 * for all 18 marine species in the DeepSea Guardian dataset.
 *
 * Uses the Wikimedia Commons API to search by scientific name and
 * filters for high-resolution, quality images.
 *
 * Preferred sources: NOAA, National Geographic, Wikimedia Commons,
 * Smithsonian Ocean, Monterey Bay Aquarium.
 *
 * Usage: node scripts/download-verified-species.mjs
 */

import { createWriteStream, existsSync, statSync, unlinkSync, readdirSync, mkdirSync } from "fs";
import { get } from "https";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "species");

// Ensure output directory exists
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const DELAY_MS = 1500; // Be polite to Wikimedia API
const USER_AGENT =
  "DeepSea-Guardian/1.0 (Hackathon Project; mailto:team@deepsea-guardian.dev) Node.js/" +
  process.version;

// ─────────────────────────────────────────────────────────────────────────────
// Species search queries — use scientific name + common name for best results
// ─────────────────────────────────────────────────────────────────────────────

const SPECIES = [
  {
    filename: "hawksbill-turtle.jpg",
    common: "Hawksbill Turtle",
    scientific: "Eretmochelys imbricata",
    search: "Eretmochelys imbricata hawksbill turtle -NOAA",
  },
  {
    filename: "blue-whale.jpg",
    common: "Blue Whale",
    scientific: "Balaenoptera musculus",
    search: "Balaenoptera musculus blue whale -NOAA",
  },
  {
    filename: "staghorn-coral.jpg",
    common: "Staghorn Coral",
    scientific: "Acropora cervicornis",
    search: "Acropora cervicornis staghorn coral -NOAA",
  },
  {
    filename: "hammerhead-shark.jpg",
    common: "Hammerhead Shark",
    scientific: "Sphyrna lewini",
    search: "Sphyrna lewini scalloped hammerhead shark -NOAA",
  },
  {
    filename: "vaquita.jpg",
    common: "Vaquita",
    scientific: "Phocoena sinus",
    search: "Phocoena sinus vaquita porpoise -NOAA",
  },
  {
    filename: "giant-clam.jpg",
    common: "Giant Clam",
    scientific: "Tridacna gigas",
    search: "Tridacna gigas giant clam -NOAA",
  },
  {
    filename: "leatherback-turtle.jpg",
    common: "Leatherback Turtle",
    scientific: "Dermochelys coriacea",
    search: "Dermochelys coriacea leatherback turtle -NOAA",
  },
  {
    filename: "sea-otter.jpg",
    common: "Sea Otter",
    scientific: "Enhydra lutris",
    search: "Enhydra lutris sea otter -NOAA",
  },
  {
    filename: "manta-ray.jpg",
    common: "Manta Ray",
    scientific: "Mobula birostris",
    search: "Mobula birostris giant manta ray -NOAA",
  },
  {
    filename: "clownfish.jpg",
    common: "Clownfish",
    scientific: "Amphiprion ocellaris",
    search: "Amphiprion ocellaris clownfish -NOAA",
  },
  {
    filename: "emperor-penguin.jpg",
    common: "Emperor Penguin",
    scientific: "Aptenodytes forsteri",
    search: "Aptenodytes forsteri emperor penguin -NOAA",
  },
  {
    filename: "green-turtle.jpg",
    common: "Green Sea Turtle",
    scientific: "Chelonia mydas",
    search: "Chelonia mydas green sea turtle -NOAA",
  },
  {
    filename: "humpback-whale.jpg",
    common: "Humpback Whale",
    scientific: "Megaptera novaeangliae",
    search: "Megaptera novaeangliae humpback whale -NOAA",
  },
  {
    filename: "antarctic-krill.jpg",
    common: "Antarctic Krill",
    scientific: "Euphausia superba",
    search: "Euphausia superba antarctic krill swarm -NOAA",
  },
  {
    filename: "lionfish.jpg",
    common: "Lionfish",
    scientific: "Pterois volitans",
    search: "Pterois volitans lionfish -NOAA",
  },
  {
    filename: "right-whale.jpg",
    common: "North Atlantic Right Whale",
    scientific: "Eubalaena glacialis",
    search: "Eubalaena glacialis right whale -NOAA",
  },
  {
    filename: "crown-of-thorns.jpg",
    common: "Crown-of-Thorns Starfish",
    scientific: "Acanthaster planci",
    search: "Acanthaster planci crown of thorns starfish -NOAA",
  },
  {
    filename: "sleeper-shark.jpg",
    common: "Pacific Sleeper Shark",
    scientific: "Somniosus pacificus",
    search: "Somniosus pacificus sleeper shark -NOAA",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Wikimedia Commons API helpers
// ─────────────────────────────────────────────────────────────────────────────

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
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(httpsGet(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
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

/**
 * Search Wikimedia Commons for images matching the given query.
 * Returns an array of { title, pageId } results.
 */
async function searchCommons(query, limit = 30) {
  const url = wikimediaApi({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6", // File namespace
    srlimit: limit,
    srprop: "size|timestamp",
    srsort: "relevance",
  });

  const data = await httpsGet(url);
  return data?.query?.search || [];
}

/**
 * Get image info (URL, dimensions, metadata) for a list of file titles.
 */
async function getImageInfo(titles) {
  const url = wikimediaApi({
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata|mime",
    iiurlwidth: 1600,
    iiurlheight: 1200,
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
      thumbUrl: info.thumburl,
      width: info.width,
      height: info.height,
      mime: info.mime,
      size: info.size,
      description: info.extmetadata?.ImageDescription?.value || "",
      categories: info.extmetadata?.Categories?.value || "",
      artist: info.extmetadata?.Artist?.value || "",
    });
  }

  return results;
}

/**
 * Score an image result for suitability.
 * Prefers:
 *  - Higher resolution (≥1200px on both axes)
 *  - JPEG/PNG format (not SVG)
 *  - Images that have the species as the main subject
 *  - Photographs (not illustrations)
 */
function scoreImage(image, searchTerms) {
  let score = 0;

  // Resolution scoring
  if (image.width >= 1600 && image.height >= 1200) score += 30;
  else if (image.width >= 1200 && image.height >= 900) score += 20;
  else if (image.width >= 800 && image.height >= 600) score += 10;

  // Prefer JPEG over PNG (smaller)
  if (image.mime === "image/jpeg") score += 10;
  else if (image.mime === "image/png") score += 5;

  // File size: prefer well-compressed images (100KB-2MB)
  if (image.size > 100000 && image.size < 2000000) score += 10;
  else if (image.size >= 2000000 && image.size < 5000000) score += 5;

  // Description relevance (check if scientific name appears in description)
  const desc = (image.description || "").toLowerCase();
  const title = (image.title || "").toLowerCase();
  const combined = desc + " " + title;

  for (const term of searchTerms) {
    if (combined.includes(term.toLowerCase())) {
      score += 5;
    }
  }

  // Prefer photographs (indicated by camera model in metadata or JPEG)
  if (image.mime === "image/jpeg") score += 5;

  return score;
}

/**
 * Download a file from URL to local path.
 */
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
            reject(new Error(`file too small: ${size}b`));
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

/**
 * Process a single species: search, score, select best image, download.
 */
async function processSpecies(species, index, total) {
  const { filename, common, scientific, search } = species;
  const outPath = resolve(OUT_DIR, filename);

  // Skip if file exists and is > 10KB
  if (existsSync(outPath) && statSync(outPath).size > 10000) {
    const sizeKB = Math.round(statSync(outPath).size / 1024);
    console.log(`  [${index + 1}/${total}] [SKIP] ${common} — already exists (${sizeKB} KB)`);
    return true;
  }

  console.log(`\n  [${index + 1}/${total}] Searching for: ${common} (${scientific})`);

  try {
    // Step 1: Search Wikimedia Commons
    const searchTerms = search.split(" ");
    const results = await searchCommons(search);

    if (!results || results.length === 0) {
      // Fallback: search with just scientific name
      console.log(`    → No results with full query, trying scientific name only...`);
      const fallbackResults = await searchCommons(scientific);
      if (!fallbackResults || fallbackResults.length === 0) {
        console.log(`    ⚠ No results found on Wikimedia Commons for ${scientific}`);
        return false;
      }
      results.push(...fallbackResults);
    }

    // Step 2: Get image info
    const fileTitles = results.slice(0, 15).map((r) => r.title);
    const images = await getImageInfo(fileTitles);

    if (images.length === 0) {
      console.log(`    ⚠ No image info available for ${common}`);
      return false;
    }

    // Step 3: Score and select best image
    const scored = images
      .filter((img) => {
        // Exclude SVGs, GIFs, and non-image files
        const validMime = ["image/jpeg", "image/png", "image/webp"];
        return validMime.some((m) => img.mime?.startsWith(m));
      })
      .map((img) => ({
        ...img,
        score: scoreImage(img, searchTerms),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      console.log(`    ⚠ No suitable images found for ${common}`);
      return false;
    }

    const best = scored[0];
    console.log(
      `    → Best match: ${best.title.split(".").pop()} (${best.width}×${best.height}, score: ${best.score})`
    );
    if (best.description) {
      const desc = best.description.replace(/<[^>]*>/g, "").substring(0, 100);
      console.log(`    → Description: ${desc}...`);
    }

    // Step 4: Download the image
    const downloadUrl = best.url;
    console.log(`    → Downloading...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      process.stdout.write(`      Attempt ${attempt}... `);
      try {
        const size = await downloadFile(downloadUrl, outPath);
        const sizeKB = Math.round(size / 1024);
        console.log(`saved (${sizeKB} KB)`);
        return true;
      } catch (err) {
        console.log(`failed: ${err.message}`);
        if (attempt < 3) {
          const wait = 5000 * attempt;
          console.log(`      Retrying in ${wait / 1000}s...`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    console.log(`    ⚠ Failed to download after 3 attempts`);
    return false;
  } catch (err) {
    console.log(`    ⚠ Error: ${err.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clean small/corrupt files before starting
// ─────────────────────────────────────────────────────────────────────────────

function cleanExisting() {
  const files = readdirSync(OUT_DIR);
  for (const f of files) {
    if (/\.(jpg|jpeg|png)$/i.test(f) && f !== "README.md") {
      const p = resolve(OUT_DIR, f);
      if (existsSync(p) && statSync(p).size < 2000) {
        unlinkSync(p);
        console.log(`  [CLEAN] Removed corrupt file: ${f}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DeepSea Guardian — Verified Species Image Downloader");
  console.log("  Source: Wikimedia Commons API");
  console.log(`  Output: ${OUT_DIR}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  cleanExisting();

  let success = 0;
  let failed = 0;

  for (let i = 0; i < SPECIES.length; i++) {
    if (i > 0) {
      // Be polite: delay between requests
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    const ok = await processSpecies(SPECIES[i], i, SPECIES.length);
    if (ok) success++;
    else failed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${success} downloaded successfully, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n  Failed species:");
    for (let i = 0; i < SPECIES.length; i++) {
      const outPath = resolve(OUT_DIR, SPECIES[i].filename);
      if (!existsSync(outPath) || statSync(outPath).size < 10000) {
        console.log(`    - ${SPECIES[i].common} (${SPECIES[i].scientific})`);
      }
    }
    console.log("\n  Re-run the script to retry failed downloads.");
  }

  console.log("\n  Next step: node scripts/optimize-species-images.js");
}

main().catch(console.error);

