// ---------- menus ----------

// ---- garage upgrades: 5 levels each, bought with coins; they only ever help human drivers ----
const UPGRADES = [
  // now(l): what level l does; next(l): the short version shown after the arrow
  { key: "handling", name: "Handling", now: l => `Lane changes +${l * 8}%`, next: l => `+${l * 8}%` },
  { key: "nitro", name: "Nitro", now: l => `Nitro burns ${(NITRO_FRAMES * (1 + 0.15 * l) / 60).toFixed(1)} s`, next: l => `${(NITRO_FRAMES * (1 + 0.15 * l) / 60).toFixed(1)} s` },
  { key: "magnet", name: "Magnet", now: l => l ? `Next-lane coins, range ${70 + 35 * l}` : "Off: pulls in next-lane coins", next: l => `range ${70 + 35 * l}` },
  { key: "shield", name: "Shield", now: l => `${l * 12}% chance to start shielded`, next: l => `${l * 12}%` },
];
const UPG_COST = [30, 60, 110, 180, 270]; // price of levels 1..5
let upg = store.get("upgrades", {});
const upLvl = k => upg[k] || 0;
const nitroFramesFor = r => r.ai ? NITRO_FRAMES : Math.round(NITRO_FRAMES * (1 + 0.15 * upLvl("nitro")));
function buyUpgrade(u) {
  const l = upLvl(u.key);
  if (l >= 5 || wallet < UPG_COST[l]) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); garageFx.denied(); return; }
  wallet -= UPG_COST[l]; upg[u.key] = l + 1;
  if (l + 1 >= 5) unlock("maxup");
  store.set("coins", wallet); store.set("upgrades", upg);
  garageFx.upgraded();
}

function garageAction() {
  const t = TEAMS[garageIdx];
  if (owned.includes(garageIdx)) { equipped = garageIdx; store.set("team", equipped); garageFx.equipped(); return; }
  if (wallet < t.cost) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); garageFx.denied(); return; }
  wallet -= t.cost; owned.push(garageIdx); equipped = garageIdx;
  store.set("coins", wallet); store.set("teams", owned); store.set("team", equipped);
  garageFx.bought(garageIdx);
}

const songInput = document.getElementById("songInput");
songInput.addEventListener("change", async () => {
  const files = Array.from(songInput.files || []);
  for (const f of files) {
    music.addBlob(f.name, f);
    try { await songDB.add(f.name, f); } catch (e) {}
  }
  if (files.length) say(`Added ${files.length} song${files.length > 1 ? "s" : ""}`);
  songInput.value = "";
});

