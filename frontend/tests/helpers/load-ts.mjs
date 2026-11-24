/**
 * Minimal TypeScript module loader for Node's built-in test runner.
 * =================================================================
 * The frontend has no JS test runner installed (next/jest is not a dependency,
 * and adding one is out of scope for this fix). Rather than ship a harness that
 * cannot run, this helper transpiles `src/**` TypeScript with the TypeScript
 * compiler API that is ALREADY installed, then hands the JavaScript to Node's
 * real CommonJS loader — so module resolution, package entrypoints and ESM/CJS
 * interop behave as they do at build time.
 *
 * Types are not checked here; `npm run typecheck` (tsc --noEmit) owns that.
 *
 * Usage:
 *   const load = createTsLoader();
 *   const mod = load("src/features/ai-assistant/assistant.ts");
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
/** frontend/tests/helpers -> frontend/ */
export const FRONTEND_ROOT = resolvePath(HERE, "..", "..");
/** frontend/src */
export const SRC_ROOT = resolvePath(FRONTEND_ROOT, "src");

// Anchored at frontend/package.json so bare imports resolve from frontend/node_modules.
const nodeRequire = createRequire(pathToFileURL(resolvePath(FRONTEND_ROOT, "package.json")).href);

const PROBE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function probe(base) {
  for (const suffix of PROBE_EXTENSIONS) {
    const candidate = base.endsWith(".ts") || base.endsWith(".tsx") ? base : `${base}${suffix}`;
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export function createTsLoader() {
  const modules = new Map();
  const stubs = new Map();
  const calls = { alias: 0, relative: 0, bare: 0 };

  function transpile(file) {
    const source = readFileSync(file, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return outputText;
  }

  function loadFile(file) {
    if (modules.has(file)) return modules.get(file).exports;

    const mod = { exports: {} };
    modules.set(file, mod); // register before evaluating: TS emits circular imports.

    const localRequire = (request) => {
      if (stubs.has(request)) return stubs.get(request);
      if (request.startsWith("@/")) {
        calls.alias++;
        const resolved = probe(resolvePath(SRC_ROOT, request.slice(2)));
        if (!resolved) throw new Error(`Unresolved TS path alias "${request}" from ${file}`);
        return loadFile(resolved);
      }
      if (request.startsWith(".")) {
        const resolved = probe(resolvePath(dirname(file), request));
        if (resolved) {
          calls.relative++;
          return loadFile(resolved);
        }
      }
      calls.bare++;
      return nodeRequire(request);
    };

    const fn = new Function("exports", "require", "module", "__filename", "__dirname", transpile(file));
    fn(mod.exports, localRequire, mod, file, dirname(file));
    return mod.exports;
  }

  return {
    /** Load a TS module by path relative to frontend/, e.g. "src/...". */
    load(relativePath) {
      const file = resolvePath(FRONTEND_ROOT, relativePath);
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) throw new Error(`Not a TS file: ${file}`);
      return loadFile(file);
    },
    /** Replace a module specifier with fixed exports (e.g. the "server-only" guard). */
    stub(request, exports) {
      stubs.set(request, exports);
    },
    /** Resolution counters, used by tests to prove each path was exercised. */
    calls,
    /** Drop the module cache (fresh module state between tests). */
    reset() {
      modules.clear();
    },
  };
}
