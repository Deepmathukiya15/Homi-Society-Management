/** Tiny WebAudio alert tones — no external audio assets, works fully offline. */
let ctx = null;

/**
 * Browsers create an AudioContext in the "suspended" state until the user has
 * interacted with the page. The old code cached the first context forever — so
 * if the very first tone attempt happened before a click/tap (e.g. a socket
 * event landing on a freshly loaded tab), every later chime/siren stayed
 * silent. We now resume the context on each play AND unlock it on the first
 * user gesture.
 */
const unlockEvents = ['pointerdown', 'touchstart', 'click', 'keydown'];

const unlockAudio = () => {
  ctx?.resume?.()?.catch(() => {});
};

const ensureCtx = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      unlockEvents.forEach((evt) =>
        window.addEventListener(evt, unlockAudio, { once: true, passive: true })
      );
    }
    if (ctx.state === 'suspended') ctx.resume()?.catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

const tone = (freq, duration, { type = 'sine', gain = 0.05, delay = 0 } = {}) => {
  try {
    const ac = ensureCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const vol = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.value = gain;
    osc.connect(vol).connect(ac.destination);
    const start = ac.currentTime + delay;
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
