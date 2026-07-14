import type { Challenge } from "@/domain/challenges/challengeTypes";
import { authoredRoute } from "@/domain/routes/routeRegistry";
import type { Route } from "@/domain/routes/routeTypes";
import { solveRoute } from "@/domain/routes/solveRoute";

/**
 * `challenge.id` is `templateId@templateVersion:dN` for a generated variant, so id and seed together
 * pin the template, its version, the difficulty, and the data — every input the solver reads. Two
 * challenges sharing this key are the same challenge, and a template version bump changes the key on
 * its own, so the cache cannot serve a route for a grid that no longer exists (§1a.5).
 */
function cacheKey(challenge: Challenge): string {
  return `${challenge.id}:${challenge.seed}`;
}

/**
 * A route is derived, never stored: nothing here survives a reload, because a stale route is worse
 * than a recomputed one. Within a session the search runs once per challenge — the route card, the
 * post-run summary, and a replay all read the same entry.
 */
const CACHE = new Map<string, Route[] | null>();

/**
 * A session drills through hundreds of variants; unbounded, this map is a leak that happens to be
 * slow rather than one that happens to crash. Oldest-first eviction, because the challenge the player
 * is on now is the one whose route gets asked for again.
 */
const MAX_ENTRIES = 200;

/**
 * The routes for a challenge: the authored override if one is current, else the solver's, else null.
 *
 * **Null is a real answer, and it is cached like any other.** It means "no fastest path is recorded
 * for this drill", and the card must say exactly that rather than invent one. Caching it matters: a
 * challenge the solver cannot crack burns its whole node budget every time it is asked, and it would
 * otherwise be asked on every render.
 */
export function getRoutes(challenge: Challenge): Route[] | null {
  const key = cacheKey(challenge);

  if (CACHE.has(key)) {
    return CACHE.get(key) ?? null;
  }

  const routes = authoredRoute(challenge) ?? solveRoute(challenge);

  if (CACHE.size >= MAX_ENTRIES) {
    const oldest = CACHE.keys().next();

    if (oldest.done !== true) {
      CACHE.delete(oldest.value);
    }
  }

  CACHE.set(key, routes);

  return routes;
}

/** The single fastest route, or null. What a route card shows; ties break by registry order (§1a.5). */
export function getRoute(challenge: Challenge): Route | null {
  return getRoutes(challenge)?.[0] ?? null;
}

/** Tests only: the cache is process-global, and a test that seeded it must not leak into the next. */
export function clearRouteCache(): void {
  CACHE.clear();
}