const MAIN_MENU = [
  { label: "World Tour", go: () => openMap() }, // the map of all 22 cities
  { label: "Daily Challenge", go: () => withTutorial(() => startGame("daily", null, dailyCity())) },
  { label: "Endless", go: () => withTutorial(() => startGame("single")) },
  { label: "VS Computer", go: () => openMenu("difficulty", 1) },
  { label: "Multiplayer", go: () => startGame("multi") },
  { label: "Garage", go: () => { garageIdx = equipped; openMenu("garage"); } },
  { label: "Stats & Awards", go: () => openMenu("stats") },
  { label: "Settings", go: () => openMenu("options") },
];
// Settings: three volume sliders (Left / Right or tap the bar), toggles, the controls page and the songs sub-menu
function setSlider(key, v) { settings[key] = Math.round(clamp(v, 0, 1) * 10) / 10; saveSettings(); applyVolumes(); if (key !== "music") sound.tone(600, 600, 0.05, "square", 0.03); }
const OPTIONS_MENU = [
  { slider: "music", name: "Music", label: "", w: 300, go: () => {} },
  { slider: "fx", name: "Effects", label: "", w: 300, go: () => {} },
  { slider: "engine", name: "Engine", label: "", w: 300, go: () => {} },
  { label: () => `Screen shake: ${settings.shake ? "ON" : "OFF"}`, w: 300, go: () => { settings.shake = !settings.shake; saveSettings(); } },
  { label: "Graphics...", w: 300, go: () => openMenu("graphics") },
  { label: () => `Fullscreen: ${document.fullscreenElement || document.webkitFullscreenElement ? "ON" : "OFF"}`, w: 300, go: () => toggleFullscreen() },
  { label: "Controls", w: 300, go: () => { controlsTab = onPad() ? 1 : onTouch() ? 2 : 0; openMenu("controls"); } }, // opens on the page for what you are holding
  { label: "Credits", w: 300, go: () => openMenu("credits") },
  { label: () => `Songs...${music.userCount ? ` (${music.userCount} of yours)` : ""}`, w: 300, go: () => openMenu("songs") },
  { label: "Back", go: () => openMenu("menu", 7) },
];
// ---- Graphics settings (the 3D renderer): a preset, then each setting on its own. Enter or Left / Right cycles a row. ----
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cycleIn = (list, cur, dir) => list[(list.indexOf(cur) + list.length + dir) % list.length];
function gfxApply() { saveSettings(); if (window.R3D) R3D.refreshQuality(); fit(); }
const gfxShown = key => settings[key] || (R3D.gfxDefaults(R3D.quality.level)[key]); // what a setting currently is (its own value, or the preset's)
const GRAPHICS_MENU = [
  { label: () => window.R3D ? `Graphics: ${settings.gfx === "auto" ? `Auto (${cap(R3D.quality.level)})` : cap(settings.gfx)}` : "Graphics: 2D mode", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.gfx = cycleIn(["auto", "low", "medium", "high", "ultra", "max"], settings.gfx, dir); Object.assign(settings, { renderScale: 0, shadows: "", effects: "", drawDist: "" }); gfxApply(); }, go: () => GRAPHICS_MENU[0].cycle(1) },
  { label: () => window.R3D ? `Render scale: ${Math.round(R3D.quality.scale * 100)}%` : "Render scale: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.renderScale = cycleIn(R3D.OPTIONS.SCALES, R3D.quality.scale, dir); gfxApply(); }, go: () => GRAPHICS_MENU[1].cycle(1) },
  { label: () => window.R3D ? `Shadows: ${cap(gfxShown("shadows"))}` : "Shadows: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.shadows = cycleIn(R3D.OPTIONS.SHADOWS, gfxShown("shadows"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[2].cycle(1) },
  { label: () => window.R3D ? `Effects: ${cap(gfxShown("effects"))}` : "Effects: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.effects = cycleIn(R3D.OPTIONS.EFFECTS, gfxShown("effects"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[3].cycle(1) },
  { label: () => window.R3D ? `Draw distance: ${cap(gfxShown("drawDist"))}` : "Draw distance: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.drawDist = cycleIn(R3D.OPTIONS.DIST, gfxShown("drawDist"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[4].cycle(1) },
  { label: () => `FPS counter: ${settings.fps ? "ON" : "OFF"}`, w: 300, cycle: () => { settings.fps = !settings.fps; saveSettings(); }, go: () => GRAPHICS_MENU[5].cycle(1) },
  { label: () => `Cinematic cameras: ${settings.cinema === false ? "OFF" : "ON"}`, w: 300, cycle: () => { settings.cinema = settings.cinema === false; saveSettings(); if (window.R3D) R3D.cinematic = settings.cinema; }, go: () => GRAPHICS_MENU[6].cycle(1) },
  { label: () => `Reduce effects (2D mode): ${settings.lowfx ? "ON" : "OFF"}`, w: 300, cycle: () => { settings.lowfx = !settings.lowfx; saveSettings(); fit(); }, go: () => GRAPHICS_MENU[7].cycle(1) },
  { label: "Back", go: () => openMenu("options", 4) },
];
const SONGS_MENU = [
  { label: "Next Song", go: () => music.next() },
  { label: () => `Add My Songs${music.userCount ? ` (${music.userCount})` : ""}`, go: () => songInput.click() },
  { label: "Clear My Songs", go: () => { music.clearUser(); songDB.clear().catch(() => {}); say("Songs cleared"); } },
  { label: "Back", go: () => openMenu("options", 8) },
];
const CREDITS_MENU = [{ label: "Back", go: () => openMenu("options", 7) }];
const CONTROLS_MENU = [{ label: "Back", go: () => openMenu("options", 6) }];
let controlsTab = 0; // 0 keyboard, 1 controller, 2 touch
const DIFF_MENU = [
  { label: "Easy", go: () => startGame("vs", "easy") },
  { label: "Medium", go: () => startGame("vs", "medium") },
  { label: "Hard", go: () => startGame("vs", "hard") },
  { label: "Impossible", go: () => startGame("vs", "impossible") },
  { label: "Back", go: () => openMenu("menu", 3) },
];
// ---- World Tour map: 22 tiles in two columns; a city unlocks once the one before it is finished ----
const MAP_COLS = 2, MAP_ROWS = Math.ceil(ROUTE.length / MAP_COLS);
const unlocked = i => i <= tourCleared;
function openMap() { mapIdx = Math.min(tourCleared, ROUTE.length - 1); jumpTo(mapIdx, 0.3); openMenu("map"); sel = -1; } // starts on the next unfinished city
function mapTile(i) { // tiles run down the first column, then the second
  const tw = Math.min((W - 24) / 2, 250), x0 = W / 2 - tw - 3, c = Math.floor(i / MAP_ROWS), r = i % MAP_ROWS;
  return { x: x0 + c * (tw + 6), y: 64 + r * 34, w: tw, h: 31 };
}
function moveMap(i) { if (i === mapIdx) return; mapIdx = i; jumpTo(mapIdx, 0.3); sound.tone(520, 520, 0.04, "square", 0.03); }
function startCity(i) { // picking a city opens its briefing: targets and missions, then RACE
  if (!unlocked(i)) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); say(`Finish ${ROUTE[i - 1].venue} to unlock`); return; }
  openMenu("brief");
}
const MAP_MENU = [{ label: "Back", go: () => { initDemo(); openMenu("menu", 0); } }];
const BRIEF_MENU = [
  { label: "RACE", big: true, go: () => withTutorial(() => startGame("tour", null, mapIdx)) },
  { label: "Back", go: () => { openMenu("map"); sel = -1; } },
];

// ---- missions: 3 optional goals per tour city, paid in coins. Count goals complete the moment you reach them;
// the "finish without..." ones are checked at the line. ----
const MISSION_TYPES = [
  { text: n => `${n} near misses in one run`, n: i => 3 + Math.floor(i / 4), now: r => r.nm || 0 },
  { text: n => `Collect ${n} coins`, n: i => 12 + Math.floor(i * 0.8), now: r => r.coins },
  { text: n => `Pass ${n} cars`, n: i => 40 + Math.floor(i * 1.5), now: r => r.passed },
  { text: n => `Reach a x${n} combo`, n: i => 3 + Math.floor(i / 6), now: r => r.bestCombo || 0 },
  { text: n => `Hit ${n} km/h`, n: i => 320 + 10 * Math.floor(i / 2), now: r => Math.round((r.topV || 0) * 60) },
  { text: () => "Finish without braking", finish: r => !r.braked },
  { text: () => "Finish without picking up nitro", finish: r => !r.usedNitro },
];
const cityMissions = i => [i, i + 2, i + 4].map(k => { const m = MISSION_TYPES[k % MISSION_TYPES.length], n = m.n ? m.n(i) : 0; return { ...m, n, label: m.text(n) }; });
const missionReward = i => 20 + 2 * i;
let missionsDone = store.get("missions", {}); // { cityIndex: [done, done, done] }
const missionState = i => missionsDone[i] || [false, false, false];
function completeMission(i, k, m) {
  const st = missionState(i).slice(); if (st[k]) return;
  st[k] = true; missionsDone[i] = st; store.set("missions", missionsDone);
  wallet += missionReward(i); store.set("coins", wallet);
  level.missionsNow = (level.missionsNow || 0) + 1;
  say(`Mission complete: ${m.label}  +${missionReward(i)} coins`); sound.tone(660, 1320, 0.25, "triangle", 0.08);
}
function checkMissions(atFinish) {
  if (!level || level.daily) return;
  const r = racers[0];
  cityMissions(level.idx).forEach((m, k) => {
    if (missionState(level.idx)[k]) return;
    if (m.finish ? atFinish && m.finish(r) : m.now(r) >= m.n) completeMission(level.idx, k, m);
  });
}
const GARAGE_MENU = [
  { label: () => owned.includes(garageIdx) ? (garageIdx === equipped ? "Equipped" : "Equip") : `Buy - ${TEAMS[garageIdx].cost} coins`, go: garageAction },
  { label: "Upgrades", go: () => openMenu("upgrades") },
  { label: "Back", go: () => openMenu("menu", 5) },
];
function cycleCamera(dir) { cam = (cam + CAMS.length + dir) % CAMS.length; store.set("camera", cam); }
const PAUSE_MENU = [
  { label: "Resume", go: () => { state = "playing"; } },
  { label: () => `Camera: ${CAMS[cam].name}`, go: () => cycleCamera(1) }, // the paused race behind previews it
  { label: "Restart", go: () => restartRace() },
  { label: "Quit to Menu", go: toMenu },
];
function restartRace() { if (state === "paused" || state === "camera") startGame(mode, difficulty, runStage); } // the same race again from the grid (tyres first, as always)
const CAMERA_MENU = [
  ...CAMS.map((c, i) => ({ label: c.name, go: () => { cam = i; store.set("camera", cam); state = "playing"; } })),
  { label: "Resume", go: () => { state = "playing"; } },
];
// first-run tips, shown once before the first Single Player race
let tipIdx = 0;
const TIPS = [
  { title: "CHANGE LANES", lines: ["Switch lanes and dodge the traffic"], prompt: [["steer", "Change lane"]], pad: ["Push the stick or the d-pad", "to switch lanes and dodge the traffic"], touch: ["Tap the left or right side", "of the screen to switch lanes"], icon: () => {
    ctx.fillStyle = "#3a3c42"; ctx.fillRect(-66, -42, 132, 84);
    ctx.fillStyle = "#eee"; for (const x of [-22, 22]) for (let y = -40; y < 42; y += 18) ctx.fillRect(x - 1, y, 2, 9);
    ctx.save(); ctx.scale(0.55, 0.55); drawCar(TEAMS[equipped]); ctx.restore();
    ctx.fillStyle = "#ffd23f"; for (const s of [-1, 1]) poly([[s * 74, -14], [s * 74, 14], [s * 94, 0]]);
  } },
  { title: "LAUNCH START", lines: ["Hold GAS + BRAKE on the grid, let go with", "the needle in the GREEN: 300 km/h! Orange 200, red 100."], prompt: [["launch", "Hold, let go in the green"]], touch: ["Hold GAS + BRAKE on the grid, let go with", "the needle in the GREEN: 300 km/h! Orange 200, red 100."], icon: () => {
    for (const [y, col] of [[-16, "#ff2a2a"], [18, "#39ff6a"]]) for (let i = 0; i < 5; i++) {
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-56 + i * 28, y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-56 + i * 28, y, 8, 0, TAU); ctx.fill();
    }
  } },
  { title: "NITRO, COINS & BYPASS", lines: ["Blue canisters give a nitro boost; coins buy cars.", "A BYPASS arrow in an outside lane lets you steer", "out and curve round the next vehicle at nitro speed."], icon: () => {
    drawNitroIcon(-36, 0, 22, clock); drawCoin(36, 0, 18, Math.cos(clock / 8));
  } },
];
const TUTORIAL_MENU = [
  { label: () => tipIdx < TIPS.length - 1 ? "Next" : "Let's race!", go: () => nextTip() },
  { label: "Skip", go: () => endTutorial() },
];
let afterTutorial = null; // the race to start once the tips are done
function withTutorial(start) { if (store.get("tutorialSeen", false)) start(); else { afterTutorial = start; tipIdx = 0; openMenu("tutorial"); } }
function nextTip() { if (tipIdx >= TIPS.length - 1) endTutorial(); else { tipIdx++; sel = 0; } }
function endTutorial() { store.set("tutorialSeen", true); (afterTutorial || (() => startGame("single")))(); afterTutorial = null; }

