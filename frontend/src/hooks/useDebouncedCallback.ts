import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a stable callback that defers invocation until `delay` ms have
 * elapsed since the last call. Useful for debouncing map viewport changes,
 * search inputs and filter updates.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay = 200
): (...args: A) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay]
  );
}
