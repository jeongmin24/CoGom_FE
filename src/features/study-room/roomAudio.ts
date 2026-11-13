let context: AudioContext | null = null;
let enabled = true;
let woodNoise: AudioBuffer | null = null;
const activeGains = new Set<GainNode>();

export function setRoomSoundEnabled(value: boolean) {
  enabled = value;
  if (!value && context) {
    for (const gain of activeGains) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
    }
  }
}

export function unlockRoomAudio() {
  if (!enabled || typeof AudioContext === 'undefined') return;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => {});
}

function outputGain() {
  if (!enabled || !context || context.state !== 'running') return null;
  const gain = context.createGain();
  gain.connect(context.destination);
  activeGains.add(gain);
  return gain;
}

/** A short filtered impact with two damped resonances, like a shoe on timber. */
function woodImpact(when: number, pitch: number, volume: number, knock = false) {
  const gain = outputGain();
  if (!gain || !context) return;
  const audio = context;
  if (!woodNoise) {
    woodNoise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.12), audio.sampleRate);
    const samples = woodNoise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const start = audio.currentTime + when;
  const duration = knock ? 0.105 : 0.16;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  const noise = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = knock ? 1050 : 580;
  filter.Q.value = 0.85;
  noise.buffer = woodNoise;
  noise.connect(filter);
  filter.connect(gain);
  noise.start(start);
  noise.stop(start + 0.065);

  const resonances = [pitch, pitch * 2.13].map(frequency => {
    const oscillator = audio.createOscillator();
    const level = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.78, start + duration);
    level.gain.value = knock ? 0.55 : 0.42;
    oscillator.connect(level);
    level.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration);
    return { oscillator, level };
  });
  resonances[resonances.length - 1].oscillator.onended = () => {
    noise.disconnect();
    filter.disconnect();
    resonances.forEach(({ oscillator, level }) => { oscillator.disconnect(); level.disconnect(); });
    gain.disconnect();
    activeGains.delete(gain);
  };
}

export function playWoodStep(leftFoot: boolean) {
  woodImpact(0, (leftFoot ? 145 : 163) + Math.random() * 10, 0.19 + Math.random() * 0.025);
}

export function playKnockSound(elapsedSeconds = 0) {
  [0.18, 0.48, 0.78].forEach((impact, index) => {
    const delay = impact - Math.max(0, elapsedSeconds);
    if (delay >= 0) woodImpact(delay, 370 + index * 14, 0.15, true);
  });
}

export function playWakeSound() {
  if (!enabled || !context || context.state !== 'running') return;
  const audio = context;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const gain = outputGain();
    if (!gain) return;
    const oscillator = audio.createOscillator();
    const start = audio.currentTime + index * 0.14;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); activeGains.delete(gain); };
  });
}
