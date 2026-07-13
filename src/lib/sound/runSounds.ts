export type SoundEvent =
  | "movement"
  | "success"
  | "softError"
  | "comboIncrease"
  | "pbPace"
  | "runComplete"
  | "rankedPromotion"
  | "dailyComplete";

export type RunSoundFeedbackEvent =
  | "taskAppear"
  | "success"
  | "mistake"
  | "shortcut"
  | "combo"
  | "pbPace"
  | "runFinished";

export type SoundPreferences = {
  enabled: boolean;
  volume?: number;
  movement?: boolean;
  success?: boolean;
  error?: boolean;
  combo?: boolean;
  pbPace?: boolean;
  runComplete?: boolean;
  rankedPromotion?: boolean;
  dailyComplete?: boolean;
};

export type SoundCue = {
  kind: SoundEvent;
  volume: number;
  waveform: OscillatorType;
  frequencies: number[];
  durationMs: number;
};

type CueShape = Omit<SoundCue, "kind" | "volume">;

const CUES: Record<SoundEvent, CueShape> = {
  movement: { waveform: "sine", frequencies: [330], durationMs: 45 },
  success: { waveform: "sine", frequencies: [523, 659], durationMs: 120 },
  softError: { waveform: "triangle", frequencies: [220, 196], durationMs: 110 },
  comboIncrease: { waveform: "sine", frequencies: [659, 784], durationMs: 100 },
  pbPace: { waveform: "sine", frequencies: [440, 554], durationMs: 110 },
  runComplete: { waveform: "sine", frequencies: [523, 659, 784], durationMs: 180 },
  rankedPromotion: { waveform: "triangle", frequencies: [440, 659, 880], durationMs: 180 },
  dailyComplete: { waveform: "sine", frequencies: [392, 523, 659], durationMs: 180 },
};

const PREFERENCE_FOR_EVENT: Record<SoundEvent, keyof SoundPreferences> = {
  movement: "movement",
  success: "success",
  softError: "error",
  comboIncrease: "combo",
  pbPace: "pbPace",
  runComplete: "runComplete",
  rankedPromotion: "rankedPromotion",
  dailyComplete: "dailyComplete",
};

function normalizedVolume(volume: number | undefined): number {
  if (volume === undefined || !Number.isFinite(volume)) {
    return 0;
  }

  const normalized = volume <= 1 ? volume : volume / 100;

  return Math.min(1, Math.max(0, normalized));
}

export function getSoundCue(
  event: SoundEvent,
  preferences: SoundPreferences,
): SoundCue | null {
  if (!preferences.enabled || preferences[PREFERENCE_FOR_EVENT[event]] === false) {
    return null;
  }

  return {
    kind: event,
    volume: normalizedVolume(preferences.volume),
    ...CUES[event],
  };
}

export function soundEventForFeedback(event: RunSoundFeedbackEvent): SoundEvent | null {
  switch (event) {
    case "taskAppear":
      return null;
    case "shortcut":
      return "movement";
    case "mistake":
      return "softError";
    case "success":
      return "success";
    case "combo":
      return "comboIncrease";
    case "pbPace":
      return "pbPace";
    case "runFinished":
      return "runComplete";
  }
}

let sharedContext: AudioContext | null = null;

/** Plays a short original synthesized cue. Returns false when Web Audio is unavailable. */
export function playSoundCue(cue: SoundCue | null): boolean {
  if (cue === null || cue.volume === 0 || typeof window === "undefined") {
    return false;
  }

  const AudioContextConstructor = window.AudioContext;

  if (AudioContextConstructor === undefined) {
    return false;
  }

  sharedContext ??= new AudioContextConstructor();

  if (sharedContext.state === "suspended") {
    void sharedContext.resume();
  }

  const noteSeconds = cue.durationMs / cue.frequencies.length / 1000;
  const startAt = sharedContext.currentTime;

  cue.frequencies.forEach((frequency, index) => {
    const noteStartsAt = startAt + index * noteSeconds;
    const noteEndsAt = noteStartsAt + noteSeconds;
    const oscillator = sharedContext!.createOscillator();
    const gain = sharedContext!.createGain();

    oscillator.type = cue.waveform;
    oscillator.frequency.setValueAtTime(frequency, noteStartsAt);
    gain.gain.setValueAtTime(0.0001, noteStartsAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(cue.volume * 0.08, 0.0001), noteStartsAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEndsAt);
    oscillator.connect(gain);
    gain.connect(sharedContext!.destination);
    oscillator.start(noteStartsAt);
    oscillator.stop(noteEndsAt);
  });

  return true;
}
