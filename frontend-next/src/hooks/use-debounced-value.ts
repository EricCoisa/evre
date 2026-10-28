import { useEffect, useState } from 'react';

/** Valor que só muda depois de `delayMs` sem novas mudanças — para não consultar o servidor a cada tecla. */
export function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
