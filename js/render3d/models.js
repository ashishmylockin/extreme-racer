// Placeholder 3D models built from simple shapes (Step 3 swaps these for real models).
// Every model faces -Z (up the road), sits on the ground at Y = 0 and is centred on X = 0, Z = 0.
import * as THREE from "three";
import { SCALE } from "./mapping.js";

const geoCache = new Map();
const matCache = new Map();
const g = (key, make) => { let v = geoCache.get(key); if (!v) geoCache.set(key, v = make()); return v; };
export const box = (w, h, d) => g(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 12) => g(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sphere = (r, seg = 12) => g(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)));
export const cone = (r, h, seg = 10) => g(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));

export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) matCache.set(key, m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o }));
  return m;
}
const mesh = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; return m; };
const glowMat = (color, emissive, k) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k });

// ---- the open-wheel race car (the player, the rivals and the menu demo cars) ----
export function makeRaceCar(team) {
  const body = mat(team.p, { roughness: 0.35, metalness: 0.4 }), stripe = mat(team.s, { roughness: 0.4 }), accent = mat(team.a, { roughness: 0.5 });
  const dark = mat("#111114", { roughness: 0.9 }), rubber = mat("#0b0b0c", { roughness: 0.95 });
  const car = new THREE.Group(), wheels = [], front = [];
  car.add(mesh(box(1.5, 0.8, 4.6), body, 0, 0.95, 0.4));            // tub
  car.add(mesh(box(0.9, 0.55, 2.6), body, 0, 0.8, -3.0));           // nose
  car.add(mesh(box(0.5, 0.06, 5.4), stripe, 0, 1.38, -0.2));        // stripe down the middle
  car.add(mesh(box(3.0, 0.55, 2.2), body, 0, 0.75, 0.3));           // sidepods
  car.add(mesh(box(3.5, 0.1, 0.9), accent, 0, 0.35, -4.15));        // front wing
  car.add(mesh(box(0.1, 0.5, 0.9), accent, -1.7, 0.55, -4.15));
  car.add(mesh(box(0.1, 0.5, 0.9), accent, 1.7, 0.55, -4.15));
  car.add(mesh(box(2.6, 0.12, 0.9), accent, 0, 2.05, 3.0));         // rear wing
  car.add(mesh(box(0.1, 0.9, 1.0), accent, -1.3, 1.75, 3.0));
  car.add(mesh(box(0.1, 0.9, 1.0), accent, 1.3, 1.75, 3.0));
  car.add(mesh(box(0.2, 0.9, 0.5), dark, 0, 1.55, 3.0));
  const helmet = mesh(sphere(0.4), mat(team.helmet, { roughness: 0.25, metalness: 0.2 }), 0, 1.62, 0.7); car.add(helmet);
  car.add(mesh(box(0.7, 0.35, 0.8), dark, 0, 1.35, 0.8));           // cockpit surround
  const brake = mesh(box(0.8, 0.18, 0.1), glowMat("#550000", "#ff0000", 0), 0, 1.1, 2.75); brake.castShadow = false; car.add(brake);
  for (const [x, z, r] of [[-1.3, -2.5, 0.7], [1.3, -2.5, 0.7], [-1.35, 2.3, 0.8], [1.35, 2.3, 0.8]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, r, z);
    const w = mesh(cyl(r, r, 0.9, 16), rubber); w.rotation.z = Math.PI / 2;
    const hub = mesh(cyl(r * 0.5, r * 0.5, 0.95, 8), mat("#9aa0a8", { metalness: 0.8 })); w.add(hub);
    const axle = new THREE.Group(); axle.add(w); pivot.add(axle); car.add(pivot); wheels.push(axle); if (z < 0) front.push(pivot);
  }
  car.userData = { wheels, front, helmet, brake, kind: "race" };
  return car;
}

// ---- everyday traffic: cars, long trucks ----
export function makeTrafficCar(col) {
  const car = new THREE.Group(), body = mat(col, { roughness: 0.4, metalness: 0.3 }), wheels = [];
  car.add(mesh(box(3.3, 1.0, 6.9), body, 0, 0.95, 0));
  car.add(mesh(box(2.8, 0.85, 3.4), mat("#222a33", { roughness: 0.15, metalness: 0.6 }), 0, 1.85, 0.4));
  car.add(mesh(box(3.2, 0.15, 0.1), mat("#ffeeaa", { emissive: "#ffeeaa", emissiveIntensity: 0.15 }), 0, 1.0, -3.46));
  car.add(mesh(box(3.2, 0.15, 0.1), glowMat("#660000", "#ff1010", 0.6), 0, 1.0, 3.46));
  for (const [x, z] of [[-1.55, -2.2], [1.55, -2.2], [-1.55, 2.2], [1.55, 2.2]]) {
    const w = mesh(cyl(0.65, 0.65, 0.5, 12), mat("#0b0b0c")); w.rotation.z = Math.PI / 2; const axle = new THREE.Group(); axle.position.set(x, 0.65, z); w.position.set(0, 0, 0); axle.add(w); car.add(axle); wheels.push(axle);
  }
  car.userData = { wheels, kind: "car" };
  return car;
}