const UPGRADE_MENU = [
  ...UPGRADES.map(u => ({ label: "", w: 330, h: 60, go: () => buyUpgrade(u) })), // rows are drawn by drawUpgrades
  { label: "Back", go: () => openMenu("garage", 1) },
];
const DAILY_MENU = [
  { label: "RETRY", big: true, go: () => startGame("daily", null, dailyCity()) },
  { label: "Menu", go: toMenu },
];
const STATS_MENU = [{ label: "Back", go: () => openMenu("menu", 6) }];
const lastCity = () => level && level.idx >= ROUTE.length - 1;
const CLEARED_MENU = [
  { label: () => lastCity() ? "MENU" : "NEXT CITY", big: true, go: () => lastCity() ? toMenu() : startGame("tour", null, level.idx + 1) },
  { label: "Replay City", go: () => startGame("tour", null, level.idx) },
  { label: "Menu", go: toMenu },
];

const OVER_MENU = [
  { label: "RETRY", big: true, go: () => startGame(mode, difficulty, runStage) }, // same mode, level and starting city; R / A / tap
  { label: "Menu", go: toMenu },
];

const BTN_W = 210;

function currentMenu() {
  switch (state) {
    case "menu": return { items: MAIN_MENU, top: 176, h: 27, gap: 5 };
    case "stats": return { items: STATS_MENU, top: 440, h: 28, gap: 0 };
    case "map": return { items: MAP_MENU, top: 446, h: 28, gap: 0 };
    case "brief": return { items: BRIEF_MENU, top: 370, h: 34, gap: 8 };
    case "options": return { items: OPTIONS_MENU, top: 90, h: 29, gap: 5 };
    case "graphics": return { items: GRAPHICS_MENU, top: 84, h: 31, gap: 6 };
    case "credits": return { items: CREDITS_MENU, top: 420, h: 32, gap: 0 };
    case "songs": return { items: SONGS_MENU, top: 150, h: 36, gap: 8 };
    case "controls": return { items: CONTROLS_MENU, top: 440, h: 30, gap: 0 };
    case "difficulty": return { items: DIFF_MENU, top: 200, h: 40, gap: 10 };
    case "garage": return { items: GARAGE_MENU, top: 336, h: 36, gap: 6 };
    case "upgrades": return { items: UPGRADE_MENU, top: 92, h: 36, gap: 8 };
    case "paused": return { items: PAUSE_MENU, top: 252, h: 38, gap: 9 };
    case "camera": return { items: CAMERA_MENU, top: 205, h: 44, gap: 10 };
    case "tutorial": return { items: TUTORIAL_MENU, top: 330, h: 44, gap: 10 };
    case "tyres": return { items: TYRES_MENU, top: 262, h: 48, gap: 6 };
    case "cleared": return { items: level && level.daily ? DAILY_MENU : CLEARED_MENU, top: 306, h: 38, gap: 8 };
    case "over": return { items: OVER_MENU, top: 328, h: 44, gap: 14 };
  }
  return null;
}

