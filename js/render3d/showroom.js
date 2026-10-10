// The Garage: a showroom with the car on a turntable set into a polished floor. It is its own little scene, built once (the first time it is
// needed, or while you sit on the main menu) and reused every time the Garage opens, drawn instead of the race.
//
//   room        a dark curved wall washed in the team's colour, two light bars, soft haze shafts, a reflective floor, a turntable ring
//   lighting    a studio reflection map (long strip-light highlights on the paint), a key light, team-coloured rim lights
//   camera      front three-quarter, a little above, long lens; its distance and shift are worked out so the car fills the free area between
//               the top bar and the panel (the 2D layer reports that area) and never goes under either
//   switching   lights dim, the turntable sinks, the car is swapped, it rises and the lights come back up in the new colour (< 0.7 s)
//   quality     Low: no reflection, no haze, no shadows. Medium: half-size reflection. High / Ultra: full reflection, haze, self-shadowing.
import * as THREE from "three";
import { createFloorMaterials, createReflection } from "./showfloor.js";
import { createConfetti, createShockRing, makeLock } from "./showfx.js";

const ROOM = 34, TABLE_R = 5.1, DROP = 2.8, AUTO = 0.3, WALL_Y = 8;
const TARGET = new THREE.Vector3(0, 0.85, 0), CAM_AZ = 36 * Math.PI / 180, CAM_EL = 10 * Math.PI / 180;
const CORNERS = []; for (const x of [-1.95, 1.95]) for (const y of [0, 2.1]) for (const z of [-4, 4]) CORNERS.push(new THREE.Vector3(x, y, z)); // the car's bounding box
const sizeV = new THREE.Vector2();
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// the wall: a grey-scale mask (dark panels, a broad glow, lit slats and a thin light strip) that is tinted with the team colour at run time
function wallTexture() {
  const W = 2048, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), img = g.createImageData(W, H), d = img.data, ss = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / 330, dy = (y - 360) / 190, glow = Math.exp(-(dx * dx + dy * dy)), slat = 0.5 + 0.5 * Math.cos(x / W * 6.2832 * 72), lit = 0.5 + 0.5 * ss(0.15, 0.85, slat);
    const strip = Math.exp(-(((y - 318) / 2.4) ** 2)) * Math.exp(-(((x - W / 2) / 360) ** 4));
    const v = 0.035 + 0.02 * ss(0.4, 0.6, slat) + 0.5 * glow * lit + 0.9 * strip + 0.1 * Math.exp(-(dx * dx) / 3) * ss(0.2, 1, y / H);
    const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * 255); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// a soft dark patch, for the contact shadows under the tyres and body
function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.45, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The light the paint reflects: bright strips overhead, soft boxes at the sides and front. Made once, then blurred into a reflection map.
function studioEnvironment(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x020203);
  const lamp = k => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(k), side: THREE.DoubleSide });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); s.add(b); };
  for (const x of [-6, 0, 6]) box(0.7, 0.1, 30, x, 12, 0, lamp(8));
  box(0.2, 8, 6, -14, 5, -2, lamp(4)); box(0.2, 8, 6, 14, 5, -2, lamp(4)); box(10, 6, 0.2, -4, 6, -16, lamp(2.5));
  box(70, 0.2, 70, 0, -0.1, 0, lamp(0.03)); box(70, 30, 0.2, 0, 10, 24, lamp(0.05)); box(70, 0.2, 70, 0, 24, 0, lamp(0.02));
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.03).texture; pm.dispose(); return tex;
}

