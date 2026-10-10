// THE CITY: buildings, ground, water and street life, built around the road as you drive.
//
// The road is cut into "chunks" (slices along the route). Four layers each cut it differently:
//   F  street front   (0..30 units from the kerb, chunks of 40): buildings lining the circuit, shops, signs, lamps, trees, people, parked cars
//   B  city blocks    (50..360, chunks of 60): a grid of lots with mid- and high-rise buildings, houses, farms, boats
//   S  skyline        (340..1150, chunks of 120): a dense layer of cheap towers, hills and distant towns
//   G  ground         (chunks of 60): pavement, grass, sand, fields and water
//   H  heroes         (chunks of 60): landmarks, grandstands and country props, placed one by one
// Each chunk is built from a seeded random generator keyed by (city, chunk number), so a city looks the same on every run.
// Every layer is a ring of slots: when a chunk scrolls behind you its slot is rewritten with the next chunk ahead. Nothing is
// created while driving, and each kind of thing is ONE draw call however many copies are on screen.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SCALE, roadHalf } from "../mapping.js";
import { rng, hash, noise2 } from "./rng.js";
import { profileOf, ZONES, PALETTES, FACADES } from "./profiles.js";
import { SlotMesh } from "./slotmesh.js";
import { unitBox, unitPlane, roofGeo, lampGeo, lampGlowGeo, personGeo, headGeo, hillGeo, treeGeos, yachtGeo, busStopGeo, carGeo, fenceTexture, flowerBedGeo } from "./geo.js";
import { shared, buildingMaterial, solidMaterial, makeSignAtlas, signMaterial, signRect, SIGN_COUNT, makeBannerAtlas, groundMaterials } from "./materials.js";
import { leafMat, crowdMat, setCrowd, lightWindows, windowMats } from "../scenery.js";
import { cloneModel, hasModel, fitModel, sceneOf } from "../assets.js";
import { makeLandmark, hasLandmark } from "../landmarks.js";
import { makeProp, hasProp } from "../props.js";

const LF = 40, LB = 60, LS = 120, LG = 60, LH = 60;                // chunk lengths
const AHEAD = { F: 330, B: 640, S: 1450, G: 1450 }, BEHIND = { F: 100, B: 140, S: 140, G: 140 };
const ROAD_EDGE = 17.4;                                            // where the kerb ends
const X0 = 60;                                                     // the first column of city blocks starts this far from the road centre
const STRIPS = [[ROAD_EDGE, 28], [28, 340], [340, 1500]];          // ground strips (x from the road centre)
const FORCE_ZONE = new URLSearchParams(location.search).get("zone"); // testing: ?zone=harbour forces one neighbourhood type everywhere
const HERO_ALL = new URLSearchParams(location.search).has("heroes"); // testing: ?heroes puts a landmark, a grandstand and props in every chunk

const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const PAL = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, v.map(lin)]));
const AWNINGS = ["#c8372d", "#2d6fb5", "#2e8b57", "#e0a526", "#7a3f9d", "#e9e9e4", "#d9622b"].map(lin);
const ROOF_KIT = ["#8b9096", "#6f757c", "#a7abb0", "#5d6269"].map(lin);
const BOAT = ["#f4f4f2", "#f4f4f2", "#1c2a3a", "#c8d4dc", "#e8e2d0"].map(lin);
const CAP = { F: { boxes: 36, solid: 110, signs: 22, banners: 14, lamps: 6, glow: 6, light: 10, trees: 16, people: 24, cars: 4, stops: 2, fence: 12, models: 6, flowers: 6 },
  B: { boxes: 64, solid: 96, trees: 40, houses: 26, yachts: 8, models: 12 }, S: { boxes: 64, hills: 18 } };
const CAR_MODELS = ["sedan", "sedan-sports", "hatchback-sports", "suv", "taxi", "van"];
const BUILD_MODELS = ["building-a", "building-d", "building-i", "building-skyscraper-a", "building-skyscraper-d"];

const mod = (a, n) => ((a % n) + n) % n;

// Kenney building as one geometry scaled to a 1x1x1 box (base at y=0), so an instance size is the building's real size
function unitModel(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = []; let material = null;
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); material = material || o.material; for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k); parts.push(g.index ? g.toNonIndexed() : g); });
  const all = mergeGeometries(parts); all.computeBoundingBox(); const bb = all.boundingBox, sz = new THREE.Vector3(); bb.getSize(sz);
  all.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(1 / sz.x, 1 / sz.y, 1 / sz.z);
  lightWindows([{ material }]);
  return { geometry: all, material, aspect: sz.y / Math.max(sz.x, sz.z) };
}

// merge a landmark / prop (many little meshes) into one mesh per material, so a hero object costs a handful of draw calls
function mergeStatic(grp) {
  if (grp.userData.spin || grp.userData.ball) return grp;
  grp.updateMatrixWorld(true); const by = new Map();
  grp.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k); (by.get(o.material) || by.set(o.material, []).get(o.material)).push(g.index ? g.toNonIndexed() : g); });
  const out = new THREE.Group();
  for (const [mat, list] of by) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; out.add(m); }
  out.userData = { ...grp.userData }; return out;
}

