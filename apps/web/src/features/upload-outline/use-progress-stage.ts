"use client";

import { useEffect, useState } from "react";

export function useProgressStage(active: boolean): 0 | 1 | 2 {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!active) return;
    const a = setTimeout(() => setStage(1), 1000);
    const b = setTimeout(() => setStage(2), 10000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      setStage(0);
    };
  }, [active]);
  return active ? stage : 0;
}
