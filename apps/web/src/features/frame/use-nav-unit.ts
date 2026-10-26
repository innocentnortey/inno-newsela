"use client";
// The unit the "Unit board" link points at: the unit named by the URL, else the most recent unit, else none.
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { pickRecentUnitKey, unitKeyFromPath } from "./nav";

// Remembered so a page outside any unit (e.g. /prompt-guidance) still points at the last unit seen.
let lastUnitKey: string | null = null;

export function useNavUnitKey(pathname: string): string | null {
  const fromPath = unitKeyFromPath(pathname);
  const [recent, setRecent] = useState<string | null>(null);
  const needsList = fromPath === null;

  useEffect(() => {
    if (!fromPath) return;
    lastUnitKey = fromPath;
  }, [fromPath]);

  useEffect(() => {
    if (!needsList || recent !== null) return;
    let alive = true;
    api
      .GET("/units")
      .then(({ data }) => {
        if (alive) setRecent(pickRecentUnitKey(data?.units ?? []));
      })
      .catch(() => {
        // The link stays on /units.
      });
    return () => {
      alive = false;
    };
  }, [needsList, recent]);

  return fromPath ?? lastUnitKey ?? recent;
}
