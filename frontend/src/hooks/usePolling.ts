import { useEffect, useRef, useState } from "react";

export function usePolling<T>(
  fetcher: () => T,
  intervalMs = 30000
): { data: T | null; lastSync: Date | null; tick: number } {
  const [data, setData] = useState<T | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const run = () => {
      setData(fetcherRef.current());
      setLastSync(new Date());
      setTick((t) => t + 1);
    };
    run();
    const id = setInterval(run, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { data, lastSync, tick };
}
