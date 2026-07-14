"use client";

import { useMemo } from "react";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import { type RouteComparison, compareRoute } from "@/domain/routes/compareRoute";
import { getRoutes } from "@/domain/routes/routeCache";
import type { Route } from "@/domain/routes/routeTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import { type Platform, getPlatform } from "@/lib/platform";

export type FastestPath = {
  /** Every route tied for shortest, or null when the solver could not prove one. */
  routes: Route[] | null;
  comparison: RouteComparison;
  platform: Platform;
};

/**
 * The fastest path for a finished run: computed once, and never during play.
 *
 * `enabled` is the whole safety property, and it is a parameter rather than a rule someone has to
 * remember. The search costs up to half a second on the deepest drills (§1a.12), and a player who
 * paid that on a keystroke would feel the grid stutter under their hands. Callers pass `true` only
 * where the plan allows the cost: the result card mounting, or help being revealed — which has
 * already unranked the run, so it cannot spoil a scored one (§6.3).
 *
 * The routes are memoised for the session in `routeCache`, so a challenge replayed ten times is
 * solved once. This hook's `useMemo` only keeps React from redoing the comparison.
 */
export function useFastestPath(
  challenge: Challenge,
  events: RunEvent[],
  enabled: boolean,
): FastestPath | null {
  return useMemo(() => {
    if (!enabled) {
      return null;
    }

    const platform = getPlatform();
    const routes = getRoutes(challenge);

    return { routes, comparison: compareRoute(events, routes, platform), platform };
  }, [challenge, events, enabled]);
}
