// Materials for the city: the window shader for buildings, shop-sign atlases, ground textures and water.
import * as THREE from "three";

// values the shaders share; the city updates these every frame
export const shared = {
  uNight: { value: 0 },                          // 0 day .. 1 night: how many windows are lit
  uSky: { value: new THREE.Color(0.5, 0.65, 0.85) }, // what window glass reflects by day
};

// ---------------------------------------------------------------------------------------------------------------------------------
// BUILDINGS: every building is a plain box. The facade (floors, windows, shop fronts, balconies, roof edge) is drawn by this shader from
// the box's size, so one box mesh gives thousands of different buildings in a single draw call. By day the glass reflects the sky,
// by night a random mix of windows glows.
// ---------------------------------------------------------------------------------------------------------------------------------
const FACADE = `
float winMask = 0.0; vec3 emitCol = vec3(0.0);
{
  vec3 n = normalize(vON);
  vec3 wall = diffuseColor.rgb;
  float sd = vSd;
  if (n.y > 0.5) { // roof: darker, with a lighter rim
    vec2 q = vOP.xz / max(vSz.xz, vec2(0.001));
    float rim = smoothstep(0.0, 0.03, 0.5 - max(abs(q.x), abs(q.y)));
    diffuseColor.rgb = wall * mix(0.32, 0.55, rim);
  } else if (n.y > -0.5) { // a wall
    bool alongZ = abs(n.x) > 0.5;
    float faceW = alongZ ? vSz.z : vSz.x;
    float u = (alongZ ? vOP.z : vOP.x) + 0.5 * faceW;
    float v = vOP.y;
    float FH = 4.2 + floor(fract(sd * 7.31) * 3.0) * 0.5;      // one floor is 4.2 to 5.2 units high
    float CW = 2.8 + floor(fract(sd * 3.77) * 4.0) * 0.45;     // one window bay is 2.8 to 4.2 units wide
    float sty = fract(sd * 13.7);
    vec2 cell = vec2(floor(u / CW), floor(v / FH));
    vec2 f = vec2(fract(u / CW), fract(v / FH));
    bool ground = cell.y < 0.5;
    vec2 lo = vec2(0.2, 0.2), hi = vec2(0.8, 0.8);
    if (sty < 0.28) { lo.x = 0.0; hi.x = 1.0; }                                    // ribbon windows
    else if (sty < 0.5) { lo.x = 0.32; hi.x = 0.68; }                              // narrow slots
    else if (sty < 0.62) { lo = vec2(0.12, 0.5); hi = vec2(0.88, 0.95); }          // high windows
    if (ground) { lo = vec2(0.05, 0.07); hi = vec2(0.95, 0.66); }                  // shop windows
    float inX = step(lo.x, f.x) * step(f.x, hi.x), inY = step(lo.y, f.y) * step(f.y, hi.y);
    float edge = step(1.0, u) * step(u, faceW - 1.0);                              // no windows on the corners
    float win = inX * inY * edge;
    // when the windows get smaller than a pixel (far away, or a glancing view) blur the pattern into its average
    float aa = clamp(max(fwidth(u / CW), fwidth(v / FH)) * 2.2, 0.0, 1.0);
    float avg = ground ? 0.5 * edge : (hi.x - lo.x) * (hi.y - lo.y) * edge;
    winMask = mix(win, avg, aa);
    float slab = smoothstep(0.0, 0.07, f.y) * (1.0 - smoothstep(0.93, 1.0, f.y));
    vec3 wallc = wall * (0.9 + 0.1 * slab) * (0.8 + 0.2 * smoothstep(0.0, 14.0, v));
    if (!ground && sty > 0.62 && sty < 0.82) { float rail = step(f.y, 0.17) * inX; wallc = mix(wallc, wallc * 0.45, rail * (1.0 - aa)); } // balcony rails
    if (ground) { float band = step(0.74, f.y) * step(f.y, 0.92); wallc = mix(wallc, wallc * vec3(0.6, 0.55, 0.55), band * (1.0 - aa)); }   // sign band over the shops
    float rnd = fract(sin(dot(cell + vec2(sd * 91.7, alongZ ? 17.0 : 3.0), vec2(127.1, 311.7))) * 43758.5453);
    float lit = step(rnd, 0.45 + 0.3 * fract(sd * 5.1));
    vec3 glass = mix(vec3(0.05, 0.08, 0.12), uSky * 0.9, 0.35 + 0.45 * smoothstep(0.0, 140.0, v));
    glass *= mix(1.0, 0.3, uNight);
    diffuseColor.rgb = mix(wallc, glass, winMask);
    float pc = fract(rnd * 7.3);
    vec3 lightc = pc < 0.62 ? vec3(1.0, 0.74, 0.42) : (pc < 0.9 ? vec3(0.62, 0.82, 1.0) : vec3(1.0, 0.35, 0.7));
    emitCol = lightc * (winMask * lit * uNight * (ground ? 1.3 : 1.0) * (0.9 + 0.8 * fract(rnd * 11.0)));
  } else { diffuseColor.rgb = wall * 0.28; } // underside
}`;

