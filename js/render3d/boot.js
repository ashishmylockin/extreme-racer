// Starts the 3D renderer if this browser can do WebGL; otherwise (or on any error) the 2D renderer keeps running.
// Add ?2d to the address to force the old 2D renderer, handy for comparing.
import * as THREE from "three";
import { createRenderer3D } from "./renderer.js";

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}

if (new URLSearchParams(location.search).has("2d")) console.log("2D renderer forced by ?2d");
else if (!webglOK()) console.warn("No WebGL here: using the 2D renderer");
else {
  try {
    const gl = document.getElementById("gl");
    gl.style.display = "block"; canvas.classList.add("over3d"); // the 2D canvas becomes see-through: it only draws menus and HUD now
    const r = createRenderer3D(canvas, gl);
    window.R3D = r;
    r.tick();
    console.log("3D renderer on (Three.js r" + THREE.REVISION + ")");
  } catch (e) { disable3D(e); }
}
