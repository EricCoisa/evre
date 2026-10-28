import { useEffect, useRef } from 'react';

/** Faz polling automático em modo preview (?preview=true). */
export function usePreviewPolling(fetchFn: () => void | Promise<void>, intervalMs = 1000) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview=true');

  useEffect(() => {
    let mounted = true;
    if (isPreview) {
      intervalRef.current = setInterval(() => {
        if (mounted) fetchFn();
      }, intervalMs);
    }
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPreview, fetchFn, intervalMs]);
}
