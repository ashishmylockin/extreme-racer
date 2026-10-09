// Photo mode (press P while paused): a free camera, filters, depth of field and a hidden HUD, for great screenshots.
import * as THREE from "three";

export const FILTERS = ["Normal", "Noir", "Vintage", "Vivid", "Cool"];

export function createPhoto() {
  const held = new Set();
  const ph = {
    active: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 55, filter: 0, hideHud: false, dof: false, aperture: 0.0012, capture: false, note: "",
    enter(fromCamera) { // start from where the race camera is looking
      const e = new THREE.Euler().setFromQuaternion(fromCamera.quaternion, "YXZ");
      ph.pos.copy(fromCamera.position); ph.yaw = e.y; ph.pitch = e.x; ph.fov = fromCamera.fov; ph.active = true; ph.hideHud = false; held.clear();
    },
    exit() { ph.active = false; ph.filter = 0; ph.dof = false; held.clear(); },
    key(e, down) { // returns true if the key was used
      const c = e.code;
      if (!down) { held.delete(c); return false; }
      if (e.repeat && !["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(c)) return true;
      if (c === "KeyP" || c === "Escape") { ph.exit(); return true; }
      if (c === "KeyV") { ph.filter = (ph.filter + 1) % FILTERS.length; ph.note = FILTERS[ph.filter]; return true; }
      if (c === "KeyH") { ph.hideHud = !ph.hideHud; return true; }
      if (c === "KeyB") { ph.dof = !ph.dof; ph.note = ph.dof ? "Depth of field on" : "Depth of field off"; return true; }
      if (c === "BracketLeft") { ph.aperture = Math.max(0.0002, ph.aperture * 0.7); return true; }
      if (c === "BracketRight") { ph.aperture = Math.min(0.01, ph.aperture * 1.4); return true; }
      if (c === "Enter" || c === "Space") { ph.capture = true; return true; }
      held.add(c); return true;
    },
    look(dx, dy) { ph.yaw -= dx * 0.004; ph.pitch = Math.max(-1.5, Math.min(1.5, ph.pitch - dy * 0.004)); },
    update(dt) {
      if (!ph.active) return;
      const fast = held.has("ShiftLeft") || held.has("ShiftRight") ? 3 : 1, sp = 14 * fast * dt;
      const fwd = new THREE.Vector3(-Math.sin(ph.yaw) * Math.cos(ph.pitch), Math.sin(ph.pitch), -Math.cos(ph.yaw) * Math.cos(ph.pitch)), right = new THREE.Vector3(Math.cos(ph.yaw), 0, -Math.sin(ph.yaw));
      if (held.has("KeyW") || held.has("ArrowUp")) ph.pos.addScaledVector(fwd, sp);
      if (held.has("KeyS") || held.has("ArrowDown")) ph.pos.addScaledVector(fwd, -sp);
      if (held.has("KeyD") || held.has("ArrowRight")) ph.pos.addScaledVector(right, sp);
      if (held.has("KeyA") || held.has("ArrowLeft")) ph.pos.addScaledVector(right, -sp);
      if (held.has("KeyE")) ph.pos.y += sp; if (held.has("KeyQ")) ph.pos.y = Math.max(0.3, ph.pos.y - sp);
      if (held.has("KeyZ")) ph.fov = Math.max(15, ph.fov - 30 * dt); if (held.has("KeyX")) ph.fov = Math.min(100, ph.fov + 30 * dt);
    },
  };
  return ph;
}
