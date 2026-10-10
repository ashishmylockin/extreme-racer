// Low-poly stylised landmarks, built from simple shapes. They only need to be recognisable silhouettes on the skyline.
// Each builder gets `h` = half the width the landmark may occupy, in world units, and returns a Group standing on the ground at the
// origin. Glowing parts use shared materials (registered in `glows`) so the renderer can light them up at night.
import * as THREE from "three";

const cache = new Map();
// every landmark surface is floodlit at night: it glows softly in its own colour, so the landmarks read against the dark sky (see tickLandmarks)
const floods = [];
const m = (hex, o = {}) => { const k = hex + JSON.stringify(o); let v = cache.get(k); if (!v) { cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, metalness: 0.05, emissive: hex, emissiveIntensity: 0, ...o })); floods.push(v); } return v; };
export const glows = []; // [{ mat, base, nightOnly }]: emissive materials, intensity driven by how dark it is (nightOnly: dark by day)
const glow = (hex, base = 1.5) => { const k = "g" + hex; let v = cache.get(k); if (!v) { cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.2, roughness: 0.5 })); glows.push({ mat: v, base }); } return v; };
// a material that looks like `hex` by day and glows `glowHex` only at night (the Flame Towers' LED flames, the Yas hotel's lit canopy)
const nightGlow = (key, hex, glowHex, base, o = {}) => { let v = cache.get(key); if (!v) { cache.set(key, v = new THREE.MeshStandardMaterial({ color: hex, emissive: glowHex, emissiveIntensity: 0, roughness: 0.4, ...o })); glows.push({ mat: v, base, nightOnly: true }); } return v; };

