// The three race cameras (Overhead, Chase, Cockpit) plus a menu camera, and the 3D cockpit that rides on the camera.
import * as THREE from "three";

// cockpit parts are drawn on top of the car body (no depth test) in the order they were added, so they never vanish inside the tub
const part = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, depthTest: false, ...o });
const dark = part(0x15161a), trim = part(0x2c2f36, { metalness: 0.5 }), carbon = part(0x0c0c0e, { roughness: 0.4 });
const add = (parent, mesh, order) => { mesh.renderOrder = order; parent.add(mesh); return mesh; };

let rigDraw = () => {}; // set up inside createCameraRig
export function createCameraRig(scene) {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 2800);
  scene.add(camera);

  // ---- cockpit furniture, parented to the camera so it always sits in front of the driver's eyes ----
  const cockpit = new THREE.Group(); cockpit.visible = false; camera.add(cockpit);
  const dash = add(cockpit, new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), carbon), 20); dash.position.set(0, -0.66, -1.1);
  const wheel = new THREE.Group(); wheel.position.set(0, -0.5, -0.95); wheel.rotation.x = -0.6; cockpit.add(wheel);
  add(wheel, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 8, 24), dark), 21);
  add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.03), dark), 21);
  add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.04), trim), 22);
  // the little screen on the wheel: rev lights, gear and speed, redrawn only when a number changes
  const dc = document.createElement("canvas"); dc.width = 192; dc.height = 112; const dg = dc.getContext("2d");
  const dispTex = new THREE.CanvasTexture(dc); dispTex.colorSpace = THREE.SRGBColorSpace;
  const display = add(wheel, new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.175), new THREE.MeshBasicMaterial({ map: dispTex, depthTest: false })), 23);
  display.position.z = 0.025;
  let dispKey = "";
  rigDraw = (kmh, gear, lit) => {
    const key = `${kmh}|${gear}|${lit}`; if (key === dispKey) return; dispKey = key;
    dg.fillStyle = "#050607"; dg.fillRect(0, 0, 192, 112);
    for (let i = 0; i < 10; i++) { dg.fillStyle = i < lit ? (i < 4 ? "#39ff6a" : i < 8 ? "#ff3b30" : "#3b82ff") : "#262830"; dg.beginPath(); dg.arc(21 + i * 16.7, 16, 6, 0, Math.PI * 2); dg.fill(); }
    dg.textAlign = "center"; dg.fillStyle = "#fff"; dg.font = "bold 56px sans-serif"; dg.fillText(String(gear), 52, 86);
    dg.fillStyle = "#ffd23f"; dg.font = "bold 36px sans-serif"; dg.fillText(String(kmh), 135, 74); dg.fillStyle = "#aaa"; dg.font = "16px sans-serif"; dg.fillText("km/h", 135, 100);
    dispTex.needsUpdate = true;
  };
  for (const s of [-1, 1]) { const grip = add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.06), dark), 22); grip.position.set(s * 0.21, 0, 0); }
  const halo = add(cockpit, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), trim), 20); halo.position.set(0, 0.58, -1.45); halo.rotation.x = 0.22;

  // ---- the two mirrors: small rear cameras drawn onto little screens ----
  const mirrors = [-1, 1].map(side => {
    const rt = new THREE.WebGLRenderTarget(256, 128, { depthBuffer: true });
    const cam = new THREE.PerspectiveCamera(42, 2, 0.5, 300);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.DoubleSide, depthTest: false }));
    screen.scale.x = -1; // a mirror image
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.02), dark);
    const holder = new THREE.Group(); holder.position.set(side * 0.9, -0.02, -1.0); holder.rotation.y = -side * 0.45;
    frame.position.z = -0.012; add(holder, frame, 23); add(holder, screen, 24); cockpit.add(holder);
    return { side, rt, cam };
  });

  const rig = { camera, cockpit, mirrors, camX: 0, back: 16, fov: 60, wheelAngle: 0, shakeV: new THREE.Vector3(), t: 0 };

  // t = the car being followed { x, z, v, tilt, nitro }, fx = { kick, shake, time }
  rig.update = function (mode, t, dt, fx) {
    const sm = rate => 1 - Math.exp(-dt * rate);
    const vv = Math.min(t.v, 9);
    cockpit.visible = mode === "cockpit";
    let fovGoal = 60;
    const pk = Math.min(1, Math.max(0, (1.25 - camera.aspect) / 0.75)); // 0 on a wide screen .. 1 on a tall phone: the view widens and the camera backs off so the road still fits
    if (mode === "overhead") {
      rig.camX += (t.x * 0.35 - rig.camX) * sm(5);
      camera.position.set(rig.camX, 64 + 38 * pk, t.z + 32 + 14 * pk);
      camera.lookAt(rig.camX, 0, t.z - 25); camera.rotation.z = 0;
      fovGoal = 42;
    } else if (mode === "chase") {
      rig.camX += (t.x - rig.camX) * sm(6); // spring: the camera trails the car across the road...
      const backGoal = (14.5 + vv * 1.25 + (t.nitro ? 3.5 : 0)) * (1 + 0.45 * pk);
      rig.back += (backGoal - rig.back) * sm(2.5); // ...and drops back the faster you go
      const lean = t.x - rig.camX;
      camera.position.set(rig.camX, (5.4 + vv * 0.12) * (1 + 0.5 * pk), t.z + rig.back);
      camera.lookAt(rig.camX * 0.4 + t.x * 0.6, 1.5, t.z - 30);
      camera.rotateZ(-lean * 0.02); // lean into the lane change
      fovGoal = 58 + vv * 2.6 + (t.nitro ? 6 : 0);
    } else if (mode === "cockpit") {
      rig.camX = t.x;
      camera.position.set(t.x, 2.0, t.z + 1.35);
      camera.rotation.set(-0.1, -t.tilt * 0.6, -t.tilt * 0.12, "YXZ");
      fovGoal = 72 + vv * 1.6 + (t.nitro ? 6 : 0);
      rig.wheelAngle += (-t.tilt * 3.2 - rig.wheelAngle) * sm(14);
      wheel.rotation.z = rig.wheelAngle;
      rigDraw(Math.round(t.v * 60), fx.gear, fx.lit);
    } else if (mode === "grid") { // before green: a slow sweep round the car from the front, ending behind it with the gantry lights ahead
      const e = fx.grid01, a = 2.5 * (1 - e) + 0.02, R = 9 + 5 * e, hh = 1.4 + 3.8 * e;
      rig.camX = t.x; camera.position.set(t.x + Math.sin(a) * R, hh, t.z + Math.cos(a) * R); camera.lookAt(t.x, 1.4 + 1.6 * e, t.z - 3 - 6 * e); camera.rotateZ(0);
      fovGoal = 52 + 8 * e;
    } else if (mode === "crash") { // the crash camera: slow-motion orbit round the wreck
      const k = fx.crashT, a = 0.3 + k * 0.75, R = 14 - Math.min(k, 2) * 2.6, hh = 3.6 - Math.min(k, 2) * 0.7;
      camera.position.set(t.x + Math.sin(a) * R, hh, t.z + Math.cos(a) * R); camera.lookAt(t.x, 1, t.z);
      fovGoal = 50;
    } else if (mode === "finish") { // after the line: the camera swings round to the front of the car
      const k = Math.min(1, fx.finishT / 2.6), e = k * k * (3 - 2 * k), a = Math.PI * e + 0.1, R = 13 - 2 * e;
      camera.position.set(t.x + Math.sin(a) * R, 3.4 - 1.0 * e, t.z + Math.cos(a) * R); camera.lookAt(t.x, 1.3, t.z - 2 * (1 - e));
      fovGoal = 55;
    } else if (mode === "photo") { // free camera: position and angles come from the photo-mode controller
      camera.position.copy(fx.photo.pos); camera.rotation.set(fx.photo.pitch, fx.photo.yaw, 0, "YXZ"); fovGoal = fx.photo.fov;
    } else if (mode === "inspect") {
      const q = new URLSearchParams(location.search).get("inspect");
      const zm = +new URLSearchParams(location.search).get("zoom") || 1, o = (q === "front" ? [5, 2.5, -9] : q === "top" ? [0.5, 14, 2] : q === "rear" ? [4, 3, 9] : q === "q34" ? [7.5, 3.4, -7.5] : q === "q34r" ? [-7.5, 3.4, 8] : [9, 3, 1]).map(v => v * zm);
      camera.position.set(t.x + o[0], o[1], t.z + o[2]); camera.lookAt(t.x, 1, t.z - 0.5); fovGoal = 45;
    } else { // menu: a slow, low sweep round the demo race
      rig.camX += (t.x - rig.camX) * sm(3);
      const a = fx.time * 0.18;
      camera.position.set(rig.camX + Math.sin(a) * 11, 3.4 + Math.sin(a * 0.7) * 0.8, t.z + 15 + Math.cos(a) * 3);
      camera.lookAt(rig.camX, 1.4, t.z - 22);
      fovGoal = 55;
    }
    fovGoal *= 1 + 0.38 * pk; // (portrait)
    rig.fov += (fovGoal + fx.kick * 12 - rig.fov) * sm(8);
    if (Math.abs(camera.fov - rig.fov) > 0.01) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    if (fx.shake > 0.5) camera.position.add(rig.shakeV.set((Math.random() - 0.5) * fx.shake * 0.035, (Math.random() - 0.5) * fx.shake * 0.035, 0));

    if (mode === "cockpit") for (const m of mirrors) { // aim each mirror camera backwards from beside the car
      m.cam.position.set(t.x + m.side * 1.9, 1.5, t.z + 1.2);
      m.cam.lookAt(t.x + m.side * 3.2, 1.3, t.z + 60);
    }
  };
  return rig;
}
