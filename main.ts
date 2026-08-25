// Constellation --- a ten-note pentatonic instrument. Each pad is a unison-
// detuned pair of oscillators through a lowpass filter, sent to a shared
// echo and shimmer-reverb bus, plus a slow ambient drone that retunes toward
// whatever was last played. Audio only ever starts from a real user gesture
// (pointerdown / keydown), never on load --- the browser would suspend it
// anyway, but the point is the same either way: silence until you touch it.

interface Note {
  readonly name: string;
  readonly freq: number;
}

const NOTES: readonly Note[] = [
  { name: "C4", freq: 261.63 },
  { name: "D4", freq: 293.66 },
  { name: "E4", freq: 329.63 },
  { name: "G4", freq: 392.0 },
  { name: "A4", freq: 440.0 },
  { name: "C5", freq: 523.25 },
  { name: "D5", freq: 587.33 },
  { name: "E5", freq: 659.25 },
  { name: "G5", freq: 783.99 },
  { name: "A5", freq: 880.0 },
];

const KEY_MAP: Partial<Record<string, number>> = {
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  g: 4,
  h: 5,
  j: 6,
  k: 7,
  l: 8,
  ";": 9,
};

const pads = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="pad"]')];
const surface = document.querySelector<HTMLElement>('[data-testid="surface"]');

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- Audio graph -----------------------------------------------------------

interface Bus {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly delaySend: GainNode;
  readonly reverbSend: GainNode;
}

let bus: Bus | null = null;

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return impulse;
}

function ensureAudio(): Bus {
  if (bus) return bus;

  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  // Shimmer: an algorithmic impulse response, so there's no audio file to ship.
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, 2.4, 2.8);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0.32;
  convolver.connect(reverbWet);
  reverbWet.connect(master);
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.5;
  reverbSend.connect(convolver);

  // Echo: a feedback delay, mixed low so it trails rather than repeats loudly.
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.27;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0.26;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(master);
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0.55;
  delaySend.connect(delay);

  bus = { ctx, master, delaySend, reverbSend };
  startDrone(bus);
  return bus;
}

// --- The drone: a slow chord that drifts toward the last note you played.
// It only sounds while at least one note is held --- it fades in with the
// first held note and fades all the way to silence a couple of seconds after
// the last one releases, so letting go of everything actually goes quiet. ---

let droneOscillators: OscillatorNode[] = [];
let droneGain: GainNode | null = null;
const DRONE_RATIOS = [1, 1.5, 2] as const;
const DRONE_LEVEL = 0.1;

function startDrone(activeBus: Bus): void {
  const { ctx, master, reverbSend } = activeBus;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  droneGain = gain;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 900;
  gain.connect(droneFilter);
  droneFilter.connect(master);
  droneFilter.connect(reverbSend);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 240;
  lfo.connect(lfoGain);
  lfoGain.connect(droneFilter.frequency);
  lfo.start();

  const base = NOTES[0].freq / 2;
  droneOscillators = DRONE_RATIOS.map((ratio) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    osc.connect(gain);
    osc.start();
    return osc;
  });
}

let activeVoices = 0;

function noteOn(): void {
  activeVoices++;
  if (activeVoices > 1 || !bus || !droneGain) return;
  const { ctx } = bus;
  const now = ctx.currentTime;
  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.setValueAtTime(droneGain.gain.value, now);
  droneGain.gain.linearRampToValueAtTime(DRONE_LEVEL, now + 2);
}

function noteOff(): void {
  activeVoices = Math.max(0, activeVoices - 1);
  if (activeVoices > 0 || !bus || !droneGain) return;
  const { ctx } = bus;
  const now = ctx.currentTime;
  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.setValueAtTime(droneGain.gain.value, now);
  droneGain.gain.linearRampToValueAtTime(0, now + 1.5);
}

function updateDrone(note: Note): void {
  if (!bus) return;
  const { ctx } = bus;
  const base = note.freq / 2;
  const now = ctx.currentTime;
  droneOscillators.forEach((osc, i) => {
    const target = base * DRONE_RATIOS[i];
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setValueAtTime(osc.frequency.value, now);
    osc.frequency.linearRampToValueAtTime(target, now + 1.6);
  });
}

// --- A single struck note ---------------------------------------------------
// Note-on/note-off, like a synth key: the note rings while held (up to its own
// decay ceiling) and releasing fades it out quickly instead of letting it ring
// on indefinitely.

