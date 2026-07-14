import { afterEach, describe, expect, it } from "vitest";

import { challenges } from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import { clearRouteCache, getRoute, getRoutes } from "@/domain/routes/routeCache";
import { ROUTE_REGISTRY } from "@/domain/routes/routeRegistry";
import type { Route } from "@/domain/routes/routeTypes";

const challenge: Challenge = challenges[0];

function authored(version: string): Route {
  return {
    id: "authored",
    label: "Authored route",
    kind: "keyboard",
    steps: [{ command: "SELECT_COLUMN", label: "Select the column", cost: 1 }],
    optimalActions: 1,
    optimalCost: 1,
    keyboardComplete: true,
    source: "authored",
    version,
    nearOptimal: false,
  };
}

afterEach(() => {
  clearRouteCache();

  for (const key of Object.keys(ROUTE_REGISTRY)) {
    delete ROUTE_REGISTRY[key];
  }
});

describe("getRoutes", () => {
  it("returns the same array twice: the search runs once per challenge", () => {
    const first = getRoutes(challenge);
    const second = getRoutes(challenge);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("prefers an authored override to the solver", () => {
    ROUTE_REGISTRY[challenge.id] = {
      version: challenge.version,
      routes: [authored(challenge.version)],
    };

    expect(getRoutes(challenge)?.[0].source).toBe("authored");
  });

  it("ignores an authored override written for another version of the challenge", () => {
    // The whole point of the version field. An authored route is a claim about a grid, and a
    // template version bump changes the grid, so a stale override would teach a route that no longer
    // works — precisely the rot (§10.1) this system exists to end. Falling back to the solver is
    // always safe; showing a dead route is not.
    ROUTE_REGISTRY[challenge.id] = { version: "v0-ancient", routes: [authored("v0-ancient")] };

    expect(getRoutes(challenge)?.[0].source).toBe("solver");
  });

  it("caches a null: an unsolvable drill must not re-burn the node budget on every render", () => {
    // A challenge that permits no action at all can have no route, and asking twice must not search
    // twice — the result card would otherwise pay the full budget on every render.
    const impossible: Challenge = { ...challenge, id: "impossible", allowedActions: [] };

    expect(getRoutes(impossible)).toBeNull();
    expect(getRoutes(impossible)).toBeNull();
  });
});

describe("getRoute", () => {
  it("is the first of the routes, and null when there are none", () => {
    expect(getRoute(challenge)).toBe(getRoutes(challenge)?.[0]);
    expect(getRoute({ ...challenge, id: "none", allowedActions: [] })).toBeNull();
  });
});
