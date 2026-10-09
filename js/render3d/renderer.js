// The Three.js renderer. It READS the simulation's globals (racers, enemies, pickups, scenery...) and never changes them.
//
// How smooth motion works: the simulation ticks at a fixed 60 Hz, but the screen may refresh at 144 Hz. After every sim tick
// we call tick(), which remembers where each thing was and where it is now. Every frame we call render(alpha), where alpha
// (0..1) says how far we are between the two ticks, and draw everything at the blended position.
import * as THREE from "three";
import { SCALE, simX, simZ, roadHalf, arrToHex } from "./mapping.js";
import * as M from "./models.js";
import { createWorld } from "./world.js";
import { createCameraRig } from "./cameras.js";
import { Instancer, chooseModel, ensure, hasChoice, leafMat, leafDarkMat, grassTopMat } from "./scenery.js";
import { hasModel } from "./assets.js";

const RACE_STATES = new Set(["playing", "over", "cleared", "paused", "camera"]);
const MODES = ["overhead", "chase", "cockpit"];
const lerp = (a, b, t) => a + (b - a) * t;
const qTmp = new THREE.Quaternion(), pTmp = new THREE.Vector3(), sTmp = new THREE.Vector3(), mTmp = new THREE.Matrix4(), yAxis = new THREE.Vector3(0, 1, 0);

