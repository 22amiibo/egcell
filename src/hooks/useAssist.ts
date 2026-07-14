"use client";

import { useCallback, useState } from "react";

import type { RunAssist } from "@/domain/runs/runRecord";

/** Idle, waiting on the confirmation, or revealed. Revealed is a one-way door within an attempt. */
export type AssistStage = "idle" | "confirming" | "revealed";

export type Assist = {
  /**
   * What the run counts for. **Monotonic within an attempt**: once it reads `"revealed"` it never
   * goes back, and hiding the panel does not restore the ranking. A player who has seen the answer
   * has seen it, and a run that could be un-assisted by pressing a button twice would rank someone
   * for work they did not do.
   */
  assist: RunAssist;
  stage: AssistStage;
  /** Is the panel on screen? Independent of `assist`, which never returns to "none". */
  visible: boolean;
  /** The player asked for help: opens the confirmation, or reveals outright if they turned it off. */
  request: () => void;
  confirm: () => void;
  cancel: () => void;
  /** Show or hide an already-revealed panel. Cannot change `assist`. */
  toggle: () => void;
};

export type AssistOptions = {
  /** Practice may open with the path already showing. Such a run is assisted from its first render. */
  autoReveal?: boolean;
  confirmBeforeReveal?: boolean;
};

/**
 * The state behind the Help control (§7.1).
 *
 * Retry resets this by *remounting* — the run surface is keyed by attempt — rather than through a
 * reset method, and deliberately: a reset method is a way to un-assist a run, and the rules say
 * there isn't one. A fresh attempt is a fresh, rankable run; the attempt that took help stays
 * unranked for good, which is exactly the trade the confirmation offers.
 */
export function useAssist({
  autoReveal = false,
  confirmBeforeReveal = true,
}: AssistOptions = {}): Assist {
  const [stage, setStage] = useState<AssistStage>(autoReveal ? "revealed" : "idle");
  const [visible, setVisible] = useState(autoReveal);

  const request = useCallback(() => {
    if (!confirmBeforeReveal) {
      setStage("revealed");
      setVisible(true);
      return;
    }

    setStage((current) => (current === "revealed" ? current : "confirming"));
  }, [confirmBeforeReveal]);

  const confirm = useCallback(() => {
    setStage("revealed");
    setVisible(true);
  }, []);

  const cancel = useCallback(() => {
    // Only the confirmation can be cancelled. Cancelling a *reveal* is the thing that cannot happen.
    setStage((current) => (current === "confirming" ? "idle" : current));
  }, []);

  const toggle = useCallback(() => {
    setVisible((current) => !current);
  }, []);

  return {
    assist: stage === "revealed" ? "revealed" : "none",
    stage,
    visible,
    request,
    confirm,
    cancel,
    toggle,
  };
}
