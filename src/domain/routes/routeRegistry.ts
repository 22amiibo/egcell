import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { Route } from "@/domain/routes/routeTypes";

/**
 * A hand-authored route, kept only for a challenge the solver cannot reach — none today.
 *
 * `version` is not decoration. An authored route is a claim about a grid, and the grid changes when
 * the template does; an override that outlives the challenge it was written for is exactly the bug
 * this phase exists to kill (§10.1: four shipped practice notes are wrong today, and they are wrong
 * precisely because nothing invalidated them when the engine moved under them). So the lookup demands
 * the version match, and a stale entry falls through to the solver rather than teaching a dead route.
 */
export type AuthoredRoute = {
  /** The `challenge.version` this route was authored against. A mismatch disables the override. */
  version: string;
  routes: Route[];
};

/**
 * Keyed by `challenge.id`. For a generated variant that id is `templateId@templateVersion:dN`
 * (`finishVariant` in `templates/shared.ts`), so an override is already scoped to one template at one
 * version at one difficulty — which it must be, because the difficulty-4/5 table offset changes the
 * route entirely.
 *
 * **Empty, deliberately.** The solver derives every shipped challenge's route from the engine's own
 * semantics, and a derived route cannot drift from the engine the way an authored one does. This map
 * is the escape hatch for a challenge whose route the search cannot prove inside its budget — not a
 * place to park a route because writing one by hand felt faster.
 *
 * An entry applies to every seed of that id, so it may only be added for a challenge whose route does
 * not depend on its data: a fixed classic, in practice, never a seeded template.
 */
export const ROUTE_REGISTRY: Record<string, AuthoredRoute> = {};

/** The authored override for a challenge, or null when there is none — or it is out of date. */
export function authoredRoute(challenge: Challenge): Route[] | null {
  const entry = ROUTE_REGISTRY[challenge.id];

  if (entry === undefined || entry.version !== challenge.version) {
    return null;
  }

  return entry.routes;
}
