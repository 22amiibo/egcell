"use client";

import { useState } from "react";

import { StatRow } from "@/components/game/StatRow";
import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import { commandChordLabel } from "@/domain/commands/keymap";
import type { Route, RouteStep } from "@/domain/routes/routeTypes";
import type { FastestPath } from "@/hooks/useFastestPath";
import type { Platform } from "@/lib/platform";

function StepRow({ step, index, platform }: { step: RouteStep; index: number; platform: Platform }) {
  const chord = commandChordLabel(step.command, platform);
  const label =
    step.argument === undefined
      ? COMMAND_REGISTRY[step.command].description
      : `${COMMAND_REGISTRY[step.command].description}: ${step.argument}`;

  return (
    <li className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-ink">
        <span className="mr-1.5 text-muted">{index + 1}.</span>
        {label}
      </span>

      {chord !== null && (
        <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
          {chord}
        </kbd>
      )}
    </li>
  );
}

function MissedShortcuts({ path }: { path: FastestPath }) {
  const missed = path.comparison.missedShortcuts;

  if (missed.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Missed shortcuts
      </h4>

      <ul className="mt-2 flex flex-col gap-1" data-testid="missed-shortcuts">
        {missed.map((shortcut) => (
          <li
            key={`${shortcut.kind}-${shortcut.suggested}`}
            className="flex items-baseline justify-between gap-3 text-[12px]"
          >
            <span className="text-ink">{shortcut.observed}</span>

            <span className="flex shrink-0 items-baseline gap-2">
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {shortcut.suggestedChordLabel}
              </kbd>

              {shortcut.savedActions > 0 && (
                <span className="text-muted">
                  {`saves ${shortcut.savedActions} action${shortcut.savedActions === 1 ? "" : "s"}`}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The post-run fastest path (§7.5).
 *
 * Three things it will not do. It will not invent a route when the solver proved none — it says so
 * plainly. It will not call a composite's route "the fastest", because the parts were solved one at
 * a time and a better interleaving may exist; that route reads "a fast path", and `nearOptimal` is
 * what makes it say so. And when an event arrived without a command, it drops the step-by-step
 * comparison rather than guess what the player pressed, and shows only what it can stand behind.
 */
export function FastestPathCard({
  path,
  // Mid-run, the help panel shows the same card with the comparison suppressed (§7.2): the run is
  // still happening, so there is nothing yet to compare it against.
  showComparison = true,
}: {
  path: FastestPath;
  showComparison?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const routes = path.routes;
  const { comparison } = path;

  if (routes === null || routes.length === 0) {
    return (
      <section className="mt-3 border-t border-line pt-3" data-testid="fastest-path">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Fastest path
        </h3>

        <p className="mt-2 text-[12px] text-muted">
          No fastest path is recorded for this drill yet.
        </p>
      </section>
    );
  }

  const route: Route = routes[Math.min(selected, routes.length - 1)];
  const composite = route.nearOptimal;

  return (
    <section className="mt-3 border-t border-line pt-3" data-testid="fastest-path">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {composite ? "A fast path" : "Fastest path"}
        </h3>

        <span className="text-[11px] text-muted" data-testid="fastest-path-summary">
          {`${route.keyboardComplete ? "keyboard" : "mixed"} · ${route.optimalActions} action${
            route.optimalActions === 1 ? "" : "s"
          }`}
        </span>
      </div>

      {routes.length > 1 && (
        <div className="mt-2 flex gap-1" role="group" aria-label="Tied routes">
          {routes.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelected(index)}
              aria-pressed={index === selected}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                index === selected
                  ? "border-accent-strong text-ink"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {`Route ${String.fromCharCode(65 + index)}`}
            </button>
          ))}
        </div>
      )}

      <ol className="mt-2 flex flex-col gap-1" data-testid="fastest-path-steps">
        {route.steps.map((step, index) => (
          <StepRow
            key={`${step.command}-${index}`}
            step={step}
            index={index}
            platform={path.platform}
          />
        ))}
      </ol>

      {composite && (
        <p className="mt-2 text-[11px] text-muted">
          The parts were solved one at a time, so this is a fast path rather than a proven shortest
          one. They may be done in either order.
        </p>
      )}

      {showComparison &&
        (comparison.confidence === "low" ? (
          <p className="mt-3 border-t border-line pt-3 text-[12px] text-muted">
            {`This run recorded ${comparison.playerActions} actions but not what produced them, so it cannot be compared step by step.`}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <StatRow label="Optimal actions" value={comparison.optimalActions} />
            <StatRow label="Your actions" value={comparison.playerActions} />
            <StatRow label="Extra actions" value={comparison.extraActions} />
            <StatRow label="Efficiency" value={`${Math.round(comparison.efficiency * 100)}%`} />
          </div>
        ))}

      {showComparison && comparison.confidence === "high" && <MissedShortcuts path={path} />}
    </section>
  );
}
