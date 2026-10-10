// The Three.js renderer. It READS the simulation's globals (racers, enemies, pickups, scenery...) and never changes them.
//
// How smooth motion works: the simulation ticks at a fixed 60 Hz, but the screen may refresh at 144 Hz. After every sim tick
// we call tick(), which remembers where each thing was and where it is now. Every frame we call render(alpha), where alpha
// (0..1) says how far we are between the two ticks, and draw everything at the blended position.
import * as THREE from "three";
import { SCALE, simX, simZ, roadHalf, arrToHex, setCol } from "./mapping.js";
import * as M from "./models.js";
import { createWorld } from "./world.js";
import { createCameraRig } from "./cameras.js";
import { leafMat, leafDarkMat, grassTopMat } from "./scenery.js";
import { createCity } from "./city/city.js";
import { createBypass } from "./bypass.js";
import { profileOf } from "./city/profiles.js";
import { loadSkies } from "./env.js";
import { glows, tickLandmarks } from "./landmarks.js";
import { createWeather } from "./weather.js";
import { createNight } from "./night.js";
import { createPost } from "./post.js";
import { createReflection } from "./reflect.js";
import { createFX } from "./fx.js";
import { createPhoto } from "./photo.js";
import { createShowroom } from "./showroom.js";
import { resolve, createAuto, gfxDefaults, OPTIONS } from "./quality.js";

const RACE_STATES = new Set(["playing", "over", "cleared", "paused", "camera"]);
const MODES = ["overhead", "chase", "cockpit"];
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const START_FINISH = ["start", "half", "finish"], NO_GRADE = {}, focus = { x: 0, z: 0, camPos: null }, playerLight = { x: 0, z: 0, yaw: 0, alive: true }, cin = { kick: 0, shake: 0, time: 0, gear: 1, lit: 0, grid01: 0, crashT: 0, finishT: 0, photo: null };
const sizeV = new THREE.Vector2(), sunV = new THREE.Vector3(), sunP = new THREE.Vector3(), camFwd = new THREE.Vector3();
const qTmp = new THREE.Quaternion(), pTmp = new THREE.Vector3(), sTmp = new THREE.Vector3(), mTmp = new THREE.Matrix4(), yAxis = new THREE.Vector3(0, 1, 0);

