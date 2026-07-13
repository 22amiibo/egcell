# Fresh Normal Speed Seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start Normal Speed from a fresh generated queue while preserving exact seeded reproduction.

**Architecture:** The browser creates a session seed once at the hydrated UI boundary. App-level queue bindings pass that seed into the unchanged deterministic queue generator; URL overrides bypass seed creation.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, Playwright.

## Global Constraints

- Randomness occurs only when the UI creates a new normal-play seed.
- Domain challenge and queue generation stays deterministic.
- `?sessionSeed=` remains exact and E2E tests use explicit or injected seeds.
- Classic challenge picking and stable daily seeds remain available.

---

### Task 1: Browser seed factory and queue bindings

**Files:**
- Modify: `src/domain/random/seeds.ts`
- Modify: `src/domain/random/seeds.test.ts`
- Modify: `src/data/challenges/queue.ts`
- Modify: `src/domain/queue/buildTaskQueue.test.ts`

- [ ] Add failing tests for UUID creation, fallback creation, same-seed queue equality, and different-seed task signatures.
- [ ] Run the focused tests and confirm the new seed-factory assertions fail.
- [ ] Add `createNewSessionSeed()` and `buildNormalSpeedQueue()` without changing `buildTaskQueue`.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Normal Speed UI seed boundary

**Files:**
- Modify: `src/components/game/GameShell.tsx`
- Modify: `src/components/game/SessionRun.tsx`
- Create: `src/components/game/normalSpeedSeed.test.tsx`

- [ ] Add failing UI tests using an injected factory for two fresh starts and an explicit URL seed.
- [ ] Run the focused UI tests and confirm the fixed classic default fails them.
- [ ] Hydration-gate seed creation, default Normal Speed to the generated queue, advance “Next challenge” through it, and pass the factory into sessions.
- [ ] Run the focused UI and existing session tests.

### Task 3: E2E, docs, and completion

**Files:**
- Modify: `e2e/main-speed.spec.ts`
- Modify: `CURRENT_STATE.md`
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Modify: `AGENT_HANDOFF.md`
- Modify: `DECISIONS.md`

- [ ] Add a deterministic browser-boundary E2E check for distinct normal starts.
- [ ] Update architecture and handoff documentation.
- [ ] Run lint, unit tests, typecheck, build, and E2E.
- [ ] Review only the intended diff and commit as `Use fresh generated queues for normal speed runs`.
