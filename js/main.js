// Fixed 60 Hz simulation so the game runs the same speed on any monitor.
const STEP = 1000 / 60;
let lastTime = 0, acc = 0;
const devTicks = new URLSearchParams(location.search).get("ticks"); // ?ticks=N (testing): run exactly N sim ticks once loading is done, then freeze
let ticksLeft = devTicks === null ? Infinity : +devTicks;
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
const FILM = new URLSearchParams(location.search).get("film"); let filmT = null; const filmShots = []; // testing: film=0.2,0.6,1.2 captures the 3D view that many seconds after the crash and shows the shots side by side
function filmFrame() {
  if (!FILM || !(state === "title" || (state === "over" && !racers[0].alive))) return; const want = FILM.split(",").map(Number); if (filmT === null) filmT = clock;
  const t = (clock - filmT) / 60; if (filmShots.length < want.length && t >= want[filmShots.length]) { const c = document.createElement("canvas"); c.width = 520; c.height = 300; c.getContext("2d").drawImage(R3D.renderer.domElement, 0, 0, 520, 300); filmShots.push(c); }
  if (filmShots.length === want.length && !document.getElementById("film")) { const d = document.createElement("div"); d.id = "film"; d.style.cssText = "position:fixed;inset:0;background:#111;z-index:99;display:flex;flex-wrap:wrap;gap:4px"; filmShots.forEach((c, i) => { c.style.width = "calc(33% - 4px)"; d.appendChild(c); }); document.body.appendChild(d); }
}
let infoN = 0; const SHOW_STATS = new URLSearchParams(location.search).has("info"); // testing: ?info logs draw calls and triangles after 40 frames
function render3D(alpha) { try { R3D.render(alpha); filmFrame(); if (SHOW_STATS && ++infoN === 40) { const i = R3D.renderer.info; console.info("INFO calls=" + i.render.calls + " triangles=" + i.render.triangles + " geometries=" + i.memory.geometries + " textures=" + i.memory.textures); } } catch (e) { disable3D(e); } }

let errorsRecently = 0;
function loop(now) {
  requestAnimationFrame(loop); // (scheduled first: whatever goes wrong below, the game keeps running instead of freezing)
  if (window.R3D_PENDING) { lastTime = now; return; } // still loading the 3D assets: hold the game
  try {
    if (!window.R3D) perfGuard(now - lastTime); // (the 2D renderer's "reduce effects" watchdog; the 3D renderer has its own Auto quality)
    acc += Math.min(100, now - lastTime);
    lastTime = now;
    while (acc >= STEP) { if (ticksLeft > 0) { update(); ticksLeft--; if (window.R3D) tick3D(); } acc -= STEP; }
    draw();
    if (window.R3D) render3D(acc / STEP); // acc / STEP = how far we are between two sim ticks (smooth motion on fast screens)
    if (errorsRecently > 0 && Math.random() < 0.002) errorsRecently--;
  } catch (e) { // a bug must never freeze the game: log it and drop back to a clean main menu (once or twice; if it keeps happening, stop trying)
    console.error("Game error:", e); acc = 0; lastTime = now;
    if (++errorsRecently <= 3) { try { toMenu(); } catch (e2) { console.error(e2); } }
  }
}

songDB.all().then(rows => { for (const r of rows || []) music.addBlob(r.name, r.blob); }).catch(() => {});
fit();
grabFocus();
initDemo(); jumpTo(3, 0.3); // the title scene: Miami at its best (warm light), with your own car leading
{ // testing: demotest=N runs the title / menu demo for N ticks and counts how often cars overlap
  const n = +new URLSearchParams(location.search).get("demotest");
  if (n) {
    let rE = 0, rR = 0, worst = 0;
    for (let i = 0; i < n; i++) {
      update();
      for (const r of racers) {
        for (const e of enemies) { const reach = (lenOf(e) + CAR_H) / 2; const vis = (lenOf(e) + 86) / 2; if (Math.abs(e.x - r.x) < 38 && Math.abs(e.y - r.y) < vis) { rE++; worst = Math.max(worst, vis - Math.abs(e.y - r.y)); } }
        for (const o of racers) if (o !== r && Math.abs(o.x - r.x) < CAR_W - 4 && Math.abs(o.y - r.y) < 86) rR++;
      }
    }
    console.info("DEMOTEST " + JSON.stringify({ ticks: n, racerThroughTraffic: rE, racerThroughRacer: rR, worstOverlap: Math.round(worst), enemies: enemies.length }));
  }
}
requestAnimationFrame(loop);

