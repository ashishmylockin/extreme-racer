// The static part of the scene: road, lane lines, kerbs, grass, sky, fog and lights.
// It never changes shape; update() recolours it for the current city, cross-fades skies and slides the road textures towards the camera.
import * as THREE from "three";
import { roadHalf, arrToHex } from "./mapping.js";
import { LOOK, CITY_TOD, skyOf, createSkyDome, sunSpot } from "./env.js";

const ROAD_TILE = 16, KERB_TILE = 4.8, GRASS_TILE = 24; // world units of road covered by one repeat of each texture
const LEN = 340, Z_START = 60;                          // the road runs from Z = +60 (behind the car) to Z = -280

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// ACES filmic (as three.js does it) applied by hand, so the fog can be the colour the sky horizon really ends up on screen
const aces = v => { v /= 0.6; return Math.min(1, Math.max(0, (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14))); };

export function createWorld(scene) {
  const RH = roadHalf();

  // --- asphalt (grey noise, tinted by the city's road colour) with the white lines on a see-through layer above it ---
  const asphalt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#cfcfcf"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 150 + Math.random() * 100 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  });
  asphalt.repeat.set(2, LEN / ROAD_TILE * 2);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0x4a4c52, roughness: 0.85, metalness: 0 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, LEN).rotateX(-Math.PI / 2), roadMat);
  road.position.set(0, 0, Z_START - LEN / 2); road.receiveShadow = true; scene.add(road);

  const lines = canvasTex(512, 256, (g, w, h) => { // 32 wide x 16 long world units: two edge lines and two dashed lane lines
    g.clearRect(0, 0, w, h); g.fillStyle = "rgba(255,255,255,0.95)";
    g.fillRect(6, 0, 8, h); g.fillRect(w - 14, 0, 8, h);
    for (const fx of [1 / 3, 2 / 3]) for (const y0 of [0, 128]) g.fillRect(w * fx - 4, y0, 8, 64);
  });
  lines.repeat.set(1, LEN / ROAD_TILE);
  const lineMat = new THREE.MeshStandardMaterial({ map: lines, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 });
  const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, LEN).rotateX(-Math.PI / 2), lineMat);
  lineMesh.position.set(0, 0.02, Z_START - LEN / 2); scene.add(lineMesh);

  // --- red and white kerbs along both edges ---
  const kerbTex = canvasTex(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#f4f4f4" : "#d4281e"; g.fillRect(0, i * 32, w, 32); } });
  kerbTex.repeat.set(1, LEN / KERB_TILE);
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7 });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, LEN).rotateX(-Math.PI / 2), kerbMat); m.position.set(s * (RH + 0.7), 0.03, Z_START - LEN / 2); scene.add(m); }

  // --- mown grass stripes either side ---
  const grassTex = canvasTex(4, 64, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h / 2); g.fillStyle = "#e6e6e6"; g.fillRect(0, h / 2, w, h / 2); });
  grassTex.repeat.set(1, LEN / GRASS_TILE); grassTex.magFilter = THREE.NearestFilter;
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x5fae4a, roughness: 1 });
  const GRASS_W = 300;
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GRASS_W, LEN).rotateX(-Math.PI / 2), grassMat); m.position.set(s * (RH + 1.4 + GRASS_W / 2), 0, Z_START - LEN / 2); m.receiveShadow = true; scene.add(m); }
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(900, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fae4a, fog: true })); // a huge disc that follows the camera, so there is ground to the horizon in every direction
  farGround.position.set(0, -0.05, -100); scene.add(farGround);

  // --- sky, fog, lights ---
  const dome = createSkyDome(); scene.add(dome);
  scene.fog = new THREE.Fog(0xbfe3fa, 40, 125);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(-40, 70, 30); scene.add(sun); scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 62, bottom: -62, near: 1, far: 260 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 3; // the shadow box follows the player
  const fill = new THREE.HemisphereLight(0xffffff, 0x445533, 0.0); scene.add(fill); // a touch of ambient when the sky image is missing

  const spotCache = new Map();
  const spotOf = (name, sky) => { let s = spotCache.get(name); if (!s) spotCache.set(name, s = sunSpot(sky.tex)); return s; };
  const fogCol = new THREE.Color(), dir = new THREE.Vector3(), toArr = c => [c.r, c.g, c.b];

  // the "mood" of a city: its sky, where its sun is (in the world, relative to the road) and how bright everything is
  function mood(todName) {
    const sky = skyOf(todName), look = LOOK[todName] || LOOK.midday;
    if (!sky) return null;
    const spot = spotOf(todName, sky), az = look.az * Math.PI / 180;
    const el = todName === "overcast" ? look.el * Math.PI / 180 : Math.max(0.12, spot.el); // under a clear sky the light comes from where the sun disc really is
    const phiWanted = Math.atan2(-Math.cos(az), Math.sin(az));
    return { sky, look, yaw: spot.phi - phiWanted, az, el };
  }

  let skyKey = "";
  return {
    sun, dome, fill,
    // pal = the simulation's blended palette; stA / stB = this city and the next; b = how far through the blend (0..1)
    update(pal, rain, scrollWu, focus, stA, stB, b, wetness = 0) {
      const night = Math.min(1, pal.dark * 4);
      asphalt.offset.y = (scrollWu / ROAD_TILE * 2) % 1; lines.offset.y = (scrollWu / ROAD_TILE) % 1;
      kerbTex.offset.y = (scrollWu / KERB_TILE) % 1; grassTex.offset.y = (scrollWu / GRASS_TILE) % 1;

      roadMat.color.setHex(arrToHex(pal.road.map(v => Math.min(255, v * (1.35 - 0.45 * wetness)))));
      roadMat.roughness = 0.85 - 0.6 * wetness; roadMat.metalness = 0.4 * wetness; lineMat.roughness = 0.6 - 0.3 * wetness; // wet asphalt shines
      grassMat.color.setHex(arrToHex(pal.grass));
      farGround.material.color.setHex(arrToHex(pal.grass)).multiplyScalar(0.7 - 0.45 * night); farGround.position.set(focus.camPos.x, -0.05, focus.camPos.z);

      const mA = mood(CITY_TOD[stA.venue]), mB = mood(CITY_TOD[stB.venue]) || mA;
      if (!mA) { scene.fog.color.setHex(arrToHex(pal.sky1)); sun.intensity = 2; fill.intensity = 1.2; return; }
      const u = dome.material.uniforms;
      u.tA.value = mA.sky.tex; u.tB.value = mB.sky.tex; u.mixB.value = b; u.yawA.value = mA.yaw; u.yawB.value = mB.yaw;
      u.tint.value.setRGB(1, 1, 1).lerp(new THREE.Color(...pal.tint.slice(0, 3).map(v => v / 255)), pal.tint[3] * 1.5);
      u.hazeAmt.value = 0; dome.position.copy(focus.camPos);

      // lighting from the sky image (both skies blended), plus the sun / moon as one directional light
      const m = b < 0.5 ? mA : mB;
      scene.environment = m.sky.env; scene.environmentRotation.y = m.yaw; // (swapping at the halfway point of a blend; intensities below are cross-faded)
      const envI = (mA.look.env + (mB.look.env - mA.look.env) * b) * (1 - 0.25 * rain);
      scene.environmentIntensity = envI;
      const az = mA.az + (mB.az - mA.az) * b, el = mA.el + (mB.el - mA.el) * b;
      dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      sun.position.set(focus.x + dir.x * 80, dir.y * 80, focus.z + dir.z * 80); sun.target.position.set(focus.x, 0, focus.z);
      sun.color.copy(new THREE.Color(mA.look.color).lerp(new THREE.Color(mB.look.color), b));
      sun.intensity = (mA.look.sun + (mB.look.sun - mA.look.sun) * b) * (1 - 0.85 * rain);

      // fog: the colour the horizon of the sky really shows
      const hA = mA.sky.horizon, hB = mB.sky.horizon;
      fogCol.setRGB(aces(hA.r + (hB.r - hA.r) * b), aces(hA.g + (hB.g - hA.g) * b), aces(hA.b + (hB.b - hA.b) * b));
      scene.fog.color.copy(fogCol);
      scene.fog.near = 45 - 20 * rain; scene.fog.far = 135 - 45 * rain - 20 * night;
    },
  };
}
