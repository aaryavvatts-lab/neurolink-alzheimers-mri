"use client";

import { useEffect, useState } from "react";
import type { Results } from "./types";

export function useResults() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/results.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  return { data, error };
}
