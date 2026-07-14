"use client";

import { useEffect } from "react";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import { getRoutes } from "@/domain/routes/routeCache";

/**
 * Warms the route cache for a challenge as soon as it mounts, off the render path — a
 * difficulty-5 solve can cost ~half a second (hotkey plan §1a.12) and must never land on a
 * frame. By the time the task finishes, `getRoutes` is a cache hit and the combo judgment
 * (`comboOutcomeFrom`) is free.
 */
export function useWarmRoutes(challenge: Challenge): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      getRoutes(challenge);
    }, 0);

    return () => clearTimeout(timer);
  }, [challenge]);
}
