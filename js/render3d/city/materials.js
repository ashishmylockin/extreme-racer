// Materials for the city: the window shader for buildings, shop-sign atlases, ground textures and water.
import * as THREE from "three";

// values the shaders share; the city updates these every frame
export const shared = {
  uNight: { value: 0 },                          // 0 day .. 1 night: how many windows are lit
  uSky: { value: new THREE.Color(0.5, 0.65, 0.85) }, // what window glass reflects by day
  uStyleA: { value: new THREE.Vector4(0, 0, 0, 0) },  // facade character of the current city: x brick, y stone pilasters + cornices, z shutters, w arched windows
  uStyleB: { value: new THREE.Vector4(0, 0, 0, 0) },  // x art-deco colour bands, y spare, z classic punched windows (old towns), w spare
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
    if (uStyleB.z > 0.5 && sty < 0.62) { lo = vec2(0.3, 0.24); hi = vec2(0.7, 0.82); } // old towns: punched windows in solid walls, never glass ribbons
    if (ground) { lo = vec2(0.05, 0.07); hi = vec2(0.95, 0.66); }                  // shop windows
    float inX = step(lo.x, f.x) * step(f.x, hi.x), inY = step(lo.y, f.y) * step(f.y, hi.y);
    float edge = step(1.0, u) * step(u, faceW - 1.0);                              // no windows on the corners
    float arch = 1.0; if (!ground && uStyleA.w > 0.01 && sty > 0.3) { float mid = hi.y - 0.28, ax = (f.x - 0.5) / max(0.5 * (hi.x - lo.x), 0.01); float ay = (f.y - mid) / max(hi.y - mid, 0.01); arch = mix(1.0, step(f.y, mid) + step(mid, f.y) * step(ax * ax + ay * ay, 1.0), uStyleA.w); } // arched window heads
    float win = inX * inY * edge * arch;
    // when the windows get smaller than a pixel (far away, or a glancing view) blur the pattern into its average
    float aa = clamp(max(fwidth(u / CW), fwidth(v / FH)) * 2.2, 0.0, 1.0);
    float avg = ground ? 0.5 * edge : (hi.x - lo.x) * (hi.y - lo.y) * edge;
    winMask = mix(win, avg, aa);
    float slab = smoothstep(0.0, 0.07, f.y) * (1.0 - smoothstep(0.93, 1.0, f.y));
    vec3 wallc = wall * (0.9 + 0.1 * slab) * (0.8 + 0.2 * smoothstep(0.0, 14.0, v));
    float fine = 1.0 - aa; // (the fine detail fades out with distance)
    if (uStyleA.x > 0.01) { float by = v / 0.55, bx = u / 1.25 + 0.5 * mod(floor(by), 2.0); float mortar = max(step(0.9, fract(by)), step(0.95, fract(bx))), tone = fract(sin(dot(vec2(floor(bx), floor(by)), vec2(12.9, 78.2))) * 43758.5); wallc *= 1.0 - uStyleA.x * fine * (0.2 * mortar + 0.14 * tone); } // brick courses
    if (uStyleA.y > 0.01) { float pil = step(f.x, 0.06) + step(0.94, f.x); float cor = step(0.9, f.y) * 0.8; wallc = mix(wallc, min(wallc * 1.22 + 0.04, vec3(1.0)), uStyleA.y * fine * max(pil * 0.8, cor)); } // pale pilasters and cornices
    if (uStyleA.z > 0.01 && !ground) { float sh = (step(lo.x - 0.16, f.x) * step(f.x, lo.x) + step(hi.x, f.x) * step(f.x, hi.x + 0.16)) * inY; vec3 shc = fract(sd * 3.0) < 0.5 ? vec3(0.22, 0.45, 0.32) : (fract(sd * 3.0) < 0.8 ? vec3(0.25, 0.4, 0.62) : vec3(0.45, 0.3, 0.22)); wallc = mix(wallc, shc, uStyleA.z * fine * sh); } // coloured shutters
    if (uStyleB.x > 0.01) { float band = step(0.5, fract(floor(v / FH) * 0.5)); wallc = mix(wallc, wallc * vec3(1.12, 0.96, 0.9) + vec3(0.04, 0.0, 0.02), uStyleB.x * band * fine); } // alternating pastel floors
    if (!ground && sty > 0.62 && sty < 0.82) { float rail = step(f.y, 0.17) * inX; wallc = mix(wallc, wallc * 0.45, rail * (1.0 - aa)); } // balcony rails
    if (ground) { float band = step(0.74, f.y) * step(f.y, 0.92); wallc = mix(wallc, wallc * vec3(0.6, 0.55, 0.55), band * (1.0 - aa)); }   // sign band over the shops
    float rnd = fract(sin(dot(cell + vec2(sd * 91.7, alongZ ? 17.0 : 3.0), vec2(127.1, 311.7))) * 43758.5453);
    float litShare = 0.45 + 0.3 * fract(sd * 5.1), lit = step(rnd, litShare);
    vec3 glass = mix(vec3(0.05, 0.08, 0.12), uSky * 0.9, 0.35 + 0.45 * smoothstep(0.0, 140.0, v));
    glass *= mix(1.0, 0.3, uNight);
    diffuseColor.rgb = mix(wallc, glass, winMask);
    float pc = fract(rnd * 7.3);
    vec3 lightc = pc < 0.62 ? vec3(1.0, 0.74, 0.42) : (pc < 0.9 ? vec3(0.62, 0.82, 1.0) : vec3(1.0, 0.35, 0.7));
    vec3 cellGlow = lightc * lit * (0.9 + 0.8 * fract(rnd * 11.0));
    // which windows are lit (and in which colour) is random per window: far away, one pixel covers several windows and that turns into
    // flickering coloured static. Long before the windows get that small, fade to the average: the share that is lit, in the average light colour.
    float far = smoothstep(0.08, 0.32, max(fwidth(u / CW), fwidth(v / FH)));
    vec3 avgGlow = vec3(0.89, 0.74, 0.56) * litShare * 0.7; // (a little under the true average: spread evenly over a far wall, the full amount reads as a pale building, not a dark one with lit windows)
    emitCol = mix(cellGlow, avgGlow, far) * 0.6 * winMask * uNight * (ground ? 1.1 : 1.0);
  } else { diffuseColor.rgb = wall * 0.28; } // underside
}`;

export function buildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = shared.uNight; sh.uniforms.uSky = shared.uSky; sh.uniforms.uStyleA = shared.uStyleA; sh.uniforms.uStyleB = shared.uStyleB;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed; varying vec3 vOP; varying vec3 vON; varying vec3 vSz; varying float vSd;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 sc_ = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vOP = position * sc_; vON = normal; vSz = sc_; vSd = aSeed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight; uniform vec3 uSky; uniform vec4 uStyleA, uStyleB; varying vec3 vOP; varying vec3 vON; varying vec3 vSz; varying float vSd;")
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

  // real CC0 textures (ambientCG) for the pavements and the lawns
  const tl = new THREE.TextureLoader();
  const load = (name, srgb, tile) => { const t = tl.load(`assets/textures/${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / tile, 1 / tile); return t; };
  const paving = (color, tile) => new THREE.MeshStandardMaterial({ map: load("paving_color", true, tile), normalMap: load("paving_normal", false, tile), roughnessMap: load("paving_roughness", false, tile), color, normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0 });
  mats.pavement = paving(0xd9d5cd, 3.5); mats.quay = paving(0xaaa69c, 4.5);

  // the lawn: the photo's brightness only (so each city's own grass colour can tint it), mown stripes, and large soft patches of lighter, drier grass
  const lawn = new THREE.MeshStandardMaterial({ color: 0x5fae4a, roughness: 1, metalness: 0, normalMap: load("grass_normal", false, 5), normalScale: new THREE.Vector2(0.7, 0.7) });
  tl.load("assets/textures/grass_color.jpg", t => {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.drawImage(t.image, 0, 0, 512, 512);
    const d = g.getImageData(0, 0, 512, 512), a = d.data; let sum = 0;
    for (let i = 0; i < a.length; i += 4) { const l = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; a[i] = l; sum += l; }
    const k = 205 / (sum / (a.length / 4));
    for (let i = 0; i < a.length; i += 4) a[i] = a[i + 1] = a[i + 2] = Math.min(255, a[i] * k);
    g.putImageData(d, 0, 0);
    const m = new THREE.CanvasTexture(c); m.wrapS = m.wrapT = THREE.RepeatWrapping; m.colorSpace = THREE.SRGBColorSpace; m.anisotropy = 8; m.repeat.set(1 / 5, 1 / 5);
    lawn.map = m; lawn.needsUpdate = true; t.dispose();
  });
  const lawnU = { uD: { value: 0 } }; // how far along the route the car is, so the stripes and patches stay put on the ground
  lawn.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, lawnU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vGW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGW = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 vGW; uniform float uD;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        { float s = uD - vGW.z; vec2 q = vec2(s, vGW.x);
          float stripe = mod(floor(s / 14.0), 2.0), n1 = vnoise(q * 0.018), n2 = vnoise(q * 0.06 + 17.0), dry = smoothstep(0.58, 0.85, vnoise(q * 0.011 + 5.0));
          diffuseColor.rgb *= (0.92 + 0.08 * stripe) * (0.86 + 0.3 * n1) * (0.9 + 0.2 * n2);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.0, 0.62), dry * 0.65); }`);
  };
  lawn.customProgramCacheKey = () => "lawn-variation";
  mats.grass = lawn; mats.lawnU = lawnU;

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

  // a hillside (Monaco): plain rough green, coloured per city
  mats.hill = new THREE.MeshStandardMaterial({ color: 0x8fae7a, roughness: 1, metalness: 0, flatShading: true });

  // a beach (Miami): sand out to a wavy shoreline, a line of surf, wet sand behind it, then the sea (its UVs are world units from the road centre)
  const beachU = { uSea: { value: new THREE.Color(0x2fc0cf) }, uT: { value: 0 } };
  const beach = new THREE.MeshStandardMaterial({ map: sand, color: 0xd8b98a, roughness: 0.95, metalness: 0 });
  beach.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, beachU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vBX; varying float vBZ;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvBX = uv.x; vBZ = (modelMatrix * vec4(position, 1.0)).z;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vBX; varying float vBZ; uniform vec3 uSea; uniform float uT; float bSea = 0.0;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        { float shore = 50.0 + sin(vBZ * 0.045 + uT * 0.5) * 1.8 + sin(vBZ * 0.13) * 0.9, wash = sin(uT * 0.9) * 1.4;
          bSea = smoothstep(shore + wash - 0.4, shore + wash + 2.0, vBX);
          float wetS = smoothstep(shore - 8.0, shore, vBX) * (1.0 - bSea), foam = 1.0 - smoothstep(0.0, 1.4, abs(vBX - shore - wash - 0.9));
          vec3 sea = mix(uSea * 1.15 + vec3(0.04, 0.1, 0.08), uSea * 0.55, smoothstep(shore, shore + 70.0, vBX)); // shallow turquoise, deeper blue further out
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.38 * wetS), sea, bSea);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.97, 0.97), foam * 0.85); }`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.07, bSea);");
  };
  beach.customProgramCacheKey = () => "beach-shore";
  mats.beach = beach; mats.beachU = beachU;
  return mats;
}
