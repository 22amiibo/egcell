"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";

import { useLocalRunHistory } from "@/hooks/useLocalRunHistory";
import { formatElapsed, formatScore } from "@/lib/format";

const BOARDS = [
  { id: "daily", label: "Daily", description: "Daily challenge standings" },
  { id: "weekly", label: "Weekly", description: "Weekly consistency standings" },
  { id: "friends", label: "Friends", description: "Friends-only standings" },
  { id: "global", label: "Global", description: "Global standings" },
  { id: "skills", label: "Skills", description: "Skill-specific standings" },
  { id: "ranked", label: "Ranked", description: "Ranked tier standings" },
] as const;

type BoardId = (typeof BOARDS)[number]["id"];

function personalBand(totalRuns: number): { name: string; note: string } {
  if (totalRuns === 0) {
    return { name: "Placement pending", note: "Finish a run to establish your local baseline." };
  }

  if (totalRuns < 5) {
    return { name: "Newcomer band", note: `${5 - totalRuns} more runs until a steadier sample.` };
  }

  if (totalRuns < 20) {
    return { name: "Steady band", note: "Your local history is becoming comparable over time." };
  }

  return { name: "Practice regular", note: "Use skill boards to choose the next focused drill." };
}

/**
 * An honest placeholder for future competition. It uses only this device's history and never
 * renders invented opponents, ranks, or scores while no leaderboard service exists.
 */
export function LeaderboardShell() {
  const { profile } = useLocalRunHistory();
  const [activeBoard, setActiveBoard] = useState<BoardId>("daily");
  const board = BOARDS.find((candidate) => candidate.id === activeBoard) ?? BOARDS[0];
  const band = personalBand(profile.totalRuns);
  const bestLocalRun = profile.entries.reduce<(typeof profile.entries)[number] | null>(
    (best, run) => (best === null || run.score > best.score ? run : best),
    null,
  );

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % BOARDS.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + BOARDS.length) % BOARDS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = BOARDS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextBoard = BOARDS[nextIndex];

    setActiveBoard(nextBoard.id);
    document.getElementById(`leaderboard-tab-${nextBoard.id}`)?.focus();
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>
        <Link
          href="/"
          className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          Back to the game
        </Link>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="flex w-full max-w-4xl flex-col gap-6">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-medium tracking-widest text-muted uppercase">
                Competition preview
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Leaderboards</h1>
            </div>
            <span className="text-[12px] text-muted">local data only</span>
          </div>

          <nav
            role="tablist"
            aria-label="Leaderboard views"
            className="flex flex-wrap gap-1 border-b border-line pb-2"
          >
            {BOARDS.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                role="tab"
                id={`leaderboard-tab-${candidate.id}`}
                aria-controls="leaderboard-panel"
                aria-selected={candidate.id === activeBoard}
                tabIndex={candidate.id === activeBoard ? 0 : -1}
                onClick={() => setActiveBoard(candidate.id)}
                onKeyDown={(event) => moveTab(event, index)}
                className={[
                  "rounded px-3 py-1.5 text-[12px] font-medium transition-colors",
                  candidate.id === activeBoard
                    ? "bg-accent/15 text-ink"
                    : "text-muted hover:bg-surface-raised hover:text-ink",
                ].join(" ")}
              >
                {candidate.label}
              </button>
            ))}
          </nav>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
            <section
              id="leaderboard-panel"
              role="tabpanel"
              aria-labelledby={`leaderboard-tab-${activeBoard}`}
              className="min-h-72 rounded-lg border border-line bg-surface p-5"
            >
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <h2 className="text-sm font-semibold text-ink">{board.description}</h2>
                <span className="text-[11px] text-muted">preview</span>
              </div>

              <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                <p className="text-sm font-medium text-ink">No live ranking service is connected.</p>
                <p className="mt-2 max-w-md text-[13px] leading-5 text-muted">
                  This shell reserves the competitive layout without inventing opponents. Your
                  runs remain on this device until you explicitly opt in to a future service.
                </p>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <section className="rounded-lg border border-line bg-surface p-4">
                <p className="text-[11px] font-medium tracking-widest text-muted uppercase">
                  Near me
                </p>
                <p className="mt-3 text-lg font-semibold text-ink">{band.name}</p>
                <p className="mt-1 text-[12px] leading-5 text-muted">{band.note}</p>
              </section>

              <section className="rounded-lg border border-line bg-surface p-4">
                <p className="text-[11px] font-medium tracking-widest text-muted uppercase">
                  Local benchmark
                </p>
                {bestLocalRun === null ? (
                  <p className="mt-3 text-[13px] text-muted">No completed run on this device yet.</p>
                ) : (
                  <div className="mt-3">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {bestLocalRun.label}
                    </p>
                    <p className="mt-1 tabular-nums text-muted">
                      {formatScore(bestLocalRun.score)} pts · {formatElapsed(bestLocalRun.elapsedMs)}
                    </p>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
