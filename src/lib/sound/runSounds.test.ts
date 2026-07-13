import { describe, expect, it } from "vitest";

import {
  getSoundCue,
  soundEventForFeedback,
  type SoundEvent,
} from "@/lib/sound/runSounds";

describe("getSoundCue", () => {
  it("is silent whenever master sound is disabled", () => {
    expect(getSoundCue("success", { enabled: false })).toBeNull();
  });

  it("maps an enabled event to an original synthesized cue at the requested volume", () => {
    expect(
      getSoundCue("success", { enabled: true, success: true, volume: 0.4 }),
    ).toMatchObject({
      kind: "success",
      volume: 0.4,
      waveform: "sine",
    });
  });

  it("respects each individual category toggle", () => {
    expect(
      getSoundCue("softError", { enabled: true, error: false, volume: 35 }),
    ).toBeNull();
    expect(
      getSoundCue("comboIncrease", { enabled: true, combo: false, volume: 35 }),
    ).toBeNull();
    expect(
      getSoundCue("runComplete", { enabled: true, runComplete: false, volume: 35 }),
    ).toBeNull();
  });

  it.each<SoundEvent>([
    "movement",
    "success",
    "softError",
    "comboIncrease",
    "pbPace",
    "runComplete",
    "rankedPromotion",
    "dailyComplete",
  ])("defines the %s category without bundled audio assets", (event) => {
    const cue = getSoundCue(event, {
      enabled: true,
      volume: 35,
      movement: true,
      success: true,
      error: true,
      combo: true,
      pbPace: true,
      runComplete: true,
      rankedPromotion: true,
      dailyComplete: true,
    });

    expect(cue).toMatchObject({ kind: event, volume: 0.35 });
    expect(cue?.frequencies.length).toBeGreaterThan(0);
    expect(cue?.durationMs).toBeLessThanOrEqual(180);
  });
});

describe("soundEventForFeedback", () => {
  it("maps live feedback to sound categories without sounding on task mount", () => {
    expect(soundEventForFeedback("taskAppear")).toBeNull();
    expect(soundEventForFeedback("shortcut")).toBe("movement");
    expect(soundEventForFeedback("mistake")).toBe("softError");
    expect(soundEventForFeedback("success")).toBe("success");
    expect(soundEventForFeedback("combo")).toBe("comboIncrease");
    expect(soundEventForFeedback("pbPace")).toBe("pbPace");
    expect(soundEventForFeedback("runFinished")).toBe("runComplete");
  });
});
