// Velvet Vault — every sound is synthesized live with WebAudio. No audio files ship with
// the game: footsteps, coin clinks, pickup chimes, the guard's alert sting, the alarm
// siren and a low ambient pulse are all oscillators and filtered noise, made here.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambientNodes = null;
  let sirenNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gainValue, slideTo) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainValue, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, gainValue, filterFreq) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  function startAmbient() {
    const c = ensure();
    if (!c || ambientNodes) return;
    const g = c.createGain();
    g.gain.value = 0.05;
    g.connect(master);
    const oscA = c.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    const oscB = c.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 82.4;
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    oscA.connect(g);
    oscB.connect(g);
    oscA.start();
    oscB.start();
    lfo.start();
    ambientNodes = { oscA, oscB, lfo, g };
  }

  function setSiren(on) {
    const c = ensure();
    if (!c) return;
    if (on && !sirenNodes) {
      const g = c.createGain();
      g.gain.value = 0.045;
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 620;
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, g };
    } else if (!on && sirenNodes) {
      try {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
      } catch { /* already stopped */ }
      sirenNodes.g.disconnect();
      sirenNodes = null;
    }
  }

  return {
    unlock() {
      ensure();
      startAmbient();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setSiren,
    footstep(sneak) {
      noiseBurst(0.05, sneak ? 0.03 : 0.07, sneak ? 500 : 900);
    },
    coin() {
      tone(1900, 0.09, 'sine', 0.12);
      setTimeout(() => tone(2400, 0.12, 'sine', 0.1), 70);
    },
    coinLand() {
      noiseBurst(0.08, 0.12, 2600);
      tone(1250, 0.1, 'triangle', 0.08);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.14);
      setTimeout(() => tone(880, 0.1, 'sine', 0.14), 80);
      setTimeout(() => tone(1320, 0.16, 'sine', 0.12), 160);
    },
    target() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.15), i * 90));
    },
    suspicious() {
      tone(330, 0.14, 'square', 0.05, 260);
    },
    alert() {
      tone(220, 0.3, 'sawtooth', 0.12, 440);
      setTimeout(() => tone(440, 0.3, 'sawtooth', 0.1, 660), 140);
    },
    emp() {
      tone(1200, 0.25, 'sine', 0.1, 120);
      noiseBurst(0.2, 0.06, 1800);
    },
    caught() {
      [392, 311, 233, 175].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.12), i * 130));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.14), i * 110));
    },
    levelDone() {
      [659, 784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.13), i * 100));
    },
  };
}