// ---- the Las Vegas Sphere: an LED screen that cycles through shows (a colour swirl, a giant eye, pulsing rings), drawn as a grid of LED dots ----
const sphereU = { uTime: { value: 0 }, uBright: { value: 1.3 } };
let sphereMat = null;
function makeSphereMat() {
  if (sphereMat) return sphereMat;
  sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sphereMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, sphereU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vLed;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvLed = uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec2 vLed; uniform float uTime, uBright;
      vec3 hsv(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      vec3 show(float m, vec2 c, float t) {
        if (m < 0.5) return hsv(fract(c.x * 2.0 + c.y * 1.3 + t * 0.08)) * (0.7 + 0.3 * sin(c.y * 40.0 - t * 3.0));       // colour swirl
        if (m < 1.5) { // a giant eye (four round the sphere, so one always looks at you)
          vec2 e = vec2((fract(c.x * 4.0) - 0.5) * 2.2, (c.y - 0.52) * 3.2); float r = length(e), look = sin(t * 0.7) * 0.12;
          vec3 col = vec3(0.05, 0.03, 0.03);
          col = mix(col, vec3(0.95, 0.92, 0.9) - vec3(0.0, 0.25, 0.25) * smoothstep(0.55, 0.9, r), step(r, 0.9));          // the white, pinker at the rim
          float ri = length(e - vec2(look, 0.0)); col = mix(col, vec3(0.15, 0.45, 0.95) * (0.6 + 0.4 * smoothstep(0.0, 0.38, ri)), step(ri, 0.38)); // iris
          col = mix(col, vec3(0.0), step(ri, 0.16)); return col;
        }
        float rr = length(vec2(c.x - 0.5, (c.y - 0.5) * 0.5)) * 6.0; return mix(vec3(0.6, 0.1, 1.0), vec3(0.1, 0.9, 1.0), 0.5 + 0.5 * sin(rr * 6.0 - t * 4.0)) * (0.6 + 0.4 * sin(rr * 6.0 - t * 4.0)); // pulsing rings
      }`).replace("#include <map_fragment>", `#include <map_fragment>
      { vec2 g = vLed * vec2(180.0, 90.0), f = fract(g) - 0.5, c = (floor(g) + 0.5) / vec2(180.0, 90.0);
        float dotLit = smoothstep(0.5, 0.25, length(f)), far = clamp(max(fwidth(g.x), fwidth(g.y)) * 1.6 - 0.4, 0.0, 1.0);
        dotLit = mix(dotLit, 0.45, far); // far away the dots blur into their average (no shimmer)
        float t = uTime, m = mod(floor(t / 8.0), 3.0), k = fract(t / 8.0);
        vec3 col = mix(show(m, c, t), show(mod(m + 1.0, 3.0), c, t), smoothstep(0.88, 1.0, k));
        diffuseColor.rgb = col * dotLit * uBright; }`);
  };
  sphereMat.customProgramCacheKey = () => "vegas-sphere";
  return sphereMat;
}
// call every frame: time in seconds, night 0..1
export function tickLandmarks(time, night) {
  sphereU.uTime.value = time; sphereU.uBright.value = 1.4 + 1.0 * night;
  const f = 0.22 * night; for (const v of floods) v.emissiveIntensity = f; // floodlights (a hundred or so materials: cheap)
}

// the Yas hotel's gridshell: a lattice of diamond panels (cut out of a texture), lit in colour at night
let latticeTex = null;
function lattice() {
  if (latticeTex) return latticeTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.strokeStyle = "#fff"; g.lineWidth = 16; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke(); // an X per tile: tiled, a diamond lattice
  latticeTex = new THREE.CanvasTexture(c); latticeTex.wrapS = latticeTex.wrapT = THREE.RepeatWrapping; latticeTex.anisotropy = 4; latticeTex.colorSpace = THREE.SRGBColorSpace;
  return latticeTex;
}
// a flame outline (in x/y, base on y = 0), extruded `depth` thick
const flameGeo = (w, H, depth) => G(`flame${w},${H},${depth}`, () => {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
  s.bezierCurveTo(w * 0.64, H * 0.45, w * 0.4, H * 0.8, w * 0.04, H); s.bezierCurveTo(-w * 0.28, H * 0.78, -w * 0.58, H * 0.42, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: w * 0.06, bevelSegments: 3, curveSegments: 14 }); g.translate(0, 0, -depth / 2); return g;
});
// a curved slab: an arc of radius R (centred on the origin, bulging towards -Z), angle A, thickness T, height H
const arcGeo = (R, A, T, H) => G(`arc${R},${A},${T},${H}`, () => {
  const s = new THREE.Shape(), N = 20;
  for (let i = 0; i <= N; i++) { const a = -A / 2 + A * i / N, p = [Math.sin(a) * R, -Math.cos(a) * R]; i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); }
  for (let i = N; i >= 0; i--) { const a = -A / 2 + A * i / N; s.lineTo(Math.sin(a) * (R - T), -Math.cos(a) * (R - T)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; // (plan in x/z after the turn; height up)
});
// the Copan building's wave: an S-shaped band in plan, extruded upwards; its walls carry horizontal sun-shade bands
let bandTex = null;
const bands = () => { if (bandTex) return bandTex; const c = document.createElement("canvas"); c.width = 4; c.height = 32; const g = c.getContext("2d"); g.fillStyle = "#2c3238"; g.fillRect(0, 0, 4, 32); g.fillStyle = "#eeeae2"; g.fillRect(0, 0, 4, 13); bandTex = new THREE.CanvasTexture(c); bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping; bandTex.colorSpace = THREE.SRGBColorSpace; bandTex.repeat.set(0.1, 0.62); return bandTex; }; // (one band per ~1.6 units of height)
const waveGeo = (L, A, T, H) => G(`wave${L},${A},${T},${H}`, () => {
  const pts = [], N = 40, s = new THREE.Shape();
  for (let i = 0; i <= N; i++) { const x = -L / 2 + L * i / N; pts.push([x, A * Math.sin(i / N * Math.PI * 1.6 - 0.3)]); }
  s.moveTo(pts[0][0], pts[0][1] - T / 2); for (const [x, y] of pts) s.lineTo(x, y - T / 2); for (let i = N; i >= 0; i--) s.lineTo(pts[i][0], pts[i][1] + T / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; // (extruded along +Z, turned so it grows upwards)
});

const geo = new Map();
const G = (key, make) => { let v = geo.get(key); if (!v) geo.set(key, v = make()); return v; };
// tiny builders: all take (parent, size..., position..., material)
const box = (p, w, h, d, x, y, z, mat) => { const o = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };       // y = bottom
const cyl = (p, r0, r1, h, x, y, z, mat, seg = 16) => { const o = new THREE.Mesh(G(`c${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r0, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; }; // r0 = bottom radius
const sph = (p, r, x, y, z, mat, sy = 1, seg = 16) => { const o = new THREE.Mesh(G(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, seg >> 1)), mat); o.position.set(x, y, z); o.scale.y = sy; p.add(o); return o; };
const cone = (p, r, h, x, y, z, mat, seg = 12) => { const o = new THREE.Mesh(G(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };
const tor = (p, R, r, x, y, z, mat, rx = 0, ry = 0, arc = Math.PI * 2, seg = 28) => { const o = new THREE.Mesh(G(`t${R},${r},${arc},${seg}`, () => new THREE.TorusGeometry(R, r, 8, seg, arc)), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); p.add(o); return o; };
const beam = (p, x0, y0, z0, x1, y1, z1, t, mat) => { // a thin bar between two points
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), d = b.clone().sub(a), len = d.length();
  const o = new THREE.Mesh(G(`bm${t}`, () => new THREE.BoxGeometry(t, 1, t)), mat); o.position.copy(a).addScaledVector(d, 0.5); o.scale.y = len;
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(o); return o;
};
const window_rows = (p, w, d, y0, y1, step, mat) => { for (let y = y0; y < y1; y += step) { box(p, w + 0.06, 0.18, d + 0.06, 0, y, 0, mat); } }; // bands of lit windows

const WHITE = m(0xf1f1ec), STONE = m(0xcdbfa6), DARK = m(0x2a2d34, { metalness: 0.4 }), STEEL = m(0x8a929c, { metalness: 0.6, roughness: 0.4 }), GLASS = m(0x5d86b8, { metalness: 0.6, roughness: 0.2 });
const WIN = glow(0xffd98a, 1.2), NEON_C = glow(0x27e6ff, 2.2), NEON_P = glow(0xff3ec8, 2.2), NEON_Y = glow(0xffe14a, 1.8), NEON_R = glow(0xff3a3a, 2);

const B = {
  opera: (h) => { const g = new THREE.Group(); box(g, h * 1.9, 1.2, h * 1.2, 0, 0, 0, STONE); for (let i = 0; i < 4; i++) { const s = 1 - i * 0.16; const c = cone(g, h * 0.3 * s, h * 1.1 * s, -h * 0.55 + i * h * 0.34, 1.2, 0, WHITE, 3); c.rotation.z = 0.2; c.scale.z = 1.6; } for (let i = 0; i < 3; i++) { const c = cone(g, h * 0.22, h * 0.8, h * 0.1 + i * h * 0.3, 1.2, h * 0.22, WHITE, 3); c.rotation.z = -0.25; } return g; },
  bridge: (h) => { const g = new THREE.Group(); box(g, h * 2, 0.5, 2.4, 0, h * 0.28, 0, DARK); tor(g, h * 0.95, 0.35, 0, h * 0.28, 0, STEEL, 0, 0, Math.PI, 40); for (let i = -4; i <= 4; i++) { const y = Math.sqrt(Math.max(0, 1 - (i / 4.4) ** 2)) * h * 0.95; beam(g, i * h * 0.21, h * 0.3, 0, i * h * 0.21, h * 0.28 + y, 0, 0.1, STEEL); } for (const s of [-1, 1]) box(g, 1.6, h * 0.5, 1.6, s * h * 0.97, 0, 0, STONE); g.rotation.y = Math.PI / 2; return g; },
  pearl: (h) => { const g = new THREE.Group(), P = m(0xd94a8a, { metalness: 0.5, roughness: 0.3 }); for (let i = 0; i < 3; i++) { const a = i * 2.094; beam(g, Math.cos(a) * h * 0.55, 0, Math.sin(a) * h * 0.55, 0, h * 1.2, 0, 0.5, STEEL); } sph(g, h * 0.62, 0, h * 1.2, 0, P); cyl(g, 0.5, 0.5, h * 1.4, 0, h * 1.4, 0, STEEL); sph(g, h * 0.38, 0, h * 2.8, 0, P); cone(g, 0.3, h * 1.8, 0, h * 3.1, 0, STEEL, 6); return g; },
  shtower: (h) => { // Shanghai Tower: the tallest on the skyline, a glass spiral narrowing and twisting as it rises, with a sloping crown
    const g = new THREE.Group(), Gs = m(0x7f9fbf, { metalness: 0.7, roughness: 0.18 }), N = 16, SH = 2.9;
    for (let i = 0; i < N; i++) { const r0 = h * (0.62 - i * 0.022), r1 = h * (0.62 - (i + 1) * 0.022), c = cyl(g, r0, r1, SH, 0, i * SH, 0, Gs, 9); c.rotation.y = i * 0.17; c.scale.z = 0.86; if (i % 2 === 0) { const b = cyl(g, r1 * 1.02, r1 * 1.02, 0.25, 0, (i + 1) * SH - 0.1, 0, WIN, 9); b.rotation.y = i * 0.17; b.scale.z = 0.86; } }
    const top = cyl(g, h * 0.27, h * 0.25, 2.8, 0, N * SH, 0, Gs, 9); top.rotation.y = N * 0.17; const cap = box(g, h * 0.55, 0.5, h * 0.5, 0, N * SH + 2.6, 0, STEEL); cap.rotation.z = 0.25; return g;
  },
  jinmao: (h) => { // Jin Mao Tower: a stepped, pagoda-like tower in silver-grey with a spire
    const g = new THREE.Group(), S = m(0x9aa3ad, { metalness: 0.6, roughness: 0.3 }); let y = 0;
    for (let i = 0; i < 9; i++) { const w = h * (0.7 - i * 0.055), hh = 4.2 - i * 0.25; box(g, w, hh, w, 0, y, 0, S); box(g, w * 1.12, 0.35, w * 1.12, 0, y + hh - 0.35, 0, i % 2 ? WIN : STEEL); y += hh; }
    cone(g, h * 0.18, 4, 0, y, 0, S, 8); cyl(g, 0.15, 0.08, 5, 0, y + 4, 0, STEEL, 6); return g;
  },
  tokyotower: (h) => { // Tokyo Tower: an orange-and-white lattice tower, splayed legs, two observation decks
    const g = new THREE.Group(), R = m(0xe8492e, { roughness: 0.5 }), Wt = m(0xf3f2ee, { roughness: 0.5 }), H = 31, N = 8;
    const legAt = t => h * 0.95 * Math.pow(1 - t, 1.8) + h * 0.07; // half the leg spread at height fraction t (wide at the foot)
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, mat = i % 2 ? Wt : R, y0 = t0 * H, y1 = t1 * H, a = legAt(t0), b = legAt(t1);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(g, sx * a, y0, sz * a, sx * b, y1, sz * b, 0.55, mat);
      for (const s of [-1, 1]) { beam(g, -a, y0, s * a, b, y1, s * b, 0.16, mat); beam(g, a, y0, s * a, -b, y1, s * b, 0.16, mat); beam(g, s * a, y0, -a, s * b, y1, b, 0.16, mat); beam(g, s * a, y0, a, s * b, y1, -b, 0.16, mat); } // X bracing on every face
    }
    const d1 = legAt(0.34), d2 = legAt(0.7);
    box(g, d1 * 2.5, 2.4, d1 * 2.5, 0, H * 0.34, 0, Wt); box(g, d1 * 2.52, 0.6, d1 * 2.52, 0, H * 0.34 + 0.9, 0, WIN);
    box(g, d2 * 2.8, 1.4, d2 * 2.8, 0, H * 0.7, 0, Wt); box(g, d2 * 2.82, 0.4, d2 * 2.82, 0, H * 0.7 + 0.5, 0, WIN);
    for (let i = 0; i < 4; i++) cyl(g, 0.32 - i * 0.06, 0.26 - i * 0.06, 2.4, 0, H + i * 2.4, 0, i % 2 ? Wt : R, 6); // the antenna
    return g;
  },
  pagoda: (h) => { const g = new THREE.Group(), R = m(0xb3392f), W = m(0xe8d3a8); box(g, h * 0.9, 1.2, h * 0.9, 0, 0, 0, STONE); for (let i = 0; i < 5; i++) { const s = 1 - i * 0.15; box(g, h * 0.7 * s, 1.6, h * 0.7 * s, 0, 1.2 + i * 3, 0, W); const c = cone(g, h * 1.15 * s, 1.3, 0, 2.8 + i * 3, 0, R, 4); c.rotation.y = Math.PI / 4; } cyl(g, 0.15, 0.15, 3, 0, 16, 0, STEEL, 6); return g; },
  ferriswheel: (h) => { const g = new THREE.Group(), R = h * 0.95; tor(g, R, 0.25, 0, R + 1, 0, WHITE); tor(g, R * 0.5, 0.1, 0, R + 1, 0, WHITE); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; beam(g, 0, R + 1, 0, Math.cos(a) * R, R + 1 + Math.sin(a) * R, 0, 0.08, WHITE); box(g, 0.9, 0.9, 1.2, Math.cos(a) * R, R + 0.2 + Math.sin(a) * R, 0, i % 2 ? NEON_P : NEON_C); } beam(g, -R * 0.4, 0, 0, 0, R + 1, 0, 0.3, STEEL); beam(g, R * 0.4, 0, 0, 0, R + 1, 0, 0.3, STEEL); return g; },
  artdeco: (h) => { const g = new THREE.Group(), P = m(0xf5b9d4), T = m(0x7fe0d4); box(g, h * 1.5, 6, h * 0.9, 0, 0, 0, P); box(g, h * 1.1, 4, h * 0.7, 0, 6, 0, T); box(g, h * 0.6, 3, h * 0.5, 0, 10, 0, P); box(g, h * 1.52, 0.3, h * 0.92, 0, 6, 0, NEON_P); box(g, h * 1.12, 0.3, h * 0.72, 0, 10, 0, NEON_C); cone(g, 0.3, 3, 0, 13, 0, NEON_Y, 6); return g; },
  freedomtower: (h) => { const g = new THREE.Group(), B2 = m(0xd9c3a0); box(g, h * 0.9, 12, h * 0.9, 0, 0, 0, B2); box(g, h * 0.7, 5, h * 0.7, 0, 12, 0, B2); box(g, h * 0.5, 4, h * 0.5, 0, 17, 0, B2); cone(g, h * 0.45, 3, 0, 21, 0, m(0xc9a46a), 4).rotation.y = Math.PI / 4; window_rows(g, h * 0.9, h * 0.9, 2, 12, 2.2, WIN); return g; },
  biosphere: (h) => { const g = new THREE.Group(), s = h * 0.9, mesh = new THREE.Mesh(G("ico", () => new THREE.IcosahedronGeometry(1, 1)), m(0xe6eef5, { metalness: 0.4, roughness: 0.3, flatShading: true })); mesh.scale.setScalar(s); mesh.position.y = s; g.add(mesh); const rg = new THREE.Mesh(G("ico2", () => new THREE.IcosahedronGeometry(1.02, 1)), new THREE.MeshBasicMaterial({ color: 0x35424f, wireframe: true })); rg.scale.setScalar(s); rg.position.y = s; g.add(rg); return g; },
  olympictower: (h) => { const g = new THREE.Group(); const t = box(g, 2.6, 22, 2.6, 0, 0, 0, STONE); t.rotation.z = 0.1; const t2 = box(g, 2, 8, 2, h * 0.1 + 1.2, 20, 0, STONE); t2.rotation.z = 0.28; for (let i = 0; i < 4; i++) beam(g, h * 0.1 + 2.5, 26, 0, h * 0.9, 1 + i * 0.4, 0, 0.06, STEEL); return g; },
  casino: (h) => { const g = new THREE.Group(), C = m(0xf0e6d2), D = m(0x3f7f6f); box(g, h * 1.8, 5, h * 1.1, 0, 0, 0, C); for (const s of [-1, 1]) { box(g, 2.6, 5, 2.6, s * h * 0.8, 5, 0, C); cone(g, 2.1, 3, s * h * 0.8, 10, 0, D, 4).rotation.y = Math.PI / 4; } sph(g, h * 0.4, 0, 5.5, 0, D, 0.8); box(g, h * 1.8, 0.3, h * 1.12, 0, 5, 0, NEON_Y); return g; },
  palace: (h) => { const g = new THREE.Group(), P = m(0xefd9b5); box(g, h * 1.9, 6, h * 0.9, 0, 0, 0, P); for (const s of [-1, 1]) for (const z of [-1, 1]) { cyl(g, 1.5, 1.5, 9, s * h * 0.9, 0, z * h * 0.4, P, 10); cone(g, 1.8, 2.4, s * h * 0.9, 9, z * h * 0.4, m(0xb3392f), 10); } for (let i = -5; i <= 5; i++) box(g, 0.7, 0.8, 0.7, i * h * 0.17, 6, h * 0.45, 0, P); return g; },
  sagrada: (h) => { const g = new THREE.Group(), S = m(0xd7c4a0); box(g, h * 1.6, 7, h * 0.9, 0, 0, 0, S); for (let i = 0; i < 4; i++) { cone(g, 1.0, 17 + (i % 2) * 5, -h * 0.65 + i * h * 0.43, 7, 0.1, S, 6); cyl(g, 1.0, 0.8, 7, -h * 0.65 + i * h * 0.43, 7, 0.1, S, 6); } cone(g, 1.4, 24, 0, 8, -h * 0.1, S, 6); box(g, 0.3, 3, 0.3, 0, 31, -h * 0.1, 0, WHITE); return g; },
  torreglories: (h) => { const g = new THREE.Group(), R = m(0xd24b4b, { metalness: 0.4 }); cyl(g, h * 0.55, h * 0.55, 15, 0, 0, 0, R, 20); sph(g, h * 0.55, 0, 15, 0, R, 1.8, 20); window_rows(g, h * 1.0, h * 1.0, 1, 14, 1.6, NEON_C); return g; },
  church: (h) => { const g = new THREE.Group(), W = m(0xf2ede2), R = m(0xb04030); box(g, h * 0.8, 5, h * 1.4, 0, 0, 0, W); cone(g, h * 0.65, 3, 0, 5, 0, R, 4).rotation.y = Math.PI / 4; box(g, 2, 12, 2, 0, 0, h * 0.5, W); cone(g, 1.5, 4, 0, 12, h * 0.5, m(0x3f8a6a), 8); return g; },
  fortress: (h) => { const g = new THREE.Group(), S = m(0xb9ab94), hill = sph(g, h * 1.2, 0, -h * 0.7, 0, m(0x5f8a4f, { roughness: 1 }), 0.8); box(g, h * 1.5, 4, h * 0.8, 0, h * 0.45, 0, S); for (let i = 0; i < 4; i++) { cyl(g, 1.6, 1.6, 7, (i % 2 ? 1 : -1) * h * 0.7, h * 0.45, (i < 2 ? 1 : -1) * h * 0.35, S, 10); cone(g, 2, 2.4, (i % 2 ? 1 : -1) * h * 0.7, h * 0.45 + 7, (i < 2 ? 1 : -1) * h * 0.35, m(0x8a3a30), 10); } return g; },
  bigben: (h) => { const g = new THREE.Group(), S = m(0xd4b483); box(g, h * 0.8, 17, h * 0.8, 0, 0, 0, S); box(g, h * 0.95, 3, h * 0.95, 0, 17, 0, S); box(g, h * 0.6, 3, h * 0.6, 0, 20, 0, S); cone(g, h * 0.5, 6, 0, 23, 0, m(0x3b5a44), 4).rotation.y = Math.PI / 4; for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, 1.57], [-1, 0, 1.57]]) { const f = new THREE.Mesh(G("clk", () => new THREE.CircleGeometry(h * 0.33, 20)), glow(0xfff1c2, 1.4)); f.position.set(dx * h * 0.48, 18.5, dz * h * 0.48); f.rotation.y = ry; g.add(f); } box(g, h * 2.4, 5, h * 0.7, h * 1.6, 0, 0, S); return g; },
  towerbridge: (h) => { const g = new THREE.Group(), B3 = m(0x5a7fa0, { metalness: 0.3 }), S = m(0xc9c2b4); for (const s of [-1, 1]) { box(g, 3, 14, 3, s * h * 0.45, 0, 0, S); cone(g, 2.4, 3, s * h * 0.45, 14, 0, B3, 4).rotation.y = Math.PI / 4; } box(g, h * 0.95, 0.8, 2.6, 0, 11, 0, B3); box(g, h * 2, 1.2, 3, 0, 4, 0, B3); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) beam(g, s * h * 0.45, 12, 0, s * (h * 0.7 + i * h * 0.1), 4.6, 0, 0.1, B3); return g; },
  londoneye: (h) => { const g = new THREE.Group(), R = h * 0.95; tor(g, R, 0.2, 0, R + 1.5, 0, WHITE); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; beam(g, 0, R + 1.5, 0, Math.cos(a) * R, R + 1.5 + Math.sin(a) * R, 0, 0.05, WHITE); sph(g, 0.5, Math.cos(a) * R, R + 1.5 + Math.sin(a) * R, 0.5, glow(0xaee6ff, 1.2), 1.4, 8); } beam(g, -R * 0.45, 0, 1.2, 0, R + 1.5, 0, 0.35, WHITE); beam(g, -R * 0.45, 0, -1.2, 0, R + 1.5, 0, 0.35, WHITE); return g; },
  atomium: (h) => { const g = new THREE.Group(), A = m(0xc9d1d8, { metalness: 0.9, roughness: 0.2 }), c = h * 0.55, sy = 8; const P = [[0, 0, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 0]]; for (const [x, y, z] of P) sph(g, 1.6, x * c, sy + y * c * 1.2, z * c, A); for (const [x, y, z] of P.slice(1, 5)) beam(g, 0, sy, 0, x * c, sy, z * c, 0.35, A); sph(g, 1.6, 0, sy + c * 1.2, 0, A); beam(g, 0, sy, 0, 0, sy + c * 1.2, 0, 0.35, A); for (const [x, , z] of P.slice(1, 5)) beam(g, x * c, sy, z * c, 0, sy + c * 1.2, 0, 0.3, A); for (const [x, , z] of P.slice(1, 5)) beam(g, x * c, 0, z * c, x * c, sy, z * c, 0.3, STEEL); return g; },
  belfry: (h) => { const g = new THREE.Group(), S = m(0xb9a98c); box(g, h * 0.8, 14, h * 0.8, 0, 0, 0, S); box(g, h * 0.6, 4, h * 0.6, 0, 14, 0, S); cone(g, h * 0.45, 7, 0, 18, 0, m(0x4d6a5a), 4).rotation.y = Math.PI / 4; return g; },
  parliament: (h) => { const g = new THREE.Group(), S = m(0xe9e1d0), D = m(0x4f8a8a); box(g, h * 2, 6, h * 0.8, 0, 0, 0, S); cyl(g, h * 0.28, h * 0.28, 6, 0, 6, 0, S, 16); sph(g, h * 0.3, 0, 12, 0, D, 1.3); cone(g, 0.4, 5, 0, 14, 0, STEEL, 6); for (const s of [-1, 1]) for (const k of [0.45, 0.8]) { cone(g, 0.7, 5, s * h * k, 6, 0, D, 6); cone(g, 0.7, 5, s * h * k, 6, h * 0.3, D, 6); } window_rows(g, h * 2, h * 0.8, 1, 5.5, 1.5, WIN); return g; },
  chainbridge: (h) => { const g = new THREE.Group(), S = m(0xc9c2b4), C = m(0x4a4f57, { metalness: 0.5 }); box(g, h * 2, 0.6, 3, 0, 3.4, 0, C); for (const s of [-1, 1]) { box(g, 2.2, 12, 3.2, s * h * 0.6, 0, 0, S); box(g, 2.6, 1, 3.4, s * h * 0.6, 12, 0, S); } for (let i = -9; i <= 9; i++) { const x = i * h * 0.1, y = 12 - Math.max(0, 1 - Math.abs(i * h * 0.1) / (h * 0.6)) * 0, sag = 12 - 8 * (1 - Math.min(1, (x / (h * 0.6)) ** 2)); beam(g, x, 4, 1.4, x, Math.max(4, sag + 1), 1.4, 0.06, C); } return g; },
  dutchmill: (h) => { const g = new THREE.Group(), W = m(0xf0ebe0); cyl(g, h * 0.45, h * 0.28, 12, 0, 0, 0, m(0x8a5a3a), 10); cone(g, h * 0.34, 3, 0, 12, 0, m(0x3a3a40), 10); const hub = new THREE.Group(); hub.position.set(0, 11, h * 0.35); for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; box(arm, 0.4, h * 1.4, 0.15, 0, 0.2, 0, W); box(arm, 0.2, h * 1.2, 0.1, 0.5, 0.4, 0, WHITE); hub.add(arm); } g.add(hub); g.userData.spin = hub; return g; },
  canalhouses: (h) => { const g = new THREE.Group(), C = [0xc8553d, 0xe8c07d, 0x6b8f71, 0x3f6f9a, 0xd98a9e, 0xf0e2c0]; for (let i = 0; i < 7; i++) { const w = h * 0.26, x = -h * 0.9 + i * h * 0.3, hh = 6 + (i * 37 % 4); box(g, w, hh, w * 1.4, x, 0, 0, m(C[i % C.length])); cone(g, w * 0.7, 1.8, x, hh, 0, m(0x4a3a36), 4).rotation.y = Math.PI / 4; for (let k = 1; k < 3; k++) box(g, w * 0.5, 0.9, 0.1, x, k * 2.2, w * 0.71, WIN); } return g; },
  colosseum: (h) => { const g = new THREE.Group(), S = m(0xd8c3a0, { roughness: 0.9 }); const ring = cyl(g, h * 0.95, h * 0.95, 8, 0, 0, 0, S, 32); ring.scale.z = 0.8; for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283; for (const y of [1.2, 3.8, 6.2]) box(g, 0.9, 1.4, 0.6, Math.cos(a) * h * 0.95, y, Math.sin(a) * h * 0.95 * 0.8, DARK).rotation.y = -a + Math.PI / 2; } return g; },
  pisa: (h) => { const g = new THREE.Group(); const t = new THREE.Group(); for (let i = 0; i < 6; i++) { cyl(t, h * 0.42, h * 0.42, 2.2, 0, i * 2.4, 0, WHITE, 14); cyl(t, h * 0.46, h * 0.46, 0.25, 0, i * 2.4 + 2.2, 0, STONE, 14); } cyl(t, h * 0.3, h * 0.3, 2, 0, 14.4, 0, WHITE, 12); t.rotation.z = -0.1; g.add(t); box(g, h * 1.6, 3, h * 0.8, h * 1.1, 0, 0, STONE); sph(g, h * 0.3, h * 1.1, 3, 0, m(0x9a8f7a), 0.8); return g; },
  alcala: (h) => { const g = new THREE.Group(), S = m(0xe6dfce); box(g, h * 1.8, 8, h * 0.8, 0, 0, 0, S); box(g, h * 0.45, 5, h * 0.9, 0, 0, 0, DARK); for (const s of [-1, 1]) box(g, h * 0.3, 4, h * 0.9, s * h * 0.55, 0, 0, DARK); box(g, h * 1.9, 0.8, h * 0.9, 0, 8, 0, S); box(g, h * 0.7, 2, h * 0.5, 0, 8.8, 0, S); return g; },
  kiotowers: (h) => { const g = new THREE.Group(), K = m(0x7f8a9a, { metalness: 0.5 }); for (const s of [-1, 1]) { const t = box(g, h * 0.45, 20, h * 0.45, s * h * 0.5, 0, 0, K); t.rotation.z = -s * 0.2; t.position.y = 10; t.position.x -= s * Math.sin(0.2) * 0 ; } box(g, h * 0.3, 1.5, h * 0.3, 0, 17, 0, glow(0x7fd9ff, 1.4)); return g; },
  flame: (h) => { // the Flame Towers: three curved glass flames on the hill; by night their skins become huge LED flames
    const g = new THREE.Group(), F = nightGlow("flameskin", 0x2f5c92, 0xff6a1a, 2.2, { metalness: 0.7, roughness: 0.18 });
    [[-h * 0.75, 19, h * 0.62, 0.35], [0, 27, h * 0.78, 0], [h * 0.75, 22, h * 0.62, -0.35]].forEach(([x, H, w, ry]) => { const o = new THREE.Mesh(flameGeo(w, H, w * 0.7), F); o.position.x = x; o.rotation.y = ry; g.add(o); });
    return g;
  },
  maiden: (h) => { const g = new THREE.Group(), S = m(0xb8a98a); cyl(g, h * 0.55, h * 0.5, 11, 0, 0, 0, S, 20); cyl(g, h * 0.3, h * 0.3, 4, h * 0.3, 11, 0, S, 14); cone(g, h * 0.34, 2.4, h * 0.3, 15, 0, m(0x8a5a3a), 14); return g; },
  heydar: (h) => { const g = new THREE.Group(), W = m(0xf4f6f8, { roughness: 0.3, metalness: 0.2 }); const a = sph(g, h * 0.9, 0, 0, 0, W, 0.45, 24); sph(g, h * 0.5, h * 0.4, 0.5, 0, W, 0.7, 20); sph(g, h * 0.4, -h * 0.5, 0.3, h * 0.2, W, 0.6, 20); box(g, h * 1.2, 0.3, h * 0.2, 0, 4, 0, NEON_C); return g; },
  mbs: (h) => { const g = new THREE.Group(), T = m(0xd9dde2, { metalness: 0.5, roughness: 0.3 }); for (let i = -1; i <= 1; i++) { const t = box(g, h * 0.45, 22, h * 0.4, i * h * 0.55, 0, 0, T); t.rotation.z = -i * 0.07; } box(g, h * 2.3, 1.4, h * 0.5, 0, 22, 0, T); box(g, h * 2.0, 0.4, h * 0.35, h * 0.1, 23.4, 0, glow(0x7fe9ff, 1.3)); cone(g, h * 0.28, 2.4, h * 1.2, 22.2, 0, T, 12).rotation.z = -1.57; window_rows(g, h * 1.9, h * 0.45, 1, 21, 2.2, WIN); return g; },
  supertrees: (h) => { const g = new THREE.Group(); [[-h * 0.5, 16], [h * 0.1, 22], [h * 0.65, 18]].forEach(([x, H], i) => { cyl(g, 0.9, 0.5, H, x, 0, 0, m(0x5a4a3a), 8); cyl(g, h * 0.45, h * 0.12, 3.5, x, H, 0, m(0x3a7a4a), 14); const ring = tor(g, h * 0.38, 0.12, x, H + 0.4, 0, i % 2 ? NEON_P : NEON_C, Math.PI / 2); }); return g; },
  merlion: (h) => { const g = new THREE.Group(), W = m(0xf0f0ee); cyl(g, h * 0.5, h * 0.35, 4, 0, 0, 0, STONE, 12); cone(g, h * 0.35, 5, 0, 4, 0, W, 10); sph(g, h * 0.3, 0, 9.4, 0.4, W); cone(g, 0.2, 2.2, 0, 8.2, 0.5, m(0x59c8ff), 6).rotation.x = 1.2; return g; },
  flyer: (h) => { const g = new THREE.Group(), R = h * 1.05; tor(g, R, 0.3, 0, R + 4, 0, STEEL); tor(g, R * 0.88, 0.1, 0, R + 4, 0, STEEL); for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; beam(g, 0, R + 4, 0, Math.cos(a) * R, R + 4 + Math.sin(a) * R, 0, 0.05, STEEL); } for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; box(g, 1, 1, 1, Math.cos(a) * R, R + 3.4 + Math.sin(a) * R, 0, NEON_Y); } box(g, h * 1.8, 4, h * 0.4, 0, 0, 0, DARK); beam(g, -2, 4, 0, 0, R + 4, 0, 0.35, STEEL); beam(g, 2, 4, 0, 0, R + 4, 0, 0.35, STEEL); return g; },
  capitol: (h) => { const g = new THREE.Group(), P = m(0xd9a48a); box(g, h * 1.9, 6, h * 0.9, 0, 0, 0, P); cyl(g, h * 0.38, h * 0.38, 4, 0, 6, 0, P, 20); sph(g, h * 0.4, 0, 10, 0, m(0xc9c2b4, { metalness: 0.4 }), 0.9); cone(g, 0.3, 3, 0, 13.4, 0, m(0xffd23f), 5); box(g, h * 0.8, 3, 1.4, 0, 0, h * 0.5, P); return g; },
  uttower: (h) => { const g = new THREE.Group(), S = m(0xdcc9a4); box(g, h * 0.7, 20, h * 0.7, 0, 0, 0, S); box(g, h * 0.9, 3.5, h * 0.9, 0, 20, 0, S); box(g, h * 0.6, 3, h * 0.6, 0, 23.5, 0, S); cone(g, h * 0.3, 3, 0, 26.5, 0, m(0xc9a46a), 4).rotation.y = Math.PI / 4; window_rows(g, h * 0.7, h * 0.7, 2, 19, 2.6, WIN); return g; },
  angel: (h) => { const g = new THREE.Group(), S = m(0xe6dfce); box(g, h * 0.9, 1, h * 0.9, 0, 0, 0, S); box(g, h * 0.65, 1, h * 0.65, 0, 1, 0, S); cyl(g, h * 0.22, h * 0.17, 14, 0, 2, 0, S, 8); cyl(g, h * 0.3, h * 0.25, 1, 0, 15.5, 0, S, 8); const gold = m(0xf2c23a, { metalness: 0.8, roughness: 0.3 }); cyl(g, 0.5, 0.35, 3, 0, 16.5, 0, gold, 8); box(g, 3.2, 0.2, 0.5, 0, 19, 0, gold); sph(g, 0.4, 0, 19.8, 0, gold, 1, 8); return g; },
  pyramid: (h) => { const g = new THREE.Group(), S = m(0xc9b48a); for (let i = 0; i < 6; i++) { const w = h * (1.6 - i * 0.25); box(g, w, 2.2, w, 0, i * 2.2, 0, S); } box(g, h * 0.3, 2.4, h * 0.3, 0, 13.2, 0, STONE); return g; },
  christ: (h) => { const g = new THREE.Group(), R = m(0x5f7a5a, { roughness: 1 }), W = m(0xeef0ec); const mt = cone(g, h * 0.95, 14, 0, 0, 0, R, 8); box(g, 2, 3, 2, 0, 14, 0, WHITE); box(g, 0.8, 5, 0.8, 0, 17, 0, W); box(g, 6, 0.8, 0.8, 0, 20.4, 0, W); sph(g, 0.5, 0, 22.2, 0, W, 1, 8); return g; },
  sugarloaf: (h) => { const g = new THREE.Group(); sph(g, h * 1.0, 0, -h * 0.1, 0, m(0x8b8e92, { roughness: 1 }), 1.2); sph(g, h * 0.5, h * 0.9, -h * 0.2, 0, m(0x6a8a62, { roughness: 1 }), 0.9); return g; },
  ponte: (h) => { const g = new THREE.Group(), C = m(0xf0f0f0), D = m(0x555a60); box(g, h * 2, 0.7, 3, 0, 3.5, 0, D); const mast = (x) => { beam(g, x - 0.8, 3.5, 0, x, 20, 0, 0.5, C); beam(g, x + 0.8, 3.5, 0, x, 20, 0, 0.5, C); }; mast(0); for (let i = 1; i <= 7; i++) for (const s of [-1, 1]) { beam(g, 0, 20 - i * 0.7, 0, s * i * h * 0.12, 3.9, 0, 0.04, STEEL); } return g; },
  sphere: (h) => { // the Sphere: a huge LED ball (see makeSphereMat) on a dark plinth
    const g = new THREE.Group(), s = h * 1.15; const ball = new THREE.Mesh(G("sphere48", () => new THREE.SphereGeometry(1, 64, 40)), makeSphereMat()); ball.scale.setScalar(s); ball.position.y = s * 0.92; g.add(ball); g.userData.ball = ball;
    cyl(g, s * 0.62, s * 0.7, 2.2, 0, 0, 0, DARK, 24); cyl(g, s * 0.71, s * 0.71, 0.3, 0, 1.0, 0, NEON_P, 24); return g;
  },
  bellagio: (h) => { // a Strip resort: a long curved hotel in cream with terracotta roofs, a lake in front with its dancing fountains
    const g = new THREE.Group(), C = m(0xeadfc6, { roughness: 0.6 }), T = m(0xb8643c), Wa = m(0x1f5f8a, { metalness: 0.2, roughness: 0.08 });
    [[-0.9, 0.45, 17], [0, 0, 22], [0.9, 0.45, 17]].forEach(([x, z, H]) => { const b = box(g, h * 0.62, H, h * 0.42, x * h * 0.95, 0, -h * 0.4 - z * h * 0.6, C); b.rotation.y = -x * 0.45; box(g, h * 0.66, 1.2, h * 0.46, x * h * 0.95, H, -h * 0.4 - z * h * 0.6, T).rotation.y = -x * 0.45; });
    for (let y = 2; y < 20; y += 2.2) box(g, h * 0.64, 0.22, h * 0.44, 0, y, -h * 0.4, WIN);
    const lake = cyl(g, h * 1.25, h * 1.25, 0.3, 0, 0, h * 0.75, Wa, 32); lake.scale.z = 0.55; box(g, h * 2.6, 0.6, 0.6, 0, 0, h * 1.45, STONE);
    for (let i = 0; i < 11; i++) cyl(g, 0.12, 0.05, 3 + (i % 3) * 2.2, (i - 5) * h * 0.2, 0.3, h * 0.75, glow(0xe8f6ff, 1.6), 5); // fountains
    box(g, 1.6, 7, 0.6, h * 1.3, 0, h * 1.35, DARK); box(g, 4.4, 3, 0.5, h * 1.3, 7, h * 1.35, NEON_Y); return g;
  },
  wynn: (h) => { // a Strip resort: a tall curved slab of bronze glass
    const g = new THREE.Group(), Bz = m(0x8c5a2b, { metalness: 0.85, roughness: 0.22 }), R = h * 2.4;
    const slab = new THREE.Mesh(arcGeo(R, 0.75, 3.4, 30), Bz); slab.position.z = -R; g.add(slab); // (the arc's centre is behind it: it bulges towards the street)
    for (let y = 2; y < 30; y += 2.4) { const b = new THREE.Mesh(arcGeo(R + 0.05, 0.75, 3.5, 0.18), WIN); b.position.set(0, y, -R); g.add(b); }
    box(g, h * 1.6, 3, h * 0.9, 0, 0, -1, m(0xd8c4a0)); box(g, h * 1.2, 1.4, 0.4, 0, 30.2, -0.6, NEON_Y); return g;
  },
  caesars: (h) => { // a Strip resort: a white tower with a stepped crown above a colonnade
    const g = new THREE.Group(), Wt = m(0xf1ede4), Gd = m(0xd9b44a, { metalness: 0.7, roughness: 0.3 });
    box(g, h * 1.3, 20, h * 0.5, 0, 0, 0, Wt); box(g, h * 1.0, 3, h * 0.42, 0, 20, 0, Wt); box(g, h * 0.6, 2, h * 0.34, 0, 23, 0, Wt); box(g, h * 1.32, 0.4, h * 0.52, 0, 20, 0, Gd);
    for (let y = 2; y < 20; y += 1.8) box(g, h * 1.31, 0.2, h * 0.51, 0, y, 0, WIN);
    box(g, h * 2, 0.6, h * 0.5, 0, 5, h * 0.55, Wt); for (let i = 0; i < 11; i++) cyl(g, 0.35, 0.35, 5, (i - 5) * h * 0.18, 0, h * 0.55, Wt, 8);
    box(g, 1.2, 6, 0.6, -h * 0.9, 0, h * 0.95, DARK); box(g, 3.6, 2.4, 0.5, -h * 0.9, 6, h * 0.95, NEON_R); return g;
  },
  yasspan: () => { // Yas hotel (Abu Dhabi), built in world units: two hotels either side of the track, a bridge over it, all under a lit gridshell
    const g = new THREE.Group(), Wh = m(0xeef0f2, { roughness: 0.4 }), Gl = m(0x3a6688, { metalness: 0.6, roughness: 0.18 }), X0 = 27, X1 = 54, HH = 21, L = 36;
    for (const s of [-1, 1]) { box(g, X1 - X0, HH, L, s * (X0 + X1) / 2, 0, 0, Gl); for (let y = 2.5; y < HH; y += 3) box(g, X1 - X0 + 0.1, 0.3, L + 0.1, s * (X0 + X1) / 2, y, 0, WIN); box(g, X1 - X0 + 1, 0.6, L + 1, s * (X0 + X1) / 2, HH, 0, Wh); }
    box(g, X0 * 2 + 1, 3.6, 11, 0, 15.5, 0, Wh); box(g, X0 * 2 + 1.2, 1.4, 11.2, 0, 16.6, 0, Gl); // the bridge over the track
    const shellMat = cache.get("yasShell") || (() => { const mt = new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.5, roughness: 0.35, map: lattice(), alphaMap: lattice(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0xb15cff, emissiveMap: lattice(), emissiveIntensity: 0 }); mt.map.repeat.set(26, 7); cache.set("yasShell", mt); glows.push({ mat: mt, base: 1.6, nightOnly: true }); return mt; })();
    const shell = new THREE.Mesh(G("yasshell", () => new THREE.CylinderGeometry(1, 1, 1, 56, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)), shellMat);
    shell.scale.set(64, 34, L + 22); shell.position.y = 2; shell.castShadow = false; g.add(shell); // (high enough to sweep over both hotels and the bridge)
    g.userData.keep = true; return g; // (kept as separate meshes: the see-through shell must not cast a solid shadow)
  },
  masp: (h) => { // MASP, Sao Paulo: a glass box held high between two red concrete frames, an open plaza beneath
    const g = new THREE.Group(), Rr = m(0xc4231c, { roughness: 0.55 }), Gl = m(0x22303a, { metalness: 0.5, roughness: 0.2 }), L = h * 2.3, D = h * 0.95, y0 = 8;
    box(g, L * 1.1, 0.4, D * 2.2, 0, 0, 0, m(0xb9b4a8)); box(g, L * 0.96, 6, D, 0, y0, 0, Gl); for (let y = y0 + 1; y < y0 + 6; y += 1.2) box(g, L * 0.961, 0.12, D + 0.02, 0, y, 0, WIN);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 1.6, y0 + 7.6, 1.6, sx * L / 2, 0, sz * (D / 2 + 0.9), Rr); // the four red pillars
    for (const sz of [-1, 1]) { box(g, L + 1.6, 1.6, 1.6, 0, y0 + 6, sz * (D / 2 + 0.9), Rr); box(g, L + 1.6, 1.4, 1.6, 0, y0 - 1.2, sz * (D / 2 + 0.9), Rr); } // the beams
    return g;
  },
  copan: (h) => { // Copan, Sao Paulo: a long residential slab curving like a wave, striped with white sun-shades
    const g = new THREE.Group(), mt = cache.get("copan") || (() => { const v = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bands(), roughness: 0.7 }); cache.set("copan", v); return v; })();
    const o = new THREE.Mesh(waveGeo(h * 3.2, h * 0.55, h * 0.36, 30), mt); g.add(o); box(g, h * 3.3, 3, h * 1.3, 0, 0, 0, m(0xbdb7aa)); return g;
  },
  banespa: (h) => { // Altino Arantes (Banespa) tower: a stepped Art Deco tower with a mast
    const g = new THREE.Group(), S = m(0xd8ccb2, { roughness: 0.75 });
    box(g, h * 1.3, 16, h * 1.0, 0, 0, 0, S); box(g, h * 0.95, 7, h * 0.75, 0, 16, 0, S); box(g, h * 0.62, 5, h * 0.5, 0, 23, 0, S); box(g, h * 0.36, 3, h * 0.3, 0, 28, 0, S);
    window_rows(g, h * 1.3, h * 1.0, 1, 15.5, 1.7, WIN); cyl(g, 0.3, 0.12, 8, 0, 31, 0, STEEL, 6); sph(g, 0.4, 0, 39, 0, NEON_R, 1, 8); return g;
  },
  cotatower: (h) => { // the Circuit of the Americas tower (Austin): a red column with a deck on top and a veil of red cables down to the ground
    const g = new THREE.Group(), R = m(0xc8142e, { roughness: 0.45, metalness: 0.2 }), H = 31;
    cyl(g, 1.0, 0.75, H, 0, 0, 0, R, 12); cyl(g, h * 0.34, h * 0.3, 1.4, 0, H - 1.4, 0, GLASS, 20); cyl(g, h * 0.36, h * 0.36, 0.6, 0, H, 0, R, 20);
    for (let i = 0; i < 22; i++) { const a = i / 22 * 6.2832; beam(g, Math.cos(a) * h * 0.33, H - 1.4, Math.sin(a) * h * 0.33, Math.cos(a) * h * 0.95, 0, Math.sin(a) * h * 0.95, 0.14, R); }
    return g;
  },
  dohatower: (h) => { // Burj Doha: a round tower wrapped in a lattice, a domed top and a spire
    const g = new THREE.Group(), S = m(0xb9c4cf, { metalness: 0.6, roughness: 0.3 });
    cyl(g, h * 0.48, h * 0.42, 26, 0, 0, 0, S, 24); for (let y = 1.5; y < 26; y += 2.2) cyl(g, h * 0.485 - y * 0.0023 * h, h * 0.485 - y * 0.0023 * h, 0.3, 0, y, 0, NEON_C, 24);
    sph(g, h * 0.42, 0, 26, 0, S, 0.8, 24); cyl(g, 0.3, 0.1, 7, 0, 29, 0, STEEL, 6); return g;
  },
  bellasartes: (h) => { // Palacio de Bellas Artes (Mexico City): white marble with a golden-orange tiled dome
    const g = new THREE.Group(), Mb = m(0xf1ece2, { roughness: 0.5 }), D = m(0xe2902e, { metalness: 0.5, roughness: 0.35 });
    box(g, h * 2, 7, h * 1.3, 0, 0, 0, Mb); box(g, h * 2.05, 0.7, h * 1.35, 0, 7, 0, Mb); box(g, h * 0.8, 9, h * 0.8, 0, 0, 0, Mb);
    sph(g, h * 0.46, 0, 9, 0, D, 1.15, 20); cyl(g, 0.6, 0.6, 2, 0, 9 + h * 0.5, 0, D, 10); sph(g, 0.8, 0, 11.5 + h * 0.5, 0, D, 1, 10);
    for (const s of [-1, 1]) { sph(g, h * 0.22, s * h * 0.75, 7.6, 0, D, 1.1, 14); } for (let i = 0; i < 8; i++) cyl(g, 0.3, 0.3, 6, (i - 3.5) * h * 0.22, 0, h * 0.68, Mb, 8);
    return g;
  },
  luxor: (h) => { const g = new THREE.Group(), P = m(0x15171c, { metalness: 0.8, roughness: 0.2 }); const p = cone(g, h * 0.95, 16, 0, 0, 0, P, 4); p.rotation.y = Math.PI / 4; const beamM = new THREE.Mesh(G("lux", () => new THREE.CylinderGeometry(0.4, 0.4, 70, 8, 1, true)), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.25, depthWrite: false })); beamM.position.y = 51; g.add(beamM); box(g, 0.4, 0.4, 0.4, 0, 16, 0, NEON_C); window_rows(g, h * 0.3, h * 0.3, 1, 6, 2, NEON_Y); return g; },
  stratosphere: (h) => { const g = new THREE.Group(), S = m(0xe2e2e8); cyl(g, 1.2, 0.8, 26, 0, 0, 0, S, 10); cyl(g, h * 0.45, h * 0.3, 2, 0, 26, 0, S, 14); cyl(g, h * 0.45, h * 0.45, 3, 0, 28, 0, NEON_R, 14); cyl(g, h * 0.3, h * 0.45, 1.2, 0, 31, 0, S, 14); cone(g, 0.3, 8, 0, 32, 0, NEON_R, 6); return g; },
  eiffel: (h) => { const g = new THREE.Group(), I = m(0x6a5a4a, { metalness: 0.6, roughness: 0.5 }); const base = h * 0.85; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { beam(g, sx * base, 0, sz * base, sx * h * 0.28, 12, sz * h * 0.28, 0.45, I); beam(g, sx * h * 0.28, 12, sz * h * 0.28, sx * h * 0.1, 26, sz * h * 0.1, 0.35, I); } for (const y of [12, 20]) box(g, h * (y === 12 ? 0.6 : 0.34), 0.35, h * (y === 12 ? 0.6 : 0.34), 0, y, 0, I); cone(g, 0.3, 8, 0, 26, 0, I, 6); box(g, h * 0.5, 0.2, h * 0.5, 0, 24, 0, NEON_Y); return g; },
  welcome: (h) => { const g = new THREE.Group(); cyl(g, 0.3, 0.3, 4, 0, 0, 0, DARK, 6); const d = box(g, 4.6, 4.6, 0.5, 0, 6.3, 0, glow(0xffd23f, 1.6)); d.rotation.z = Math.PI / 4; box(g, 3, 0.8, 0.6, 0, 6.0, 0, NEON_R); for (let i = 0; i < 6; i++) sph(g, 0.22, Math.cos(i * 1.047) * 3.4, 6.3 + Math.sin(i * 1.047) * 3.4, 0.4, NEON_Y, 1, 6); return g; },
  lusail: (h) => { const g = new THREE.Group(), G1 = m(0xd4a64a, { metalness: 0.7, roughness: 0.3 }); const b = cyl(g, h * 0.92, h * 0.7, 12, 0, 0, 0, G1, 28); cyl(g, h * 0.74, h * 0.74, 0.5, 0, 12, 0, DARK, 28); for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; box(g, 0.5, 8, 0.2, Math.cos(a) * h * 0.82, 2, Math.sin(a) * h * 0.82, i % 2 ? glow(0xffe8a0, 1.2) : DARK).rotation.y = -a; } return g; },
  aspire: (h) => { const g = new THREE.Group(), S = m(0xc7ccd4, { metalness: 0.6, roughness: 0.3 }); cyl(g, h * 0.38, h * 0.2, 22, 0, 0, 0, S, 14); cyl(g, h * 0.4, h * 0.3, 3, 0, 22, 0, S, 14); tor(g, h * 0.38, 0.35, 0, 25.2, 0, glow(0xff9a3a, 2), Math.PI / 2); cone(g, h * 0.3, 4, 0, 25, 0, glow(0xff7a1a, 2), 10); return g; },
  mosque: (h) => { const g = new THREE.Group(), W = m(0xfbfaf4, { roughness: 0.4 }); box(g, h * 1.8, 5, h * 1.1, 0, 0, 0, W); sph(g, h * 0.5, 0, 5, 0, W, 0.9, 24); for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) sph(g, h * 0.2, x * h, 5, z * h, W, 0.9, 14); for (const [x, z] of [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]]) { cyl(g, 0.6, 0.45, 15, x * h * 0.95, 0, z * h * 0.55, W, 8); cone(g, 0.7, 2.4, x * h * 0.95, 15, z * h * 0.55, glow(0xffe9b0, 0.8), 8); } return g; },
  themepark: (h) => { const g = new THREE.Group(), R = m(0xc8281e, { roughness: 0.5 }); const roof = sph(g, h * 1.0, 0, 0, 0, R, 0.28, 28); box(g, h * 1.8, 1.4, h * 1.2, 0, 0, 0, m(0xbfc3c8)); tor(g, h * 0.45, 0.25, h * 0.5, h * 0.55 + 1.4, h * 0.3, STEEL, 0, Math.PI / 2); for (let i = 0; i < 3; i++) box(g, 0.4, 5 + i, 0.4, -h * 0.6 + i * h * 0.12, 1.4, -h * 0.4, WHITE); return g; },
  yashotel: (h) => { const g = new THREE.Group(), G2 = m(0x20344f, { metalness: 0.6, roughness: 0.3 }); box(g, h * 1.8, 10, h * 0.8, 0, 0, 0, G2); const arc = tor(g, h * 0.55, 0.5, 0, 10, 0, glow(0x39e6ff, 2), 0, 0, Math.PI, 28); arc.scale.set(1.5, 0.5, 1); box(g, h * 1.82, 0.2, h * 0.82, 0, 5, 0, NEON_P); window_rows(g, h * 1.8, h * 0.8, 1, 10, 1.6, NEON_C); return g; },
  etihad: (h) => { const g = new THREE.Group(), S = m(0xc3cad4, { metalness: 0.6, roughness: 0.25 }); [[-0.8, 17], [-0.4, 21], [0, 24], [0.45, 20], [0.85, 15]].forEach(([x, H], i) => { const t = box(g, h * 0.28, H, h * 0.34, x * h, 0, (i % 2) * 0.4, S); cone(g, h * 0.17, 3, x * h, H, (i % 2) * 0.4, S, 4).rotation.y = Math.PI / 4; }); window_rows(g, h * 2, h * 0.34, 2, 15, 2.4, WIN); return g; },
};
export const hasLandmark = key => !!B[key];
// build (once per instance) the landmark `key`, fitting `half` world units
export function makeLandmark(key, half) { const g = B[key](half); g.traverse(o => { if (o.isMesh) o.castShadow = !(o.material && o.material.transparent); }); return g; } // (see-through parts, like the Yas gridshell, cast no solid shadow)
export const LANDMARK_KEYS = Object.keys(B);
