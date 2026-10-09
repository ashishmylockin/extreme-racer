// ---------- sound (synthesised, no assets) ----------

const sound = {
  on: store.get("sound", true), ac: null, out: null, eng: null, env: null, nit: null, noiseBuf: null,
  ensure() {
    if (!this.ac) {
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.out = this.ac.createGain();
        this.out.gain.value = 0.22; // master level for effects: kept low
        this.out.connect(this.ac.destination);
        this.fxBus = this.ac.createGain(); this.fxBus.gain.value = settings.fx; this.fxBus.connect(this.out); // effects volume
        this.engBus = this.ac.createGain(); this.engBus.gain.value = settings.engine; this.engBus.connect(this.out); // engine volume
      } catch (e) { this.ac = null; }
    }
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
    return this.ac;
  },
  noiseBuffer() {
    if (!this.noiseBuf) {
      const ac = this.ac, len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  },
  tone(f1, f2, dur, type = "square", vol = 0.06, delay = 0) {
    if (!this.on || !this.ensure()) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.fxBus);
    o.start(t); o.stop(t + dur);
  },
  // filtered noise burst whose filter sweeps from f0 to f1: the building block for clicks, whooshes and pops
  burst(dur, vol, type, f0, f1, delay = 0) {
    if (!this.on || !this.ensure()) return;
    const t = this.ac.currentTime + delay, src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = this.noiseBuffer(); f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.fxBus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  },
  // paddle-shift: a crisp click and a blow-off "pssh" on the way up, a throttle blip and burble on the way down
  shift(up) {
    if (up) {
      this.burst(0.05, 0.6, "highpass", 3000, 3000);
      this.tone(210, 90, 0.07, "square", 0.05);
      this.burst(0.2, 0.32, "bandpass", 4200, 1400, 0.03);
    } else {
      this.tone(150, 340, 0.1, "sawtooth", 0.05);
      this.burst(0.05, 0.55, "highpass", 2600, 2600);
      for (let i = 0; i < 3; i++) this.burst(0.05, 0.5, "lowpass", 900, 250, 0.07 + i * 0.055);
    }
  },
  coin() { this.tone(900, 1500, 0.09, "square", 0.04); },
  jingle(i) { // a short rising motif, pitched a little differently for each country
    const base = [523, 587, 659, 698, 784][i % 5];
    [1, 1.25, 1.5, 2].forEach((m, k) => this.tone(base * m, base * m, 0.28, "triangle", 0.05, k * 0.11));
  },
  // engine: detuned saw + square plus a turbine whine; pitch climbs through each gear then drops on the shift
  engineTick(active, v, boost = false) {
    if (active && this.on && this.ac && this.ac.state === "running") {
      if (!this.eng) {
        const a = this.ac.createOscillator(), b = this.ac.createOscillator(), c = this.ac.createOscillator();
        const g = this.ac.createGain(), gc = this.ac.createGain(), f = this.ac.createBiquadFilter();
        a.type = "sawtooth"; b.type = "square"; c.type = "triangle"; f.type = "lowpass"; g.gain.value = 0.05; gc.gain.value = 0.25;
        a.connect(f); b.connect(f); c.connect(gc); gc.connect(f); f.connect(g); g.connect(this.engBus);
        a.start(); b.start(); c.start();
        this.eng = { a, b, c, f, g };
      }
      const gear = gearOf(v), hz = (92 + gear * 12 + rpmOf(v) * 150) * (boost ? 1.32 : 1), t = this.ac.currentTime;
      this.eng.a.frequency.setTargetAtTime(hz, t, 0.03);
      this.eng.b.frequency.setTargetAtTime(hz * 2.01, t, 0.03);
      this.eng.c.frequency.setTargetAtTime(hz * 4, t, boost ? 0.02 : 0.03);
      this.eng.f.frequency.setTargetAtTime(600 + rpmOf(v) * 1500 + gear * 120 + (boost ? 1600 : 0), t, 0.05);
      this.eng.g.gain.setTargetAtTime(boost ? 0.08 : 0.05, t, 0.1);
      this.nitroLayer(boost);
    } else {
      if (this.eng) this.silenceEngine();
      this.nitroLayer(false);
    }
  },
  // the roaring flame hiss that sits on top of the engine while nitro burns
  nitroLayer(on) {
    if (!this.ac || (!this.nit && !on)) return;
    if (!this.nit) {
      const ac = this.ac, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = this.noiseBuffer(); src.loop = true; f.type = "bandpass"; f.frequency.value = 1600; f.Q.value = 0.6; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.engBus); src.start();
      this.nit = { g, f };
    }
    const t = this.ac.currentTime;
    this.nit.g.gain.setTargetAtTime(on && this.on ? 0.5 : 0, t, on ? 0.05 : 0.12);
    if (on) this.nit.f.frequency.setTargetAtTime(1500 + Math.random() * 1400, t, 0.05);
  },
  nitroStart() { // whoosh, blow-off and a rising turbine scream
    this.burst(0.5, 0.7, "bandpass", 500, 6000);
    this.burst(0.18, 0.5, "highpass", 3500, 3500);
    this.tone(160, 1100, 0.6, "sawtooth", 0.07);
    this.tone(320, 1500, 0.5, "square", 0.03, 0.05);
  },
  nitroEnd() { // the flutter as it cuts out
    this.tone(900, 120, 0.35, "sawtooth", 0.05);
    for (let i = 0; i < 4; i++) this.burst(0.06, 0.45, "lowpass", 1200, 250, 0.05 + i * 0.07);
    this.burst(0.3, 0.3, "bandpass", 3500, 800, 0.1);
  },
  silenceEngine() {
    if (!this.eng) return;
    try { this.eng.g.gain.value = 0; this.eng.a.stop(); this.eng.b.stop(); this.eng.c.stop(); } catch (e) {}
    this.eng = null;
  },
  // everything cut dead the instant you crash
  silence() {
    this.silenceEngine();
    if (this.nit) this.nit.g.gain.value = 0;
    if (this.env) { this.env.rain.gain.cancelScheduledValues(0); this.env.wind.gain.cancelScheduledValues(0); this.env.rain.gain.value = 0; this.env.wind.gain.value = 0; }
  },
  whoosh() { this.burst(0.28, 0.22, "bandpass", 450, 2800); this.tone(300, 900, 0.18, "sine", 0.03); }, // a near miss rushing past
  thud() { this.burst(0.22, 0.5, "lowpass", 700, 120); this.tone(90, 35, 0.2, "sine", 0.18); },
  // ambience: rain hiss, wind and birdsong follow the weather
  envTick(active, rain, wind, birds) {
    if (!this.ac || this.ac.state !== "running") return;
    if (!this.env) {
      const ac = this.ac, buf = this.noiseBuffer();
      const mk = (type, freq, q) => {
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = buf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(this.fxBus); s.start();
        return g;
      };
      this.env = { rain: mk("highpass", 2200, 0.7), wind: mk("bandpass", 420, 0.9) };
    }
    const on = this.on && active, t = this.ac.currentTime;
    this.env.rain.gain.setTargetAtTime(on ? rain * 0.05 : 0, t, 0.4);
    this.env.wind.gain.setTargetAtTime(on ? wind * 0.07 : 0, t, 0.4);
    if (on && birds > 0.05 && Math.random() < 0.012 * birds) {
      const f = rnd(2600, 3500);
      this.tone(f, f * 1.25, 0.07, "sine", 0.025);
      this.tone(f * 1.1, f * 1.4, 0.07, "sine", 0.025, 0.1);
    }
  },
  toggle() { this.on = !this.on; store.set("sound", this.on); if (this.on) this.tone(500, 800, 0.1); },
};

