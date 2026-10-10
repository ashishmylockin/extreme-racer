// Effects: glowing sparks, fire, smoke, flying debris (real car parts), nitro flames, light trails, fireworks.
// Particles live in two fixed-size pools (additive: sparks / fire / flames; normal: smoke), recycled forever, so nothing is created while racing.
import * as THREE from "three";


function pointSystem(scene, cap, blending) {
  const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 4), size = new Float32Array(cap);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending, fog: false,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute vec4 aColor; attribute float aSize; uniform float scale; varying vec4 vC;
      void main() { vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, d)); a *= a; if (a * vC.a < 0.01) discard; gl_FragColor = vec4(vC.rgb, a * vC.a); }`,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);
  // per-particle simulation state (kept beside the GPU arrays)
  const P = { vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap), life: new Float32Array(cap), max: new Float32Array(cap), s0: new Float32Array(cap), grow: new Float32Array(cap), drag: new Float32Array(cap), grav: new Float32Array(cap), r: new Float32Array(cap), g: new Float32Array(cap), b: new Float32Array(cap), a: new Float32Array(cap) };
  let next = 0;
  return {
    points, mat, cap,
    clear() { for (let i = 0; i < cap; i++) { P.life[i] = 0; size[i] = 0; col[i * 4 + 3] = 0; } geo.attributes.aSize.needsUpdate = geo.attributes.aColor.needsUpdate = true; },
    emit(x, y, z, vx, vy, vz, life, s, r, g, b, a = 1, grow = 0, drag = 0.97, grav = 0) {
      const i = next; next = (next + 1) % cap;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.life[i] = P.max[i] = life; P.s0[i] = s; P.grow[i] = grow; P.drag[i] = drag; P.grav[i] = grav;
      P.r[i] = r; P.g[i] = g; P.b[i] = b; P.a[i] = a; size[i] = s; col.set([r, g, b, a], i * 4);
    },
    update(dt, shiftZ) { // shiftZ: how far the road moved towards the camera this frame (things left on the road slide back with it)
      const k = dt * 60;
      for (let i = 0; i < cap; i++) {
        if (P.life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; } continue; }
        P.life[i] -= dt; const t = Math.max(0, P.life[i] / P.max[i]);
        P.vy[i] -= P.grav[i] * dt; const d = Math.pow(P.drag[i], k);
        pos[i * 3] += P.vx[i] * dt; pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + P.vy[i] * dt); pos[i * 3 + 2] += P.vz[i] * dt + shiftZ;
        P.vx[i] *= d; P.vy[i] *= d; P.vz[i] *= d;
        size[i] = P.s0[i] * (1 + P.grow[i] * (1 - t)); col[i * 4 + 3] = P.a[i] * t;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aColor.needsUpdate = geo.attributes.aSize.needsUpdate = true;
    },
  };
}

let K = 1; const n = c => Math.max(1, Math.round(c * K)); // K = particle density from the graphics settings
const rnd = (a, b) => a + Math.random() * (b - a);
const hexRgb = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

// ---- light trails: a ribbon that streams behind a point on a car ----
class Trail {
  constructor(scene, n = 16, width = 0.1) {
    this.n = n; this.w = width; this.pts = Array.from({ length: n }, () => new THREE.Vector3(0, -50, 0)); this.fade = 0;
    const g = this.geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 4), idx = [];
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
  }
  clear() { for (const p of this.pts) p.set(0, -50, 0); this.fade = 0; this.mesh.visible = false; }
  // add a new head point, slide the old ones back with the road, redraw. rgb in 0..1; amount 0..1 fades the whole ribbon in or out
  step(x, y, z, shiftZ, rgb, amount) {
    this.fade += (amount - this.fade) * (amount > this.fade ? 0.25 : 0.4); // (quick to go once the nitro is spent)
    for (const p of this.pts) p.z += shiftZ;
    const head = this.pts.pop(); head.set(x, y, z); this.pts.unshift(head); // the oldest point is reused as the new head
    this.mesh.visible = this.fade > 0.02; if (!this.mesh.visible) return;
    const pos = this.geo.attributes.position.array, col = this.geo.attributes.color.array;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i], k = 1 - i / (this.n - 1), f = k * k * this.fade; // (bright at the car, gone within a few metres)
      pos.set([p.x, p.y + this.w, p.z, p.x, p.y - this.w, p.z], i * 6);
      col.set([rgb[0], rgb[1], rgb[2], f * 0.9, rgb[0], rgb[1], rgb[2], f * 0.9], i * 8);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.color.needsUpdate = true;
  }
}

export function createFX(scene, makeWheelDebris) {
  const add = pointSystem(scene, 1800, THREE.AdditiveBlending), smoke = pointSystem(scene, 500, THREE.NormalBlending);

  // ---- debris: shards of the wrecked car (bodywork in the team's colour, carbon, bare metal) that fly off in a crash and bounce along the road ----
  const pieces = [], wheelPieces = []; let wheelAt = 0;
  const shardMats = [new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2 }), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x9096a0, roughness: 0.4, metalness: 0.8 })];
  const shardGeos = [new THREE.BoxGeometry(1.1, 0.12, 0.7), new THREE.BoxGeometry(0.7, 0.1, 0.45), new THREE.BoxGeometry(1.5, 0.1, 0.35), new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6).rotateZ(Math.PI / 2), new THREE.BoxGeometry(0.5, 0.35, 0.5)];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(shardGeos[i % shardGeos.length], shardMats[i % 4]); m.visible = false; m.castShadow = true; scene.add(m);
    pieces.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, mat: i % 4 });
  }
  if (makeWheelDebris) for (let i = 0; i < 4; i++) { const m = makeWheelDebris(); m.visible = false; scene.add(m); wheelPieces.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, wheel: true }); }
  let pi = 0;

  // ---- nitro flame (a flickering blue cone), made per car by makeFlame() ----
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, k: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vT; void main() { vUv = uv; vT = uv.y; vec3 p = position; float w = 1.0 + 0.2 * sin(p.y * 9.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float time, k; varying vec2 vUv; varying float vT;
      void main() { float flick = 0.75 + 0.25 * sin(time * 60.0 + vUv.x * 12.0); float core = pow(clamp(1.0 - vT, 0.0001, 1.0), 1.8); /* (vT can round to just over 1.0 at the tip: pow of a negative number is NaN, and one NaN pixel turns the whole screen black through the bloom) */
        vec3 c = mix(vec3(0.15, 0.4, 1.0), vec3(0.85, 0.95, 1.0), core * 0.9); gl_FragColor = vec4(c * (0.6 + core) * flick, (1.0 - vT) * 0.9 * k); }`,
  });
  const flameGeo = new THREE.ConeGeometry(0.42, 5.5, 12, 1, true).translate(0, 2.75, 0).rotateX(Math.PI / 2); // base at the car, tip trailing behind (+Z)
  const makeFlame = () => { const g = new THREE.Group(); for (const x of [-0.5, 0.5]) { const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(x, 1.15, 3.3); f.frustumCulled = false; g.add(f); } g.visible = false; return g; };

  const trails = new Map(); // per car: { l: Trail, r: Trail }

  return {
    add, smoke, makeFlame, flameMat, Trail,
    setDensity(k) { K = k; },
    trailsFor(key) { let t = trails.get(key); if (!t) trails.set(key, t = { l: new Trail(scene), r: new Trail(scene) }); return t; },
    update(dt, shiftZ, scale) {
      add.mat.uniforms.scale.value = scale; smoke.mat.uniforms.scale.value = scale;
      add.update(dt, shiftZ); smoke.update(dt, shiftZ);
      for (const p of wheelPieces) { // a wheel that has torn off: it bounces, then rolls along on its edge, slowing
        if (p.life <= 0) continue; p.life -= dt; p.v.y -= 38 * dt; p.m.position.addScaledVector(p.v, dt); p.m.position.z += shiftZ;
        if (p.m.position.y < 0.78) { p.m.position.y = 0.78; if (p.v.y < -1) p.v.y = -p.v.y * 0.4; else p.v.y = 0; const k = Math.pow(0.55, dt * 3); p.v.x *= k; p.v.z *= k; }
        const sp = Math.hypot(p.v.x, p.v.z); p.m.rotation.x -= p.v.z * dt / 0.78 * -1; p.m.rotation.z += 0; if (sp < 0.3 && p.m.position.y <= 0.8) p.life = Math.min(p.life, 8); // (it keeps lying there, then goes)
        if (p.life <= 0) p.m.visible = false;
      }
      for (const p of pieces) {
        if (p.life <= 0) continue; p.life -= dt;
        p.v.y -= 38 * dt; p.m.position.addScaledVector(p.v, dt); p.m.position.z += shiftZ;
        p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
        if (p.m.position.y < 0.25) { p.m.position.y = 0.25; p.v.y = Math.abs(p.v.y) * 0.35; p.v.x *= 0.7; p.v.z *= 0.7; p.w.multiplyScalar(0.7); }
        if (p.life <= 0) p.m.visible = false;
      }
    },
    // ---- one-off events ----
    // A crash at speed: the fireball, sparks and smoke all carry the car's momentum (fwd = its forward speed in world units per second, negative = up the road),
    // so everything streams on past the point of impact instead of bursting in place. Wheels and bodywork tear off and bounce away.
    crash(x, z, team, fwd = 0) {
      const c1 = [1, 0.85, 0.4], c2 = [1, 0.45, 0.1], w = [1, 1, 1];
      for (let i = 0; i < n(60); i++) { const a = rnd(0, 6.28), s = rnd(1, 9); add.emit(x, rnd(0.6, 2.2), z, Math.cos(a) * s, rnd(1, 9), Math.sin(a) * s + fwd * 0.55, rnd(0.5, 1.2), rnd(2.0, 4.8), ...(Math.random() < 0.5 ? c1 : c2), 0.9, 1.2, 0.93, 6); } // the fireball
      for (let i = 0; i < n(80); i++) { const a = rnd(0, 6.28), s = rnd(4, 20); add.emit(x, rnd(0.5, 1.6), z, Math.cos(a) * s, rnd(2, 14), Math.sin(a) * s + fwd * 0.8, rnd(0.5, 1.4), rnd(0.4, 0.9), ...w, 1, 0, 0.985, 28); } // sparks
      for (let i = 0; i < n(30); i++) { const a = rnd(0, 6.28), s = rnd(0.4, 3.5), g = rnd(0.12, 0.28); smoke.emit(x, rnd(0.5, 2), z, Math.cos(a) * s, rnd(1, 4), Math.sin(a) * s + fwd * 0.35, rnd(2.5, 4.5), rnd(4, 8), g, g, g * 1.05, 0.7, 1.4, 0.97, -1.5); } // smoke
      const body = hexRgb(team.p);
      for (let i = 0; i < n(14); i++) { const a = rnd(0, 6.28), s = rnd(2, 9); add.emit(x, 1.5, z, Math.cos(a) * s, rnd(3, 10), Math.sin(a) * s + fwd * 0.7, rnd(0.8, 1.5), rnd(0.4, 0.8), ...body, 1, 0, 0.98, 25); }
      shardMats[0].color.set(team.p); shardMats[1].color.set(team.a); // (the bodywork shards wear the team colours)
      for (let q = 0; q < n(14) && pieces.length; q++) { const p = pieces[pi++ % pieces.length]; p.life = 9; p.m.visible = true; p.m.position.set(x + rnd(-1, 1), rnd(0.8, 2.0), z + rnd(-1.5, 1.5)); const a = rnd(0, 6.28), s = rnd(3, 11); p.v.set(Math.cos(a) * s, rnd(5, 13), Math.sin(a) * s + fwd * 0.9); p.w.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)); }
      for (let q = 0; q < Math.min(2, wheelPieces.length); q++) { // two wheels break off and roll away
        const p = wheelPieces[wheelAt++ % wheelPieces.length], a = (q ? 1 : -1) * rnd(0.3, 1.1);
        p.life = 14; p.m.visible = true; p.m.position.set(x + (q ? 1.6 : -1.6), 0.8, z + rnd(-1, 1)); p.m.rotation.set(0, 0, 0); p.v.set(Math.sin(a) * rnd(3, 9), rnd(2, 6), fwd * rnd(0.55, 0.9) + rnd(-3, 3)); p.w.set(0, 0, 0);
      }
    },
    // clean slate for a new race: no debris, particles or trails left over from the last one
    reset() {
      for (const p of pieces) { p.life = 0; p.m.visible = false; p.v.set(0, 0, 0); }
      for (const p of wheelPieces) { p.life = 0; p.m.visible = false; p.v.set(0, 0, 0); }
      for (const sys of [add, smoke]) sys.clear();
      for (const t of trails.values()) t.l.clear(), t.r.clear();
    },
    fire(x, z) { // a wreck keeps burning and smoking
      add.emit(x + rnd(-1, 1), rnd(0.5, 1.5), z + rnd(-1.5, 1.5), rnd(-0.6, 0.6), rnd(3, 6), rnd(-0.6, 0.6), rnd(0.4, 0.8), rnd(1.4, 2.6), 1, rnd(0.4, 0.75), 0.12, 0.8, 0.5, 0.98);
      if (Math.random() < 0.5) smoke.emit(x + rnd(-1, 1), rnd(1, 2), z + rnd(-1, 1), rnd(-0.4, 0.4), rnd(3, 6), rnd(-0.4, 0.4), rnd(2, 3.5), rnd(2.5, 4), 0.1, 0.1, 0.11, 0.6, 1.6, 0.985);
    },
    shield(x, z) { for (let i = 0; i < n(60); i++) { const a = rnd(0, 6.28), s = rnd(5, 20); add.emit(x, rnd(0.8, 2.6), z, Math.cos(a) * s, rnd(0, 8), Math.sin(a) * s, rnd(0.4, 0.9), rnd(0.5, 1.4), 0.4, 0.9, 1, 1, 0.4, 0.96); } },
    pickup(x, z, type) {
      const c = type === "coin" ? [1, 0.82, 0.25] : type === "nitro" ? [0.3, 0.65, 1] : [0.4, 0.95, 1];
      for (let i = 0; i < n(18); i++) { const a = rnd(0, 6.28), s = rnd(2, 8); add.emit(x, 1.6, z, Math.cos(a) * s, rnd(1, 8), Math.sin(a) * s, rnd(0.3, 0.7), rnd(0.35, 0.8), ...c, 1, 0, 0.95, 14); }
    },
    nitroStart(x, z) { for (let i = 0; i < n(40); i++) add.emit(x + rnd(-1.5, 1.5), rnd(0.8, 1.6), z + 3.5, rnd(-3, 3), rnd(-0.5, 2), rnd(6, 24), rnd(0.3, 0.7), rnd(0.8, 1.6), 0.35, 0.6, 1, 0.9, 1, 0.95); },
    nearMiss(x, z) { for (let i = 0; i < n(14); i++) add.emit(x + rnd(-2, 2), rnd(0.8, 1.8), z + rnd(-2, 2), rnd(-2, 2), rnd(-1, 1), rnd(10, 30), rnd(0.2, 0.45), rnd(0.25, 0.5), 0.8, 1, 0.95, 0.9, 0, 0.97); },
    tyreSmoke(x, z, col, a = 0.45) { for (const sx of [-1.7, 1.7]) smoke.emit(x + sx + rnd(-0.3, 0.3), 0.5, z + 3, rnd(-0.6, 0.6), rnd(0.2, 1.2), rnd(0, 2), rnd(0.5, 1), rnd(1.4, 2.4), col[0], col[1], col[2], a, 1.6, 0.96); },
    firework(x, y, z, cols) {
      const rgb = cols.map(hexRgb);
      for (let i = 0; i < n(90); i++) { const th = rnd(0, 6.28), ph = Math.acos(rnd(-1, 1)), s = rnd(10, 24), c = rgb[i % rgb.length]; add.emit(x, y, z, Math.sin(ph) * Math.cos(th) * s, Math.cos(ph) * s, Math.sin(ph) * Math.sin(th) * s, rnd(1.2, 2.2), rnd(1.2, 2.2), c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 1, 0, 0.955, 10); }
    },
    confetti(x, y, z, cols) {
      const rgb = cols.map(hexRgb);
      for (let i = 0; i < n(40); i++) { const c = rgb[i % rgb.length]; smoke.emit(x + rnd(-14, 14), y + rnd(0, 6), z + rnd(-10, 10), rnd(-2, 2), rnd(-2, 3), rnd(-2, 2), rnd(3, 5), rnd(0.5, 0.9), c[0], c[1], c[2], 1, 0, 0.99, 4); }
    },
  };
}