export function makeTruck(lenSim, col) {
  const L = lenSim * SCALE, truck = new THREE.Group(), wheels = [], cabL = 2.8;
  truck.add(mesh(box(3.5, 4.4, L - cabL - 0.2), mat("#d7d9dc", { roughness: 0.7 }), 0, 2.9, cabL / 2 + 0.1)); // trailer (the rear end is +Z)
  truck.add(mesh(box(3.4, 3.4, cabL), mat(col, { roughness: 0.4 }), 0, 2.1, -L / 2 + cabL / 2));
  truck.add(mesh(box(3.0, 1.2, 0.1), mat("#222a33", { roughness: 0.15 }), 0, 3.0, -L / 2 - 0.03));
  truck.add(mesh(box(3.2, 0.2, 0.1), glowMat("#660000", "#ff1010", 0.6), 0, 1.0, L / 2 + 0.03));
  for (const z of [-L / 2 + 1.2, L / 2 - 3.2, L / 2 - 1.4]) for (const x of [-1.6, 1.6]) {
    const w = mesh(cyl(0.7, 0.7, 0.6, 12), mat("#0b0b0c")); w.rotation.z = Math.PI / 2; const axle = new THREE.Group(); axle.position.set(x, 0.7, z); axle.add(w); truck.add(axle); wheels.push(axle);
  }
  truck.userData = { wheels, kind: "truck" };
  return truck;
}

// ---- roadworks: cones along the closed lane, a barrier at the near end and a warning sign well before it ----
export function makeWorks(lenSim) {
  const L = lenSim * SCALE, grp = new THREE.Group(), orange = mat("#ff6a13", { roughness: 0.6 });
  for (let z = -L / 2; z <= L / 2 + 0.1; z += 3) for (const x of [-4.6, 4.6]) grp.add(mesh(cone(0.45, 1.3), orange, x, 0.65, z));
  for (let i = 0; i < 4; i++) grp.add(mesh(cone(0.45, 1.3), orange, -4.5 + i * 3, 0.65, L / 2 + 1.6 + i * 1.8));
  grp.add(mesh(box(10, 1.0, 0.3), mat("#ffcc00"), 0, 0.9, L / 2 + 0.4));
  const s = new THREE.Group(); s.position.set(-7.5, 0, L / 2 + 65); // the warning sign stands SIGN_AHEAD (650 sim units) before the cones, off to the side
  s.add(mesh(box(0.2, 3, 0.2), mat("#444"), 0, 1.5, 0));
  const plate = mesh(box(2.4, 2.4, 0.15), mat("#ffcc00", { emissive: "#332200" }), 0, 3.4, 0); plate.rotation.z = Math.PI / 4; s.add(plate);
  grp.add(s);
  grp.userData = { kind: "works" };
  return grp;
}

// ---- pickups ----
export function makeCoin() {
  const grp = new THREE.Group(), c = mesh(cyl(1.1, 1.1, 0.25, 16), mat("#ffd23f", { metalness: 0.9, roughness: 0.25, emissive: "#664400", emissiveIntensity: 0.4 }), 0, 1.5, 0);
  c.rotation.x = Math.PI / 2; grp.add(c); grp.userData = { kind: "coin" }; return grp;
}
export function makeNitro() {
  const grp = new THREE.Group();
  grp.add(mesh(cyl(0.7, 0.7, 2.2, 16), mat("#2a7bff", { metalness: 0.6, roughness: 0.3, emissive: "#0a2a88", emissiveIntensity: 0.7 }), 0, 1.5, 0));
  grp.add(mesh(cyl(0.45, 0.7, 0.4, 16), mat("#d8e8ff", { metalness: 0.8 }), 0, 2.8, 0));
  grp.userData = { kind: "nitro" }; return grp;
}
export function makeShield() {
  const grp = new THREE.Group(), s = mesh(sphere(1.5, 20), new THREE.MeshStandardMaterial({ color: "#5fe6ff", emissive: "#1aa8d0", emissiveIntensity: 0.8, transparent: true, opacity: 0.55 }), 0, 1.8, 0);
  s.castShadow = false; grp.add(s); grp.userData = { kind: "shield" }; return grp;
}
export function makeShieldBubble() { // the bubble around a protected car
  const s = mesh(sphere(3.6, 20), new THREE.MeshStandardMaterial({ color: "#5fe6ff", emissive: "#1aa8d0", emissiveIntensity: 0.6, transparent: true, opacity: 0.22, depthWrite: false }), 0, 1.4, 0);
  s.castShadow = false; return s;
}

