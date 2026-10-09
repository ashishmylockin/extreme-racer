// AI tuning: think = frames between decisions, look = how far ahead it sees (px),
// miss = chance it fails to notice a given car, cooldown = min frames between lane changes,
// greedy = detours for coins when the road is clear, speed = the pace it likes to hold
const DIFFS = {
  easy:   { think: 24, look: 120, miss: 0.35, cooldown: 30, greedy: false, speed: 1.9 },
  medium: { think: 14, look: 170, miss: 0.12, cooldown: 18, greedy: true,  speed: 2.5 },
  hard:   { think: 6,  look: 230, miss: 0.02, cooldown: 8,  greedy: true,  speed: 3.1 },
  impossible: { think: 1, look: 400, miss: 0, cooldown: 3, greedy: true, speed: 4.4, plan: true, accel: 0.05 }, // never misses a car, reacts every frame and runs flat out
};
const DEMO_AI = { think: 5, look: 230, miss: 0, cooldown: 8, greedy: false, speed: 2.8 };

// camera views: the first is top-down; the other two are projected 3D road views
const CAMS = [
  { name: "Overhead", desc: "Top-down view of the road" },
  { name: "Chase", desc: "Right behind the car", f: 240, back: 230, h: 218, hor: 150, kx: 0.55 },
  { name: "Cockpit", desc: "Through the driver's eyes", f: 300, back: 8, h: 30, hor: 215, kx: 0.55 },
];

