// Fixed 60 Hz simulation so the game runs the same speed on any monitor.
const STEP = 1000 / 60;
let lastTime = 0, acc = 0;
// If a device can't keep up with the full effects (frames averaging over ~22 ms for 3 s of racing), turn on Reduce effects once
let perfAvg = 16.7, perfT = 0, perfDone = store.get("perfGuard", false);
function perfGuard(dt) {
  if (perfDone || settings.lowfx || state !== "playing" || dt > 250 || document.hidden) { perfT = 0; return; }
  perfAvg += (dt - perfAvg) * 0.05;
  if (perfAvg > 22) { if ((perfT += dt) > 3000) { settings.lowfx = true; saveSettings(); fit(); perfDone = true; store.set("perfGuard", true); say("Reduce effects turned on for smoother play"); } }
  else perfT = 0;
}

// ---- the 3D renderer (js/render3d) is optional: if WebGL is missing or anything in it throws, we drop back to the 2D renderer ----
function disable3D(why) {
  console.warn("3D renderer off, using the 2D one:", why);
  window.R3D = null;
  const gl = document.getElementById("gl"); if (gl) gl.style.display = "none";
  canvas.classList.remove("over3d");
}
function tick3D() { try { R3D.tick(); } catch (e) { disable3D(e); } }
function render3D(alpha) { try { R3D.render(alpha); } catch (e) { disable3D(e); } }

function loop(now) {
  perfGuard(now - lastTime);
  acc += Math.min(100, now - lastTime) * (slowT > 0 && state === "playing" ? 0.35 : 1); // big combos: a moment of slow motion
  lastTime = now;
  while (acc >= STEP) { update(); if (window.R3D) tick3D(); acc -= STEP; }
  draw();
  if (window.R3D) render3D(acc / STEP); // acc / STEP = how far we are between two sim ticks (smooth motion on fast screens)
  requestAnimationFrame(loop);
}

songDB.all().then(rows => { for (const r of rows || []) music.addBlob(r.name, r.blob); }).catch(() => {});
fit();
grabFocus();
initDemo();
requestAnimationFrame(loop);

// Developer shortcut for testing and screenshots: index.html?dev=tour,3,1  starts World Tour city 4 (counting from 0: 3) with camera 1
// (0 Overhead, 1 Chase, 2 Cockpit) and holds the gas down; add &ff=600 to skip the first 10 seconds. Modes: tour, single, vs.
{
  const dev = new URLSearchParams(location.search).get("dev");
  if (dev) {
    const [m, c, k] = dev.split(",");
    cam = +k || 0; startGame(m || "single", "medium", +c || 0); held.add("ArrowUp");
    for (let i = +new URLSearchParams(location.search).get("ff") || 0; i > 0; i--) update(); // ff=600 fast-forwards 600 sim ticks (10 s)
  }
}
