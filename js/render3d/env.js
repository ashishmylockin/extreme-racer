// Skies and image-based lighting. Five CC0 HDRI skies from Poly Haven (morning, midday, sunset, night, overcast) light the scene and
// show up in reflections. Each city uses one; between two cities the sky cross-fades and the lighting follows.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export const TODS = ["morning", "midday", "sunset", "night", "overcast"];
// which sky each of the 22 cities gets (by venue name)
export const CITY_TOD = {
  Sydney: "morning", Shanghai: "midday", Tokyo: "morning", Miami: "sunset", Montreal: "midday", "Monte Carlo": "midday", Barcelona: "midday", Salzburg: "morning",
  London: "overcast", Brussels: "overcast", Budapest: "midday", Amsterdam: "midday", Rome: "midday", Madrid: "midday", Baku: "sunset", Singapore: "night",
  Austin: "midday", "Mexico City": "midday", "Sao Paulo": "overcast", "Las Vegas": "night", Doha: "night", "Abu Dhabi": "sunset",
};
// sun / moon direction (azimuth: 0 = straight ahead, positive to the right; elevation in degrees), light colour and strength,
// env = how much soft light the sky image adds (less = more contrast: lit sides bright, shadowed sides dark),
// exp = exposure, skySat / skyGain = a grade on the sky picture itself (the raw images are pale and a little lilac: this makes them a clear blue)
export const LOOK = {
  morning:  { az: -50, el: 30, color: 0xffd6a0, sun: 4.6, env: 0.5,  exp: 1.0,  skySat: 1.0,  skyGain: [0.6, 0.75, 0.56] }, // (this photo's sky is very bright and violet: measured, then pulled to the midday photo's blue)
  midday:   { az: -35, el: 52, color: 0xfff0d6, sun: 5.0, env: 0.45, exp: 0.95, skySat: 1.45, skyGain: [0.84, 0.97, 1.14] },
  sunset:   { az: -48, el: 9,  color: 0xff9440, sun: 4.2, env: 0.5,  exp: 1.0,  skySat: 1.2,  skyGain: [1.06, 0.95, 0.9] },
  night:    { az: 30, el: 38,  color: 0x9fb4ff, sun: 0.3, env: 0.3,  exp: 0.95, skySat: 1.0,  skyGain: [1, 1, 1] },
  overcast: { az: -30, el: 50, color: 0xe8ecf2, sun: 0.9, env: 0.95, exp: 1.0,  skySat: 1.05, skyGain: [0.97, 1.0, 1.04] },
};
export const NIGHT_SKY = "night"; // this sky image only lights the scene: what you see overhead is drawn by the dome shader (clean stars, a moon)

const skies = {}; // tod -> { tex (equirect HDR, for the sky shader), env (PMREM, for lighting), horizon: THREE.Color }

function horizonColour(tex) { // average colour of the band just above the horizon: that is what the fog should fade to
  const { data, width, height } = tex.image, c = new THREE.Color(0, 0, 0); let n = 0;
  const half = data instanceof Uint16Array;
  for (let y = Math.floor(height * 0.46); y < Math.floor(height * 0.5); y++) for (let x = 0; x < width; x += 4) {
    const i = (y * width + x) * 4;
    c.r += half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]; c.g += half ? THREE.DataUtils.fromHalfFloat(data[i + 1]) : data[i + 1]; c.b += half ? THREE.DataUtils.fromHalfFloat(data[i + 2]) : data[i + 2]; n++;
  }
  return c.multiplyScalar(1 / n);
}

// The brightest spots in a sky image (the sun, the moon) can be too bright for a half-float number and load as infinity. Filtering an
// infinite texel gives NaN, and a NaN pixel makes the whole screen flash black once bloom has smeared it. So: cap every texel.
function capHDR(tex, cap = 4000) {
  const d = tex.image.data; let n = 0;
  if (d instanceof Uint16Array) { const lim = THREE.DataUtils.toHalfFloat(cap); for (let i = 0; i < d.length; i++) { const h = d[i]; if ((h & 0x7c00) === 0x7c00 || (h & 0x7fff) > lim) { d[i] = (h & 0x7c00) === 0x7c00 && (h & 0x03ff) ? 0 : lim; n++; } } }
  else if (d instanceof Float32Array) for (let i = 0; i < d.length; i++) if (!(d[i] < cap)) { d[i] = d[i] !== d[i] ? 0 : cap; n++; }
  return n;
}

