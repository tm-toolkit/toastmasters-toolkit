import { useState, useEffect } from 'react';

// Mirrors a piece of state to localStorage under `key`.
// `raw: true` stores plain strings (no JSON.stringify/parse) — matches how the
// original vanilla app stored `tmRole` and `gsEndpoint` (plain strings), so the
// same localStorage keys stay readable by either version during the migration.
// tmRoster/tmHistory were already JSON-encoded arrays, so they use the default.
export function useLocalStorageState(key, initialValue, { raw = false } = {}) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return initialValue;
      return raw ? stored : JSON.parse(stored);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, raw ? value : JSON.stringify(value));
  }, [key, value, raw]);

  return [value, setValue];
}
