// Small shared shapes the city is built from.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cloneModel, hasModel } from "../assets.js";
import { rng } from "./rng.js";

const flat = g => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal") o.deleteAttribute(k); return o; };

export const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // 1x1x1, standing on the ground, centred in x and z
export const unitPlane = new THREE.PlaneGeometry(1, 1);                       // faces +Z

// a gable roof: a triangular prism, 1 wide, 1 long, 0.5 high, the ridge running along Z
export function roofGeo() {
  const p = [[-.5, 0, -.5], [.5, 0, -.5], [0, .5, -.5], [-.5, 0, .5], [.5, 0, .5], [0, .5, .5]];
  const tri = (a, b, c) => [...p[a], ...p[b], ...p[c]];
  const v = [...tri(0, 2, 1), ...tri(3, 4, 5), ...tri(0, 3, 5), ...tri(0, 5, 2), ...tri(1, 2, 5), ...tri(1, 5, 4), ...tri(0, 1, 4), ...tri(0, 4, 3)];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}

// a street lamp: pole, arm reaching towards +X (the road), lamp head
export function lampGeo() {
  const pole = new THREE.CylinderGeometry(0.11, 0.17, 9, 6).translate(0, 4.5, 0);
  const arm = new THREE.BoxGeometry(2.7, 0.18, 0.18).translate(1.3, 9, 0);
  const head = new THREE.BoxGeometry(1.2, 0.26, 0.55).translate(2.4, 8.92, 0);
  return mergeGeometries([flat(pole), flat(arm), flat(head)]);
}
export const lampGlowGeo = () => new THREE.BoxGeometry(1.0, 0.1, 0.42).translate(2.4, 8.75, 0);

export const personGeo = () => flat(new THREE.CapsuleGeometry(0.34, 1.25, 3, 6).translate(0, 1.0, 0));
export const headGeo = () => new THREE.SphereGeometry(0.3, 6, 5).translate(0, 2.15, 0);

// low-poly mountain: a rough, squashed icosahedron, base at y=0
export function hillGeo(detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); g.translate(0, 0.0, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.max(y, -0.15)); }
  g.computeVertexNormals(); return g;
}

// A tree from one of the Kenney models, split into trunk and leaves, each as ONE geometry with the model's size scaled to
// height 1 and its base at y=0 (so an instance scale of 10 is a 10-unit tree).
export function treeGeos(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), trunk = [], leaves = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = flat(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    (/leaf|leafs|grass|plant|cactus/i.test(o.material.name) ? leaves : trunk).push(g);
  });
  const all = mergeGeometries([...trunk, ...leaves]); all.computeBoundingBox();
  const bb = all.boundingBox, k = 1 / (bb.max.y - bb.min.y), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const fit = g => g.translate(-cx, -bb.min.y, -cz).scale(k, k, k);
  return { trunk: trunk.length ? fit(mergeGeometries(trunk)) : null, leaves: leaves.length ? fit(mergeGeometries(leaves)) : null, width: (bb.max.x - bb.min.x) * k };
}

// a small yacht: hull, deck house and a mast, bow towards -Z, base at y=0 (1 wide, about 3.4 long)
export function yachtGeo() {
  const hull = new THREE.BoxGeometry(1, 0.38, 3.4).translate(0, 0.19, 0);
  const bow = new THREE.ConeGeometry(0.5, 0.9, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4).scale(1, 0.42, 1).translate(0, 0.19, -2.1);
  const cabin = new THREE.BoxGeometry(0.72, 0.34, 1.3).translate(0, 0.55, 0.2);
  const top = new THREE.BoxGeometry(0.5, 0.22, 0.7).translate(0, 0.83, 0.3);
  const mast = new THREE.CylinderGeometry(0.02, 0.025, 1.6, 4).translate(0, 1.5, 0.2);
  return mergeGeometries([flat(hull), flat(bow), flat(cabin), flat(top), flat(mast)]);
}

// a bus shelter: roof slab, back and side glass, a bench; open side towards +X (the road), 6 long, base at y=0
export function busStopGeo() {
  const roof = new THREE.BoxGeometry(2.6, 0.18, 6.4).translate(0, 3.5, 0);
  const back = new THREE.BoxGeometry(0.1, 3.3, 6.0).translate(-1.1, 1.75, 0);
  const sideA = new THREE.BoxGeometry(2.3, 3.3, 0.1).translate(0, 1.75, -3.0), sideB = new THREE.BoxGeometry(2.3, 3.3, 0.1).translate(0, 1.75, 3.0);
  const bench = new THREE.BoxGeometry(0.7, 0.14, 4.2).translate(-0.6, 1.0, 0);
  const pole = new THREE.CylinderGeometry(0.08, 0.08, 6, 5).translate(1.2, 3, 3.6);
  return mergeGeometries([flat(roof), flat(back), flat(sideA), flat(sideB), flat(bench), flat(pole)]);
}

// A car from the Kenney car kit as ONE geometry (body and wheels together), 6.2 long, facing -Z, standing on y=0.
// The material is the model's own, so the colours of the paint come from its picture.
export function carGeo(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = []; let material = null;
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); material = material || o.material;
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const all = mergeGeometries(parts); all.rotateY(Math.PI); all.computeBoundingBox();
  const bb = all.boundingBox, k = 6.2 / (bb.max.z - bb.min.z);
  all.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, k, k);
  return { geometry: all, material, width: (bb.max.x - bb.min.x) * k };
}

// a catch-fence: a see-through diamond mesh (alpha texture), 1x1, facing +Z
export function fenceTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.strokeStyle = "#cfd3d8"; g.lineWidth = 3;
  g.beginPath(); for (let i = -64; i <= 128; i += 16) { g.moveTo(i, 0); g.lineTo(i + 64, 64); g.moveTo(i + 64, 0); g.lineTo(i, 64); } g.stroke();
  g.fillStyle = "#cfd3d8"; g.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}

// a flower bed 6 long and 1.7 wide: dark soil, a mound of green leaves, and colourful flower heads (vertex colours; the layout is fixed)
export function flowerBedGeo() {
  const rnd = rng(4242), parts = [], col = (g, c) => { const o = flat(g), a = new Float32Array(o.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } o.setAttribute("color", new THREE.BufferAttribute(a, 3)); return o; };
  const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }, GREENS = ["#2f6b2f", "#3d8a3a", "#4f9a3f", "#2a5f2e"].map(lin), FLOWERS = ["#d6342a", "#f08ab0", "#f2c230", "#ffffff", "#8a3fa8", "#ff8a1f", "#e8506a"].map(lin);
  parts.push(col(new THREE.BoxGeometry(6, 0.42, 1.7).translate(0, 0.21, 0), lin("#3a2a1f")));
  for (let i = 0; i < 40; i++) parts.push(col(new THREE.SphereGeometry(rnd.range(0.26, 0.42), 6, 4).scale(1, 0.75, 1).translate(rnd.range(-2.8, 2.8), 0.5, rnd.range(-0.62, 0.62)), rnd.pick(GREENS)));
  const tone = []; for (let k = 0; k < 4; k++) tone.push(rnd.pick(FLOWERS)); // each bed is mostly two or three colours
  for (let i = 0; i < 80; i++) parts.push(col(new THREE.SphereGeometry(rnd.range(0.1, 0.16), 5, 4).translate(rnd.range(-2.85, 2.85), rnd.range(0.62, 0.82), rnd.range(-0.7, 0.7)), tone[Math.floor(rnd() * (i < 55 ? 2 : 4))]));
  return mergeGeometries(parts);
}