// The raw sky photos are pale, a little grey and (the morning one) lilac. Grade each one once as it loads (saturation, then a colour gain),
// so the sky you see AND the light it casts on the city are a clear blue / warm gold, not a wash.
function gradeHDR(tex, sat, gain) {
  const d = tex.image.data, half = d instanceof Uint16Array, from = THREE.DataUtils.fromHalfFloat, to = THREE.DataUtils.toHalfFloat;
  if (sat === 1 && gain.every(g => g === 1)) return;
  for (let i = 0; i < d.length; i += 4) {
    let r = half ? from(d[i]) : d[i], g = half ? from(d[i + 1]) : d[i + 1], b = half ? from(d[i + 2]) : d[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = Math.max(0, l + (r - l) * sat) * gain[0]; g = Math.max(0, l + (g - l) * sat) * gain[1]; b = Math.max(0, l + (b - l) * sat) * gain[2];
    if (half) { d[i] = to(r); d[i + 1] = to(g); d[i + 2] = to(b); } else { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  }
}

export async function loadSkies(renderer, onProgress = () => {}) {
  const pmrem = new THREE.PMREMGenerator(renderer), loader = new RGBELoader();
  let done = 0;
  await Promise.all(TODS.map(async name => {
    try {
      const tex = await loader.loadAsync(`assets/hdri/${name}.hdr`);
      const capped = capHDR(tex); if (capped) console.info(`sky ${name}: capped ${capped} out-of-range texel values`);
      gradeHDR(tex, LOOK[name].skySat, LOOK[name].skyGain);
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true; // mipmaps let the sky shader soften the magnified image
      skies[name] = { tex, env: pmrem.fromEquirectangular(tex).texture, horizon: horizonColour(tex) };
    } catch (e) { console.warn("sky failed:", name, e.message || e); }
    onProgress(++done / TODS.length);
  }));
  pmrem.dispose();
  return Object.keys(skies).length;
}
export const skyOf = name => skies[name] || skies.midday || Object.values(skies)[0] || null;

// ---------- the sky dome: mixes two equirect HDRIs (this city and the next) and tints them with the city's palette ----------
// At night the photo is replaced by a sky drawn here: a dark gradient, the city's glow on the horizon, a moon and small, steady stars
// (the night photo's own stars are noisy and it has a blurry tree in it; it still lights the scene).
export function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: true,
    uniforms: { tA: { value: null }, tB: { value: null }, mixB: { value: 0 }, expo: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, yawA: { value: 0 }, yawB: { value: 0 }, haze: { value: new THREE.Color(0.7, 0.8, 0.9) }, hazeAmt: { value: 0 },
      nightK: { value: 0 }, moonDir: { value: new THREE.Vector3(0.4, 0.6, -0.7) }, glow: { value: new THREE.Color(0.1, 0.08, 0.12) } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tA, tB; uniform float mixB, expo, yawA, yawB, hazeAmt, nightK; uniform vec3 tint, haze, moonDir, glow; varying vec3 vDir;
      vec2 eq(vec3 d, float yaw) { float a = atan(d.z, d.x) + yaw; return vec2(a / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5); }
      float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
      vec3 nightSky(vec3 d) {
        float up = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(vec3(0.016, 0.022, 0.05), vec3(0.003, 0.005, 0.014), smoothstep(0.0, 0.6, up));   // deep blue overhead, a touch lighter low down
        col += glow * exp(-max(d.y, 0.0) * 9.0);                                                           // the city's glow along the horizon
        // stars: one chance per cell of a grid on the sky; each star is a soft dot at least about a pixel wide, so it never sparkles as you move
        vec3 p = d * 160.0, c = floor(p), f = p - c - 0.5; float r = h31(c);
        if (r < 0.055 && d.y > 0.06) {
          vec3 o = (vec3(h31(c + 7.1), h31(c + 3.7), h31(c + 1.3)) - 0.5) * 0.5;
          float px = max(fwidth(p.x), fwidth(p.y)) * 0.9, dist = length(f - o);
          float s = smoothstep(max(0.05, px), 0.0, dist) * (0.35 + 1.4 * h31(c + 9.0)) * smoothstep(0.06, 0.25, d.y);
          col += vec3(0.85, 0.9, 1.0) * s * 0.9;
        }
        // the moon: a pale disc with a soft halo
        float m = dot(d, normalize(moonDir));
        col += vec3(0.95, 0.96, 1.0) * 2.6 * smoothstep(0.99935, 0.99955, m) + vec3(0.25, 0.3, 0.42) * pow(clamp(m, 0.0, 1.0), 400.0) * 0.6;
        return col;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(texture2D(tA, eq(d, yawA), 1.5).rgb, texture2D(tB, eq(d, yawB), 1.5).rgb, mixB) * expo * tint;
        col = mix(col, haze, hazeAmt * (1.0 - smoothstep(0.0, 0.55, d.y)));
        if (nightK > 0.001) col = mix(col, nightSky(d), nightK);
        col = min(col, vec3(7.0)); // the sun disc is thousands of times brighter than the sky: cap it so it can't blow the bloom out
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

// where the brightest spot of an HDRI is (the sun or moon): { phi: atan(z, x) of its direction, el: elevation in radians }
export function sunSpot(tex) {
  const { data, width, height } = tex.image, half = data instanceof Uint16Array;
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i], g = half ? THREE.DataUtils.fromHalfFloat(data[i + 1]) : data[i + 1], b = half ? THREE.DataUtils.fromHalfFloat(data[i + 2]) : data[i + 2];
    const l = r + g + b; if (l > best) { best = l; bx = x; by = y; }
  }
  return { phi: ((bx + 0.5) / width - 0.5) * Math.PI * 2, el: ((by + 0.5) / height - 0.5) * Math.PI };
}
