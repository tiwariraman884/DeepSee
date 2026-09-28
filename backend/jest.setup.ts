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

console.log = (...args: unknown[]) => {
  const isBareNumber =
    args.length > 0 &&
    args.every((a) => typeof a === "number" && Number.isFinite(a));
  if (isBareNumber) return; // searoute-js distance chatter
  // Background processes (the resident ML worker's stderr pump) can emit logs
  // after the test environment is torn down — Jest turns those into errors.
  try {
    originalLog(...args);
  } catch {
    /* environment already torn down */
  }
};
