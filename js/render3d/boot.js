// The 3D renderer will live in js/render3d/. For now this only proves that Three.js loads through the import map.
import * as THREE from "three";
window.THREE_REVISION = THREE.REVISION;
console.log("Three.js r" + THREE.REVISION + " loaded");