// ---- start gantry (five lights) and finish arch ----
export function makeGantry(finish, roadHalf) {
  const grp = new THREE.Group(), frame = mat("#2a2c31", { metalness: 0.6, roughness: 0.4 }), lights = [];
  for (const sx of [-1, 1]) grp.add(mesh(box(0.8, 10, 0.8), frame, sx * (roadHalf + 1.4), 5, 0));
  grp.add(mesh(box(roadHalf * 2 + 3.6, 1.8, 1.2), frame, 0, 10, 0));
  if (finish) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 32; const x = c.getContext("2d");
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? "#fff" : "#111"; x.fillRect(i * 8, j * 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf * 2, 1.6), new THREE.MeshBasicMaterial({ map: t })); banner.position.set(0, 8.4, 0.1); grp.add(banner);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf * 2, 2.4), new THREE.MeshBasicMaterial({ map: t })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, 0); grp.add(line);
  } else {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({ color: "#220000", emissive: "#000000" });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), m); l.position.set((i - 2) * 3.2, 10, 0.7); grp.add(l); lights.push(m);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(roadHalf * 2, 0.8), new THREE.MeshBasicMaterial({ color: "#ffffff" })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, 0); grp.add(line);
  }
  grp.userData = { lights, kind: finish ? "finish" : "start" };
  return grp;
}

// ---- scenery (simple placeholders; the real set comes in Steps 3 and 4) ----
const hashKey = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
export function makeScenery(s, leafHex) {
  const k = s.kind, r = s.r * SCALE, grp = new THREE.Group();
  if (k === "tree") {
    const style = s.style;
    if (style === "palm") { grp.add(mesh(cyl(0.25, 0.4, 8, 6), mat("#8a6a44"), 0, 4, 0)); grp.add(mesh(sphere(1.8, 8), mat(leafHex), 0, 8.4, 0)); }
    else if (style === "pine" || style === "cypress") { grp.add(mesh(cyl(0.3, 0.4, 2, 6), mat("#5b3d24"), 0, 1, 0)); grp.add(mesh(cone(r * (style === "cypress" ? 1.2 : 2.2), style === "cypress" ? 11 : 9, 8), mat(leafHex), 0, style === "cypress" ? 7 : 6, 0)); }
    else if (style === "cactus") { grp.add(mesh(cyl(0.5, 0.5, 5, 8), mat("#3f8a45"), 0, 2.5, 0)); grp.add(mesh(cyl(0.3, 0.3, 2, 8), mat("#3f8a45"), 0.9, 3.3, 0)); }
    else { grp.add(mesh(cyl(0.35, 0.5, 4, 6), mat("#5b3d24"), 0, 2, 0)); grp.add(mesh(sphere(r * 2.2, 8), mat(leafHex), 0, 4.5 + r, 0)); }
  } else if (k === "bush") grp.add(mesh(sphere(r * 1.6, 8), mat(leafHex), 0, r * 0.8, 0));
  else if (k === "rock") grp.add(mesh(sphere(r * 1.6, 6), mat("#8a8d92", { roughness: 1 }), 0, r * 0.6, 0));
  else if (k === "dune") { const d = mesh(sphere(r * 2.4, 10), mat("#c8a86a", { roughness: 1 }), 0, 0, 0); d.scale.y = 0.35; grp.add(d); }
  else if (k === "lamp") { grp.add(mesh(cyl(0.12, 0.15, 7, 6), mat("#555"), 0, 3.5, 0)); grp.add(mesh(box(0.9, 0.2, 0.5), mat("#fff3c8", { emissive: "#ffe8a0", emissiveIntensity: 0.8 }), s.side * -0.4, 7, 0)); }
  else if (k === "flag") { grp.add(mesh(cyl(0.08, 0.08, 7, 6), mat("#ccc"), 0, 3.5, 0)); grp.add(mesh(box(2.4, 1.5, 0.05), mat("#e8e8e8"), 1.2, 6.2, 0)); }
  else if (k === "board") { const col = s.sponsor ? s.sponsor[1] : "#ff8000"; grp.add(mesh(box(0.2, 2.6, 0.2), mat("#444"), 0, 1.3, 0)); grp.add(mesh(box(6, 2.2, 0.2), mat(col), 0, 3.2, 0)); }
  else if (k === "stand") { for (let i = 0; i < 3; i++) grp.add(mesh(box(10, 1.2, 2.4 - i * 0.6), mat(i % 2 ? "#cfd4da" : "#aab0b8"), 0, 0.6 + i * 1.2, i * -0.8)); grp.add(mesh(box(10.4, 0.2, 3), mat(s.roofColor || "#d33"), 0, 5.2, -1)); }
  else if (k === "building") { const h = s.bh * SCALE * 2.2, w = s.bw * SCALE * 1.6; grp.add(mesh(box(w, h, w), mat(s.bcol, { roughness: 0.8 }), 0, h / 2, 0)); }
  else if (k === "lm") { const h = s.half * SCALE * 1.7, w = s.half * SCALE * 1.2; grp.add(mesh(box(w, h, w * 0.6), mat(`hsl(${hashKey(s.key) % 360}, 25%, 62%)`, { roughness: 0.8 }), 0, h / 2, 0)); }
  else { const w = (s.half || 30) * SCALE; grp.add(mesh(box(w, w * 0.7, w * 0.8), mat(`hsl(${hashKey(s.key) % 360}, 45%, 55%)`), 0, w * 0.35, 0)); } // "prop"
  grp.rotation.y = k === "lamp" ? 0 : (s.ph || 0);
  if (k === "board" || k === "stand" || k === "lm") grp.rotation.y = s.side * -0.35; // angled towards the road
  return grp;
}
