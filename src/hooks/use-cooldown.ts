import { useEffect, useRef, useState } from "react";

/**
 * Persists a cooldown timer across refreshes using localStorage.
 * Returns whether the cooldown is active, seconds remaining, and a
 * `start()` function to begin the cooldown.
 */
export function useCooldown(key: string, durationSeconds: number) {
  const storageKey = `cooldown:${key}`;

  const getRemaining = () => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return 0;
    const expiresAt = Number(raw);
    if (Number.isNaN(expiresAt)) return 0;
    const remainingMs = expiresAt - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  };

  const [secondsLeft, setSecondsLeft] = useState(getRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Re-sync on mount in case another tab/row updated storage
    setSecondsLeft(getRemaining());

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const remaining = getRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const start = () => {
    const expiresAt = Date.now() + durationSeconds * 1000;
    window.localStorage.setItem(storageKey, String(expiresAt));
    setSecondsLeft(durationSeconds);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const remaining = getRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);
  };

  return {
    isActive: secondsLeft > 0,
    secondsLeft,
    start,
  };
}
