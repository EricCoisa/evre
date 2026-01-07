import { useCallback } from "react";

export function useLocalStorage<T>(key: string) {
  // Get value from localStorage
  const getValue = useCallback((): T | null => {
    if (typeof window === "undefined") return null;
    const item = window.localStorage.getItem(key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }, [key]);

  // Set value in localStorage
  const setValue = useCallback((value: T) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  }, [key]);

  // Clear all localStorage
  const clearAll = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.clear();
  }, []);

  return { getValue, setValue, removeValue, clearAll };
}