interface Voice {
  release(): void;
}

function trigger(padIndex: number, clientY: number): Voice {
  const activeBus = ensureAudio();
  const { ctx, master, delaySend, reverbSend } = activeBus;
  const note = NOTES[padIndex];
  const now = ctx.currentTime;

  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = "sawtooth";
  oscB.type = "sawtooth";
  oscA.frequency.value = note.freq;
  oscB.frequency.value = note.freq;
  oscA.detune.value = -7;
  oscB.detune.value = 7;

  // Where on the pad you pressed sets brightness --- top is brighter, bottom
  // is darker, so the same note never sounds quite the same way twice.
  const rect = pads[padIndex].getBoundingClientRect();
  const heightFraction = rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0.5;
  const brightness = 1 - heightFraction;
  const baseCutoff = 500 + brightness * 3800;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(baseCutoff * 2.1, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(baseCutoff, 90), now + 0.35);

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0, now);
  voiceGain.gain.linearRampToValueAtTime(0.5, now + 0.012);
  voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(voiceGain);
  voiceGain.connect(master);
  voiceGain.connect(delaySend);
  voiceGain.connect(reverbSend);

  oscA.start(now);
  oscB.start(now);
  const naturalStop = now + 2.7;
  oscA.stop(naturalStop);
  oscB.stop(naturalStop);

  updateDrone(note);
  noteOn();

  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      const releaseTime = ctx.currentTime;
      const releaseLength = 0.12;
      voiceGain.gain.cancelScheduledValues(releaseTime);
      voiceGain.gain.setValueAtTime(voiceGain.gain.value, releaseTime);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, releaseTime + releaseLength);
      oscA.stop(releaseTime + releaseLength + 0.02);
      oscB.stop(releaseTime + releaseLength + 0.02);
      noteOff();
    },
  };
}

// --- Input: pointer (mouse & touch), hit-tested against pad rects so a drag
// glissandos across pads even though touch implicitly captures to whichever
// pad first received it. Keyboard is handled separately below. Lifting off a
// pad (or sliding onto a new one) releases that pad's note. ---

function padIndexAt(x: number, y: number): number {
  for (let i = 0; i < pads.length; i++) {
    const rect = pads[i].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i;
  }
  return -1;
}

const heldPointers = new Set<number>();
const activePointerPads = new Map<number, { index: number; voice: Voice }>();

function markInvited(): void {
  document.body.classList.add("played");
}

function onPointerActive(pointerId: number, x: number, y: number): void {
  const current = activePointerPads.get(pointerId);
  const idx = padIndexAt(x, y);

  if (current?.index === idx) return;

  if (current) {
    current.voice.release();
    pads[current.index].classList.remove("active");
  }

  if (idx !== -1) {
    markInvited();
    const voice = trigger(idx, y);
    pads[idx].classList.add("active");
    activePointerPads.set(pointerId, { index: idx, voice });
  } else {
    activePointerPads.delete(pointerId);
  }
}

function releasePointer(pointerId: number): void {
  heldPointers.delete(pointerId);
  const current = activePointerPads.get(pointerId);
  if (current) {
    current.voice.release();
    pads[current.index].classList.remove("active");
  }
  activePointerPads.delete(pointerId);
}

if (surface) {
  surface.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    heldPointers.add(event.pointerId);
    onPointerActive(event.pointerId, event.clientX, event.clientY);
  });
}

window.addEventListener("pointermove", (event) => {
  if (heldPointers.has(event.pointerId)) {
    onPointerActive(event.pointerId, event.clientX, event.clientY);
  }
});
window.addEventListener("pointerup", (event) => releasePointer(event.pointerId));
window.addEventListener("pointercancel", (event) => releasePointer(event.pointerId));

// --- Input: keyboard ---------------------------------------------------------

const heldKeys = new Map<string, Voice>();

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  const idx = KEY_MAP[key];
  if (idx === undefined || heldKeys.has(key)) return;

  markInvited();
  const rect = pads[idx].getBoundingClientRect();
  const voice = trigger(idx, rect.top + rect.height * 0.3);
  heldKeys.set(key, voice);
  pads[idx].classList.add("active");
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  const voice = heldKeys.get(key);
  if (!voice) return;
  heldKeys.delete(key);
  voice.release();
  const idx = KEY_MAP[key];
  if (idx !== undefined) pads[idx].classList.remove("active");
});
