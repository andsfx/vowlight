// The synthesised sound bank: a ward ping, a kill pop, a hurt thud, a wave gong, a victory chord, a
// defeat fall and the quiet drone bed. WebAudio only, built on the first gesture, nothing from disk.

/** A bank with no context yet: the browser will not start audio until the player touches the page. */
export function createAudioBank() {
  return { context: null, master: null, noise: null, drone: null, muted: false, failed: false };
}

/** Build the context, the master gain and the shared noise buffer on the first key or click. */
export function unlockAudio(bank) {
  if (bank.context !== null || bank.failed) return;
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (typeof Ctor !== 'function') {
    bank.failed = true;
    return;
  }
  try {
    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = 0.42;
    master.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    bank.context = context;
    bank.master = master;
    bank.noise = noise;
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch {
    bank.failed = true;
  }
}

/** A single shaped tone, the building block every cue below is made of. */
function tone(bank, options) {
  const context = bank.context;
  if (context === null || bank.muted) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(options.frequency, now);
  if (options.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), now + options.duration);
  }
  const attack = options.attack ?? 0.004;
  const peak = options.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
  oscillator.connect(gain);
  gain.connect(bank.master);
  oscillator.start(now);
  oscillator.stop(now + options.duration + 0.02);
}

/** A band of noise through a filter, for the sharper cues. */
function noiseBurst(bank, options) {
  const context = bank.context;
  if (context === null || bank.noise === null || bank.muted) return;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = bank.noise;
  const filter = context.createBiquadFilter();
  filter.type = options.filterType ?? 'bandpass';
  filter.frequency.setValueAtTime(options.frequency, now);
  if (options.endFrequency !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, options.endFrequency), now + options.duration);
  }
  filter.Q.value = options.q ?? 3;
  const gain = context.createGain();
  gain.gain.setValueAtTime(options.gain ?? 0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(bank.master);
  source.start(now);
  source.stop(now + options.duration + 0.02);
}

/** A bolt returned: a short sine sweep up, the parry's signature. */
export function playWardPing(bank) {
  tone(bank, { frequency: 620, endFrequency: 1180, duration: 0.13, gain: 0.16, type: 'sine' });
  tone(bank, { frequency: 940, endFrequency: 1560, duration: 0.09, gain: 0.06, type: 'triangle', attack: 0.01 });
}

/** A husk breaking: a noise burst through a bandpass that falls away. */
export function playKillPop(bank) {
  noiseBurst(bank, { frequency: 1500, endFrequency: 320, duration: 0.18, gain: 0.3, q: 2.4 });
  tone(bank, { frequency: 210, endFrequency: 90, duration: 0.16, gain: 0.1, type: 'triangle' });
}

/** The flame taking a hit: a low square with a fast decay. */
export function playHurtThud(bank) {
  tone(bank, { frequency: 118, endFrequency: 44, duration: 0.26, gain: 0.34, type: 'square' });
  noiseBurst(bank, { frequency: 240, endFrequency: 120, duration: 0.16, gain: 0.14, filterType: 'lowpass', q: 1 });
}

/** A wave opening: two low sines, the second a fifth up, ringing long. */
export function playWaveGong(bank) {
  tone(bank, { frequency: 132, endFrequency: 96, duration: 1.1, gain: 0.2, attack: 0.02 });
  tone(bank, { frequency: 198, endFrequency: 148, duration: 1.3, gain: 0.12, attack: 0.03 });
}

/** The vow kept: three sines laid over each other with a slow attack. */
export function playVictoryChord(bank) {
  tone(bank, { frequency: 261.6, duration: 2.4, gain: 0.16, attack: 0.35, type: 'sine' });
  tone(bank, { frequency: 392.0, duration: 2.4, gain: 0.12, attack: 0.45, type: 'sine' });
  tone(bank, { frequency: 523.3, duration: 2.6, gain: 0.1, attack: 0.55, type: 'sine' });
}

/** The flame going out: a long fall from a low sine to the floor of hearing. */
export function playDefeatFall(bank) {
  tone(bank, { frequency: 220, endFrequency: 42, duration: 1.8, gain: 0.22, attack: 0.02, type: 'sine' });
  tone(bank, { frequency: 146, endFrequency: 30, duration: 2.1, gain: 0.14, attack: 0.04, type: 'triangle' });
}

/** The drone bed: two detuned low oscillators behind a slow lowpass, held for the whole run. */
export function startDrone(bank) {
  const context = bank.context;
  if (context === null || bank.drone !== null || bank.muted) return;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 1.4);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 340;
  const voices = [55, 82.4].map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.detune.value = frequency === 55 ? -6 : 5;
    oscillator.connect(filter);
    oscillator.start();
    return oscillator;
  });
  filter.connect(gain);
  gain.connect(bank.master);
  bank.drone = { voices, gain, filter };
}

/** Fade the drone out and stop it. */
export function stopDrone(bank) {
  const drone = bank.drone;
  if (drone === null || bank.context === null) return;
  bank.drone = null;
  const now = bank.context.currentTime;
  drone.gain.gain.cancelScheduledValues(now);
  drone.gain.gain.setValueAtTime(drone.gain.gain.value, now);
  drone.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  for (const voice of drone.voices) voice.stop(now + 0.6);
}

/** Mute or unmute everything; returns the new muted state. */
export function toggleMute(bank) {
  bank.muted = !bank.muted;
  if (bank.master !== null) bank.master.gain.value = bank.muted ? 0 : 0.42;
  if (bank.muted) stopDrone(bank);
  return bank.muted;
}
