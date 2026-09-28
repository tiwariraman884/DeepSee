import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";

/**
 * Resolves the Python interpreter used to run the ML scripts.
 *
 * Why this exists: the backend used to call bare "python", which fails with
 * ENOENT on machines where Python is not on PATH — and silently picks the wrong
 * interpreter when several are installed (one may lack numpy/sklearn/torch).
 *
 * Resolution order:
 *   1. PYTHON_BIN env var            — explicit, wins always
 *   2. A project venv                 — .venv or venv at the repo root
 *   3. The first interpreter on PATH that can import the ML dependencies
 *   4. "python"                       — last resort, preserves old behaviour
 */

const ML_DEP_CHECK = "import numpy, sklearn, PIL, joblib";

let _resolved: string | null = null;

function works(candidate: string, args: string[] = ["-c", ML_DEP_CHECK]): boolean {
  try {
    // 60s: importing sklearn+torch deps can take several seconds each, and in
    // CI/test runs several workers probe simultaneously — 20s timed out under
    // that load and silently degraded the whole pipeline to a broken "python".
    execFileSync(candidate, args, {
      stdio: "ignore",
      timeout: 60000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function venvCandidates(): string[] {
  const root = path.join(process.cwd(), "..");
  const rel = process.platform === "win32"
    ? ["Scripts", "python.exe"]
    : ["bin", "python"];
  return [path.join(root, ".venv", ...rel), path.join(root, "venv", ...rel)]
    .filter((p) => fs.existsSync(p));
}

function pathCandidates(): { bin: string; args?: string[] }[] {
  // Common install locations when PATH is not set up.
  if (process.platform === "win32") {
    const explicit = [
      "python.exe",
      "C:\\Python314\\python.exe",
      "C:\\Python313\\python.exe",
      "C:\\Python312\\python.exe",
      "C:\\Python311\\python.exe",
    ].map((bin) => ({ bin }));
    // The official Windows launcher, installed with python.org builds.
    explicit.push({ bin: "py.exe" } as any);
    explicit.push({ bin: "py" } as any);
    return explicit;
  }
  return [
    { bin: "python3" },
    { bin: "python" },
  ];
}

export function getPythonBin(): string {
  if (_resolved) return _resolved;

  const explicit = process.env.PYTHON_BIN?.trim();
  if (explicit) {
    if (!works(explicit)) {
      console.warn(
        `[Python] PYTHON_BIN="${explicit}" is set but cannot import the ML dependencies. Using it anyway.`
      );
    }
    _resolved = explicit;
    return _resolved;
  }

  for (const candidate of venvCandidates()) {
    if (works(candidate)) {
      console.log(`[Python] Using project virtualenv: ${candidate}`);
      _resolved = candidate;
      return _resolved;
    }
  }

  for (const candidate of pathCandidates()) {
    if (works(candidate.bin, candidate.args ? [...candidate.args, "-c", ML_DEP_CHECK] : undefined)) {
      console.log(`[Python] Using interpreter: ${candidate.bin}`);
      _resolved = candidate.bin;
      return _resolved;
    }
  }

  console.warn(
    "[Python] No interpreter found with numpy/sklearn/PIL/joblib installed. " +
      "Falling back to 'python'. Set PYTHON_BIN in .env to fix this."
  );
  _resolved = "python";
  return _resolved;
}

/** Absolute path to the ml/ directory, resolved once. */
export function getMlDir(): string {
  return path.join(process.cwd(), "..", "ml");
}