export function createRenderer3D(canvas2d, glCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  const rig = createCameraRig(scene);
  const camera = rig.camera;

  // ---------- pools: finished objects are hidden and reused instead of rebuilt ----------
  const pools = new Map();
  const acquire = (key, make) => { const list = pools.get(key); const o = list && list.pop() || make(); o.userData.poolKey = key; scene.add(o); return o; };
  const release = o => { scene.remove(o); const k = o.userData.poolKey; (pools.get(k) || pools.set(k, []).get(k)).push(o); };

  // ---------- trackers: one record per simulation object, holding its previous and current position ----------
  let tickId = 0;
  function makeTracker(keyOf, build, readExtra, xOf = e => e.x) {
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
        for (const [e, r] of recs) if (r.id !== tickId) { if (r.obj) release(r.obj); recs.delete(e); }
      },
    };
  }
  const racersT = makeTracker(r => "race:" + r.team.name, r => M.makeRaceCar(r.team), r => r.tilt);
  const enemiesT = makeTracker(
    e => e.kind === "truck" ? `truck:${e.len}:${e.col}` : e.kind === "works" ? `works:${e.len}` : "car:" + e.col,
    e => e.kind === "truck" ? M.makeTruck(e.len, e.col) : e.kind === "works" ? M.makeWorks(e.len) : M.makeTrafficCar(e.col));
  const pickupsT = makeTracker(k => "pickup:" + k.type, k => k.type === "coin" ? M.makeCoin() : k.type === "nitro" ? M.makeNitro() : M.makeShield());
  const instancer = new Instancer(scene, 220);
  const farX = s => (s.far ? s.x3 : s.x); // far scenery sits at x3, near scenery at x
  const sceneryT = makeTracker(          // scenery with no model yet: simple placeholder shapes
    s => `s:${s.kind}:${s.style || s.key || ""}:${Math.round(s.r)}:${Math.round(s.bh || 0)}:${s.bcol || ""}:${s.side}`,
    s => M.makeScenery(s, arrToHex(pal.leaf)), null, farX);
  const barrierInfo = hasModel("barrierWall") ? ensure(instancer, { name: "barrierWall" }) : null; // the roadside barrier row
  const barriers = barrierInfo ? { key: barrierInfo.key, k: 8 / barrierInfo.w } : null;
  const instT = makeTracker(null, null, null, farX); // scenery drawn from real models through the instancer
  const decisions = new WeakMap();
  function decision(s) {
    let d = decisions.get(s);
    if (d === undefined) { const c = chooseModel(s); d = hasChoice(c) ? { c, info: ensure(instancer, c) } : null; decisions.set(s, d); }
    return d;
  }

  let scrollPrev = 0, scrollCur = 0;
  const marks = { start: null, finish: null }; // start gantry and finish arch: { obj, pz, cz }
  function trackMark(name, src, finish) {
    const m = marks[name];
    if (src && !m) marks[name] = { obj: acquire(finish ? "finish" : "start", () => M.makeGantry(finish, roadHalf())), pz: simZ(src.y), cz: simZ(src.y) };
    else if (src) { m.pz = m.cz; m.cz = simZ(src.y); }
    else if (m) { release(m.obj); marks[name] = null; }
  }

  function tick() {
    tickId++;
    racersT.tick(racers);
    enemiesT.tick(enemies);
    pickupsT.tick(pickups);
    const withModel = [], without = [];
    for (const s of scenery) (decision(s) ? withModel : without).push(s);
    instT.tick(withModel); sceneryT.tick(without);
    trackMark("start", startObj, false);
    trackMark("finish", finishObj, true);
    scrollPrev = scrollCur; scrollCur = scrollPos;
  }

  // ---------- sizing: match the 2D canvas, which fit() sizes to the window ----------
  let sizeKey = "";
  function resize() {
    const cw = canvas2d.clientWidth, ch = canvas2d.clientHeight; if (!cw || !ch) return;
    const pr = Math.min(window.devicePixelRatio || 1, 2), key = `${cw}x${ch}@${pr}`;
    if (key === sizeKey) return; sizeKey = key;
    renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
  }

  // ---------- per-frame ----------
  let last = performance.now(), time = 0, frozen = null;
  const camTarget = { x: 0, z: 0, v: 0, tilt: 0, nitro: false };
  const R = { active: true, renderer, scene, camera, rig, tick, racerScreen };

  const INSPECT = new URLSearchParams(location.search).get("inspect"); // ?inspect=side|front|top: a fixed close-up of your car, for checking models
  function modeNow() { return INSPECT ? "inspect" : RACE_STATES.has(state) ? MODES[cam] : "menu"; }

  function render(alpha) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    resize();
    const mode = modeNow();

    // the cars
    for (const [r, rec] of racersT.recs) {
      const o = rec.obj, x = lerp(rec.px, rec.cx, alpha), z = lerp(rec.pz, rec.cz, alpha), tilt = lerp(rec.pe, rec.ce, alpha);
      o.position.set(x, 0, z); o.rotation.y = -tilt;
      const ud = o.userData, spin = r.v * SCALE / 0.75 * dt * 60;
      for (const w of ud.wheels) w.rotation.x -= spin;
      for (const f of ud.front) f.rotation.y = -Math.max(-0.5, Math.min(0.5, tilt * 1.4));
      ud.brake.material.emissiveIntensity = r.braking ? 3 : 0.15;
      if (ud.rain) ud.rain.material.emissiveIntensity = rainI > 0.25 ? 2 + Math.sin(time * 9) * 1.5 : 0; // the flashing rain light
      if (ud.setCockpit) ud.setCockpit(mode === "cockpit" && r === racers[0]); else ud.helmet.visible = !(mode === "cockpit" && r === racers[0]);
      o.visible = r.ghost > 0 && r.ghost < 1000 ? (frame >> 1) % 2 === 0 : true; // flashes after a bump
      if (r.shield && !ud.bubble) { ud.bubble = M.makeShieldBubble(); o.add(ud.bubble); }
      if (ud.bubble) ud.bubble.visible = !!r.shield;
    }
    // traffic, pickups, scenery
    for (const [e, rec] of enemiesT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      if (o.userData.wheels) for (const w of o.userData.wheels) w.rotation.x -= speed * SCALE / 0.7 * dt * 60 * 0.3;
    }
    for (const [k, rec] of pickupsT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      o.rotation.y = time * 2.4 + (k.x || 0);
      if (k.type !== "coin") o.position.y = Math.sin(time * 3) * 0.25;
    }
    for (const [, rec] of sceneryT.recs) rec.obj.position.set(rec.cx, 0, lerp(rec.pz, rec.cz, alpha)); // scenery never moves sideways
    instancer.begin();
    for (const [s, rec] of instT.recs) { // model-based scenery: one matrix each, then the GPU draws every copy at once
      const { c, info } = decisions.get(s), k = c.height ? c.height / info.h : c.width / info.w;
      qTmp.setFromAxisAngle(yAxis, c.yaw || 0); pTmp.set(rec.cx, 0, lerp(rec.pz, rec.cz, alpha)); sTmp.setScalar(k);
      instancer.push(info.key, mTmp.compose(pTmp, qTmp, sTmp));
    }
    // low barriers along both edges of the road: a repeating row that streams past with the scroll (also instanced)
    if (barriers) {
      const seg = 8, off = (lerp(scrollPrev, scrollCur, alpha) * SCALE) % (seg * 2);
      for (let i = 0; i < 40; i++) for (const side of [-1, 1]) {
        const z = 60 - ((i * seg - off + seg * 40) % (seg * 40));
        qTmp.setFromAxisAngle(yAxis, Math.PI / 2); pTmp.set(side * (roadHalf() + 2.8), 0, z); sTmp.setScalar(barriers.k);
        instancer.push(barriers.key, mTmp.compose(pTmp, qTmp, sTmp));
      }
    }
    instancer.end();
    // everything leafy follows the city's colour, and the cars' lights come up at night
    const night = Math.min(1, pal.dark * 4);
    leafMat.color.setHex(arrToHex(pal.leaf)); leafDarkMat.color.setHex(arrToHex(pal.leaf.map(v => v * 0.72))); grassTopMat.color.setHex(arrToHex(pal.leaf.map(v => Math.min(255, v * 1.12))));
    M.lightMats.head.emissiveIntensity = 0.4 + 4 * night; M.lightMats.tail.emissiveIntensity = 0.8 + 2 * night;
    for (const name of ["start", "finish"]) {
      const m = marks[name]; if (!m) continue;
      m.obj.position.set(0, 0, lerp(m.pz, m.cz, alpha));
      if (name === "start") m.obj.userData.lights.forEach((mt, i) => {
        const green = grid.done, red = !green && i < grid.lit;
        mt.emissive.set(green ? 0x00ff40 : red ? 0xff1010 : 0x000000); mt.emissiveIntensity = green || red ? 3 : 0; mt.color.set(green ? 0x00aa30 : red ? 0xaa0000 : 0x220000);
      });
    }

    // what the camera follows: your car, interpolated (frozen where it was when you crash)
    const p0 = racers[0], rec0 = racersT.recs.get(p0);
    if (rec0 && p0.alive) {
      camTarget.x = lerp(rec0.px, rec0.cx, alpha); camTarget.z = lerp(rec0.pz, rec0.cz, alpha); camTarget.tilt = lerp(rec0.pe, rec0.ce, alpha);
      camTarget.v = p0.v; camTarget.nitro = p0.nitro > 0; frozen = null;
    } else if (rec0 && !frozen) frozen = { x: camTarget.x, z: camTarget.z, tilt: 0, v: 0, nitro: false };
    const target = frozen || camTarget;

    rig.update(mode, target, dt, { kick: kickFx, shake: settings.shake ? shake : 0, time, gear: gearOf(p0.v), lit: Math.round(rpmOf(effV(p0)) * 10) });
    world.update(pal, rainI, lerp(scrollPrev, scrollCur, alpha) * SCALE, { x: target.x, z: target.z, camPos: camera.position });

    // mirrors first (cockpit view only), without the cockpit in them
    if (mode === "cockpit") {
      rig.cockpit.visible = false;
      for (const m of rig.mirrors) { renderer.setRenderTarget(m.rt); renderer.render(scene, m.cam); }
      renderer.setRenderTarget(null); rig.cockpit.visible = true;
    }
    renderer.render(scene, camera);
  }
  R.render = render;

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
