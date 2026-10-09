// Post-processing: the finished 3D picture goes through bloom, speed blur, chromatic aberration (nitro), a per-city colour grade,
// vignette, heat shimmer, a lens flare, depth of field (menus / photo mode), tone mapping and anti-aliasing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

// Everything that looks like a "lens" or "grade" lives in one shader so it costs a single full-screen pass.
const FXShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, aspect: { value: 1.7 },
    blur: { value: 0 }, aberr: { value: 0 }, vig: { value: 0.3 }, heat: { value: 0 },
    sat: { value: 1 }, contrast: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: 0 },
    flarePos: { value: new THREE.Vector2(0.5, 0.5) }, flareAmt: { value: 0 }, flareCol: { value: new THREE.Color(1, 0.9, 0.7) },
    fmode: { value: 0 }, grain: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, aspect, blur, aberr, vig, heat, sat, contrast, lift, flareAmt, grain; uniform int fmode;
    uniform vec3 tint, flareCol; uniform vec2 flarePos; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv, c = uv - 0.5;
      if (heat > 0.0) { // heat shimmer: the air wobbles above the hot road
        float band = smoothstep(0.0, 0.3, uv.y) * (1.0 - smoothstep(0.3, 0.62, uv.y));
        uv.x += sin(uv.y * 95.0 + time * 4.0) * 0.0016 * heat * band; uv.y += cos(uv.x * 70.0 + time * 3.0) * 0.0007 * heat * band;
      }
      vec2 off = c * aberr; vec3 col = vec3(0.0);
      if (blur > 0.002) { // radial blur from the centre: speed
        const int N = 7;
        for (int i = 0; i < N; i++) { float t = float(i) / float(N - 1); vec2 u = uv - c * blur * t * 0.14;
          col += vec3(texture2D(tDiffuse, u + off).r, texture2D(tDiffuse, u).g, texture2D(tDiffuse, u - off).b); }
        col /= float(N);
      } else col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      // lens flare when looking into the sun
      if (flareAmt > 0.001) {
        vec2 d = (flarePos - 0.5) * vec2(aspect, 1.0), p = (uv - 0.5) * vec2(aspect, 1.0); vec3 fl = vec3(0.0);
        fl += flareCol * exp(-length(p - d) * 5.0) * 0.55;
        for (int i = 1; i <= 4; i++) { float k = -0.35 * float(i); vec2 g = d * k; fl += flareCol * (0.5 + 0.1 * float(i)) * smoothstep(0.09 + 0.02 * float(i), 0.0, length(p - g)) * 0.12; }
        fl += flareCol * smoothstep(0.012, 0.0, abs(p.y - d.y)) * exp(-abs(p.x - d.x) * 2.5) * 0.3; // the horizontal streak
        col += fl * flareAmt;
      }
      // grade: saturation, contrast, tint, lift
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat); col = (col - 0.18) * contrast + 0.18; col = col * tint + lift;
      if (fmode == 1) { l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = vec3(l) * 1.1; col = (col - 0.18) * 1.25 + 0.18; }                       // noir
      else if (fmode == 2) { col = mix(col, vec3(dot(col, vec3(0.33))), 0.25) * vec3(1.12, 0.98, 0.78) + 0.015; }                                      // vintage
      else if (fmode == 3) { l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 1.6); }                                               // vivid
      else if (fmode == 4) { col *= vec3(0.82, 0.95, 1.2); }                                                                                           // cool
      float v = smoothstep(0.9, 0.2, length(c * vec2(aspect * 0.85, 1.0))); col *= mix(1.0 - vig, 1.0, v); // vignette
      col += (hash(uv * 900.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }); // 4x multisampling inside the pipeline
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  const bokeh = new BokehPass(scene, camera, { focus: 18, aperture: 0.0012, maxblur: 0.012 }); bokeh.enabled = false;
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.55, 1.0);
  const fx = new ShaderPass(FXShader);
  const output = new OutputPass();
  const smaa = new SMAAPass(size.x, size.y);
  const fxaa = new ShaderPass(FXAAShader); fxaa.enabled = false;
  [renderPass, bokeh, bloom, fx, output, smaa, fxaa].forEach(p => composer.addPass(p));
  const u = fx.uniforms;
  const api = {
    composer, renderPass, bokeh, bloom, fx, smaa, fxaa, u,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr); composer.setSize(w, h);
      fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); u.aspect.value = w / h;
    },
    setScene(s, c) { renderPass.scene = s; renderPass.camera = c; bokeh.scene = s; bokeh.camera = c; },
    render(dt) { composer.render(dt); },
  };
  return api;
}
