// The Garage: a lit showroom with the car on a slowly rotating turntable. It is its own little scene, drawn instead of the race
// while the Garage menu is open.
import * as THREE from "three";
import { skyOf } from "./env.js";

export function createShowroom(makeCar) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 200);
  scene.background = new THREE.Color(0x07080d);
  // a dark backdrop with a soft pool of light behind the car
  const bc = document.createElement("canvas"); bc.width = 4; bc.height = 256; const g = bc.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#04050a"); grd.addColorStop(0.5, "#161b2c"); grd.addColorStop(0.62, "#232a42"); grd.addColorStop(1, "#06070c"); g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), new THREE.MeshBasicMaterial({ map: bt, side: THREE.BackSide, fog: false })));

  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f1118, roughness: 0.28, metalness: 0.7 })); floor.receiveShadow = true; scene.add(floor);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.8, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x1b1e27, roughness: 0.25, metalness: 0.85 })); table.position.y = 0.25; table.receiveShadow = true; scene.add(table);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.09, 8, 80).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.85, 1).multiplyScalar(2.2), toneMapped: false })); ring.position.y = 0.5; scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.05, 8, 80).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.4, 0.15).multiplyScalar(1.6), toneMapped: false })); ring2.position.y = 0.02; scene.add(ring2);

  // lights: warm key from the front-left, cool rims from behind, a soft fill
  const key = new THREE.DirectionalLight(0xfff0dd, 1.6); key.position.set(-9, 11, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); key.shadow.bias = -0.0004; scene.add(key);
  const rim1 = new THREE.SpotLight(0x6fa8ff, 160, 60, 0.55, 0.8, 1.4); rim1.position.set(10, 8, -9); rim1.target.position.set(0, 1, 0); scene.add(rim1, rim1.target);
  const rim2 = new THREE.SpotLight(0xff8a50, 130, 60, 0.55, 0.8, 1.4); rim2.position.set(-10, 7, -9); rim2.target.position.set(0, 1, 0); scene.add(rim2, rim2.target);
  scene.add(new THREE.HemisphereLight(0x8899cc, 0x0a0a10, 0.2));

  const turntable = new THREE.Group(); turntable.position.y = 0.5; scene.add(turntable);
  const cars = new Map(); let shown = -1, t = 0;
  return {
    scene, camera, key,
    useEnvironment() { const sky = skyOf("overcast") || skyOf("midday"); if (sky) { scene.environment = sky.env; scene.environmentIntensity = 0.3; } },
    update(dt, teamIndex, team) {
      t += dt;
      if (teamIndex !== shown) { // swap the car on the turntable
        if (shown >= 0 && cars.has(shown)) turntable.remove(cars.get(shown));
        let c = cars.get(teamIndex); if (!c) { c = makeCar(team); c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); cars.set(teamIndex, c); }
        c.position.set(0, 0, 0); turntable.add(c); shown = teamIndex;
      }
      const c = cars.get(shown); if (c && c.userData.wheels) for (const w of c.userData.wheels) w.rotation.x -= dt * 0.8; // tyres idle round
      turntable.rotation.y += dt * 0.55;
      camera.position.set(Math.sin(t * 0.2) * 2.5, 3.6 + Math.sin(t * 0.31) * 0.4, 15); camera.lookAt(0, -0.9, 0); // aimed a little low, so the car sits in the upper half of the screen, above the menu text
    },
  };
}
