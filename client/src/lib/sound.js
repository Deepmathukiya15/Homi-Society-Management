/** Tiny WebAudio alert tones — no external audio assets, works fully offline. */
let ctx = null;

const tone = (freq, duration, { type = 'sine', gain = 0.05, delay = 0 } = {}) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = ctx || new AudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.value = gain;
    osc.connect(vol).connect(ctx.destination);
    const start = ctx.currentTime + delay;
    osc.start(start);
    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.stop(start + duration);
  } catch {
    /* audio is a nicety — never break the UI */
  }
};

export const playApproved = () => {
  tone(880, 0.16, { gain: 0.05 });
  tone(1320, 0.22, { gain: 0.045, delay: 0.13 });
};

export const playDenied = () => {
  tone(320, 0.22, { type: 'square', gain: 0.035 });
  tone(200, 0.3, { type: 'square', gain: 0.03, delay: 0.16 });
};

export const playScan = () => tone(1400, 0.12, { type: 'triangle', gain: 0.04 });

export const playSiren = () => {
  tone(760, 0.32, { type: 'sawtooth', gain: 0.05 });
  tone(560, 0.32, { type: 'sawtooth', gain: 0.05, delay: 0.3 });
  tone(760, 0.32, { type: 'sawtooth', gain: 0.05, delay: 0.6 });
};

export const playChime = () => {
  tone(660, 0.14, { gain: 0.035 });
  tone(990, 0.18, { gain: 0.03, delay: 0.1 });
};