export function buildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = shared.uNight; sh.uniforms.uSky = shared.uSky;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed; varying vec3 vOP; varying vec3 vON; varying vec3 vSz; varying float vSd;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 sc_ = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vOP = position * sc_; vON = normal; vSz = sc_; vSd = aSeed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight; uniform vec3 uSky; varying vec3 vOP; varying vec3 vON; varying vec3 vSz; varying float vSd;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FACADE)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, winMask); metalnessFactor = mix(metalnessFactor, 0.5, winMask * (1.0 - 0.7 * uNight));`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += emitCol;");
  };
  m.customProgramCacheKey = () => "city-building";
  return m;
}

// a plain, tinted material (awnings, rooftop kit, tunnel walls, bridges...): colour comes from each instance
export const solidMaterial = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.05 });

// ---------------------------------------------------------------------------------------------------------------------------------
// SIGNS: one picture holds many shop signs / sponsor banners; each sign quad picks its own rectangle (aRect) of the picture.
// ---------------------------------------------------------------------------------------------------------------------------------
const BRANDS = ["NOVA MART", "ZENO CAFE", "KITE BANK", "PIXEL & CO", "TURBINA", "AURA HOTEL", "BLUE FIN SUSHI", "HAPPY BYTE", "ORBIT TELECOM", "MAPLE & OAK", "ATLAS TRAVEL", "VOLTA ENERGY",
  "SUNRISE BAKERY", "NEON NOODLE", "RIVER BANK", "LUMEN FILMS", "QUICKFIX", "GREENLEAF", "ROCKET PIZZA", "MINT HOTEL", "COSMO GAMES", "URBAN CUT", "PETAL FLOWERS", "IRON GYM",
  "SKYLINE BAR", "TOKEN ARCADE", "LUCKY 8", "DELTA AIR", "FRESH & CO", "VELVET CLUB", "STAR DINER", "MEGA SHOP"];
const PAINT = ["#d62f2f", "#e8862a", "#f0c431", "#3f9a4f", "#2f78c8", "#7a4fb8", "#c8387a", "#1d8f8f", "#444a58", "#f2f0e6"];
const NEON = ["#ff3fa4", "#34e6ff", "#ffe14a", "#7dff6a", "#ff7a2a", "#b06bff", "#ff4b4b", "#5affd2"];

export function makeSignAtlas(style) { // 4 columns x 8 rows of 256x64 signs
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  BRANDS.forEach((name, i) => {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 64;
    if (style === "neon") {
      const col = NEON[i % NEON.length];
      g.fillStyle = "#06070d"; g.fillRect(x, y, 256, 64);
      g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 10; g.strokeRect(x + 5, y + 5, 246, 54);
      g.fillStyle = col; g.font = "bold 30px Arial, sans-serif"; g.fillText(name, x + 128, y + 34, 226); g.shadowBlur = 0;
    } else {
      const col = PAINT[i % PAINT.length], light = ["#f0c431", "#f2f0e6"].includes(col);
      g.fillStyle = col; g.fillRect(x, y, 256, 64); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x, y + 52, 256, 12);
      g.fillStyle = light ? "#20232b" : "#ffffff"; g.font = "bold 30px Arial, sans-serif"; g.fillText(name, x + 128, y + 31, 232);
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
export const SIGN_COUNT = BRANDS.length;
export const signRect = i => [(i % 4) / 4, 1 - (Math.floor(i / 4) + 1) / 8, 1 / 4, 1 / 8]; // x, y, w, h in texture space

export function makeBannerAtlas(sponsors) { // wide banners for the barriers: one row per sponsor (1024x128 each)
  const rows = Math.max(1, sponsors.length), c = document.createElement("canvas"); c.width = 1024; c.height = 128 * rows; const g = c.getContext("2d");
  g.textAlign = "center"; g.textBaseline = "middle";
  sponsors.forEach(([name, col], i) => {
    const y = i * 128; g.fillStyle = col; g.fillRect(0, y, 1024, 128);
    g.fillStyle = "rgba(255,255,255,0.14)"; for (let k = 0; k < 8; k++) g.fillRect(k * 160 - 40, y, 56, 128);
    g.fillStyle = "#ffffff"; g.font = "bold 84px Arial, sans-serif"; g.fillText(name, 512, y + 66, 940);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, rect: i => [0, 1 - (i + 1) / rows, 1, 1 / rows] };
}

// a flat quad whose texture rectangle is chosen per instance (attribute aRect = x, y, width, height)
export function signMaterial(map) {
  const m = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aRect;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * aRect.zw + aRect.xy;\n#endif");
  };
  m.customProgramCacheKey = () => "city-sign";
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// GROUND textures (UVs are in world units, so each texture says how big one repeat is)
// ---------------------------------------------------------------------------------------------------------------------------------
function tex(w, h, draw, tile, { srgb = true, filter = true } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); t.anisotropy = 8; if (!filter) t.magFilter = THREE.NearestFilter;
  return t;
}
const speckle = (g, w, h, n, lo, hi, s = 1.5) => { for (let i = 0; i < n; i++) { const v = (lo + Math.random() * (hi - lo)) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, s, s); } };

export function groundMaterials() {
  // paving slabs for the pavements and promenades (one repeat = 8 units)
  const pave = tex(256, 256, (g, w, h) => { g.fillStyle = "#c9c6bf"; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 170, 220); g.strokeStyle = "rgba(60,60,60,0.35)"; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }, 8);
  // the city block grid (one repeat = 30 units: a 22-unit lot with an 8-unit street)
  const grid = tex(512, 512, (g, w, h) => {
    const k = w / 30; g.fillStyle = "#b9b7b0"; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 150, 205);
    g.fillStyle = "#3a3c42"; g.fillRect(22 * k, 0, 8 * k, h); g.fillRect(0, 22 * k, w, 8 * k);       // streets
    for (let i = 0; i < 5000; i++) { const v = 45 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(22 * k + Math.random() * 8 * k, Math.random() * h, 1.5, 1.5); g.fillRect(Math.random() * w, 22 * k + Math.random() * 8 * k, 1.5, 1.5); }
    g.fillStyle = "#d8d3c6"; g.fillRect(21 * k, 0, k, h); g.fillRect(30 * k - 0.001, 0, 1, 0); g.fillRect(0, 21 * k, w, k); g.fillRect(0, 30 * k - 1, w, 1);  // kerbs
    g.fillStyle = "rgba(255,255,255,0.7)"; for (let y = 0; y < h; y += 24) g.fillRect(26 * k - 1, y, 2, 12); for (let x = 0; x < w; x += 24) g.fillRect(x, 26 * k - 1, 12, 2);   // street centre lines
  }, 30);
  grid.offset.set(-38 / 30, 0);
  const grass = tex(64, 128, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h / 2); g.fillStyle = "#e2e2e2"; g.fillRect(0, h / 2, w, h / 2); speckle(g, w, h, 600, 200, 255, 2); }, 24, { filter: false });
  const sand = tex(256, 256, (g, w, h) => { g.fillStyle = "#e8e8e8"; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, 195, 255); for (let i = 0; i < 14; i++) { g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, Math.random() * h); g.bezierCurveTo(w * .3, Math.random() * h, w * .6, Math.random() * h, w, Math.random() * h); g.stroke(); } }, 40);
  const field = tex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { const base = [255, 232, 214, 246][i % 4]; g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, i * 32, w, 32); g.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < 32; y += 4) g.fillRect(0, i * 32 + y, w, 1.5); } speckle(g, w, h, 2500, 200, 255); }, 36);
  const quay = tex(256, 256, (g, w, h) => { g.fillStyle = "#a9a59b"; g.fillRect(0, 0, w, h); speckle(g, w, h, 3500, 130, 190); g.strokeStyle = "rgba(40,40,40,0.4)"; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }, 12);
  const mk = (map, color, rough = 0.95) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0 });
  const mats = {
    pavement: mk(pave, 0xffffff, 0.9), city: mk(grid, 0xffffff, 0.9), grass: mk(grass, 0x5fae4a), sand: mk(sand, 0xd8b98a), field: mk(field, 0x8fae4a), quay: mk(quay, 0xffffff, 0.85),
  };

  // water: a dark blue surface with moving ripples (a normal map slid over it) that reflects the sky
  const wn = tex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), hgt = new Float32Array(w * h);
    for (let i = 0; i < 6; i++) { const fx = 1 + (i % 3) * 2, fy = 1 + ((i + 1) % 3) * 2, ph = Math.random() * 6.28, ph2 = Math.random() * 6.28; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hgt[y * w + x] += Math.sin((x / w * fx + y / h * fy) * 6.2832 + ph) * Math.cos((x / w * fy - y / h * fx) * 6.2832 + ph2); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = hgt[y * w + (x + 1) % w] - hgt[y * w + (x + w - 1) % w], dy = hgt[((y + 1) % h) * w + x] - hgt[((y + h - 1) % h) * w + x], i = (y * w + x) * 4;
      img.data[i] = 128 + dx * 14; img.data[i + 1] = 128 + dy * 14; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 28, { srgb: false });
  mats.water = new THREE.MeshStandardMaterial({ color: 0x2a78a8, emissive: 0x0a2c44, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.0, normalMap: wn, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.6 });
  mats.waterNormal = wn;
  return mats;
}
