import { describe, expect, it } from "vitest";

import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";

describe("variant types", () => {
  it("keeps a variant assignable to a challenge, so the whole engine consumes it unchanged", () => {
    // This compiles only while ChallengeVariant extends Challenge. The run loop, validators,
    // scoring, and record store all take a Challenge; this assignment is the migration lever.
    const acceptsChallenge = (challenge: Challenge) => challenge;
    const acceptsVariant = (variant: ChallengeVariant) => acceptsChallenge(variant);

    expect(typeof acceptsVariant).toBe("function");
  });
});
