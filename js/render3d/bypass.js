// The bypass: a glowing side track that appears beside the road, curves out round the vehicle ahead and rejoins the lane further on.
// The simulation decides where it runs (bypassTrack = { side, lane, y0, L, OFF, RAMP }); this only draws it, in the same shape the car follows.
import * as THREE from "three";
import { SCALE, simX, simZ } from "./mapping.js";

export function createBypass(scene) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main() {
        float across = abs(vUv.y - 0.5) * 2.0, rim = smoothstep(0.78, 1.0, across);
        float c = fract(vUv.x * 0.22 - time * 1.1 + across * 0.35), band = smoothstep(0.0, 0.12, c) * smoothstep(0.45, 0.3, c); // arrows streaming forward
        float a = 0.16 + 0.55 * rim + 0.32 * band * (1.0 - rim);
        gl_FragColor = vec4(vec3(0.1, 0.8, 1.0) * (0.9 + 0.8 * rim), a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3; scene.add(mesh);
  let current = null, prevY0 = 0, lastY0 = 0;
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  function build(t) { // the ribbon, built once per bypass
    const pos = [], uv = [], idx = [], step = 14, n = Math.ceil(t.L / step), half = 3.0;
    for (let i = 0; i <= n; i++) {
      const d = Math.min(t.L, i * step), k = smooth(Math.min(d / t.RAMP, (t.L - d) / t.RAMP)), x = simX(laneX(t.lane) + t.side * t.OFF * k), z = -d * SCALE;
      pos.push(x - half, 0.16, z, x + half, 0.16, z); uv.push(d * SCALE, 0, d * SCALE, 1);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    mesh.geometry.dispose(); mesh.geometry = g;
  }
  return {
    update(track, alpha, time) {
      if (!track) { mesh.visible = false; current = null; return; }
      if (track !== current) { current = track; build(track); lastY0 = prevY0 = track.y0; }
      if (track.y0 !== lastY0) { prevY0 = lastY0; lastY0 = track.y0; }
      mesh.visible = true; mesh.position.z = simZ(prevY0 + (track.y0 - prevY0) * alpha); mat.uniforms.time.value = time;
    },
  };
}
