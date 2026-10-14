/**
 * Procedural Web Audio for the Atlas. No files, no network: every sound is built
 * from oscillators and a noise buffer. The context exists only after a gesture
 * made while sound is on, so the browser never blocks or startles anyone.
 */
import type { Cue } from "./cues";

// −24 dBFS: 10^(−24 / 20).
const MASTER = 0.063;
// The Motion sheet's dive (1600 ms) and back out (1100 ms).
const DIVE = 1.6;
const BACK = 1.1;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let bed: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null;

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
 * Two detuned pads under a slow low-pass sweep; fades in over 2 s and out over
 * 1.2 s, or stops at once when sound is turned off.
 */
export function ambient(on: boolean, immediate = false) {
  if (!context || !master) return;
  const now = context.currentTime;
  if (!on) {
    if (!bed) return;
    const { gain, sources } = bed;
    const fade = immediate ? 0 : 1.2;
    bed = null;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(immediate ? 0 : gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    sources.forEach((source) => source.stop(now + fade + 0.05));
    return;
  }
  if (bed) return;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 2);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  filter.Q.value = 0.7;
  // One sweep every 20 s, between roughly 300 and 740 Hz.
  const sweep = context.createOscillator();
  sweep.frequency.value = 0.05;
  const depth = context.createGain();
  depth.gain.value = 220;
  sweep.connect(depth).connect(filter.frequency);
  const pads = (
    [
      ["sine", 110, -7],
      ["triangle", 164.81, 6],
    ] as const
  ).map(([type, frequency, detune]) => {
    const pad = context!.createOscillator();
    pad.type = type;
    pad.frequency.value = frequency;
    pad.detune.value = detune;
    const level = context!.createGain();
    level.gain.value = type === "sine" ? 0.55 : 0.3;
    pad.connect(level).connect(filter);
    return pad;
  });
  filter.connect(gain).connect(master);
  const sources = [sweep, ...pads];
  sources.forEach((source) => source.start(now));
  bed = { gain, sources };
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
