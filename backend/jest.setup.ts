process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-jest";
/**
 * Explicit opt-in for the test-only auth bypass in src/lib/authMiddleware.ts.
 *
 * That bypass is now gated on THREE conditions: NODE_ENV=test, the presence of
 * JEST_WORKER_ID (which only Jest sets, inside a real test worker), and this
 * variable. Setting NODE_ENV=test on a deployed server is therefore no longer
 * sufficient to disable authentication, and assertSafeProductionAuth() refuses
 * to boot such a process.
 *
 * This file is loaded by Jest alone (jest.config.json → setupFiles) and is never
 * imported by the production server, so the opt-in cannot leak into a deployment.
 */
process.env.ALLOW_TEST_AUTH_BYPASS = "true";

/**
 * Test-only admin password. Declared here (jest.setup.ts is loaded for every
 * suite via setupFiles) so no test file needs a hardcoded fallback password:
 * an absent ADMIN_PASSWORD must fail loudly, not silently become a known secret.
 */
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password-for-jest";
/**
 * Jest setup — scoped console filter for noisy dependencies.
 *
 * searoute-js prints bare distance numbers (e.g. "1656") to stdout for every
 * route calculation. That is library chatter, not an application error, and it
 * pollutes test output. We drop ONLY console.log calls whose every argument is
 * a bare finite number; everything else (strings, objects, multi-arg calls)
 * passes through untouched, so genuine application errors stay visible.
 * Test-only: this file is loaded by Jest alone and never in production.
 */
const originalLog = console.log.bind(console);

console.log = (...args: Parameters<typeof console.log>) => {
  const isBareNumber =
    args.length > 0 &&
    args.every((a) => typeof a === "number" && Number.isFinite(a));
  if (isBareNumber) {
    // Only swallow the noise when it actually comes from searoute-js, so
    // genuine application logs that happen to be numeric still get printed.
    const stack = new Error().stack ?? "";
    if (stack.includes("searoute")) return;
  }
  // Background processes (the resident ML worker's stderr pump) can emit logs
  // after the test environment is torn down — Jest turns those into errors.
  try {
    originalLog(...args);
  } catch {
    /* environment already torn down */
  }
};
