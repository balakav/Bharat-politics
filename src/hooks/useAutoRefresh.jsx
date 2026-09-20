import { useEffect, useRef } from "react";

export function useAutoRefresh(loadFn, intervalMs = 30000) {
  const savedFn = useRef(loadFn);
  useEffect(() => { savedFn.current = loadFn; });
  useEffect(() => {
    const id = setInterval(() => savedFn.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}