const menuOY = () => (H - 480) / 2; // how far menus are pushed down to sit in the middle of a tall screen

const btnH = (menu, i) => menu.items[i].h || menu.h + (menu.items[i].big ? 18 : 0); // a "big" button is taller and wider than the rest; some set their own size

function btnRect(menu, i) {
  let y = menu.top;
  for (let k = 0; k < i; k++) y += btnH(menu, k) + menu.gap;
  const w = menu.items[i].w ? Math.min(menu.items[i].w, W - 20) : menu.items[i].big ? 260 : BTN_W;
  return { x: (W - w) / 2, y, w, h: btnH(menu, i) };
}

function menuIndexAt(px, py) {
  if (domMenuActive()) return -1; // the Garage and Upgrades buttons are HTML: the canvas has none to hit
  if (state === "menu") { const hit = menuCards().slice().reverse().find(c => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h); return hit ? hit.i : -1; } // nearest card first
  const menu = currentMenu();
  if (!menu) return -1;
  return menu.items.findIndex((_, i) => {
    const r = btnRect(menu, i);
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  });
}

function activate(index) {
  const menu = currentMenu();
  if (!menu || performance.now() - overAt < Math.max(600, window.R3D ? R3D.overDelay() : 0)) return; // don't let crash-time taps hit buttons (or skip the crash camera)
  if (state !== "garage") sound.tone(440, 700, 0.08);
  menu.items[index].go();
}

