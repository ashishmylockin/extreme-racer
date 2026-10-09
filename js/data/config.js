const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// the tab icon, drawn here so the game stays a single file: a yellow race car from above on a dark tile, with a speed streak
(function makeFavicon() {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), box = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    g.fillStyle = "#16171c"; g.beginPath(); g.roundRect ? g.roundRect(0, 0, 64, 64, 14) : g.rect(0, 0, 64, 64); g.fill();
    box(6, 40, 12, 4, "#ff7a1a"); box(2, 48, 10, 3, "#ff7a1a"); // speed streaks
    for (const [x, y] of [[17, 13], [41, 13], [17, 39], [41, 39]]) box(x, y, 7, 13, "#0a0a0c"); // tyres
    box(19, 6, 26, 5, "#ffe11a"); box(18, 52, 28, 5, "#ffe11a"); // front and rear wings
    g.fillStyle = "#ffe11a"; g.beginPath(); g.moveTo(29, 8); g.lineTo(35, 8); g.lineTo(39, 34); g.lineTo(37, 54); g.lineTo(27, 54); g.lineTo(25, 34); g.closePath(); g.fill(); // body
    box(30, 26, 4, 12, "#141416"); g.fillStyle = "#141416"; g.beginPath(); g.arc(32, 32, 4, 0, Math.PI * 2); g.fill(); // cockpit and helmet
    document.getElementById("favicon").href = c.toDataURL("image/png");
  } catch (e) {}
})();

const VERSION = "1.0.0";
let W = 400, H = 480; // the width stretches to fit your screen; on a portrait phone the height grows instead
let ROAD_L = 40; const ROAD_W = 320; let ROAD_R = ROAD_L + ROAD_W; // grass verges either side of the road, always centred
const LANES = 3, LANE_W = ROAD_W / LANES, CAR_W = 36, CAR_H = 72;
const SPAWN_PX = 220;      // distance between traffic spawns at the start (shrinks as you progress)
const GRID_STEP = 55;      // frames between the five red start lights coming on (~0.9s each)
const AI_REACT = 6;        // the CPU pulls away exactly 6 frames = 0.100s after the lights turn green
const STAGE_LEN = 2400;    // distance travelled per city in Endless
const LEVEL_LEN = 20000;   // World Tour: one city is one level (~65s flat out at 300 km/h, ~90s driving carefully)
const VMAX = 5.5;          // CPU top speed (x60 = km/h); the player has no cap
const NITRO_MAX = VMAX * 1.3;  // where the speed dial needle tops out
const NITRO_PUSH = 2.2;        // how far above your normal speed nitro can push you (~130 km/h)
// throttle pull at speed v, per frame: ~40 km/h per second off the line, fading like air drag does
// (0-100 in ~2.6s, 0-300 in ~10.5s), but never below 4 km/h per second, so holding on always gains speed
const accelAt = v => Math.max(40 / (1 + (v * 60 / 250) ** 3), 4) / 3600;
const NITRO_FRAMES = 200;      // nitro burn time (~3.3s)
const AHEAD = 1000;        // how far up the road traffic, coins and scenery exist, so the 3D views see an endless road
const TAU = Math.PI * 2;

