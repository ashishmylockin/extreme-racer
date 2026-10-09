// Starts the 3D renderer if this browser can do WebGL; otherwise (or on any error) the 2D renderer keeps running.
// Add ?2d to the address to force the old 2D renderer, handy for comparing.
import * as THREE from "three";
import { loadAssets } from "./assets.js";
import { createRenderer3D } from "./renderer.js";

const TIPS = ["Near misses build a combo: the bigger the combo, the bigger the points.", "Nitro canisters boost you the moment you drive through them.", "Rain makes lane changes slower: plan your line early.", "Shields absorb one crash. Grab them!"];
const overlay = document.getElementById("loading"), fill = document.getElementById("loadfill");
document.getElementById("loadtip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
const hideLoading = () => { window.R3D_PENDING = false; overlay.classList.add("done"); setTimeout(() => overlay.remove(), 600); };

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}

if (new URLSearchParams(location.search).has("2d")) { console.log("2D renderer forced by ?2d"); hideLoading(); }
else if (!webglOK()) { console.warn("No WebGL here: using the 2D renderer"); hideLoading(); }
else {
  try {
    // the loading bar: models are 70% of the work, skies 30%
    const res = await loadAssets(p => { fill.style.width = Math.round(p * 70) + "%"; });
    if (!res.loaded) throw new Error("no models could be loaded");
    const gl = document.getElementById("gl");
    const r = createRenderer3D(canvas, gl);
    const skies = await r.init(p => { fill.style.width = Math.round(70 + p * 30) + "%"; });
    gl.style.display = "block"; canvas.classList.add("over3d"); // the 2D canvas becomes see-through: it only draws menus and HUD now
    window.R3D = r;
    r.tick();
    if (new URLSearchParams(location.search).has("photo")) { state = "paused"; r.render(1); r.photo.enter(r.camera); r.photo.dof = true; r.photo.pos.y += 1.5; r.photo.pitch -= 0.1; r.photo.filter = +new URLSearchParams(location.search).get("photo") || 0; } // testing shortcut
    console.log(`3D renderer on (Three.js r${THREE.REVISION}), ${res.loaded} models${res.failed ? `, ${res.failed} failed` : ""}, ${skies} skies`);
  } catch (e) { disable3D(e); }
  hideLoading();
}