// Developer shortcut for testing and screenshots (not linked from anywhere in the game):
//   index.html?dev=tour,3,1   starts World Tour city 4 (counting from 0: 3) with camera 1 (0 Overhead, 1 Chase, 2 Cockpit), gas held down
//   &ff=600  skips the first 10 seconds   &god  ignores crashes   &crash  crashes the car   &finish  crosses the finish line   &ticks=N  freeze after N ticks
//   dev=garage / dev=menu / dev=pause  open that screen.  Modes: tour, single, vs, garage, menu, pause
{
  const q = new URLSearchParams(location.search), dev = q.get("dev");
  if (dev) {
    const [m, c, k] = dev.split(",");
    if (m === "garage") { garageIdx = +c || 0; openMenu("garage"); }
    else if (m === "menu" || m === "options" || m === "graphics" || m === "stats" || m === "upgrades" || m === "credits" || m === "controls" || m === "songs" || m === "difficulty" || m === "tutorial") openMenu(m);
    else if (m === "tyres") startGame("tour", null, +c || 0); // the tyre choice before a World Tour race in city c
    else if (m === "map") openMap();
    else if (m === "brief") { mapIdx = +c || 0; jumpTo(mapIdx, 0.3); openMenu("brief"); }
    else {
      cam = +k || 0; startGameNow(m === "pause" || m === "camerapick" ? "tour" : m || "single", "medium", +c || 0); held.add("ArrowUp");
      if (q.has("god")) racers[0].ghost = 1e9; // god: crashes are ignored
      if (q.has("clean")) document.getElementById("game").style.visibility = "hidden"; // clean: hide the 2D HUD for screenshots
      if (q.has("team")) racers[0].team = TEAMS[+q.get("team") % TEAMS.length]; // team=N: drive that team's car
      if (q.has("bypass")) { const r0 = racers[0]; grid.done = true; grid.goFrame = 0; r0.launchGoal = 3.33; r0.lane = 0; r0.x = laneX(0); enemies = []; pickups = []; pickups.push({ type: "curve", lane: 0, x: laneX(0), y: r0.y - 300 }); enemies.push({ kind: "car", model: "van", lane: 0, x: laneX(0), y: r0.y - 950, len: CAR_H, v: 1.4, cur: 1.4, col: "#f2f2f0", passed: {}, miss: {} }); window.devSteer = +q.get("bypass") || 120; } // bypass=N: a bypass pop-up and a slow van in the left lane; steers left at tick N
      if (q.has("charge")) { held.add("ArrowDown"); window.devRel = +q.get("release") || 0; } // charge: hold gas and brake together; release=N lets go of the brake at tick N
      for (let i = +q.get("ff") || 0; i > 0; i--) { if (window.devRel && frame >= window.devRel) held.delete("ArrowDown"); if (window.devSteer && frame === window.devSteer) steer(racers[0], -1); update(); } // ff=600 fast-forwards 600 sim ticks (10 s)
      if (q.has("half") && level) dist = level.d0 + level.len / 2 - (+q.get("half") || 700); // half=N: jump to N units before the halfway point
      if (q.has("nitro")) startNitro(racers[0]); // nitro: fire a nitro canister straight away
      if (q.has("report")) { // testing: run the simulation flat out for a while and print what the traffic did
        const n = +q.get("report") || 3000, st = { ticks: 0, pickInCar: 0, carOverlap: 0, wall: 0, minGapAhead: 1e9, spd: {}, crashes: 0 }; let maxWall = 0;
        if (!q.has("charge")) { racers[0].launchGoal = 3.33; racers[0].launched = true; grid.done = true; grid.goFrame = frame; }
        const trace = [];
        for (let i = 0; i < n; i++) {
          if (!racers[0].alive) { st.crashes++; break; }
          if (window.devRel && frame >= window.devRel) held.delete("ArrowDown"); update(); st.ticks++; if (i % 20 === 0 && i < 520) trace.push(`${frame}:${Math.round(racers[0].v * 60)}${grid.done ? "" : "(grid)"}`);
          for (const k of pickups) for (const e of enemies) if (e.lane === k.lane && Math.abs(k.y - e.y) < lenOf(e) / 2 + 6 && k.y < racers[0].y - 100) st.pickInCar++;
          for (const a of enemies) for (const b of enemies) if (a !== b && a.lane === b.lane && a.y < b.y && b.y - a.y < (lenOf(a) + lenOf(b)) / 2 - 2) st.carOverlap++;
          for (const e of enemies) { const s = st.spd[e.model] || (st.spd[e.model] = { n: 0, sum: 0, min: 1e9, max: 0 }); s.n++; s.sum += e.cur; s.min = Math.min(s.min, e.cur); s.max = Math.max(s.max, e.cur); }
          const win = enemies.filter(e => e.y > -700 && e.y < 200); // a wall: all three lanes occupied within 300 units of each other
          for (const e of win) { const near = new Set(win.filter(o => Math.abs(o.y - e.y) < 220).map(o => o.lane)); if (near.size >= 3) { st.wall++; break; } }
        }
        const sp = Object.fromEntries(Object.entries(st.spd).map(([k, s]) => [k, `avg ${(s.sum / s.n * 60).toFixed(0)} min ${(s.min * 60).toFixed(0)} max ${(s.max * 60).toFixed(0)} km/h`]));
        console.info("REPORT " + JSON.stringify({ trace: trace.join(" "), zone: racers[0].launchZone && racers[0].launchZone.name, ticks: st.ticks, crashed: st.crashes, speedKmh: Math.round(racers[0].v * 60), pickupsInsideCars: st.pickInCar, carsOverlapping: st.carOverlap, wallTicks: st.wall, speeds: sp, enemiesNow: enemies.length, pickupsNow: pickups.length }));
      }
      if (q.has("crash")) { racers[0].ghost = 0; const r0 = racers[0]; enemies.push({ kind: "car", model: "sedan", lane: r0.lane, x: r0.x, y: r0.y - 100, len: CAR_H, v: 1.67, cur: 1.67, col: "#2f5fa8", passed: {}, miss: {} }); } // crash: a car appears just ahead, so the real crash physics plays out
      if (q.has("finish") && level) finishLevel();
      if (q.has("next")) { // testing: after finishing / crashing, choose the first menu button (Next city / Retry) and run the sim to see whether anything throws
        try { for (let i = 0; i < 5; i++) update(); const menu = currentMenu(); console.info("NEXT state=" + state); menu.items[0].go(); console.info("NEXT after click state=" + state); for (let i = 0; i < 200; i++) update(); console.info("NEXT survived 200 ticks, state=" + state); if (q.has("pick")) { TYRES_MENU[+q.get("pick")].go(); for (let i = 0; i < 700; i++) update(); console.info("NEXT raced: state=" + state + " mode=" + mode + " city=" + (level && level.idx) + " tyre=" + racers[0].tyre + " v=" + Math.round(racers[0].v * 60)); } }
        catch (e) { console.info("NEXT THREW " + e.message + " | " + (e.stack || "").split("\n")[1]); }
      }
      if (m === "pause") state = "paused";
      if (m === "camerapick") openMenu("camera", cam);
    }
  }
}
