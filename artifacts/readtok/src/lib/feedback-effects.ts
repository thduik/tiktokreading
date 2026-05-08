export interface FeedbackPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export const defaultFeedbackPreferences: FeedbackPreferences = {
  soundEnabled: false,
  hapticsEnabled: false,
};

let sharedAudioContext: AudioContext | null = null;

export function sanitizeFeedbackPreferences(
  value: unknown,
): FeedbackPreferences {
  if (!value || typeof value !== "object") {
    return defaultFeedbackPreferences;
  }

  const candidate = value as Partial<FeedbackPreferences>;
  return {
    soundEnabled: candidate.soundEnabled === true,
    hapticsEnabled: candidate.hapticsEnabled === true,
  };
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }

  return sharedAudioContext;
}

function playTone(frequency: number, durationMs: number, volume: number) {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => undefined);
  }

  const startTime = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + durationMs / 1000,
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + durationMs / 1000 + 0.02);
}

export function playAnswerFeedback(
  isCorrect: boolean,
  preferences: FeedbackPreferences,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (preferences.soundEnabled) {
      if (isCorrect) {
        playTone(660, 85, 0.028);
      } else {
        playTone(220, 105, 0.03);
      }
    }

    if (
      preferences.hapticsEnabled &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(isCorrect ? [14] : [22]);
    }
  } catch (error) {
    console.warn("Could not play answer feedback", error);
  }
}
