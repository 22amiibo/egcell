# Fresh Normal Speed Seeds Design

## Goal

Normal Speed begins with a generated challenge queue whose seed is created in the browser for each page load. Supplying `?sessionSeed=<seed>` reproduces the exact same queue for tests, shared links, and rematches.

## Boundaries

- `createNewSessionSeed()` is the only new nondeterministic operation. It uses `crypto.randomUUID()` and falls back to a timestamp plus random values only when UUID generation is unavailable.
- App-level queue bindings compose the browser seed into a normal-speed queue request.
- `buildTaskQueue`, variant generation, validators, and daily seed composition remain deterministic and unchanged.
- The classic challenge picker remains available, but the initial Normal Speed challenge and its next-challenge sequence come from the generated queue.

## UI Flow

URL parameters are read before mounting the playable shell. The hydrated shell chooses either the exact `sessionSeed` override or one injected seed-factory result, builds the queue once, and shows its first task. “Next challenge” advances through that queue. Manual classic or generated picker choices continue to use their existing behavior.

Sprint and timed modes use the same seed factory at their session-start boundary. Explicit seeded retries replay the same queue; unpinned session retries draw a new seed, preserving current behavior.

## Testing

- Seed unit tests cover UUID and fallback behavior without real randomness.
- Queue tests compare stable task signatures for equal and different explicit seeds.
- UI tests inject fixed seed factories, proving separate normal starts consume separate seeds and explicit URL seeds bypass the factory.
- E2E stubs the UUID boundary with deterministic values, proving a reload changes the normal queue without probabilistic assertions.
