"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "linkto:hide-bot-clicks";

/**
 * "Hide bot clicks" preference, shared by every analytics view and remembered
 * across visits. On by default so numbers reflect genuine visitors.
 */
export function useHideBotClicks(): [boolean, (value: boolean) => void] {
  const [hideBots, setHideBots] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setHideBots(stored === "true");
    } catch {
      // ignore private mode / blocked storage
    }
  }, []);

  const update = useCallback((value: boolean) => {
    setHideBots(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }, []);

  return [hideBots, update];
}