// one place for menu navigation so keyboard and controller behave identically
function menuAction(a) {
  const menu = currentMenu();
  if (!menu) return;
  const n = menu.items.length;
  if (a === "next") { music.next(); return; }
  if (state === "garage" && (a === "left" || a === "right")) {
    garageIdx = (garageIdx + TEAMS.length + (a === "left" ? -1 : 1)) % TEAMS.length;
    sound.tone(520, 520, 0.05);
  } else if (state === "upgrades" && (a === "left" || a === "right")) { // the upgrade cards sit side by side: left / right step along them (and Back)
    sel = clamp(sel + (a === "left" ? -1 : 1), 0, n - 1); sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "map" && a !== "back") { // move around the grid; the road behind shows the selected city
    const c = Math.floor(mapIdx / MAP_ROWS), r = mapIdx % MAP_ROWS;
    if (a === "up") moveMap(c * MAP_ROWS + Math.max(0, r - 1));
    else if (a === "down") moveMap(Math.min(ROUTE.length - 1, c * MAP_ROWS + Math.min(MAP_ROWS - 1, r + 1)));
    else if (a === "left" || a === "right") moveMap(Math.min(ROUTE.length - 1, (a === "left" ? 0 : 1) * MAP_ROWS + r));
    else if (a === "confirm") startCity(mapIdx);
  } else if (state === "graphics" && GRAPHICS_MENU[sel] && GRAPHICS_MENU[sel].cycle && (a === "left" || a === "right")) { // change a graphics setting
    GRAPHICS_MENU[sel].cycle(a === "left" ? -1 : 1); sound.tone(600, 600, 0.04, "square", 0.03);
  } else if (state === "options" && OPTIONS_MENU[sel] && OPTIONS_MENU[sel].slider && (a === "left" || a === "right")) { // nudge a volume
    const k = OPTIONS_MENU[sel].slider; setSlider(k, settings[k] + (a === "left" ? -0.1 : 0.1));
  } else if (state === "tyres" && (a === "left" || a === "right")) { // left / right step through the tyres too
    sel = clamp(sel + (a === "left" ? -1 : 1), 0, TYRES.length - 1); sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "controls" && (a === "left" || a === "right")) { // the Keyboard / Controller / Touch pages
    controlsTab = (controlsTab + (a === "left" ? 2 : 1)) % 3; sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "tutorial" && (a === "left" || a === "right")) { // flick between the tip cards
    if (a === "right") nextTip(); else { tipIdx = Math.max(0, tipIdx - 1); sel = 0; }
  } else if (state === "paused" && sel === 1 && (a === "left" || a === "right")) { // flick through the cameras
    cycleCamera(a === "left" ? -1 : 1);
    sound.tone(520, 520, 0.05);
  } else if (state === "menu" && ["left", "right", "up", "down"].includes(a)) { // the carousel: step along, stop at the ends
    const to = clamp(sel + (a === "left" || a === "up" ? -1 : 1), 0, n - 1);
    if (to !== sel) { sel = to; sound.tone(620, 760, 0.05, "triangle", 0.04); }
  } else if (a === "up") { sel = (sel + n - 1) % n; sound.tone(520, 520, 0.04, "square", 0.03); }
  else if (a === "down") { sel = (sel + 1) % n; sound.tone(520, 520, 0.04, "square", 0.03); }
  else if (a === "confirm") activate(sel);
  else if (a === "back") {
    if (state === "paused" || state === "camera") state = "playing";
    else if (state === "tutorial") endTutorial();
    else if (state === "difficulty") openMenu("menu", 3);
    else if (state === "tyres") TYRES_MENU[TYRES.length].go();
    else if (state === "map") { initDemo(); openMenu("menu", 0); }
    else if (state === "brief") { openMenu("map"); sel = -1; }
    else if (state === "garage") openMenu("menu", 5);
    else if (state === "upgrades") openMenu("garage", 1);
    else if (state === "options") openMenu("menu", 7);
    else if (state === "graphics") openMenu("options", 4);
    else if (state === "songs") openMenu("options", 8);
    else if (state === "credits") openMenu("options", 7);
    else if (state === "controls") openMenu("options", 6);
    else if (state === "stats") openMenu("menu", 6);
    else if (state === "over" || state === "cleared") toMenu();
  }
}


