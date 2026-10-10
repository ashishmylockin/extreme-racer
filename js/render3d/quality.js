// Graphics quality: four presets (Low, Medium, High, Ultra), plus "Auto", which picks one from a quick benchmark on the first launch
// and drops a level whenever the frame rate stays low. Each setting can also be changed by hand in the Settings menu.

export const LEVELS = ["low", "medium", "high", "ultra"];

// The numbers behind each preset.
//   scale     render resolution (1 = the window's real pixels); shadows = shadow-map size (0 = off); msaa = multisampling samples
//   fxaa/smaa the anti-aliasing used;  bloom/grade = the post-processing passes;  flare/ca/dof = lens effects
//   particles = how many sparks / smoke puffs (0..1.5);  rain = how many raindrops;  dist = draw distance (0..1)
//   carLod = how far away the race cars keep their detail (1 = normal, smaller = cheaper models sooner)
//   ibl = lighting from the sky image (off = a cheap fixed ambient);  mirrorRes = cockpit mirror size;  reflect = planar road reflections
//   ao = ambient occlusion (GTAO) at this fraction of the screen's resolution (0 = off)
export const PRESETS = {
  low:    { scale: 0.75, shadows: 0,    msaa: 0, fxaa: true,  smaa: false, bloom: false, grade: false, flare: false, ca: false, dof: false, particles: 0.3, rain: 0.45, dist: 0.7, ibl: false, mirrorRes: 128, reflect: false, trails: false, cityAhead: 0.5, cityDensity: 0.5, carLod: 0.45, ao: 0 },
  medium: { scale: 1.0,  shadows: 1024, msaa: 0, fxaa: true,  smaa: false, bloom: true,  grade: true,  flare: false, ca: true,  dof: false, particles: 0.6, rain: 0.7,  dist: 0.85, ibl: true, mirrorRes: 192, reflect: false, trails: true, cityAhead: 0.75, cityDensity: 0.75, carLod: 0.8, ao: 0 },
  high:   { scale: 1.0,  shadows: 2048, msaa: 4, fxaa: false, smaa: false, bloom: true,  grade: true,  flare: true,  ca: true,  dof: true,  particles: 1.0, rain: 1.0,  dist: 1.0, ibl: true, mirrorRes: 256, reflect: false, trails: true, cityAhead: 1, cityDensity: 1, carLod: 1, ao: 0.5 },
  ultra:  { scale: 1.25, shadows: 4096, msaa: 4, fxaa: false, smaa: true,  bloom: true,  grade: true,  flare: true,  ca: true,  dof: true,  particles: 1.4, rain: 1.0,  dist: 1.0, ibl: true, mirrorRes: 512, reflect: true,  trails: true, cityAhead: 1, cityDensity: 1, carLod: 1.7, ao: 0.75 },
};

const SCALES = [0.5, 0.75, 1, 1.25, 1.5];
const SHADOWS = { off: 0, low: 1024, high: 2048, ultra: 4096 };
const EFFECTS = { low: 0.3, medium: 0.6, high: 1.0, max: 1.4 };
const DIST = { short: 0.7, medium: 0.85, long: 1.0 };

// Turn the saved settings + the Auto level into the numbers to use now.
export function resolve(settings, autoLevel) {
  const name = settings.gfx === "auto" || !PRESETS[settings.gfx] ? LEVELS[autoLevel] : settings.gfx;
  const q = { ...PRESETS[name], level: name };
  if (settings.renderScale) q.scale = settings.renderScale;
  if (settings.shadows && SHADOWS[settings.shadows] !== undefined) q.shadows = SHADOWS[settings.shadows];
  if (settings.effects && EFFECTS[settings.effects] !== undefined) { q.particles = EFFECTS[settings.effects]; q.rain = Math.min(1, 0.3 + EFFECTS[settings.effects] * 0.7); if (settings.effects === "low") { q.flare = false; q.ca = false; q.trails = false; } }
  if (settings.drawDist && DIST[settings.drawDist]) q.dist = DIST[settings.drawDist];
  return q;
}
export const gfxDefaults = name => { const p = PRESETS[name] || PRESETS.high; return { renderScale: p.scale, shadows: p.shadows === 0 ? "off" : p.shadows <= 1024 ? "low" : p.shadows <= 2048 ? "high" : "ultra", effects: p.particles <= 0.3 ? "low" : p.particles <= 0.6 ? "medium" : p.particles <= 1 ? "high" : "max", drawDist: p.dist <= 0.7 ? "short" : p.dist <= 0.85 ? "medium" : "long" }; };
export const OPTIONS = { SCALES, SHADOWS: Object.keys(SHADOWS), EFFECTS: Object.keys(EFFECTS), DIST: Object.keys(DIST) };

// ---- Auto: the first-launch benchmark and the "drop a level if it stays slow" watchdog ----
export function createAuto(store, isPhone) {
  let level = store.get("gfxLevel", isPhone ? 1 : -1); // -1 = not benchmarked yet
  const bench = { frames: 0, total: 0, done: level >= 0 };
  if (level < 0) level = 2; // benchmark at High
  let slowT = 0, hold = 0, avg = 16.7;
  return {
    get level() { return level; }, get benchmarking() { return !bench.done; },
    // call once per rendered frame with the frame time in ms; returns true when the level changed
    frame(ms, racing) {
      if (ms > 400) return false; // tab was hidden / a hitch: ignore
      if (!bench.done) {
        bench.frames++; if (bench.frames > 30) bench.total += ms; // let it warm up (shader compiles) first
        if (bench.frames >= 150) {
          const mean = bench.total / 120; bench.done = true;
          level = mean < 7.5 ? 3 : mean < 12.5 ? 2 : mean < 20 ? 1 : 0; store.set("gfxLevel", level); return true;
        }
        return false;
      }
      if (!racing) { slowT = 0; return false; }
      avg += (ms - avg) * 0.05;
      if (hold > 0) { hold -= ms; return false; }
      if (avg > 24) { slowT += ms; if (slowT > 3000 && level > 0) { level--; store.set("gfxLevel", level); slowT = 0; hold = 8000; avg = 16.7; return true; } } else slowT = 0;
      return false;
    },
  };
}