export function createShowroom({ renderer, makeCar }) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 200);
  scene.background = new THREE.Color(0x020306); scene.environment = studioEnvironment(renderer);
  const accent = new THREE.Color("#ffb21a"), accentTo = new THREE.Color("#ffb21a"), white = new THREE.Color(1, 1, 1);
  const floorM = createFloorMaterials(), refl = createReflection(renderer, floorM.shared);

  // ---- the room ----
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTexture(), side: THREE.BackSide, fog: false, color: accent.clone() });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM, ROOM, 26, 96, 1, true), wallMat); wall.position.y = WALL_Y; wall.rotation.y = CAM_AZ - Math.PI; scene.add(wall); // (the glow is straight behind the car, seen from the camera)
  const barMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false });
  for (const k of [-1, 1]) { const a = CAM_AZ + k * 0.5, b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), barMat); b.position.set(Math.sin(a) * (ROOM - 3), 4, Math.cos(a) * (ROOM - 3)); scene.add(b); }
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(TABLE_R + 0.15, 70, 96, 1).rotateX(-Math.PI / 2), floorM.floor); floorRing.position.y = -0.01; scene.add(floorRing);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R + 0.15, TABLE_R + 0.15, 7, 64), new THREE.MeshBasicMaterial({ color: 0x010102, side: THREE.BackSide })); well.position.y = -3.5; scene.add(well);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R + 0.06, 0.1, 12, 120).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x252830, metalness: 1, roughness: 0.22 })); scene.add(bezel);
  const ledMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false });
  const led = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R - 0.08, 0.045, 8, 120).rotateX(Math.PI / 2), ledMat); led.position.y = 0.03; scene.add(led);
  const floorLines = [9.2, 13.5].map((r, i) => { const m = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false }), l = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 128).rotateX(-Math.PI / 2), m); l.position.y = 0.005; scene.add(l); return { m, k: i ? 0.5 : 1 }; });
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(0.8, 0.88, 1) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT; void main() { vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); vT = position.y / 12.0 + 0.5; gl_Position = projectionMatrix * m; }`,
    fragmentShader: `uniform float uI; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vT; void main() { float e = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0); gl_FragColor = vec4(uCol * uI * e * (0.15 + 0.85 * vT), 1.0); }`,
  });
  const hazeGeo = new THREE.CylinderGeometry(0.6, 3.6, 12, 24, 1, true), shafts = new THREE.Group(); scene.add(shafts);
  for (const [x, z] of [[-9, 6], [9, 6], [0, 13]]) { const m = new THREE.Mesh(hazeGeo, hazeMat); m.position.set(x, 6, z); m.frustumCulled = false; shafts.add(m); }

  // ---- the turntable: a disc (with a body that can sink into the well), contact shadows and the car ----
  const table = new THREE.Group(); scene.add(table);
  const discTop = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R, 96).rotateX(-Math.PI / 2), floorM.table); discTop.position.y = -0.004; table.add(discTop);
  const discBody = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - 0.1, DROP + 0.6, 64), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.9, roughness: 0.35 })); discBody.position.y = -(DROP + 0.6) / 2 - 0.008; table.add(discBody);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [x, z, w, l] of [[0, -0.1, 3.8, 9.6], [-1.35, -2.6, 1.7, 2.3], [1.35, -2.6, 1.7, 2.3], [-1.35, 2.4, 1.9, 2.6], [1.35, 2.4, 1.9, 2.6]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), blobMat); b.position.set(x, 0.02, z); b.renderOrder = 1; table.add(b); }
  const holder = new THREE.Group(); table.add(holder);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0x9fb0d8, 0x05060a, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(-9, 15, -11); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 5, far: 40 }); scene.add(key);
  const spot = (x, y, z, ang) => { const s = new THREE.SpotLight(0xffffff, 0, 80, ang, 0.9, 1.3); s.position.set(x, y, z); s.target.position.set(0, 1, 0); scene.add(s, s.target); return s; };
  const rimA = spot(-13, 11, 12, 0.6), rimB = spot(13, 10, 11, 0.6), top = spot(0, 16, -2, 0.5);
  const fill = new THREE.PointLight(0xaec4ff, 0, 40, 1.5); fill.position.set(11, 5, -17); scene.add(fill);
  const flashLight = new THREE.PointLight(0xffffff, 0, 30, 1.5); flashLight.position.set(0, 6, -5); scene.add(flashLight);

  // ---- effects ----
  const confetti = createConfetti(scene), ring = createShockRing(scene), lock = makeLock(); lock.visible = false; lock.position.set(0, 1.7, 0); scene.add(lock);
  const silhouette = new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.9, metalness: 0, envMapIntensity: 0.06 });

  // ---- cars: one per team, built the first time it is shown, kept for good ----
  const cars = new Map(); let shown = -1, want = -1, wantTeam = null;
  function carOf(i, team) {
    let e = cars.get(i);
    if (!e) { const obj = makeCar(team), mats = new Map(); obj.traverse(o => { if (o.isMesh) mats.set(o, o.material); }); e = { obj, mats, locked: false, shadows: null }; cars.set(i, e); }
    return e;
  }
  function setLocked(e, locked) { // a locked car is a black silhouette (the decals and stickers are hidden, the contact shadow stays)
    if (e.locked === locked) return; e.locked = locked;
    for (const [m, orig] of e.mats) { if (m.renderOrder === 1) continue; if (orig.transparent) m.visible = !locked; else m.material = locked ? silhouette : orig; }
  }
  function setCarShadows(e, on) { if (e.shadows === on) return; e.shadows = on; for (const m of e.mats.keys()) if (m.renderOrder !== 1 && !e.mats.get(m).transparent) { m.castShadow = on; m.receiveShadow = on; } }

  // ---- state ----
  let cw = 1280, ch = 720, layout = { top: 0.1, bottom: 0.7 }, dirty = true, dist = 18, info = null;
  let lvl = "high", shadowSize = 2048, t = 0, dip = 1, spinY = 0, vel = AUTO, idle = 99, dragging = false, velEst = 0, flashT = 0, lockS = 0, L = 1;
  const hide = [floorRing, discTop, discBody, well, lock]; // (not drawn in the mirror image)

  // The projected size of the car over a full turn, with the camera `d` away: { w, h } as fractions of the screen, cy = vertical centre (NDC)
  function measure(d) {
    camPlace(d, 0, 0);
    let w = 0, h = 0, cy = 0, n = 0, x0 = 9, x1 = -9, y0 = 9, y1 = -9; const v = new THREE.Vector3();
    for (let a = 0; a < Math.PI; a += Math.PI / 24) {
      let ax = 9, bx = -9, ay = 9, by = -9; const c = Math.cos(a), s = Math.sin(a);
      for (const p of CORNERS) { v.set(p.x * c + p.z * s, p.y, -p.x * s + p.z * c).project(camera); ax = Math.min(ax, v.x); bx = Math.max(bx, v.x); ay = Math.min(ay, v.y); by = Math.max(by, v.y); }
      w = Math.max(w, (bx - ax) / 2); h = Math.max(h, (by - ay) / 2); cy += (ay + by) / 2; n++; x0 = Math.min(x0, ax); x1 = Math.max(x1, bx); y0 = Math.min(y0, ay); y1 = Math.max(y1, by);
    }
    return { w, h, cy: cy / n, x0, x1, y0, y1 };
  }
  function camPlace(d, dAz, dEl) {
    const az = CAM_AZ + dAz, el = CAM_EL + dEl;
    camera.position.set(TARGET.x - Math.sin(az) * Math.cos(el) * d, TARGET.y + Math.sin(el) * d, TARGET.z - Math.cos(az) * Math.cos(el) * d); camera.lookAt(TARGET); camera.updateMatrixWorld();
  }
  // choose the camera distance so the car fills `maxW` of the width (at its widest point of the turn) and fits the free height, then shift the picture
  // so the car is centred in that free area
  function fit() {
    dirty = false; const aspect = cw / ch, portrait = aspect < 0.9;
    camera.aspect = aspect; camera.fov = portrait ? 32 : 26; camera.updateProjectionMatrix();
    const maxW = portrait ? 0.9 : aspect < 1.25 ? 0.8 : 0.66, freeH = Math.max(0.15, layout.bottom - layout.top);
    let lo = 6, hi = 90;
    for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2, r = measure(mid); if (r.w > maxW || r.h > freeH * 0.88) lo = mid; else hi = mid; }
    dist = hi; const r = measure(dist), shift = (1 - (layout.top + layout.bottom)) - r.cy;
    camera.projectionMatrix.elements[9] = -shift; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    info = { dist, width: r.w, height: r.h, shift, left: (r.x0 + 1) / 2, right: (r.x1 + 1) / 2, top: (1 - (r.y1 + shift)) / 2, bottom: (1 - (r.y0 + shift)) / 2 }; // (the car's outline over a full turn, as fractions of the screen)
  }

  function setQuality(Q) {
    const sh = Q.shadows > 0 && Q.level !== "low" ? Math.min(Q.shadows, 2048) : 0;
    if (Q.level === lvl && sh === shadowSize) return;
    lvl = Q.level; shadowSize = sh; key.castShadow = sh > 0;
    if (sh > 0 && key.shadow.mapSize.x !== sh) { key.shadow.mapSize.set(sh, sh); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; }); // (shadows on / off change the shaders)
  }

  const api = {
    scene, camera, get info() { return info; }, get dist() { return dist; },
    debug: () => ({ dip, L, lvl, shown, want, spinY, shadowSize, refl: floorM.shared.uRefl.value, fade: floorM.shared.uFade.value, dist, info }),
    setQuality,
    resize(w, h) { if (w !== cw || h !== ch) { cw = w; ch = h; dirty = true; } },
    setLayout(l) { if (l && (Math.abs(l.top - layout.top) > 0.002 || Math.abs(l.bottom - layout.bottom) > 0.002)) { layout = { top: l.top, bottom: l.bottom }; dirty = true; } },
    spin(a) { spinY = a; vel = 0; idle = 0; },
    enter() { dip = 1; idle = 99; vel = AUTO; spinY = 0; }, // opening the Garage: the lights come up on a car that rises out of the floor
    grab() { dragging = true; idle = 0; vel = 0; velEst = 0; },
    drag(dx, dt) { spinY += dx * 0.011; velEst = lerp(velEst, dx * 0.011 / Math.max(dt, 1 / 120), 0.35); idle = 0; },
    release() { dragging = false; vel = Math.max(-7, Math.min(7, velEst)); idle = 0; },
    buy(team, big = true) { // the flash, shock ring and (for a car) confetti in the team's colours
      ring.fire(accentTo); flashT = 1; if (big) confetti.burst([team.p, team.s, team.a, teamAccent(team), "#ffffff", "#ffd23f"]);
    },
    warm(i, team) { const e = carOf(i, team); setCarShadows(e, shadowSize > 0); holder.add(e.obj); renderer.compile(scene, camera); holder.remove(e.obj); }, // (compile the shaders before the first time it is on screen)
    // call once per frame: v = { idx, team, locked, spinIn (right stick, -1..1) }
    update(dt, v) {
      t += dt;
      if (v.idx !== want || v.team !== wantTeam) { want = v.idx; wantTeam = v.team; }
      if (shown < 0 || (dip >= 1 && want !== shown)) { // the lights are down: swap the car and take the new colour
        if (shown >= 0 && cars.has(shown)) holder.remove(cars.get(shown).obj);
        const e = carOf(want, wantTeam); holder.add(e.obj); shown = want; accentTo.set(teamAccent(wantTeam));
      } else if (want !== shown) dip = Math.min(1, dip + dt / 0.26);
      else dip = Math.max(0, dip - dt / 0.34);
      const e = cars.get(shown); setLocked(e, !!v.locked); setCarShadows(e, shadowSize > 0);
      const ed = smooth(dip); L = 1 - 0.9 * ed;
      accent.lerp(accentTo, 1 - Math.exp(-dt * 14));

      // spin: drag / right stick / coast to a stop, then ease back to the slow automatic turn
      if (dragging) idle = 0;
      else if (Math.abs(v.spinIn || 0) > 0.12) { vel = v.spinIn * 3.2; idle = 0; spinY += vel * dt; }
      else { idle += dt; if (idle < 3) vel *= Math.exp(-dt * 2.2); else vel += (AUTO - vel) * (1 - Math.exp(-dt * 1.4)); spinY += vel * dt; }
      table.rotation.y = spinY; table.position.y = -DROP * ed;

      // lights, wall, rings: everything follows the team colour and the dim of the switch
      const lit = 0.12 + 0.88 * L;
      wallMat.color.copy(accent).multiplyScalar(0.85 * lit); barMat.color.copy(accent).lerp(white, 0.3).multiplyScalar(1.7 * lit);
      ledMat.color.copy(accent).lerp(white, 0.15).multiplyScalar(1.7 * (0.5 + 0.5 * L) + flashT * 4);
      for (const f of floorLines) f.m.color.copy(accent).multiplyScalar(0.7 * f.k * lit);
      floorM.shared.accent.value.copy(accent); floorM.shared.uGlow.value = L; floorM.shared.uFade.value = 1 - smooth(dip * 3);
      scene.environmentIntensity = 0.7 * (0.15 + 0.85 * L);
      hemi.intensity = 0.3 * L; key.intensity = 1.5 * L; top.intensity = 70 * L; fill.intensity = 40 * L;
      rimA.intensity = rimB.intensity = 200 * L; rimA.color.copy(accent).lerp(white, 0.12); rimB.color.copy(accent).lerp(white, 0.35);
      flashT = Math.max(0, flashT - dt * 2.2); flashLight.intensity = flashT * flashT * 900;
      shafts.visible = lvl !== "low"; hazeMat.uniforms.uI.value = 0.12 * L;
      const hz = hazeMat.uniforms.uCol.value; hz.copy(accent).lerp(white, 0.75);

      // the padlock on a locked car
      lockS += ((v.locked && dip < 0.6 ? 1 : 0) - lockS) * (1 - Math.exp(-dt * 12)); lock.visible = lockS > 0.02;
      if (lock.visible) { lock.scale.setScalar(0.6 * lockS * (1 + 0.04 * Math.sin(t * 2.4))); lock.rotation.y = Math.atan2(camera.position.x - lock.position.x, camera.position.z - lock.position.z); for (const m of lock.userData.mats) m.opacity = Math.min(1, lockS); }
      confetti.update(dt); ring.update(dt);

      // the camera: a slow sway around the three-quarter view
      if (dirty) fit();
      camPlace(dist, Math.sin(t * 0.25) * 0.035, Math.sin(t * 0.37) * 0.012);
    },
    // the mirror image for the floor (not on Low)
    beforeRender() {
      const on = lvl !== "low"; floorM.shared.uRefl.value = on ? 1 : 0; if (!on) return;
      const s = lvl === "medium" ? 0.5 : lvl === "high" ? 0.75 : 1, size = renderer.getDrawingBufferSize(sizeV);
      refl.setSize(Math.min(1600, size.x * s), Math.min(1600, size.x * s) * size.y / size.x);
      refl.render(scene, camera, hide);
    },
  };
  return api;
}