// ---- tyres: every race starts here. Dry slicks, intermediates or full wets; how well each one grips depends on how wet the city is. ----
let tyreChoice = store.get("tyre", "dry"), pendingStart = null, tyreBack = "menu", tyreCity = 0;
const TYRE_KEYS = TYRES.map(t => t.key);
function startGame(m, d, stage = 0) { // asks for tyres first; the tyre menu then starts the race
  pendingStart = [m, d, stage]; tyreBack = ["brief", "difficulty", "menu"].includes(state) ? state : "menu"; // (after a race, Back means the main menu: the finished race is gone)
  if (!racers || racers.some(r => !r.ai)) initDemo(); // coming from a real race (Next city, Retry): the menu needs its demo traffic back, not the finished race
  tyreCity = stage % ROUTE.length;
  if ((m === "tour" || m === "daily") && stage) jumpTo(tyreCity, 0.3); // the road behind the menu shows the city you are about to race
  const rec = bestTyre(cityWetness(ROUTE[tyreCity]));
  openMenu("tyres", TYRE_KEYS.indexOf(store.get("tyreSeen", false) ? tyreChoice : rec)); // the first time the sensible one is pre-selected, after that your last choice
}
const TYRES_MENU = [
  ...TYRES.map(t => ({ label: "", w: 330, h: 48, go: () => { tyreChoice = t.key; store.set("tyre", tyreChoice); store.set("tyreSeen", true); const p = pendingStart; pendingStart = null; startGameNow(p[0], p[1], p[2]); } })),
  { label: "Back", h: 32, go: () => { pendingStart = null; openMenu(tyreBack, tyreBack === "menu" ? 0 : 0); if (tyreBack === "brief") sel = 0; } },
];
