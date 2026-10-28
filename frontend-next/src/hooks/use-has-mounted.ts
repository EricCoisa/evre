import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/** True only after the client has hydrated. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
