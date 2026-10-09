// Skies and image-based lighting. Five CC0 HDRI skies from Poly Haven (morning, midday, sunset, night, overcast) light the scene and
// show up in reflections. Each city uses one; between two cities the sky cross-fades and the lighting follows.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export const TODS = ["morning", "midday", "sunset", "night", "overcast"];
// which sky each of the 22 cities gets (by venue name)
export const CITY_TOD = {
  Sydney: "morning", Shanghai: "overcast", Tokyo: "morning", Miami: "sunset", Montreal: "midday", "Monte Carlo": "midday", Barcelona: "midday", Salzburg: "morning",
  London: "overcast", Brussels: "overcast", Budapest: "midday", Amsterdam: "midday", Rome: "midday", Madrid: "midday", Baku: "sunset", Singapore: "night",
  Austin: "midday", "Mexico City": "midday", "Sao Paulo": "overcast", "Las Vegas": "night", Doha: "night", "Abu Dhabi": "sunset",
};
// sun / moon direction (azimuth: 0 = straight ahead, positive to the right; elevation in degrees), light colour and strength, sky brightness
export const LOOK = {
  morning:  { az: -50, el: 24, color: 0xffe2b8, sun: 3.4, env: 0.6, sky: 1.0 },
  midday:   { az: -35, el: 58, color: 0xfff4e2, sun: 3.0, env: 1.0, sky: 1.0 },
  sunset:   { az: -48, el: 9, color: 0xffa860, sun: 2.6, env: 0.9, sky: 1.0 },
  night:    { az: 30, el: 38, color: 0x8fa8ff, sun: 0.35, env: 0.5, sky: 1.0 },
  overcast: { az: -30, el: 50, color: 0xdfe6ee, sun: 0.0, env: 1.1, sky: 1.0 },
};

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

export async function loadSkies(renderer, onProgress = () => {}) {
  const pmrem = new THREE.PMREMGenerator(renderer), loader = new RGBELoader();
  let done = 0;
  await Promise.all(TODS.map(async name => {
    try {
      const tex = await loader.loadAsync(`assets/hdri/${name}.hdr`);
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
export function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: true,
    uniforms: { tA: { value: null }, tB: { value: null }, mixB: { value: 0 }, expo: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, yawA: { value: 0 }, yawB: { value: 0 }, haze: { value: new THREE.Color(0.7, 0.8, 0.9) }, hazeAmt: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tA, tB; uniform float mixB, expo, yawA, yawB, hazeAmt; uniform vec3 tint, haze; varying vec3 vDir;
      vec2 eq(vec3 d, float yaw) { float a = atan(d.z, d.x) + yaw; return vec2(a / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(texture2D(tA, eq(d, yawA), 1.5).rgb, texture2D(tB, eq(d, yawB), 1.5).rgb, mixB) * expo * tint;
        col = mix(col, haze, hazeAmt * (1.0 - smoothstep(0.0, 0.55, d.y)));
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
