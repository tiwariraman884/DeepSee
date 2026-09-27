// Self-contained CI accessibility audit (Doc 16.9).
// Builds the app, starts `next start`, waits for it to be ready,
// runs scripts/a11y-audit.mjs against it, then shuts the server down.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3137;
const BASE = `http://localhost:${PORT}`;

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error(`Server at ${url} did not become ready`);
}

async function main() {
  console.log("▶ Building app…");
  await new Promise((res, rej) => {
    const p = run("npm", ["run", "build"]);
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`build failed (${code})`))));
  });

  console.log(`▶ Starting server on port ${PORT}…`);
  const server = run("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(PORT) },
  });

  let auditCode = 1;
  try {
    await waitForServer(BASE);
    const audit = run("node", ["scripts/a11y-audit.mjs"], {
      stdio: "inherit",
      env: { ...process.env, BASE_URL: BASE },
    });
    auditCode = await new Promise((res) => audit.on("exit", res));
  } finally {
    server.kill("SIGTERM");
  }

  process.exit(auditCode);
}

main();
