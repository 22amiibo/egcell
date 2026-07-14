import type { GridCommandId } from "@/domain/commands/commandTypes";

export type RouteStep = {
  command: GridCommandId;
  /** Player-facing and command-level, from the registry. The chord renders from the keymap. */
  label: string;
  /** What it acted on, when that is not obvious: "Complete", so a card can say `Filter to "Complete"`. */
  argument?: string;
  optional?: boolean;
  /** Steps sharing a group may be performed in any order — a composite's independent parts. */
  group?: string;
  /**
   * This step's weight, read from the command registry at solve time. Uniformly 1 today, so cost
   * and count coincide — but they are two fields from day one (§1a.5), so giving a menu-driven
   * command a real weight later is a data change, not a solver rewrite.
   */
  cost: number;
};

export type Route = {
  id: string;
  label: string;
  kind: "keyboard" | "mouse" | "mixed";
  steps: RouteStep[];
  /** Count: the non-optional steps. */
  optimalActions: number;
  /** Weight: the non-optional steps' cost. Identical to `optimalActions` while every cost is 1. */
  optimalCost: number;
  /** Every step has a chord or a menu route — i.e. every step is `hotkeyEligible`. */
  keyboardComplete: boolean;
  source: "solver" | "authored";
  version: string;
  /**
   * True when the route was assembled leaf by leaf from a composite's parts rather than searched as
   * one problem. Such a route solves the challenge and is short, but is not *provably* shortest — a
   * globally better route might interleave the parts. The card says "a fast path" rather than "the
   * fastest path", and this flag is what makes it say so (§6.3).
   */
  nearOptimal: boolean;
};