export function createRenderer3D(canvas2d, glCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: "high-performance" }); // anti-aliasing comes from the post pipeline
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // the composer renders several times per frame: reset once per frame ourselves so the totals mean "this frame"
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const rig = createCameraRig(scene);
  const camera = rig.camera;
  const weather = createWeather(scene, camera);
  const nightFx = createNight(scene);
  const city = createCity(scene); // the buildings, ground and water around the road
  const post = createPost(renderer, scene, camera);
  const titleLight = new THREE.SpotLight(0xffe2bd, 0, 70, 0.55, 0.85, 1.2); scene.add(titleLight, titleLight.target);
  const fx = createFX(scene, M.makeWheelDebris), bypass = createBypass(scene), bypassWin = { side: 1, zBack: 0, zFront: 0 };
  const reflect = createReflection(renderer, scene, camera, world.groundMeshes, world.reflectMats); // wet-road reflections (Ultra)
  const photo = createPhoto();
  let showroom = null, showWas = false, menuFrames = 0; const inShowroom = () => state === "garage" || state === "upgrades";
  const GRADE = { Miami: { sat: 1.2, tint: [1.05, 0.97, 1.03] }, Shanghai: { sat: 0.85, tint: [0.95, 1, 1.06] }, London: { sat: 0.8 }, Brussels: { sat: 0.78 }, "Sao Paulo": { sat: 0.92 }, "Las Vegas": { sat: 1.2, contrast: 1.14 }, Singapore: { sat: 1.15, contrast: 1.1 }, Doha: { sat: 1.1, tint: [1.05, 1, 0.92] }, "Abu Dhabi": { sat: 1.15, tint: [1.08, 0.98, 0.9] }, Tokyo: { sat: 1.1, tint: [1.02, 0.99, 1.03] }, Austin: { tint: [1.06, 1, 0.93] }, "Mexico City": { sat: 1.12 }, Barcelona: { tint: [1.04, 1, 0.95] }, Salzburg: { sat: 1.06, tint: [0.97, 1, 1.03] }, Baku: { sat: 1.1, tint: [1.04, 0.98, 0.98] } };
  let nearPulse = 0, seenPop = null, tunnelK = 0;

  // ---------- graphics quality ----------
  const isPhone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 800;
  const auto = createAuto(store, isPhone);
  const URLQ = new URLSearchParams(location.search).get("gfx"); // ?gfx=low|medium|high|ultra tries a preset without saving it
  const qSettings = () => URLQ ? { ...settings, gfx: URLQ } : settings;
  let Q = resolve(qSettings(), auto.level);
  function applyQuality() {
    Q = resolve(qSettings(), auto.level);
    for (const kv of (new URLSearchParams(location.search).get("q") || "").split(",")) { const [k, v] = kv.split(":"); if (k && v !== undefined) Q[k] = v === "true" ? true : v === "false" ? false : +v; } // testing: ?q=msaa:0,shadows:1024 overrides single quality values
    renderer.shadowMap.enabled = Q.shadows > 0; world.sun.castShadow = Q.shadows > 0;
    world.setShadowArea(Math.min(Q.shadowArea || 100, Q.shadows >= 4096 ? 125 : Q.shadows >= 2048 ? 100 : 70), Q.shadows >= 2048 ? 45 : 25); // sharper shadow maps can stretch over more of the road ahead
    post.setAO(Q.ao || 0);
    if (world.sun.shadow.mapSize.x !== Q.shadows && Q.shadows > 0) { world.sun.shadow.mapSize.set(Q.shadows, Q.shadows); if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; } }
    renderer.shadowMap.needsUpdate = true;
    fx.setDensity(Q.particles); reflect.enable(Q.reflect); city.setQuality({ ahead: Q.cityAhead * Q.dist, density: Q.cityDensity }); M.setCarDetail(Q.carLod ?? 1);
    post.bloom.enabled = post.clean.enabled = Q.bloom; post.clean.uniforms.debug.value = Q.debugnan ? 1 : 0; post.fx.enabled = Q.grade; post.smaa.enabled = Q.smaa; post.fxaa.enabled = Q.fxaa;
    for (const t of [post.composer.renderTarget1, post.composer.renderTarget2]) if (t.samples !== Q.msaa) { t.samples = Q.msaa; t.dispose(); }
    for (const m of rig.mirrors) m.rt.setSize(Q.mirrorRes, Q.mirrorRes / 2);
    sizeKey = ""; // the pixel ratio may have changed
    refreshMaterials(); // shadows on/off changes every material's shader
  }

  // after a quality change, every material must be rebuilt (e.g. shadows on/off changes its shader), including those of hidden pooled objects
  function refreshMaterials() {
    const seen = new Set(), mark = o => o.traverse(c => { const ms = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : []; for (const m of ms) if (!seen.has(m)) { seen.add(m); m.needsUpdate = true; } });
    mark(scene); for (const list of pools.values()) for (const o of list) mark(o);
  }

  // ---------- pools: finished objects are hidden and reused instead of rebuilt ----------
  const pools = new Map();
  const acquire = (key, make) => { const list = pools.get(key); const o = list && list.pop() || make(); o.userData.poolKey = key; if (o.userData.reset) o.userData.reset(); scene.add(o); return o; };
  const release = o => { scene.remove(o); const k = o.userData.poolKey; (pools.get(k) || pools.set(k, []).get(k)).push(o); };

  // ---------- trackers: one record per simulation object, holding its previous and current position ----------
  let tickId = 0, lastRacers = null;
  function makeTracker(keyOf, build, readExtra, xOf = e => e.x, onRemove) {
    const recs = new Map();
    return {
      recs,
      tick(list) {
        for (const e of list) {
          const x = simX(xOf(e)), z = simZ(e.y), ex = readExtra ? readExtra(e) : 0;
          let r = recs.get(e);
          if (!r) { const key = keyOf ? keyOf(e) : ""; r = { obj: build ? acquire(key, () => build(e)) : null, px: x, pz: z, cx: x, cz: z, pe: ex, ce: ex }; recs.set(e, r); }
          else { r.px = r.cx; r.pz = r.cz; r.cx = x; r.cz = z; r.pe = r.ce; r.ce = ex; }
          r.id = tickId;
        }
        for (const [e, r] of recs) if (r.id !== tickId) { if (onRemove) onRemove(e, r); if (r.obj) release(r.obj); recs.delete(e); }
      },
    };
  }
  const racersT = makeTracker(r => "race:" + r.team.name, r => M.makeRaceCar(r.team), r => r.tilt);
  const enemiesT = makeTracker(
    e => e.kind === "truck" ? `truck:${e.len}:${e.col}:${e.model}` : e.kind === "works" ? `works:${e.len}` : `car:${e.col}:${e.model}`,
    e => e.kind === "truck" ? M.makeTruck(e.len, e.col, e.model) : e.kind === "works" ? M.makeWorks(e.len) : M.makeTrafficCar(e.col, e.model));
  const pickupsT = makeTracker(k => "pickup:" + k.type + (k.type === "curve" ? ":" + k.lane : ""), k => k.type === "coin" ? M.makeCoin() : k.type === "nitro" ? M.makeNitro() : k.type === "curve" ? M.makeCurve(k.lane === 0 ? -1 : 1) : M.makeShield(), null, e => e.x,
    (k, r) => { if (k.taken && !k.gone) fx.pickup(r.cx, r.cz, k.type); }); // a sparkle where a pickup was collected
  const puddlesT = makeTracker(() => "puddle", () => weather.puddleBuild());
  let distPrev = 0, distCur = 0; // how far along the route the car is (sim units), before and after the latest tick
  const marks = { start: null, half: null, finish: null }; // start gantry, halfway gantry and finish arch: { obj, pz, cz }
  function trackMark(name, src, finish) {
    const m = marks[name];
    if (src && !m) marks[name] = { obj: acquire(name, () => M.makeGantry(name === "half" ? "half" : finish, roadHalf())), pz: simZ(src.y), cz: simZ(src.y) };
    else if (src) { m.pz = m.cz; m.cz = simZ(src.y); }
    else if (m) { release(m.obj); marks[name] = null; }
  }

  function tick() {
    tickId++;
    if (racers !== lastRacers) { lastRacers = racers; fx.reset(); crashAt = -1; crashClock = 0; } // a new race: nothing left over from the last one
    racersT.tick(racers);
    enemiesT.tick(enemies);
    pickupsT.tick(pickups);
    puddlesT.tick(roadItems);
    trackMark("start", startObj, false);
    trackMark("half", halfObj, false);
    trackMark("finish", finishObj, true);
    distPrev = distCur; distCur = dist;
  }

  // ---------- sizing: match the 2D canvas, which fit() sizes to the window ----------
  let sizeKey = "";
  function resize() {
    const cw = canvas2d.clientWidth, ch = canvas2d.clientHeight; if (!cw || !ch) return;
    const sc = state === "title" || state === "menu" ? Math.max(Q.scale, Q.menuScale || 1) : inShowroom() ? Math.max(Q.scale, Q.garageScale || 1) : Q.scale * (Q.level === "low" ? auto.dynScale : 1); // the title, main menu and Garage are cheap scenes: they render sharper (by how much: the preset)
    const pr = Math.max(0.5, Math.min(2.6, Math.min(Math.max(window.devicePixelRatio || 1, 1), 2) * sc)), key = `${cw}x${ch}@${pr}`;
    if (key === sizeKey) return; sizeKey = key;
    renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); post.setSize(cw, ch, pr);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    if (showroom) showroom.resize(cw, ch);
  }

  // ---------- per-frame ----------
  let last = performance.now(), time = 0, frozen = null, fps = 60, crashAt = -1, crashClock = 0, finishAt = -1, fwT = 0, lastState = "";
  const camTarget = { x: 0, z: 0, v: 0, tilt: 0, nitro: false };
  const R = { active: true, renderer, scene, camera, rig, tick, racerScreen, photo, get showroom() { return showroom; }, refreshQuality: applyQuality, gfxDefaults, OPTIONS, cinematic: settings.cinema !== false, get fps() { return fps; }, get quality() { return Q; }, get autoLevel() { return auto.level; } };

  const INSPECT = new URLSearchParams(location.search).get("inspect"); // ?inspect=side|front|top: a fixed close-up of your car, for checking models
  function modeNow() {
    if (photo.active) return "photo";
    if (INSPECT) return "inspect";
    if (state === "playing" && grid && !grid.done && R.cinematic !== false) return "grid";
    if (state === "over" && racers[0] && !racers[0].alive && crashAt >= 0) return "crash";
    if (state === "cleared") return "finish";
    if (state === "title") return "title";
    return RACE_STATES.has(state) ? MODES[cam] : "menu";
  }
  R.overDelay = () => (state === "over" && racers[0] && !racers[0].alive && R.cinematic !== false ? 1700 : 0); // ms the crash camera plays before the Game Over screen

  function render(alpha) {
    const now = performance.now(), ms = now - last, dt = Math.min(0.1, ms / 1000); last = now; time += dt;
    fps += (1000 / Math.max(1, ms) - fps) * 0.08; renderer.info.reset();
    if (auto.frame(ms, state === "playing")) applyQuality();
    if (Q.level === "low" && state === "playing") auto.lowFrame(ms); // (Low keeps 60 fps by trading resolution: see dynScale)
    resize();
    if (inShowroom()) { renderShowroom(dt); return; }
    showWas = false; if (!showroom && state === "menu" && ++menuFrames === 90) buildShowroom(); // (the Garage is built while you sit on the main menu, so opening it is instant)
    post.setScene(scene, camera);
    const mode = modeNow();
    if (state !== lastState) { if (state === "cleared") finishAt = time; lastState = state; }

    // the cars
    const night = Math.min(1, pal.dark * 4), shiftZ = (state === "paused" || state === "camera" || photo.active) ? 0 : scroll * SCALE * 60 * dt;
    const fxDt = (state === "paused" || state === "camera" || photo.active) ? 0 : dt;
    for (const [r, rec] of racersT.recs) {
      const o = rec.obj, x = lerp(rec.px, rec.cx, alpha), z = lerp(rec.pz, rec.cz, alpha), tilt = lerp(rec.pe, rec.ce, alpha);
      o.rotation.order = "YXZ"; o.position.set(x, r.bypassing ? 0.28 * (r.bypassK || 0) : 0, z); o.rotation.y = -tilt; // (yaw first, then nose up / down, then roll: so a tumbling wreck turns about its own axes)
      if (!r.alive && rec.wreck && fxDt > 0) { // a wreck: it hops off what it hit, rolls over once if the impact was fast, and settles on its wheels
        const w = rec.wreck; w.vy -= 30 * fxDt; w.h += w.vy * fxDt;
        if (w.h < 0) { w.h = 0; w.vy = w.vy < -2 ? -w.vy * 0.28 : 0; w.rollV *= 0.8; }
        if (Math.abs(w.roll) < Math.PI * 2 && w.rollV) { w.roll += w.rollV * fxDt; if (Math.abs(w.roll) >= Math.PI * 2) { w.roll = 0; w.rollV = 0; w.done = true; } }
        if (w.h === 0 && w.vy === 0) { const k = Math.min(1, fxDt * 5); w.roll += (Math.round(w.roll / (Math.PI * 2)) * Math.PI * 2 - w.roll) * k; w.pitch *= 1 - k; w.rollV *= 1 - k; } // on the ground it comes to rest on its wheels
        o.position.y = w.h; o.rotation.z = w.roll; o.rotation.x = w.pitch * Math.min(1, w.h * 2 + 0.2);
      } else if (r.alive) { o.rotation.z = 0; o.rotation.x = 0; rec.wreck = null; }
      const ud = o.userData, spin = r.v * SCALE / 0.75 * dt * 60, c = Math.cos(-tilt), s = Math.sin(-tilt);
      for (const w of ud.wheels) w.rotation.x -= spin;
      for (const f of ud.front) f.rotation.y = -Math.max(-0.5, Math.min(0.5, tilt * 1.4));
      ud.brake.material.emissiveIntensity = r.braking ? 3 : 0.15;
      if (ud.setTyre && rec.tyre !== r.tyre) { rec.tyre = r.tyre; ud.setTyre(r.tyre || "dry"); } // the compound band on the sidewalls
      if (r.slip && fxDt > 0 && RACE_STATES.has(state) && Math.random() < 0.5) fx.tyreSmoke(x, z, [0.85, 0.86, 0.9], 0.28); // wrong tyres for the weather: they smoke as they slide
      if (ud.discMat) { const goal = r.alive ? (r.hardBrake ? 3.5 : r.braking ? 1.4 : 0) : 0, d = ud.discMat; d.emissiveIntensity += (goal - d.emissiveIntensity) * Math.min(1, dt * (goal > d.emissiveIntensity ? 14 : 3)); } // brake discs glow orange when you brake, and cool slowly
      if (!ud.beam) { ud.beam = nightFx.makeBeam(); o.add(ud.beam); ud.flame = fx.makeFlame(); o.add(ud.flame); }
      ud.beam.visible = pal.dark > 0.012 && r.alive;
      ud.flame.visible = r.alive && r.nitro > 0; fx.flameMat.uniforms.time.value = time;
      if (ud.rain) ud.rain.material.emissiveIntensity = rainI > 0.25 ? 2 + Math.sin(time * 9) * 1.5 : 0; // the flashing rain light
      if (ud.setCockpit) ud.setCockpit(mode === "cockpit" && r === racers[0]); else ud.helmet.visible = !(mode === "cockpit" && r === racers[0]);
      o.visible = r.ghost > 0 && r.ghost < 1000 ? (frame >> 1) % 2 === 0 : true; // flashes after a bump
      if (r.shield && !ud.bubble) { ud.bubble = M.makeShieldBubble(); o.add(ud.bubble); }
      if (ud.bubble) ud.bubble.visible = !!r.shield;
      // ---- events: crash, shield break, nitro, tyre smoke, spray, trails ----
      if (!r.alive && !rec.crashed) { rec.crashed = true; rec.crashTime = time; fx.crash(x, z, r.team, -(r.wreckV || 0) * SCALE * 60); const fast = (r.wreckV || 0) > 3.2; rec.wreck = { h: 0, vy: Math.min(9, 1.5 + (r.wreckV || 0) * 1.3), roll: 0, rollV: fast ? (r.yawV >= 0 ? 1 : -1) * 5.2 : 0, pitch: -0.22, done: false }; if ((r.wreckV || 0) > 2.2 && ud.shed) { const pair = Math.random() < 0.5 ? [0, 3] : [1, 2]; ud.shed(pair[0]); ud.shed(pair[1]); } if (r === racers[0]) { crashAt = time; crashClock = 0; } }
      if (r.alive) rec.crashed = false;
      if (rec.crashed && time - rec.crashTime < 7 && fxDt > 0) { fx.fire(x, z); fx.fire(x, z); }
      if (rec.hadShield && !r.shield && r.alive) fx.shield(x, z); rec.hadShield = !!r.shield;
      if (r.nitro > 0 && !rec.nitroOn && fxDt > 0) fx.nitroStart(x, z); rec.nitroOn = r.nitro > 0;
      if (fxDt > 0 && r.alive && RACE_STATES.has(state) && !(cam === 2 && r.id === 0)) { // (no dust, spray or tyre smoke behind the demo cars on the title and menus: a clean picture; none from your own car in the cockpit, where it would bloom right in front of your eyes)
        if (r.hardBrake && Math.random() < 0.6) fx.tyreSmoke(x, z, [0.82, 0.82, 0.82]);
        else if (wet > 0.3 && r.v > 1.5 && Math.random() < 0.35 * Q.particles) fx.tyreSmoke(x, z, [0.75, 0.82, 0.92], 0.22);   // spray off a wet road
        else if (stA.desert && r.v > 1.5 && Math.random() < 0.25 * Q.particles) fx.tyreSmoke(x, z, [0.8, 0.7, 0.5], 0.25);       // dust in the desert
      }
      if (Q.trails && fxDt > 0 && RACE_STATES.has(state)) {
        const tr = fx.trailsFor(r.id), nit = r.alive && r.nitro > 0, amt = nit ? 1 : 0, rgb = [0.45, 0.8, 1.3]; // only during nitro: a thin blue streak that fades fast (no red tail-light ribbons at night)
        tr.l.step(x - 1.15 * c + 3.4 * s, 1.2, z + 1.15 * s + 3.4 * c, shiftZ, rgb, amt); tr.r.step(x + 1.15 * c + 3.4 * s, 1.2, z - 1.15 * s + 3.4 * c, shiftZ, rgb, amt);
      }
    }
    // traffic, pickups, scenery
    for (const [e, rec] of enemiesT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      if (o.userData.wheels) for (const w of o.userData.wheels) w.rotation.x -= (e.cur || 0) * SCALE / 0.65 * dt * 60; // wheels turn with the vehicle's own speed
    }
    for (const [k, rec] of pickupsT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      if (k.type !== "curve") o.rotation.y = time * 2.4 + (k.x || 0);
      if (k.type !== "coin") o.position.y = Math.sin(time * 3) * 0.25 + (k.type === "curve" ? 0.4 : 0);
    }
    for (const [it, rec] of puddlesT.recs) { rec.obj.position.set(rec.cx, 0.045, lerp(rec.pz, rec.cz, alpha)); rec.obj.scale.set(it.rx * SCALE * 1.4, 1, it.ry * SCALE * 1.8); }
    // everything leafy follows the city's colour, and the cars' lights come up at night
    setCol(leafMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2]); setCol(leafDarkMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2], 0.72); setCol(grassTopMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2], 1.12);
    M.lightMats.head.emissiveIntensity = 0.4 + 4 * night; M.lightMats.tail.emissiveIntensity = 0.8 + 2 * night;
    M.trafficLamp.color.setScalar(0.8 + 1.4 * night); { const p = M.trafficPool(); p.visible = night > 0.04; p.opacity = Math.min(0.32, night * 0.4); } // working lights on the traffic: lamps glow, headlamps light the road ahead
    for (const g of glows) g.mat.emissiveIntensity = g.base * (g.nightOnly ? night : 0.12 + 0.8 * night); // neon, lit windows and landmark lights come up at night (gently)
    tickLandmarks(time, night); // (the Las Vegas Sphere's LED shows)
    for (const name of START_FINISH) {
      const m = marks[name]; if (!m) continue;
      m.obj.position.set(0, 0, lerp(m.pz, m.cz, alpha));
      if (name === "start") { const dd = m.obj.position.distanceTo(camera.position), near = Math.min(1, Math.max(0, (dd - 6) / 30)); m.obj.userData.lights.forEach((mt, i) => { // (the lights fade down when the camera is right under them, or they would wash out the screen)
        const green = grid.done, red = !green && i < grid.lit;
        mt.emissive.set(green ? 0x00ff40 : red ? 0xff0000 : 0x000000); mt.emissiveIntensity = (green ? 2.4 : red ? 1.8 : 0) * (0.15 + 0.85 * near); mt.color.set(green ? 0x00aa30 : red ? 0xaa0000 : 0x220000); // (pure red at a lower strength: bright reds turn orange in the tone mapper)
      }); }
    }

    // what the camera follows: your car, interpolated. When you crash, the crash camera follows the wreck itself.
    const p0 = racers[0], rec0 = racersT.recs.get(p0);
    if (rec0 && (p0.alive || mode === "crash")) {
      camTarget.x = lerp(rec0.px, rec0.cx, alpha); camTarget.z = lerp(rec0.pz, rec0.cz, alpha); camTarget.tilt = lerp(rec0.pe, rec0.ce, alpha);
      camTarget.v = p0.alive ? p0.v : 0; camTarget.nitro = p0.alive && p0.nitro > 0; frozen = null;
    } else if (rec0 && !frozen) frozen = { x: camTarget.x, z: camTarget.z, tilt: 0, v: 0, nitro: false };
    const target = frozen || camTarget;

    photo.update(dt);
    crashClock += dt * (time - crashAt < 1.0 ? 0.6 : 1); // the crash camera eases in gently
    cin.kick = kickFx; cin.shake = settings.shake ? shake : 0; cin.time = time; cin.gear = gearOf(p0.v); cin.lit = Math.round(rpmOf(effV(p0)) * 10);
    cin.grid01 = Math.min(1, grid.t / (5 * GRID_STEP + 25)); cin.crashT = crashClock; cin.finishT = time - finishAt; cin.photo = photo;
    rig.update(mode, target, dt, cin);
    { const show = mode === "title" && R.photo === photo && !photo.active; titleLight.intensity = show ? 800 : 0; if (show) { titleLight.position.set(camera.position.x + 2.5, camera.position.y + 3, camera.position.z + 1); titleLight.target.position.set(target.x, 0.9, target.z); } } // a soft showroom light on your car behind the title
    focus.x = target.x; focus.z = target.z; focus.camPos = camera.position; // (reused every frame: nothing is allocated while racing)
    const D = lerp(distPrev, distCur, alpha) * SCALE; // how far along the route the car is (world units)
    world.update(pal, rainI, D, focus, stA, stB, stBlend, wet); renderer.toneMappingExposure = world.exposure;
    city.setSignStyle(profileOf(stA.venue).sign); city.update(D, dt, night, pal, scene.fog.color, stA, camera.position.z);
    // inside a tunnel the sun and sky light are blocked out (the tunnel lights take over)
    tunnelK += ((city.inTunnel(D - camera.position.z) ? 1 : 0) - tunnelK) * Math.min(1, dt * 6);
    if (tunnelK > 0.01) { scene.environmentIntensity *= 1 - 0.8 * tunnelK; world.sun.intensity *= 1 - tunnelK; }
    scene.fog.near *= Q.dist; scene.fog.far *= Q.dist;
    if (!Q.ibl) { scene.environment = null; world.fill.color.copy(scene.fog.color).multiplyScalar(1.5); world.fill.groundColor.copy(world.fill.color).multiplyScalar(0.45); world.fill.intensity = 2.3 - 1.5 * night; } // Low: no image-based lighting, so a plain sky-coloured ambient light instead
    else { world.fill.color.setRGB(0.56, 0.65, 1); world.fill.groundColor.setRGB(0.2, 0.25, 0.33); world.fill.intensity = 0.4 * night; } // (a little moonlight fill on the cars at night)
    const flash = weather.update(time, fxDt, camera.position, rainI, wind, pal.petals, mode, Q.rain);
    if (flash > 0) { scene.environmentIntensity += flash * 3; world.sun.intensity += flash * 4; } // lightning lights up the whole scene for a moment
    nightFx.update(night, city.lamps, city.lampCount, p0.alive && rec0 ? (playerLight.x = camTarget.x, playerLight.z = camTarget.z, playerLight.yaw = -camTarget.tilt, playerLight) : null);
    const du = world.dome.material.uniforms; du.hazeAmt.value = night * 0.3; du.haze.value.setRGB(Math.pow(stA.s1[0] / 255, 2.2) * 0.5, Math.pow(stA.s1[1] / 255, 2.2) * 0.5, Math.pow(stA.s1[2] / 255, 2.2) * 0.5); // the glow of the city on the horizon
    du.glow.value.copy(du.haze.value).multiplyScalar(0.45); // (the drawn night sky's horizon glow: the same colour, gentler)

    // ---- finish line: fireworks and confetti in the city's flag colours ----
    if (state === "cleared" && level && fxDt > 0) {
      const cols = FLAG_COLS[ROUTE[level.idx].flag] || ["#ffd23f", "#ffffff"];
      if ((fwT -= dt) < 0 && time - finishAt < 9) { fwT = rnd(0.25, 0.55); fx.firework(target.x + rnd(-26, 26), rnd(24, 44), target.z - rnd(45, 85), cols); }
      if (time - finishAt < 0.2 && (R._cf = (R._cf || 0) + 1) % 3 === 0) fx.confetti(target.x, 8, target.z - 6, cols);
      if (Math.random() < 0.08) fx.confetti(target.x, 12, target.z - 8, cols);
    }
    // near miss: a streak of air
    const lp = pops.length ? pops[pops.length - 1] : null; if (lp && lp !== seenPop) { seenPop = lp; nearPulse = 1; if (rec0 && fxDt > 0) fx.nearMiss(camTarget.x, camTarget.z); } nearPulse *= Math.pow(0.04, dt);
    { const bt = typeof bypassTrack === "undefined" ? null : bypassTrack; bypass.update(bt, alpha, time); if (bt) { bypassWin.side = bt.side; bypassWin.zBack = simZ(bt.y0); bypassWin.zFront = bypassWin.zBack - bt.L * SCALE; city.setBypass(bypassWin); } else city.setBypass(null); }
    fx.update(fxDt * (time - crashAt < 1.0 && crashAt >= 0 && state === "over" ? 0.6 : 1), shiftZ, renderer.getDrawingBufferSize(sizeV).y / (2 * Math.tan(camera.fov * Math.PI / 360)));

    // ---- post-processing settings for this frame ----
    {
      const U = post.u, kmh = p0.v * 60, nf = typeof nitroFx === "number" ? nitroFx : 0;
      const gA = GRADE[stA.venue] || NO_GRADE, gB = GRADE[stB.venue] || NO_GRADE, mixv = (k, d) => (gA[k] ?? d) + ((gB[k] ?? d) - (gA[k] ?? d)) * stBlend;
      const wetDim = 1 - 0.12 * rainI;
      U.sat.value = mixv("sat", 1.1) * wetDim; U.contrast.value = mixv("contrast", 1.08) + 0.04 * night; // (a little punch by default: day cities read warm and crisp)
      const ta = gA.tint || [1, 1, 1], tb = gB.tint || [1, 1, 1];
      U.tint.value.setRGB(ta[0] + (tb[0] - ta[0]) * stBlend, ta[1] + (tb[1] - ta[1]) * stBlend, ta[2] + (tb[2] - ta[2]) * stBlend);
      const sk = pal.tint; if (sk[3] > 0.005) U.tint.value.multiply(pTmpC.setRGB(1 + (sk[0] / 255 - 0.5) * sk[3] * 2, 1 + (sk[1] / 255 - 0.5) * sk[3] * 2, 1 + (sk[2] / 255 - 0.5) * sk[3] * 2));
      U.time.value = time; U.vig.value = 0.26 + 0.06 * nf + 0.08 * night;
      U.blur.value = Math.min(0.1, Math.max(0, (kmh - 300) / 1200) + nf * 0.05) * (mode === "menu" || mode === "title" || mode === "photo" || mode === "crash" || mode === "grid" ? 0 : 1);
      U.aberr.value = Q.ca ? nf * 0.003 : 0;   // (the picture stays clean and sharp at speed: only the faintest hint of speed blur, none from near misses or the nitro kick)
      U.heat.value = stA.desert ? (1 - night) * 0.9 : 0;       // heat shimmer in the desert cities by day
      U.fmode.value = photo.active ? photo.filter : 0; U.grain.value = photo.active && photo.filter === 2 ? 0.05 : 0;
      { const crisp = state === "title" || state === "menu"; post.smaa.enabled = Q.smaa || crisp; post.fxaa.enabled = Q.fxaa && !crisp; } // best anti-aliasing behind the title and menus
      post.bloom.strength = 0.1 + 0.16 * night + flash * 0.6 + nf * 0.2; post.bloom.threshold = 1.5 - 0.15 * night; post.bloom.radius = 0.4 + 0.05 * night; // (a soft, relaxed glow: no blinding halos; calm at night)
      // lens flare: only when the sun is on screen
      sunV.copy(world.sun.position).sub(camera.position).normalize(); const facing = sunV.dot(camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion));
      sunP.copy(camera.position).addScaledVector(sunV, 200).project(camera);
      const sunUp = Q.flare && world.sun.intensity > 1.2 && mode !== "overhead" && facing > 0.55 && sunP.z < 1;
      U.flareAmt.value = sunUp ? Math.min(1, (facing - 0.55) * 3) * Math.min(1, world.sun.intensity / 3) * (1 - rainI) * (1 - night) * 0.45 : 0;
      U.flarePos.value.set(sunP.x * 0.5 + 0.5, sunP.y * 0.5 + 0.5);
      // depth of field behind the menus and in photo mode
      post.bokeh.enabled = Q.dof && photo.active && photo.dof; // (no blur behind the title and menus: they are razor sharp)
      if (post.bokeh.enabled) { post.bokeh.uniforms.focus.value = camera.position.distanceTo(pTmp.set(target.x, 1, target.z)); post.bokeh.uniforms.aperture.value = photo.active ? photo.aperture : 0.0012; }
    }
    // mirrors first (cockpit view only), without the cockpit in them
    if (mode === "cockpit") {
      rig.cockpit.visible = false;
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; // the mirrors reuse the main view's shadows
      for (const m of rig.mirrors) { renderer.setRenderTarget(m.rt); renderer.render(scene, m.cam); }
      renderer.shadowMap.autoUpdate = au;
      renderer.setRenderTarget(null); rig.cockpit.visible = true;
    }
    if (Q.reflect && wet > 0.12 && mode !== "menu" && mode !== "title") reflect.render(Math.min(1, wet * 1.3)); // Ultra: reflections on a wet road
    post.render(dt, camera.position);
    if (photo.capture) capture();
  }
  const pTmpC = new THREE.Color();
  R.render = render;
  R.init = async onProgress => { const n = await loadSkies(renderer, onProgress); applyQuality(); return n; }; // loads the HDRI skies; call once before the first render

  // ---------- the Garage showroom (built once, reused; see showroom.js) ----------
  const SETTLE = new URLSearchParams(location.search).get("settle"); const GFIX = new URLSearchParams(location.search).has("gscript");
  function buildShowroom() {
    const t0 = performance.now();
    showroom = createShowroom({ renderer, makeCar: team => M.makeRaceCar(team) });
    showroom.setQuality(Q); showroom.resize(canvas2d.clientWidth, canvas2d.clientHeight); showroom.warm(equipped, TEAMS[equipped]); sizeKey = "";
    if (location.search.includes("stats")) console.info("SHOWROOM built in " + Math.round(performance.now() - t0) + " ms");
  }
  // testing: ?gscript=F:action,... plays the Garage at a fixed 60 fps, doing each action (left, right, buy, ...) at frame F, and stops the game on the frame named "freeze", so a screenshot can show any moment of a transition
  function runGarageScript(view) {
    const steps = new URLSearchParams(location.search).get("gscript").split(",").map(s => s.split(":")); let f = 0;
    const frame = () => { f++; view.idx = garageIdx; view.team = TEAMS[garageIdx]; view.locked = !owned.includes(garageIdx); showroom.update(1 / 60, view); };
    for (const [t, act] of steps) { while (f < +t) frame(); if (act === "freeze") { while (f < +t) frame(); window.gFreeze = true; document.getAnimations().forEach(a => a.pause()); console.info("GSCRIPT " + JSON.stringify({ d: showroom.debug(), layout: window.garageLayout })); return; } if (act === "buy") garageAction(); else if (/^(Arrow|Enter|Escape)/.test(act)) document.dispatchEvent(new KeyboardEvent("keydown", { code: act, bubbles: true })); else menuAction(act); }
  }
  function renderShowroom(dt) {
    if (!showroom) buildShowroom();
    const view = { idx: garageIdx, team: TEAMS[garageIdx], locked: !owned.includes(garageIdx), spinIn: garageSpin };
    showroom.setQuality(Q); showroom.setLayout(window.garageLayout);
    if (!showWas) { showWas = true; showroom.enter(); if (SETTLE !== null) { for (let i = 0; i < 30; i++) showroom.update(0.05, view); showroom.spin(+SETTLE || 0); } } // (testing: ?settle=ANGLE skips the intro and starts at that turntable angle)
    if (GFIX && !window.gDone) { window.gDone = true; runGarageScript(view); if (window.gFreeze) dt = 0; } // (testing)
    showroom.update(dt, view);
    showroom.beforeRender();
    post.setScene(showroom.scene, showroom.camera); renderer.toneMappingExposure = 1; post.aoOff = true; // (the showroom has its own lighting and no AO)
    const U = post.u; U.sat.value = 1.08; U.contrast.value = 1.06; U.tint.value.setRGB(1, 1, 1); U.vig.value = 0.4; U.blur.value = 0; U.aberr.value = 0; U.heat.value = 0; U.flareAmt.value = 0; U.fmode.value = 0; U.time.value = time;
    post.bloom.strength = 0.32; post.bloom.threshold = 1.2; post.bloom.radius = 0.6; post.bokeh.enabled = false;
    post.smaa.enabled = Q.level !== "low"; post.fxaa.enabled = !post.smaa.enabled && Q.fxaa; // (best anti-aliasing the machine can afford: the scene is cheap)
    post.render(dt);
  }

  // ---------- photo mode: save what's on screen as a PNG ----------
  function capture() {
    photo.capture = false;
    const c = document.createElement("canvas"); c.width = glCanvas.width; c.height = glCanvas.height; const g = c.getContext("2d");
    g.drawImage(glCanvas, 0, 0);
    if (!photo.hideHud) g.drawImage(canvas2d, 0, 0, c.width, c.height);
    c.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `extreme-racer-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); photo.note = "Saved to your Downloads"; });
  }

  // where a racer is on the 2D canvas right now (for the "CLOSE!" popups beside the car)
  const v3 = new THREE.Vector3();
  function racerScreen(r) {
    const rec = racersT.recs.get(r);
    if (!rec) return { x: W / 2, y: H * 0.55 };
    v3.set(rec.cx, 2.2, rec.cz).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
  }

  return R;
}
