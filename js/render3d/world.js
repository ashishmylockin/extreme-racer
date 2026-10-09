// The static part of the scene: road, lane lines, kerbs, grass, sky dome, fog and lights.
// It never changes shape; update() just recolours it for the current city and slides the road textures towards the camera.
import * as THREE from "three";
import { roadHalf, arrToHex } from "./mapping.js";

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
  const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, LEN).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: lines, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  lineMesh.position.set(0, 0.02, Z_START - LEN / 2); scene.add(lineMesh);

  // --- red and white kerbs along both edges ---
  const kerbTex = canvasTex(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#f4f4f4" : "#d4281e"; g.fillRect(0, i * 32, w, 32); } });
  kerbTex.repeat.set(1, LEN / KERB_TILE);
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7 });
  const kerbs = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, LEN).rotateX(-Math.PI / 2), kerbMat); m.position.set(s * (RH + 0.7), 0.03, Z_START - LEN / 2); scene.add(m); return m; });

  // --- mown grass stripes either side ---
  const grassTex = canvasTex(4, 64, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h / 2); g.fillStyle = "#e6e6e6"; g.fillRect(0, h / 2, w, h / 2); });
  grassTex.repeat.set(1, LEN / GRASS_TILE); grassTex.magFilter = THREE.NearestFilter;
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x5fae4a, roughness: 1 });
  const GRASS_W = 300;
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GRASS_W, LEN).rotateX(-Math.PI / 2), grassMat); m.position.set(s * (RH + 1.4 + GRASS_W / 2), 0, Z_START - LEN / 2); m.receiveShadow = true; scene.add(m); }
  // the road also gets grass out to the horizon behind the sky line, so the fog always meets ground
  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(900, 600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fae4a, fog: true }));
  farGround.position.set(0, -0.05, -420); scene.add(farGround);

  // --- sky dome: a big inside-out sphere whose texture is a vertical gradient (horizon in the middle) ---
  const skyCanvas = document.createElement("canvas"); skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; scene.add(sky);
  let skyKey = "";

  // --- fog and lights ---
  scene.fog = new THREE.Fog(0xbfe3fa, 40, 125);
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6a7a55, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(-40, 70, 30); scene.add(sun); scene.add(sun.target);

  const col = new THREE.Color(), tmp = new THREE.Color();
  const mixArr = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  return {
    sun, hemi, sky,
    // pal = the simulation's current blended palette (grass, road, sky0, sky1, dark, sun, rain, ...)
    update(pal, rain, scrollWu, focus) {
      const night = Math.min(1, pal.dark * 4), dim = rain * 0.35;
      // slide the textures so the road streams towards the camera (+Z)
      asphalt.offset.y = (scrollWu / ROAD_TILE * 2) % 1; lines.offset.y = (scrollWu / ROAD_TILE) % 1;
      kerbTex.offset.y = (scrollWu / KERB_TILE) % 1; grassTex.offset.y = (scrollWu / GRASS_TILE) % 1;

      roadMat.color.setHex(arrToHex(pal.road.map(v => Math.min(255, v * 1.35))));
      grassMat.color.setHex(arrToHex(pal.grass));
      farGround.material.color.setHex(arrToHex(pal.grass)).multiplyScalar(0.75 - 0.4 * night);

      // sky gradient and fog colour
      const top = mixArr(pal.sky0, [88, 98, 112], dim), hor = mixArr(pal.sky1, [150, 160, 172], dim);
      const key = [top, hor].flat().map(Math.round).join(",");
      if (key !== skyKey) {
        skyKey = key; const g = skyCanvas.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 256);
        const rgb = c => `rgb(${c.map(Math.round).join(",")})`;
        grd.addColorStop(0, rgb(mixArr(top, [0, 0, 0], 0.2))); grd.addColorStop(0.35, rgb(top)); grd.addColorStop(0.5, rgb(hor)); grd.addColorStop(1, rgb(hor));
        g.fillStyle = grd; g.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
      }
      scene.fog.color.setHex(arrToHex(hor));
      scene.fog.near = 40 - 15 * rain; scene.fog.far = 125 - 40 * rain - 20 * night;

      // lights: bright day, dim night, soft grey storm
      hemi.color.setHex(arrToHex(mixArr(pal.sky0, [255, 255, 255], 0.55))); hemi.groundColor.setHex(arrToHex(pal.grass));
      hemi.intensity = 1.05 * (1 - 0.65 * night) * (1 - 0.3 * rain);
      sun.intensity = (0.6 + 2.4 * Math.min(1, pal.sun / 0.8)) * (1 - 0.92 * night) * (1 - 0.8 * rain);
      sun.color.setHex(night > 0.3 ? 0x8899ff : 0xfff2dd);
      sun.position.set(focus.x - 40, 70, focus.z + 30); sun.target.position.set(focus.x, 0, focus.z); // the light follows the player
      sky.position.copy(focus.camPos);
    },
  };
}
