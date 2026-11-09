// Little sound effects made in the browser, no audio files. Muting is remembered.

export type Sfx = "chop" | "mine" | "pick" | "splash" | "catch" | "coin" | "build" | "level" | "step" | "nope" | "pet";

const KEY = "mochi_muted";
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
} catch {}

export const isMuted = () => muted;
export function setMuted(on: boolean) {
  muted = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

// Browsers only allow sound after the player has touched the page
function audio() {
  if (muted || typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(a: AudioContext, freq: number, at: number, len: number, type: OscillatorType = "sine", vol = 0.12, slide = 0) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + at);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + at + len);
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + len);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + len + 0.02);
}

function noise(a: AudioContext, len: number, freq: number, vol = 0.18) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = "lowpass";
  f.frequency.value = freq;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export function play(s: Sfx) {
  const a = audio();
  if (!a) return;
  switch (s) {
    case "chop":
      noise(a, 0.12, 900, 0.25);
      tone(a, 180, 0, 0.08, "square", 0.05, -60);
      break;
    case "mine":
      noise(a, 0.1, 2500, 0.18);
      tone(a, 520, 0, 0.09, "triangle", 0.08, -200);
      break;
    case "pick":
      tone(a, 660, 0, 0.08, "sine", 0.1, 220);
      break;
    case "splash":
      noise(a, 0.35, 700, 0.2);
      break;
    case "catch":
      noise(a, 0.25, 900, 0.15);
      tone(a, 523, 0.05, 0.1, "triangle", 0.1);
      tone(a, 784, 0.14, 0.14, "triangle", 0.1);
      break;
    case "coin":
      tone(a, 988, 0, 0.07, "square", 0.05);
      tone(a, 1319, 0.07, 0.16, "square", 0.05);
      break;
    case "build":
      [392, 494, 587, 784].forEach((f, i) => tone(a, f, i * 0.09, 0.2, "triangle", 0.1));
      break;
    case "level":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.1, 0.25, "triangle", 0.12));
      break;
    case "step":
      noise(a, 0.04, 400, 0.04);
      break;
    case "nope":
      tone(a, 220, 0, 0.15, "sawtooth", 0.04, -60);
      break;
    case "pet":
      tone(a, 880, 0, 0.1, "sine", 0.08, 300);
      tone(a, 1175, 0.1, 0.12, "sine", 0.06);
      break;
  }
}
