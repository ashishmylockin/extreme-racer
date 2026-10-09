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

function loop(now) {
  perfGuard(now - lastTime);
  acc += Math.min(100, now - lastTime) * (slowT > 0 && state === "playing" ? 0.35 : 1); // big combos: a moment of slow motion
  lastTime = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}

songDB.all().then(rows => { for (const r of rows || []) music.addBlob(r.name, r.blob); }).catch(() => {});
fit();
grabFocus();
initDemo();
requestAnimationFrame(loop);