export function createCity(scene) {
  const root = new THREE.Group(); root.name = "city"; scene.add(root);
  const gF = new THREE.Group(), gB = new THREE.Group(), gS = new THREE.Group(), gG = new THREE.Group(), gH = new THREE.Group(), gBack = new THREE.Group(); root.add(gF, gB, gS, gG, gH, gBack);

  const bMat = buildingMaterial(), sMat = solidMaterial(), ground = groundMaterials();
  const signTex = { paint: makeSignAtlas("paint"), neon: makeSignAtlas("neon") };
  const signMat = signMaterial(signTex.paint);
  const sponsors = typeof SPONSORS !== "undefined" ? SPONSORS : [["EXTREME RACER", "#7b2cbf"]];
  const banners = makeBannerAtlas(sponsors), bannerMat = signMaterial(banners.tex);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.82, 0.5), toneMapped: false });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.7), toneMapped: false });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.8 });
  const stopMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.85 });
  const fenceMat = new THREE.MeshBasicMaterial({ map: fenceTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  const TYPES = { round: "tree_default", pine: "tree_pineTallA", palm: "tree_palmTall", cactus: "cactus_tall" };
  const treeG = {}; for (const [k, name] of Object.entries(TYPES)) treeG[k] = treeGeos(name);
  const carG = CAR_MODELS.map(carGeo).filter(Boolean), modelG = BUILD_MODELS.map(unitModel).filter(Boolean);

  const slotsOf = id => Math.ceil((AHEAD[id] + BEHIND[id]) / { F: LF, B: LB, S: LS, G: LG }[id]) + 2;
  const nF = slotsOf("F"), nB = slotsOf("B"), nS = slotsOf("S"), nG = slotsOf("G");

  // ---- the instanced meshes ----
  const F = {
    boxes: new SlotMesh(gF, unitBox, bMat, nF, CAP.F.boxes, { color: true, seed: true, shadow: true }),
    solid: new SlotMesh(gF, unitBox, sMat, nF, CAP.F.solid, { color: true, shadow: true }),
    signs: new SlotMesh(gF, unitPlane, signMat, nF, CAP.F.signs, { rect: true }),
    banners: new SlotMesh(gF, unitPlane, bannerMat, nF, CAP.F.banners, { rect: true }),
    lamps: new SlotMesh(gF, lampGeo(), lampMat, nF, CAP.F.lamps, { shadow: true }),
    glow: new SlotMesh(gF, lampGlowGeo(), glowMat, nF, CAP.F.glow, {}),
    light: new SlotMesh(gF, unitBox, lightMat, nF, CAP.F.light, {}),
    people: new SlotMesh(gF, personGeo(), sMat, nF, CAP.F.people, { color: true }),
    heads: new SlotMesh(gF, headGeo(), skinMat, nF, CAP.F.people, {}),
    stops: new SlotMesh(gF, busStopGeo(), stopMat, nF, CAP.F.stops, { shadow: true }),
    fence: new SlotMesh(gF, unitPlane, fenceMat, nF, CAP.F.fence, {}),
    flowers: new SlotMesh(gF, flowerBedGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nF, CAP.F.flowers, {}),
    cars: carG.map(c => new SlotMesh(gF, c.geometry, c.material, nF, CAP.F.cars, { shadow: true })),
    models: modelG.map(c => new SlotMesh(gF, c.geometry, c.material, nF, CAP.F.models, { shadow: true })),
    trees: {},
  };
  const B = {
    boxes: new SlotMesh(gB, unitBox, bMat, nB, CAP.B.boxes, { color: true, seed: true, shadow: true }),
    solid: new SlotMesh(gB, unitBox, sMat, nB, CAP.B.solid, { color: true }),
    houses: new SlotMesh(gB, unitBox, sMat, nB, CAP.B.houses, { color: true, shadow: true }),
    roofs: new SlotMesh(gB, roofGeo(), sMat, nB, CAP.B.houses, { color: true }),
    yachts: new SlotMesh(gB, yachtGeo(), boatMat, nB, CAP.B.yachts, { color: true }),
    models: modelG.map(c => new SlotMesh(gB, c.geometry, c.material, nB, CAP.B.models, { shadow: true })),
    trees: {},
  };
  const S = {
    boxes: new SlotMesh(gS, unitBox, bMat, nS, CAP.S.boxes, { color: true, seed: true }),
    hills: new SlotMesh(gS, hillGeo(1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), nS, CAP.S.hills, { color: true }),
  };
  for (const k of Object.keys(treeG)) {
    const t = treeG[k]; if (!t) continue;
    F.trees[k] = { trunk: t.trunk ? new SlotMesh(gF, t.trunk, trunkMat, nF, CAP.F.trees, { shadow: true }) : null, leaves: t.leaves ? new SlotMesh(gF, t.leaves, leafMat, nF, CAP.F.trees, { shadow: true }) : null };
    B.trees[k] = { trunk: t.trunk ? new SlotMesh(gB, t.trunk, trunkMat, nB, CAP.B.trees, {}) : null, leaves: t.leaves ? new SlotMesh(gB, t.leaves, leafMat, nB, CAP.B.trees, {}) : null };
  }
  const treeMeshes = T => Object.values(T).flatMap(t => [t.trunk, t.leaves]).filter(Boolean);
  const listF = [F.boxes, F.solid, F.signs, F.banners, F.lamps, F.glow, F.light, F.people, F.heads, F.stops, F.fence, F.flowers, ...F.cars, ...F.models, ...treeMeshes(F.trees)];
  const listB = [B.boxes, B.solid, B.houses, B.roofs, B.yachts, ...B.models, ...treeMeshes(B.trees)];
  const listS = [S.boxes, S.hills];

  // ---- ground: for each chunk slot, three strips per side ----
  const gslots = [];
  const stripGeo = (side, x0, x1) => { // a quad lying on the ground; UVs are world units so every texture says how big its own repeat is
    const a = side * x0, b = side * x1, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([a, 0, 0, b, 0, 0, b, 0, -LG, a, 0, -LG], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([x0, 0, x1, 0, x1, LG, x0, LG], 2));
    g.setIndex(side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); return g;
  };
  const geos = [-1, 1].map(side => STRIPS.map(([x0, x1]) => stripGeo(side, x0, x1)));
  ground.city.map.offset.set(-X0 / 30, 0);
  for (let i = 0; i < nG; i++) {
    const grp = new THREE.Group(), meshes = [];
    for (let si = 0; si < 2; si++) { meshes.push([]); for (let st = 0; st < 3; st++) { const m = new THREE.Mesh(geos[si][st], ground.grass); m.receiveShadow = true; grp.add(m); meshes[si].push(m); } }
    gG.add(grp); gslots.push({ grp, meshes, chunk: NaN, city: -1, start: 0 });
  }

  // ---- bookkeeping per layer ----
  const mkLayer = (id, L, n, meshes) => ({ id, L, n, meshes, chunk: new Float64Array(n).fill(NaN), city: new Int32Array(n).fill(-1), start: new Float64Array(n), data: Array.from({ length: n }, () => ({})) });
  const lay = { F: mkLayer("F", LF, nF, listF), B: mkLayer("B", LB, nB, listB), S: mkLayer("S", LS, nS, listS) };
  let sBase = 0, lastD = 0, quality = { ahead: 1, density: 1 };
  const lamps = []; let lampCount = 0;

  // ---- which city / neighbourhood is at a place on the route ----
  function cityForS(s) { // s in world units along the route
    if (typeof level !== "undefined" && level) return { idx: level.idx, start: level.d0 * SCALE };
    const sim = s / SCALE, stage = Math.floor(sim / STAGE_LEN);
    return { idx: mod(stage, ROUTE.length), start: stage * STAGE_LEN * SCALE };
  }
  const zonePick = (profile, city, block) => {
    if (FORCE_ZONE) return FORCE_ZONE;
    const r = rng(hash(city, block, 1234)), entries = Object.entries(profile.zones), tot = entries.reduce((a, [, w]) => a + w, 0);
    let x = r() * tot; for (const [name, w] of entries) { if ((x -= w) < 0) return name; } return entries[0][0];
  };
  function zoneAt(prof, city, sRel, side) { // the neighbourhood next to the road at sRel, on one side
    const name = zonePick(prof, city, Math.floor(sRel / 300));
    const wsd = prof.water && (prof.water.side === "B" || (prof.water.side === "L" ? -1 : 1) === side);
    if (name === "harbour") return wsd ? { type: "harbour", water: true } : { type: "urban", water: false };
    return { type: name, water: false };
  }
  function chunkCtx(L, k) {
    const s0 = k * L, c = cityForS(s0 + L / 2), prof = profileOf(ROUTE[c.idx].venue);
    return { city: c.idx, start: c.start, rel: Math.floor((s0 - c.start) / L), s0, prof, st: ROUTE[c.idx], sRel: s0 - c.start + L / 2, zone: side => zoneAt(prof, c.idx, s0 - c.start + L / 2, side) };
  }
  const tunnelAt = (prof, sRel) => prof.tunnel > 0 && mod(sRel, prof.tunnel) > prof.tunnel * 0.5 && mod(sRel, prof.tunnel) < prof.tunnel * 0.5 + 95; // (Monaco)

  const hsv = (r, pal) => { const c = pal[r.int(0, pal.length - 1)], k = r.range(0.9, 1.08); return [c[0] * k, c[1] * k, c[2] * k]; };
  const treeKind = (st, r) => { const t = st.trees ? r.pick(st.trees) : "round"; return t === "pine" || t === "cypress" ? "pine" : t === "palm" ? "palm" : t === "cactus" ? "cactus" : "round"; };
  const treeSize = { round: [9, 14], pine: [12, 19], palm: [12, 16], cactus: [3.5, 6] };
  function addTree(meshes, kind, x, z, r, scale = 1) {
    const m = meshes[kind] || meshes.round; if (!m) return; const [lo, hi] = treeSize[kind] || treeSize.round, h = r.range(lo, hi) * scale;
    m.trunk && m.trunk.add(x, 0, z, h, h, h, r() * 6.28); m.leaves && m.leaves.add(x, 0, z, h, h, h, r() * 6.28);
  }

  // =================================================================================================================================
  // H: heroes - landmarks, grandstands, country props (a short list per chunk, built once and remembered)
  // =================================================================================================================================
  const heroCache = new Map();
  function heroesOfChunk(k) {
    let list = heroCache.get(k); if (list) return list;
    list = []; const ctx = chunkCtx(LH, k), lms = ctx.st.lms || [];
    // 1. the city's attractions, one every ~120 units, alternating sides and cycling through the list: big, close to the street, impossible to miss
    if (lms.length && (HERO_ALL || mod(ctx.rel, 2) === 0)) {
      const q = Math.floor(ctx.rel / 2), r2 = rng(hash(ctx.city, q, 501)), key = lms[mod(q, lms.length)], side = mod(q, 2) ? -1 : 1, zi = ctx.zone(side), far = zi.water, u = r2.range(10, 50);
      if (hasLandmark(key)) list.push({ kind: "lm", key, s: ctx.s0 + u, x: side * (far ? r2.range(300, 400) : r2.range(70, 88)), side, sc: far ? 3.4 : 2.6, ry: -side * 0.3, rad: far ? 60 : 32, range: 1500 });
    }
    // 2. the city's signature on the skyline: the first attraction, huge, far off, so each city has a recognisable horizon
    if (lms.length && (HERO_ALL || mod(ctx.rel, 7) === 3)) {
      const r4 = rng(hash(ctx.city, Math.floor(ctx.rel / 7), 777)), key = lms[mod(Math.floor(ctx.rel / 7), Math.min(2, lms.length))], side = r4.chance(0.5) ? -1 : 1;
      if (hasLandmark(key)) list.push({ kind: "lm", key, s: ctx.s0 + r4.range(10, 50), x: side * r4.range(430, 640), side, sc: 7.5, ry: -side * 0.4, rad: 70, range: 1500 });
    }
    const r3 = rng(hash(ctx.city, Math.floor(ctx.rel / 7), 502));
    if (HERO_ALL || mod(ctx.rel, 7) === r3.int(0, 6)) for (const side of [-1, 1]) { // grandstands with crowds
      const zi = ctx.zone(side); if (zi.water || ["country", "desert", "residential"].includes(zi.type) || !r3.chance(0.8)) continue;
      list.push({ kind: "stand", key: r3.chance(0.5) ? "grandStand" : "grandStandCovered", s: ctx.s0 + r3.range(14, 46), x: side * 39, side, sc: 18, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, rad: 12, range: 520 });
    }
    const rp = rng(hash(ctx.city, ctx.rel, 503)), props = ctx.st.props || [];
    for (const side of [-1, 1]) { // the city's own roadside things: out in the quiet neighbourhoods, and along the pavement in the busy ones
      const zi = ctx.zone(side); if (zi.water || !props.length) continue;
      if (["park", "country", "residential", "desert"].includes(zi.type)) {
        const n = rp.int(0, 2); for (let i = 0; i < n; i++) { const key = props[rp.int(0, props.length - 1)][0]; if (hasProp(key)) list.push({ kind: "prop", key, s: ctx.s0 + rp.range(2, 58), x: side * rp.range(28, 58), side, sc: 1.5, ry: -side * 0.5 + rp.range(-0.4, 0.4), rad: 7, range: 380 }); }
      } else if (rp.chance(0.7)) { // street dressing: a lantern pole, phone box, neon sign... standing on the pavement
        const near = props.filter(p => !p[2]); if (!near.length) continue;
        const key = near[rp.int(0, near.length - 1)][0]; if (hasProp(key)) list.push({ kind: "prop", key, s: ctx.s0 + rp.range(4, 56), x: side * rp.range(21.8, 24.2), side, sc: 1.25, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2, rad: 4, range: 300 });
      }
    }
    heroCache.set(k, list); if (heroCache.size > 400) heroCache.delete(heroCache.keys().next().value);
    return list;
  }
  const heroBlocks = (side, s0, s1, x0, x1) => { // is a hero standing on the strip s0..s1 x x0..x1 on this side?
    for (let k = Math.floor((s0 - 40) / LH); k <= Math.floor((s1 + 40) / LH); k++) for (const h of heroesOfChunk(k)) if (h.side === side && h.s + h.rad > s0 && h.s - h.rad < s1 && Math.abs(h.x) + h.rad > x0 && Math.abs(h.x) - h.rad < x1) return true;
    return false;
  };
  const heroPool = new Map(), heroActive = new Map(); let heroStamp = 0;
  function makeHero(h) {
    if (h.kind === "lm") return mergeStatic(makeLandmark(h.key, 9));
    if (h.kind === "prop") return mergeStatic(makeProp(h.key));
    const m = cloneModel(h.key); m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material.name === "red") o.material = crowdMat; } });
    return fitModel(m, { width: 1 });
  }
  function updateHeroes(D, ahead) {
    heroStamp++;
    const kmin = Math.floor((D - 100) / LH), kmax = Math.floor((D + ahead) / LH);
    for (let k = kmin; k <= kmax; k++) {
      const list = heroesOfChunk(k);
      for (let i = 0; i < list.length; i++) {
        const h = list[i], z = D - h.s; if (z < -h.range * Math.min(1, ahead / 1000 + 0.3)) continue;
        const id = k * 16 + i; let a = heroActive.get(id);
        if (!a) { const key = h.kind + ":" + h.key, p = heroPool.get(key), obj = p && p.pop() || makeHero(h); obj.userData.poolKey = key; obj.scale.setScalar(h.sc); obj.rotation.y = h.ry; obj.position.x = h.x; gH.add(obj); a = { obj, stamp: 0 }; heroActive.set(id, a); }
        a.stamp = heroStamp; a.obj.position.z = z;
      }
    }
    for (const [id, a] of heroActive) if (a.stamp !== heroStamp) { gH.remove(a.obj); const key = a.obj.userData.poolKey; (heroPool.get(key) || heroPool.set(key, []).get(key)).push(a.obj); heroActive.delete(id); }
  }

  // =================================================================================================================================
  // F: the street front
  // =================================================================================================================================
  function buildF(slot, k) {
    const ctx = chunkCtx(LF, k), data = lay.F.data[slot] = { lamps: [] }, ms = lay.F.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch];
    const tun = tunnelAt(prof, ctx.sRel - LF / 2) || tunnelAt(prof, ctx.sRel + LF / 2) || tunnelAt(prof, ctx.sRel);
    const rb = rng(hash(ctx.city, ctx.rel, 77)), zl0 = ctx.zone(-1), zr0 = ctx.zone(1);
    for (const side of [-1, 1]) {
      const zi = side < 0 ? zl0 : zr0, Z = ZONES[zi.type], r = rng(hash(ctx.city, ctx.rel, 100 + (side > 0 ? 1 : 0))), neon = prof.sign === "neon";
      const faceRot = side < 0 ? Math.PI / 2 : -Math.PI / 2, built = Z.fh[1] > 0 && !zi.water, urbanish = Z.shops || zi.type === "harbour";
      // barrier along the track (plain red and white: no banners)
      for (let u = 4; u < LF; u += 8) {
        const odd = Math.floor((ctx.s0 + u) / 8) % 2;
        F.solid.add(side * 18.8, 0, zl(u), 1.0, 1.05, 8, 0, odd ? 0.8 : 0.9, odd ? 0.1 : 0.9, odd ? 0.08 : 0.9);
      }
      if (urbanish && !tun && r.chance(0.3)) for (let u = 4; u < LF; u += 8) F.fence.add(side * 19.3, 3.45, zl(u), 8, 4.8, 1, faceRot); // catch fencing
      // street lamps (every 20 units, staggered between the two sides)
      if ((zi.type !== "country" || r.chance(0.4)) && !tun) for (let u = side < 0 ? 7 : 17; u < LF; u += 20) {
        F.lamps.add(side * 20.2, 0, zl(u), 1, 1, 1, side > 0 ? Math.PI : 0); F.glow.add(side * 20.2, 0, zl(u), 1, 1, 1, side > 0 ? Math.PI : 0);
        data.lamps.push({ s: ctx.s0 + u, hx: side * (20.2 - 2.4), side });
      }
      if (zi.water) { for (let u = 3; u < LF; u += 9) F.solid.add(side * 33, 0, zl(u), 0.5, 1.6, 0.5, 0, 0.18, 0.18, 0.2); continue; } // harbour: quay, bollards
      if (!tun) {
        if (urbanish || zi.type === "residential") { // planter trees, parked cars, a bus stop
          for (let u = side < 0 ? 17 : 7; u < LF; u += 20) if (r.chance(0.75)) { F.solid.add(side * 20.6, 0, zl(u), 1.5, 0.9, 1.5, 0, 0.45, 0.4, 0.38); addTree(F.trees, treeKind(ctx.st, r), side * 20.6, zl(u), r, 0.55); }
          if (carG.length) for (let i = r.int(0, 2); i > 0; i--) F.cars[r.int(0, F.cars.length - 1)].add(side * 23.6, 0, zl(r.range(3, LF - 3)), 1, 1, 1, r.chance(0.5) ? 0 : Math.PI);
          if (r.chance(0.12)) F.stops.add(side * 22.4, 0, zl(r.range(8, 32)), 1, 1, 1, side > 0 ? Math.PI : 0);
          if (r.chance(zi.type === "residential" ? 0.5 : 0.32)) F.flowers.add(side * 26.9, 0, zl(r.range(4, 36)), 1, 1, 1, 0); // a flower bed against the frontage
        }
      }
      if (built) {
        const xEdge = zi.type === "residential" ? 31 : 28, standHere = heroBlocks(side, ctx.s0, ctx.s0 + LF, 26, 52);
        let u = r.range(0, 3);
        while (u < LF - 6) {
          let w = r.range(Z.fw[0], Z.fw[1]); if (u + w > LF) w = LF - u; if (w < 6) break;
          if (standHere && heroBlocks(side, ctx.s0 + u, ctx.s0 + u + w, 26, 52)) { u += w + 1; continue; } // a grandstand stands here
          const d = r.range(13, 21), floors = r.int(Z.fh[0], Z.fh[1]);
          const h = Math.max(7, floors * 4.4 * prof.height * (zi.type === "residential" ? 1 : r.range(0.85, 1.15))), xc = side * (xEdge + d / 2 + r.range(0, 1.5)), col = hsv(r, pal), seed = r(), zc = zl(u + w / 2);
          if (modelG.length && Z.shops && r.chance(0.26)) { // a hand-made Kenney building for variety
            const mi = r.int(0, modelG.length - 1), mg = modelG[mi], fp = Math.min(w * 0.95, 20), mh = Math.max(14, floors * 4.2);
            F.models[mi].add(side * (xEdge + fp * 0.5 + 0.4), 0, zc, fp, Math.min(mh, fp * mg.aspect * 1.3), fp * 0.9, faceRot - (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (side < 0 ? Math.PI / 2 : -Math.PI / 2), 1, 1, 1);
            u += w + r.range(0.2, 1); continue;
          }
          const podium = zi.type === "downtown" && floors >= 12 && r.chance(0.55);
          if (podium) { // a wide base with a narrower tower on top
            F.boxes.add(side * (xEdge + d * 0.58), 0, zc, d * 1.16, 9.5, w, 0, col[0] * 0.92, col[1] * 0.92, col[2] * 0.92, r());
            F.boxes.add(side * (xEdge + d * 0.78), 0, zc, d * 0.72, h, w * 0.78, 0, col[0], col[1], col[2], seed);
          } else F.boxes.add(xc, 0, zc, d, h, w, 0, col[0], col[1], col[2], seed);
          if (Z.houses) { const c2 = hsv(r, PAL.warm); F.solid.add(xc, h, zc, d * 1.05, h * 0.35, w * 1.05, 0, c2[0] * 0.8, c2[1] * 0.5, c2[2] * 0.45); }
          if (floors >= 14) { const th = h * r.range(0.15, 0.35); F.boxes.add(xc + side * d * 0.1, h, zc, d * 0.68, th, w * 0.72, 0, col[0] * 0.95, col[1] * 0.95, col[2] * 0.95, r()); }
          if (Z.shops) {
            const a = AWNINGS[r.int(0, AWNINGS.length - 1)];
            F.solid.add(side * (xEdge - 1.1), 3.2, zc, 2.3, 0.3, w * 0.84, 0, a[0], a[1], a[2]);
            const sw = Math.min(w * 0.62, 8.5);
            F.signs.add(side * (xEdge - 0.08), 3.55, zc, sw, sw / 4.4, 1, faceRot, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1)));
            if (neon || r.chance(0.3)) F.signs.add(side * (xEdge - 0.9), 9 + r.range(0, 8), zl(u + w * r.range(0.15, 0.85)), 1.6, 5.5, 1, 0, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1))); // blade sign over the street
            if (neon && floors >= 6 && r.chance(0.45)) F.signs.add(side * (xEdge - 0.12), Math.min(h * 0.6, 40), zc, Math.min(w * 0.85, 17), Math.min(w * 0.85, 17) / 4.4, 1, faceRot, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1))); // a big LED screen
          }
          for (let i = r.int(0, 2); i > 0; i--) { const g = ROOF_KIT[r.int(0, 3)]; F.solid.add(xc + r.range(-d * 0.3, d * 0.3), h, zc + r.range(-w * 0.3, w * 0.3), r.range(1.5, 4), r.range(1, 2.8), r.range(1.5, 4), 0, g[0], g[1], g[2]); }
          if (floors > 12 && r.chance(0.4)) F.solid.add(xc, h, zc, 0.35, r.range(6, 15), 0.35, 0, 0.7, 0.7, 0.72);
          u += w + (r.chance(0.2) ? r.range(3, 6) : r.range(0.2, 1.0));
        }
      } else if (zi.type !== "country" || r.chance(0.5)) { // park / countryside: scattered trees
        if (zi.type === "park" && r.chance(0.6)) F.flowers.add(side * r.range(22, 32), 0, zl(r.range(4, 36)), r.range(0.9, 1.3), 1, r.range(1, 1.5), 0); // flower beds in the park
        for (let i = Math.round(Z.tree * 5); i > 0; i--) addTree(F.trees, treeKind(ctx.st, r), side * r.range(23, 70), zl(r.range(0, LF)), r);
      }
      if (Z.shops && !tun) for (let i = r.int(0, 3); i > 0; i--) { const c = hsv(r, PAL.colonial), x = side * r.range(24.6, 26.6), z = zl(r.range(0, LF)); F.people.add(x, 0, z, 0.85, 0.85, 0.85, r() * 6, c[0], c[1], c[2]); F.heads.add(x, 0, z, 0.85, 0.85, 0.85); } // people on the pavement
    }
    if (tun) for (let u = 0; u < LF; u += 4) { // a tunnel: roof, side walls and ceiling lights over the part of this chunk that is inside it
      if (!tunnelAt(prof, ctx.sRel - LF / 2 + u + 2)) continue;
      F.solid.add(0, 11, zl(u + 2), 40, 1.6, 4.05, 0, 0.32, 0.33, 0.35);
      for (const side of [-1, 1]) F.solid.add(side * 19.6, 0, zl(u + 2), 1.6, 11, 4.05, 0, 0.36, 0.37, 0.4);
      if (u % 8 === 0) for (const x of [-8, 8]) F.light.add(x, 10.7, zl(u + 2), 0.5, 0.2, 3.2);
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // B: city blocks
  // =================================================================================================================================
  function buildB(slot, k) {
    const ctx = chunkCtx(LB, k), ms = lay.B.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch], dens = quality.density;
    for (const side of [-1, 1]) {
      const zi = ctx.zone(side), Z = ZONES[zi.type], r = rng(hash(ctx.city, ctx.rel, 200 + (side > 0 ? 1 : 0)));
      if (zi.water) { for (let i = r.int(2, 5); i > 0; i--) { const c = BOAT[r.int(0, BOAT.length - 1)], s = r.range(5, 11); B.yachts.add(side * r.range(55, 300), 0.0, zl(r.range(0, LB)), s, s, s, r.range(-0.4, 0.4) + (r.chance(0.5) ? 0 : Math.PI), c[0], c[1], c[2]); } continue; } // boats on the water
      for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
        const cx = X0 + col * 30 + 11 + r.range(-2, 2), cz = row * 30 + 11 + r.range(-2, 2);
        if (heroBlocks(side, ctx.s0 + cz - 12, ctx.s0 + cz + 12, cx - 12, cx + 12)) continue;
        if (r() > Z.occ * (0.55 + 0.45 * dens) || (dens < 0.7 && (col + row) % 2)) { if (Z.tree > 0.4 && r.chance(0.7)) for (let i = r.int(1, 3); i > 0; i--) addTree(B.trees, treeKind(ctx.st, r), side * (cx + r.range(-9, 9)), zl(cz + r.range(-9, 9)), r); continue; }
        const fpx = r.range(12, 20), fpz = r.range(12, 20), nse = noise2((ctx.s0 + cz) * 0.004, cx * 0.006, ctx.city);
        const floors = Z.bh[0] + (Z.bh[1] - Z.bh[0]) * Math.pow(nse, 1.35) * r.range(0.6, 1.1), h = Math.max(6, floors * 4.4 * prof.height);
        const slope = prof.hill && (prof.hill === "L" ? -1 : 1) === side ? Math.max(0, (cx - 50) * 0.3) : 0, col3 = hsv(r, pal), seed = r();
        if (Z.houses || Z.farm) { // houses and farm buildings: a coloured box with a roof
          const hh = r.range(5, 9), c2 = hsv(r, PAL.warm);
          B.houses.add(side * cx, 0, zl(cz), fpx * 0.7, hh, fpz * 0.7, 0, col3[0], col3[1], col3[2]); B.roofs.add(side * cx, hh, zl(cz), fpx * 0.78, hh * 0.55, fpz * 0.78, 0, c2[0] * 0.7, c2[1] * 0.4, c2[2] * 0.35);
          if (Z.farm && r.chance(0.6)) { B.houses.add(side * (cx + 11), 0, zl(cz + 4), 10, 9, 14, 0, 0.62, 0.18, 0.14); B.roofs.add(side * (cx + 11), 9, zl(cz + 4), 11, 6, 15, 0, 0.3, 0.3, 0.32); B.solid.add(side * (cx - 10), 0, zl(cz + 3), 4, 16, 4, 0, 0.8, 0.8, 0.78); } // barn and silo
        } else if (modelG.length && r.chance(0.3)) { // a hand-made Kenney building
          const mi = r.int(0, modelG.length - 1), mg = modelG[mi], fp = r.range(13, 20);
          B.models[mi].add(side * cx, slope, zl(cz), fp, Math.min(h, fp * mg.aspect * r.range(1.1, 2.2)) + slope * 0, fp * r.range(0.85, 1.1), r.chance(0.5) ? 0 : Math.PI, 1, 1, 1);
        } else {
          B.boxes.add(side * cx, 0, zl(cz), fpx, h + slope, fpz, 0, col3[0], col3[1], col3[2], seed);
          if (floors >= 16) B.boxes.add(side * (cx + 1), slope + h, zl(cz), fpx * 0.66, h * r.range(0.12, 0.3), fpz * 0.66, 0, col3[0], col3[1], col3[2], r());
          if (r.chance(0.6)) { const g = ROOF_KIT[r.int(0, 3)]; B.solid.add(side * cx + r.range(-3, 3), slope + h, zl(cz) + r.range(-3, 3), r.range(2, 4.5), r.range(1.2, 3), r.range(2, 4.5), 0, g[0], g[1], g[2]); }
        }
        if (r.chance(Z.tree * 0.6)) addTree(B.trees, treeKind(ctx.st, r), side * (cx + r.range(-10, 10)), zl(cz + 13), r);
      }
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // S: the skyline
  // =================================================================================================================================
  function buildS(slot, k) {
    const ctx = chunkCtx(LS, k), ms = lay.S.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch], dens = quality.density;
    const hill = lin(ctx.st.mount || "#8aa5b8"), green = lin(ctx.st.hill || "#6fae5c"), peaky = ["peaks", "alps", "fuji", "volcano"].includes(ctx.st.horizon);
    for (const side of [-1, 1]) {
      const zi = ctx.zone(side), r = rng(hash(ctx.city, ctx.rel, 300 + (side > 0 ? 1 : 0)));
      const urban = zi.type === "downtown" || zi.type === "urban" || zi.type === "harbour";
      const n = Math.round((urban ? 14 : zi.type === "residential" ? 9 : 5) * dens);
      for (let j = 0; j < n; j++) {
        const x = 340 + (j + r()) / Math.max(1, n) * 780, u = r() * LS, w = r.range(22, 56), d = r.range(22, 56);
        const nse = noise2((ctx.s0 + u) * 0.0025, x * 0.003, ctx.city + 5);
        let h = (urban ? 50 + 280 * Math.pow(nse, 1.5) : zi.type === "residential" ? 25 + 30 * nse : 12 + 14 * nse) * prof.skyline * (urban ? 0.8 + (x - 340) / 700 : 1);
        if (zi.type === "downtown") h *= 1.2;
        const c = hsv(r, pal); S.boxes.add(side * x, 0, zl(u), w, h, d, 0, c[0], c[1], c[2], r());
        if (h > 120 && r.chance(0.4)) S.boxes.add(side * x, h, zl(u), w * 0.55, h * r.range(0.1, 0.25), d * 0.55, 0, c[0], c[1], c[2], r());
      }
      for (let j = zi.type === "downtown" ? 1 : r.int(2, 4); j > 0; j--) {
        const w = r.range(150, 320), hgt = r.range(25, 70) * (peaky ? 2.6 : 1), x = r.range(420, 1150), g = r.chance(0.5) ? hill : green;
        S.hills.add(side * x, -hgt * 0.1, zl(r() * LS), w, hgt, w * r.range(0.7, 1.2), r() * 6, g[0], g[1], g[2]);
      }
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // G: the ground
  // =================================================================================================================================
  function buildG(gs, k) {
    const ctx = chunkCtx(LG, k), desert = ["Las Vegas", "Doha", "Abu Dhabi"].includes(ROUTE[ctx.city].venue);
    for (let si = 0; si < 2; si++) {
      const side = si ? 1 : -1, zi = ctx.zone(side), Z = ZONES[zi.type], m = gs.meshes[si];
      const s0 = zi.water ? "quay" : Z.ground === "city" ? "pavement" : Z.ground === "sand" ? "sand" : "grass";
      const s1 = zi.water ? "water" : Z.ground, s2 = desert ? "sand" : "grass";
      m[0].material = ground[s0]; m[1].material = ground[s1]; m[2].material = ground[s2];
      m[1].position.y = zi.water ? -0.02 : 0; m[0].position.y = zi.water ? 0.4 : 0; // (water sits just above the big ground disc under everything)
    }
    gs.chunk = k; gs.city = ctx.city; gs.start = ctx.start;
  }

  // =================================================================================================================================
  // the far backdrop: a skyline of towers (or hills) across the end of the road, so the horizon is never empty
  // =================================================================================================================================
  const backBoxes = new THREE.InstancedMesh(unitBox, bMat, 150), backHills = new THREE.InstancedMesh(hillGeo(1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 40);
  for (const m of [backBoxes, backHills]) { m.frustumCulled = false; gBack.add(m); }
  backBoxes.geometry = backBoxes.geometry.clone(); backBoxes.geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(150), 1));
  backHills.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3).fill(1), 3); backBoxes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(150 * 3).fill(1), 3);
  const dm = new THREE.Object3D(); let backCity = -1;
  function buildBackdrop(idx) {
    backCity = idx; const st = ROUTE[idx], prof = profileOf(st.venue), pal = PAL[prof.arch], r = rng(hash(idx, 0, 909));
    const urban = (prof.zones.downtown || 0) + (prof.zones.urban || 0) + (prof.zones.harbour || 0) >= 0.55, hill = lin(st.mount || "#8aa5b8");
    for (let i = 0; i < 150; i++) {
      const x = -1250 + i * 16.7 + r.range(-6, 6), w = r.range(30, 70), h = urban ? r.range(60, 340) * prof.skyline * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.37))) : r.range(8, 40), c = hsv(r, pal);
      dm.position.set(x, 0, -1450 - r.range(0, 160)); dm.scale.set(w, h, w); dm.rotation.set(0, 0, 0); dm.updateMatrix(); backBoxes.setMatrixAt(i, dm.matrix); backBoxes.setColorAt(i, new THREE.Color(c[0], c[1], c[2])); backBoxes.geometry.attributes.aSeed.array[i] = r();
    }
    for (let i = 0; i < 40; i++) {
      const w = r.range(260, 520), h = r.range(60, 150) * (["peaks", "alps", "fuji", "volcano"].includes(st.horizon) ? 2.2 : 1), x = -1300 + i * 65 + r.range(-20, 20);
      dm.position.set(x, -h * 0.1, -1500 - r.range(0, 200)); dm.scale.set(w, h, w * 0.8); dm.rotation.set(0, r() * 6, 0); dm.updateMatrix(); backHills.setMatrixAt(i, dm.matrix); backHills.setColorAt(i, new THREE.Color(hill[0], hill[1], hill[2]));
    }
    for (const m of [backBoxes, backHills]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    backBoxes.geometry.attributes.aSeed.needsUpdate = true; backBoxes.visible = urban; backHills.visible = true;
  }

  // =================================================================================================================================
  // the update, called every frame
  // =================================================================================================================================
  const builders = { F: buildF, B: buildB, S: buildS };
  function ensure(layer, D, budget) {
    const L = layer.L, id = layer.id, kmin = Math.floor((D - BEHIND[id]) / L), kmax = Math.floor((D + AHEAD[id] * quality.ahead) / L), need = [];
    for (let k = kmin; k <= kmax; k++) { const slot = mod(k, layer.n), c = cityForS(k * L + L / 2); if (layer.chunk[slot] !== k || layer.city[slot] !== c.idx || layer.start[slot] !== c.start) need.push(k); }
    if (need.length > budget) need.sort((a, b) => Math.abs(a * L - D) - Math.abs(b * L - D));
    const nb = need.length > layer.n * 0.6 ? need.length : Math.min(budget, need.length);
    for (let i = 0; i < nb; i++) { const k = need[i], slot = mod(k, layer.n), c = cityForS(k * L + L / 2); builders[id](slot, k); layer.chunk[slot] = k; layer.city[slot] = c.idx; layer.start[slot] = c.start; }
    for (let s = 0; s < layer.n; s++) { const c = layer.chunk[s]; if (c === c && (c > kmax || c < kmin - 1)) { for (const m of layer.meshes) m.clear(s); layer.chunk[s] = NaN; layer.data[s] = {}; } }
  }
  function ensureG(D, budget) {
    const kmin = Math.floor((D - BEHIND.G) / LG), kmax = Math.floor((D + AHEAD.G * quality.ahead) / LG); let built = 0;
    for (let k = kmin; k <= kmax; k++) {
      const gs = gslots[mod(k, nG)], c = cityForS(k * LG + LG / 2);
      if (gs.chunk !== k || gs.city !== c.idx || gs.start !== c.start) { if (built++ >= budget && gs.chunk === gs.chunk) continue; buildG(gs, k); }
    }
    for (let s = 0; s < nG; s++) { const gs = gslots[s]; gs.grp.visible = gs.chunk === gs.chunk && gs.chunk >= kmin - 1 && gs.chunk <= kmax; if (gs.grp.visible) gs.grp.position.z = D - gs.chunk * LG; }
  }

  return {
    root, ground, lamps, get lampCount() { return lampCount; },
    setQuality(q) { quality = { ahead: q.ahead ?? 1, density: q.density ?? 1 }; },
    setSignStyle(style) { signMat.map = signTex[style] || signTex.paint; },
    // is the point at distance D along the route (world units) inside a tunnel?
    inTunnel(s) { const c = cityForS(s); return tunnelAt(profileOf(ROUTE[c.idx].venue), s - c.start); },
    // D = how far along the route the car is (world units); st = the current city's sim data; camZ = where the camera is
    update(D, dt, night, pal, fogColor, st, camZ) {
      if (Math.abs(D - sBase) > 6000 || Math.abs(D - lastD) > 250) { // a far jump (new race, map preview) or a very long drive: start the layers afresh
        const jump = Math.abs(D - lastD) > 250; sBase = Math.round(D / 2000) * 2000;
        for (const L of Object.values(lay)) L.chunk.fill(NaN); if (jump) for (const L of Object.values(lay)) L.city.fill(-1);
        for (const gs of gslots) gs.chunk = NaN; heroCache.clear();
      }
      lastD = D;
      { const fa = FACADES[st.venue] || [0, 0, 0, 0, 0]; shared.uStyleA.value.set(fa[0], fa[1], fa[2], fa[3]); shared.uStyleB.value.set(fa[4], 0, 0, 0); } // this city's facade character
      shared.uNight.value = night; shared.uSky.value.setRGB(Math.min(1, fogColor.r * 1.1 + 0.05), Math.min(1, fogColor.g * 1.1 + 0.07), Math.min(1, fogColor.b * 1.1 + 0.1));
      ensure(lay.F, D, 3); ensure(lay.B, D, 3); ensure(lay.S, D, 2); ensureG(D, 4);
      for (const L of Object.values(lay)) for (const m of L.meshes) m.flush();
      const z = D - sBase; gF.position.z = gB.position.z = gS.position.z = z;
      updateHeroes(D, 1500 * quality.ahead);
      const cidx = cityForS(D).idx; if (cidx !== backCity) buildBackdrop(cidx);
      gBack.position.z = camZ;
      // ground colours follow the city's palette; ripples slide over the water
      ground.lawnU.uD.value = D; const g = pal.grass; ground.grass.color.setRGB(g[0] / 255, g[1] / 255, g[2] / 255, THREE.SRGBColorSpace);
      ground.sand.color.setRGB(Math.min(1, g[0] * 1.15 / 255), Math.min(1, g[1] * 1.12 / 255), Math.min(1, g[2] * 1.1 / 255), THREE.SRGBColorSpace);
      ground.field.color.setRGB(Math.min(1, g[0] * 1.15 / 255), Math.min(1, g[1] * 1.1 / 255), g[2] * 0.8 / 255, THREE.SRGBColorSpace);
      const wc = profileOf(st.venue).water; if (wc) ground.water.color.set(wc.color);
      ground.waterNormal.offset.x += dt * 0.012; ground.waterNormal.offset.y += dt * 0.007;
      setCrowd(st.crowd); for (const w of windowMats) w.emissiveIntensity = 1.4 * night; // grandstand crowds wear the city's colours; Kenney windows light up
      // the street lamps near the car, for the night lighting
      lampCount = 0; const kc = Math.floor(D / LF);
      for (let k = kc - 2; k <= kc + 8; k++) { const sl = lay.F.chunk[mod(k, lay.F.n)] === k ? lay.F.data[mod(k, lay.F.n)] : null; if (!sl || !sl.lamps) continue; for (const l of sl.lamps) { const o = lamps[lampCount] || (lamps[lampCount] = { hx: 0, z: 0, side: 1 }); o.hx = l.hx; o.z = D - l.s; o.side = l.side; lampCount++; } }
    },
  };
}
