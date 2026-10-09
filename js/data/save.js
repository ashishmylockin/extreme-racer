// ---------- saved progress ----------

const store = {
  get(k, d) { try { const v = localStorage.getItem("cardodge." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("cardodge." + k, JSON.stringify(v)); } catch (e) {} },
};

let best = store.get("best", 0);
let wallet = store.get("coins", 0);
let owned = store.get("teams", [0, 1]);
let equipped = store.get("team", 0);
if (!owned.includes(equipped)) equipped = 0;
let cam = store.get("camera", 0);
if (!(cam >= 0 && cam < CAMS.length)) cam = 0;

// ---------- settings: volumes (1 = the original mix), screen shake, reduced effects for slow machines ----------
let settings = Object.assign({ music: 1, fx: 1, engine: 1, shake: true, lowfx: false, gfx: "auto", renderScale: 0, shadows: "", effects: "", drawDist: "", fps: false }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
function applyVolumes() {
  if (sound.fxBus) { sound.fxBus.gain.value = settings.fx; sound.engBus.gain.value = settings.engine; }
  if (music.bus) music.bus.gain.setTargetAtTime(0.5 * settings.music, sound.ac.currentTime, 0.05);
  if (music.audio) music.audio.volume = 0.6 * settings.music;
}
const maxParticles = () => settings.lowfx ? 90 : 320;
// game feel: crash flash and freeze, finish confetti (screen space)
let flashT = 0, hitStop = 0, confetti = [];
const FLAG_COLS = { au: ["#012169", "#ffffff", "#e4002b"], cn: ["#de2910", "#ffde00"], jp: ["#ffffff", "#bc002d"], us: ["#b22234", "#ffffff", "#3c3b6e"], ca: ["#d52b1e", "#ffffff"],
  mc: ["#ce1126", "#ffffff"], es: ["#aa151b", "#f1bf00"], at: ["#ed2939", "#ffffff"], gb: ["#012169", "#ffffff", "#c8102e"], be: ["#1a1a1a", "#fdda24", "#ef3340"],
  hu: ["#ce2939", "#ffffff", "#477050"], nl: ["#ae1c28", "#ffffff", "#21468b"], it: ["#009246", "#ffffff", "#ce2b37"], az: ["#0092bc", "#e4002b", "#00af66"],
  sg: ["#ef3340", "#ffffff"], mx: ["#006847", "#ffffff", "#ce1126"], br: ["#009c3b", "#ffdf00", "#002776"], qa: ["#8a1538", "#ffffff"], ae: ["#00732f", "#ffffff", "#1a1a1a", "#ff0000"] };
function throwConfetti(flag) { // a shower in the city's flag colours
  const cols = FLAG_COLS[flag] || ["#ffd23f", "#ffffff"];
  for (let i = 0, n = settings.lowfx ? 50 : 140; i < n; i++) confetti.push({ x: rnd(0, W), y: rnd(-H * 0.6, -10), vx: rnd(-0.6, 0.6), vy: rnd(1, 2.6), rot: rnd(0, TAU), vr: rnd(-0.15, 0.15), w: rnd(4, 8), h: rnd(6, 11), ph: rnd(0, TAU), c: pick(cols) });
}
function rumbleSoft() { try { for (const g of navigator.getGamepads()) if (g && g.vibrationActuator) g.vibrationActuator.playEffect("dual-rumble", { duration: 110, strongMagnitude: 0.2, weakMagnitude: 0.5 }); } catch (e) {} }

