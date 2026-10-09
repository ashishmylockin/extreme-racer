// Starts the 3D renderer if this browser can do WebGL 2; otherwise (or on any error, or if loading stalls) the 2D renderer keeps running.
// Add ?2d to the address to force the old 2D renderer, handy for comparing.
import * as THREE from "three";
import { loadAssets } from "./assets.js";
import { createRenderer3D } from "./renderer.js";

const TIPS = ["Near misses build a combo: the bigger the combo, the bigger the points.", "Nitro canisters boost you the moment you drive through them.", "Rain makes lane changes slower: plan your line early.",
  "Shields absorb one crash. Grab them!", "Hold the gas while the lights count down: more revs means a faster launch.", "Night cities: only tail lights show on far cars. Watch the glow.",
  "Press P while paused for photo mode.", "Grand Final: first car over the line wins."];
const overlay = document.getElementById("loading"), fill = document.getElementById("loadfill");
const progress = (p, from, span) => { window.R3D_BOOT = Date.now(); if (fill) fill.style.width = Math.round(from + p * span) + "%"; }; // (also tells the watchdog in index.html we're alive)
progress(0, 0, 0);
if (overlay) document.getElementById("loadtip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
const hideLoading = () => { window.R3D_PENDING = false; if (overlay) { overlay.classList.add("done"); setTimeout(() => overlay.remove(), 600); } try { grabFocus(); } catch (e) {} };

function webgl2OK() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
}

if (new URLSearchParams(location.search).has("2d")) { console.log("2D renderer forced by ?2d"); hideLoading(); }
else if (!webgl2OK()) { console.warn("No WebGL 2 here: using the 2D renderer"); hideLoading(); }
else {
  try {
    const res = await loadAssets(p => progress(p, 0, 70));   // the loading bar: models are 70% of the work, skies 30%
    if (!res.loaded) throw new Error("no models could be loaded");
    const gl = document.getElementById("gl");
    const r = createRenderer3D(canvas, gl);
    const skies = await r.init(p => progress(p, 70, 30));
    if (!window.R3D_PENDING) throw new Error("took too long, the 2D renderer is already running"); // the watchdog gave up while we were loading
    gl.addEventListener("webglcontextlost", e => { e.preventDefault(); disable3D("WebGL context lost"); });
    gl.style.display = "block"; canvas.classList.add("over3d"); // the 2D canvas becomes see-through: it only draws menus and HUD now
    window.R3D = r;
    r.tick();
    if (new URLSearchParams(location.search).has("photo")) { state = "paused"; r.render(1); r.photo.enter(r.camera); r.photo.dof = true; r.photo.pos.y += 1.5; r.photo.pitch -= 0.1; r.photo.filter = +new URLSearchParams(location.search).get("photo") || 0; } // testing shortcut
    console.log(`3D renderer on (Three.js r${THREE.REVISION}), ${res.loaded} models${res.failed ? `, ${res.failed} failed` : ""}, ${skies} skies`);
  } catch (e) { disable3D(e); }
  hideLoading();
}

// testing: ?stats prints draw calls, triangles and frame rate to the console every few seconds
if (new URLSearchParams(location.search).has("stats")) setInterval(() => { const r = window.R3D; if (r) { const i = r.renderer.info; console.log(`STATS calls=${i.render.calls} tris=${i.render.triangles} geos=${i.memory.geometries} textures=${i.memory.textures} fps=${Math.round(r.fps)} quality=${r.quality.level}`); } }, 2500);
