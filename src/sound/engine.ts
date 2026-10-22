/**
 * Web Audio for the Atlas. The bed is "Monkeys Spinning Monkeys" by Kevin
 * MacLeod (CC BY 4.0, credited on About); every one-shot is built from
 * oscillators and a noise buffer. The context
 * exists only after a gesture made while sound is on, so the browser never
 * blocks or startles anyone.
 */
import type { Cue } from "./cues";

// −24 dBFS: 10^(−24 / 20).
const MASTER = 0.063;
// The Motion sheet's dive (1600 ms) and back out (1100 ms).
const DIVE = 1.6;
const BACK = 1.1;
const SONG = "/media/sound/monkeys-spinning-monkeys.mp3";
// The song plays well under the cues' master, quiet enough to talk over.
const SONG_LEVEL = 0.35;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let song: { element: HTMLAudioElement; gain: GainNode } | null = null;
let playing = false;
let pausing: number | undefined;

export function audioReady() {
  return context !== null;
}

/** Creates the context. Call only from a user gesture while sound is on. */
export function unlock() {
  if (!context) {
    const Context = window.AudioContext;
    if (!Context) return;
    context = new Context();
    master = context.createGain();
    master.gain.value = MASTER;
    master.connect(context.destination);
  }
  void context.resume().catch(() => {});
}

export function suspend() {
  if (context?.state === "running") void context.suspend().catch(() => {});
}

export function resume() {
  if (context && context.state !== "running")
    void context.resume().catch(() => {});
}

function noiseBuffer(audio: AudioContext) {
  if (noise) return noise;
  noise = audio.createBuffer(
    1,
    Math.ceil(audio.sampleRate * DIVE),
    audio.sampleRate,
  );
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/**
 * The song on a loop; fades in over 2 s and out over 1.2 s, or stops at once
 * when sound is turned off. It resumes where it paused.
 */
export function ambient(on: boolean, immediate = false) {
  if (!context) return;
  const now = context.currentTime;
  if (!on) {
    if (!song || !playing) return;
    const { element, gain } = song;
    const fade = immediate ? 0 : 1.2;
    playing = false;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(immediate ? 0 : gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    pausing = window.setTimeout(() => element.pause(), fade * 1000 + 50);
    return;
  }
  if (playing) return;
  if (!song) {
    const element = new Audio(SONG);
    element.loop = true;
    element.preload = "auto";
    const gain = context.createGain();
    context.createMediaElementSource(element).connect(gain);
    gain.connect(context.destination);
    song = { element, gain };
  }
  window.clearTimeout(pausing);
  playing = true;
  const { element, gain } = song;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(SONG_LEVEL, now + 2);
  void element.play().catch(() => {});
}

/** Filtered noise; the dive opens upward over 1.6 s, the way back closes over 1.1 s. */
function whoosh(direction: "dive" | "back") {
  if (!context || !master) return;
  const now = context.currentTime;
  const length = direction === "dive" ? DIVE : BACK;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.9;
  const [from, to] = direction === "dive" ? [320, 2200] : [2200, 320];
  filter.frequency.setValueAtTime(from, now);
  filter.frequency.exponentialRampToValueAtTime(to, now + length);
  const gain = context.createGain();
  // The dive swells late like the camera; the way back peaks early and trails off.
  const peak = direction === "dive" ? 0.65 : 0.3;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.7, now + length * peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  source.connect(filter).connect(gain).connect(master);
  source.start(now);
  source.stop(now + length + 0.05);
}

/** A small bell: a warm fundamental and a quiet fifth, decaying over 1.2 s. */
function chime() {
  if (!context || !master) return;
  const now = context.currentTime;
  [
    [659.25, 0.32],
    [987.77, 0.12],
  ].forEach(([frequency, level]) => {
    const tone = context!.createOscillator();
    tone.type = "sine";
    tone.frequency.value = frequency;
    const gain = context!.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    tone.connect(gain).connect(master!);
    tone.start(now);
    tone.stop(now + 1.25);
  });
}

/** A faint 40 ms tick for each year step. */
function tick() {
  if (!context || !master) return;
  const now = context.currentTime;
  const tone = context.createOscillator();
  tone.type = "triangle";
  tone.frequency.value = 1760;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  tone.connect(gain).connect(master);
  tone.start(now);
  tone.stop(now + 0.05);
}

export function play(cue: Cue) {
  if (cue === "dive" || cue === "back") whoosh(cue);
  else if (cue === "chime") chime();
  else tick();
}
