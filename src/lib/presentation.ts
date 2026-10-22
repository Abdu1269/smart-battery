let audioContext: AudioContext | null = null;

export function applyThemeClass(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0f1915" : "#f6f4ed");
  }
}

export function playAlertChime(volume: number) {
  if (typeof window === "undefined" || volume <= 0) {
    return;
  }
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, (volume / 100) * 0.16),
      now + 0.04,
    );
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    master.connect(audioContext.destination);

    const notes = [
      { frequency: 587.33, start: 0, duration: 0.3 },
      { frequency: 783.99, start: 0.19, duration: 0.45 },
    ];
    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.85, now + note.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.05);
    }
  } catch (error) {
    console.warn("alert chime could not play", error);
  }
}
