// ---------- drawing: UI ----------

function textAt(str, x, y, size, align = "center", color = "#fff") {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(2, size / 9);
  ctx.lineJoin = "round";
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.strokeText(str, x, y);
  ctx.fillText(str, x, y);
}

function text(str, y, size, align = "center", color = "#fff") {
  textAt(str, align === "left" ? 46 : align === "right" ? W - 12 : W / 2, y, size, align, color);
}

function drawButtons() {
  const menu = currentMenu();
  menu.items.forEach((item, i) => {
    const r = btnRect(menu, i);
    roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = i === sel ? "#1d70f5" : "rgba(0,0,0,0.6)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = i === sel ? "#fff" : "rgba(255,255,255,0.4)";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = item.big ? "bold 26px sans-serif" : "bold 19px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typeof item.label === "function" ? item.label() : item.label, W / 2, r.y + r.h / 2 + 1);
    ctx.textBaseline = "alphabetic";
  });
}

function drawTutorial() {
  const tip = TIPS[tipIdx], pw = Math.min(W - 32, 340), px = (W - pw) / 2;
  roundRect(px, 60, pw, 252, 16); ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.stroke();
  textAt(`TIP ${tipIdx + 1} / ${TIPS.length}`, W / 2, 86, 12, "center", "#ffd23f");
  textAt(tip.title, W / 2, 116, 24);
  ctx.save(); ctx.translate(W / 2, 186); tip.icon(); ctx.restore();
  (hasTouch && tip.touch ? tip.touch : tip.lines).forEach((s, i) => textAt(s, W / 2, 264 + i * 20, 13, "center", "#ddd"));
}

function drawBrief() { // the city card between the map and the race
  const i = mapIdx, st = ROUTE[i], tg = starTargets(i), stars = cityStars[i] || 0, pw = Math.min(W - 24, 360), px = (W - pw) / 2;
  roundRect(px, 40, pw, 322, 14); ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fill();
  ctx.save(); ctx.translate(W / 2 - 30, 54); drawFlag(st.flag, 60, 38); ctx.restore();
  text(st.venue.toUpperCase(), 124, 24); text(`${st.country}  -  ${roundLabel(st)}`, 146, 12, "center", "#ccc");
  for (let k = 0; k < 3; k++) drawStar(W / 2 - 26 + k * 26, 172, 10, k < stars);
  text(i === ROUTE.length - 1 ? `Win the final   2 stars ${tg[0]}   3 stars ${tg[1]}` : `2 stars: score ${tg[0]}     3 stars: score ${tg[1]}`, 204, 12, "center", "#ffd23f");
  textAt("MISSIONS", px + 18, 236, 13, "left", "#7fffd4");
  cityMissions(i).forEach((m, k) => {
    const done = missionState(i)[k], y = 262 + k * 30;
    roundRect(px + 18, y - 13, 16, 16, 4); ctx.fillStyle = done ? "#3dff6e" : "rgba(255,255,255,0.15)"; ctx.fill();
    if (done) { ctx.strokeStyle = "#0b2d14"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 22, y - 5); ctx.lineTo(px + 25, y - 1); ctx.lineTo(px + 31, y - 9); ctx.stroke(); } // tick
    textAt(m.label, px + 44, y, 13, "left", done ? "#9be89b" : "#fff");
    textAt(done ? "done" : `+${missionReward(i)}c`, px + pw - 16, y, 12, "right", done ? "#9be89b" : "#ffd23f");
  });
}

function drawStats() { // lifetime numbers on top, the achievements underneath
  text("STATS & AWARDS", 32, 24);
  const rows = [["Distance", `${stats.km.toFixed(1)} km`], ["Cars passed", stats.cars], ["Near misses", stats.nearMisses], ["Best combo", `x${stats.bestCombo}`],
    ["Top speed", `${stats.topSpeed} km/h`], ["Crashes", stats.crashes], ["Races", stats.races], ["Coins collected", stats.coins], ["Shields used", stats.shields]];
  const cw = Math.min(W - 24, 520), x0 = (W - cw) / 2, half = Math.ceil(rows.length / 2);
  rows.forEach(([k, v], i) => {
    const c = i < half ? 0 : 1, y = 58 + (i % half) * 17, x = x0 + c * (cw / 2 + 6);
    textAt(k, x, y, 11, "left", "#bbb"); textAt(String(v), x + cw / 2 - 12, y, 12, "right", "#fff");
  });
  textAt(`ACHIEVEMENTS  ${achieved.length} / ${ACHIEVEMENTS.length}`, W / 2, 158, 13, "center", "#ffd23f");
  const aw = (cw - 6) / 2;
  ACHIEVEMENTS.forEach((a, i) => {
    const c = i % 2, y = 166 + Math.floor(i / 2) * 30, x = x0 + c * (aw + 6), got = achieved.includes(a.id);
    roundRect(x, y, aw, 27, 6); ctx.fillStyle = got ? "rgba(255,210,63,0.16)" : "rgba(0,0,0,0.5)"; ctx.fill();
    ctx.globalAlpha = got ? 1 : 0.45;
    ctx.fillStyle = got ? "#ffd23f" : "#777"; // a little trophy
    ctx.beginPath(); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 20, y + 7); ctx.lineTo(x + 18, y + 15); ctx.lineTo(x + 10, y + 15); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 13, y + 15, 2, 4); ctx.fillRect(x + 10, y + 19, 8, 2);
    textAt(a.name, x + 26, y + 12, 11, "left", got ? "#fff" : "#ccc"); textAt(a.desc, x + 26, y + 23, 9, "left", "#aaa");
    ctx.globalAlpha = 1;
  });
}

function drawMap() {
  text("WORLD TOUR", 34, 26);
  drawStar(W / 2 - 40, 49, 7, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W / 2 - 28, 54, 13, "left", "#ffd23f");
  ROUTE.forEach((st, i) => {
    const r = mapTile(i), open = unlocked(i), on = i === mapIdx, stars = cityStars[i] || 0;
    roundRect(r.x, r.y, r.w, r.h, 7); ctx.fillStyle = on ? "#1d70f5" : open ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.4)"; ctx.fill();
    ctx.strokeStyle = on ? "#fff" : "rgba(255,255,255,0.25)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    ctx.globalAlpha = open ? 1 : 0.45;
    textAt(String(st.n), r.x + 14, r.y + 20, 11, "center", "#ccc");
    ctx.save(); ctx.translate(r.x + 26, r.y + 9); drawFlag(st.flag, 20, 13); ctx.restore();
    const room = r.w - 52 - (open ? 46 : 32); // shrink long names to fit between the flag and the stars, then shorten them if needed
    let nm = st.venue, fs = 12;
    const fits = () => { ctx.font = `bold ${fs}px sans-serif`; return ctx.measureText(nm).width + 4 <= room; };
    while (!fits() && fs > 10) fs--;
    while (!fits() && nm.length > 4) nm = nm.slice(0, nm.endsWith(".") ? -2 : -1).trimEnd() + ".";
    textAt(nm, r.x + 52, r.y + 20, fs, "left", "#fff");
    ctx.globalAlpha = 1;
    if (open) {
      for (let k = 0; k < 3; k++) drawStar(r.x + r.w - 40 + k * 13, r.y + r.h / 2 + 2, 5.5, k < stars);
      missionState(i).forEach((d, k) => { ctx.fillStyle = d ? "#3dff6e" : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(r.x + r.w - 40 + k * 13, r.y + 5, 2.2, 0, TAU); ctx.fill(); }); // missions done
    }
    else { // a little padlock
      const lx = r.x + r.w - 22, ly = r.y + r.h / 2;
      ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly - 3, 4, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = "#aaa"; ctx.fillRect(lx - 6, ly - 3, 12, 9);
    }
  });
}

function drawGarage() {
  const t = TEAMS[garageIdx], isOwned = owned.includes(garageIdx);
  text("GARAGE", 58, 34);
  text(`Coins ${wallet}`, 84, 16, "center", "#ffd23f");
  ctx.save();
  ctx.translate(W / 2, 190);
  ctx.scale(2.0, 2.0);
  drawCar(t, { slip: false });
  ctx.restore();
  textAt("<", 12, 204, 44, "left");
  textAt(">", W - 12, 204, 44, "right");
  text(`${garageIdx + 1}/${TEAMS.length}`, 104, 13, "center", "#ccc");
  text(t.name.toUpperCase(), 290, 22);
  [t.p, t.s, t.a].forEach((c, i) => { ctx.fillStyle = c; ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2 - 18 + i * 18, 304, 6, 0, TAU); ctx.fill(); ctx.stroke(); });
  if (isOwned) text(garageIdx === equipped ? "EQUIPPED" : "OWNED", 327, 15, "center", "#7CFC9A");
  else text(wallet >= t.cost ? `Price ${t.cost} coins` : `Need ${t.cost - wallet} more coins`, 327, 15, "center", wallet >= t.cost ? "#fff" : "#ff7b7b");
}

const sliderBar = r => ({ x: r.x + 100, y: r.y + r.h / 2 - 5, w: r.w - 160, h: 10 }); // the bar inside a slider row
function drawSliders() {
  const menu = currentMenu();
  OPTIONS_MENU.forEach((it, i) => {
    if (!it.slider) return;
    const r = btnRect(menu, i), b = sliderBar(r), v = settings[it.slider];
    textAt(it.name, r.x + 14, r.y + r.h / 2 + 5, 15, "left");
    roundRect(b.x, b.y, b.w, b.h, 5); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fill();
    roundRect(b.x, b.y, Math.max(b.h, b.w * v), b.h, 5); ctx.fillStyle = "#3dff6e"; ctx.fill();
    textAt(`${Math.round(v * 100)}%`, r.x + r.w - 12, r.y + r.h / 2 + 5, 13, "right");
  });
}
function drawCredits() {
  drawLogo(W / 2, 120, Math.min(0.8, (W - 30) / 330));
  text("Made by Ashish", 196, 22, "center", "#ffd23f");
  text(`Version ${VERSION}`, 222, 13, "center", "#ccc");
  text("Everything you see and hear is drawn and synthesised in code:", 266, 12, "center", "#ddd");
  text("no image or sound files.", 284, 12, "center", "#ddd");
  text("All teams, cars and liveries are fictional.", 314, 12, "center", "#ddd");
  text("Thanks for playing!", 366, 18);
}
const drawVersion = () => textAt(`v${VERSION}`, W - 14, H - 10, 10, "right", "rgba(255,255,255,0.55)"); // bottom-right of the title and main menu

function drawControls() { // every way to play, on one page
  text("CONTROLS", 40, 28);
  const cols = [
    ["KEYBOARD", ["Left / Right or A / D: change lane", "Up / W: gas    Down / S: brake", "C: camera    P / Esc: pause", "F: fullscreen    M: mute    N: next song", "R: retry after a crash"]],
    ["MULTIPLAYER", ["P1: arrow keys    P2: W A S D"]],
    ["CONTROLLER", ["Stick / D-pad: change lane", "RT or A: gas    LT, B or X: brake", "Y / Back: camera", "Start: pause"]],
    ["TOUCH", ["Tap left / right half: change lane", "GAS and BRAKE pads", "Camera top-left, pause bottom-right"]],
  ];
  let y = 70;
  for (const [title, lines] of cols) {
    textAt(title, W / 2, y, 13, "center", "#ffd23f"); y += 18;
    for (const l of lines) { textAt(l, W / 2, y, 11, "center", "#ddd"); y += 15; }
    y += 8;
  }
}

// ---- main menu carousel: cards side by side, each with a live little preview of what it is ----
const CARD_INFO = [ // per MAIN_MENU entry: colour, tagline, badge, preview
  { col: "#ff7a1a", tag: "22 cities, stars and missions", badge: () => `${totalStars()} / ${ROUTE.length * 3} stars`, art: "tour" },
  { col: "#ffd23f", tag: "Same race for everyone today", badge: () => daily.streak ? `${daily.streak}-day streak` : "Play today", art: "daily" },
  { col: "#3dff6e", tag: "How far can you go?", badge: () => `Best ${best}`, art: "endless" },
  { col: "#ff4d4d", tag: "Race the CPU, Easy to Impossible!", badge: () => "4 levels", art: "vs" },
  { col: "#b06bff", tag: "Two players, one keyboard", badge: () => "P1 vs P2", art: "multi" },
  { col: "#5fd4ff", tag: "Cars, liveries and upgrades", badge: () => `${wallet} coins`, art: "garage" },
  { col: "#ffb347", tag: "Your records and awards", badge: () => `${achieved.length} / ${ACHIEVEMENTS.length} awards`, art: "stats" },
  { col: "#aab4c0", tag: "Sound, graphics and controls", badge: () => `v${VERSION}`, art: "settings" },
];
function menuCards() { // where each card is right now (centre card biggest; drawn far-to-near)
  const cw = Math.min(196, W * 0.56), ch = 266, top = 132, step = cw * 0.8 + 10, out = [];
  MAIN_MENU.forEach((_, i) => {
    const d = i - menuCar, ad = Math.abs(d);
    if (ad > 3.2) return;
    const s = 1 - Math.min(ad, 2) * 0.17, intro = clamp((clock - menuIntroT - i * 3) / 22, 0, 1), fly = (1 - intro) * (1 - intro);
    const w = cw * s, h = ch * s, bob = i === sel ? Math.sin(clock / 18) * 3 - 5 : 0;
    out.push({ i, d, s, x: W / 2 + d * step - w / 2, y: top + (ch - h) / 2 + bob + fly * 260, w, h, a: clamp(1 - ad * 0.28, 0.25, 1) * intro });
  });
  return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}
function drawCarousel() {
  for (const c of menuCards()) {
    const info = CARD_INFO[c.i], on = c.i === sel, item = MAIN_MENU[c.i];
    ctx.save(); ctx.globalAlpha = c.a;
    if (on) { ctx.shadowColor = info.col; ctx.shadowBlur = 22 + 8 * Math.sin(clock / 10); }
    roundRect(c.x, c.y, c.w, c.h, 16);
    const bg = ctx.createLinearGradient(0, c.y, 0, c.y + c.h); bg.addColorStop(0, shade(info.col, -0.55)); bg.addColorStop(1, "#0d0e13");
    ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? info.col : "rgba(255,255,255,0.18)"; ctx.stroke();
    // the preview window
    const px = c.x + 10 * c.s, py = c.y + 10 * c.s, pw = c.w - 20 * c.s, ph = c.h * 0.56;
    ctx.save(); roundRect(px, py, pw, ph, 10); ctx.clip();
    ctx.fillStyle = "#07080c"; ctx.fillRect(px, py, pw, ph);
    ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(c.s, c.s);
    drawCardArt(info.art, pw / c.s, ph / c.s, info.col);
    ctx.restore();
    if (on) { // a sheen that sweeps across the selected card
      ctx.save(); roundRect(c.x, c.y, c.w, c.h, 16); ctx.clip();
      const sx = c.x + ((clock * 4) % (c.w * 3)) - c.w, g = ctx.createLinearGradient(sx, 0, sx + 60, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.13)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.restore();
    }
    const ty = py + ph;
    ctx.save(); roundRect(c.x + 2, c.y, c.w - 4, c.h, 16); ctx.clip(); // side cards are narrower: keep their text inside
    const room = c.w - 18 * c.s, fit = (str, size) => { ctx.font = `bold ${size}px sans-serif`; const w = ctx.measureText(str).width; return w > room ? size * room / w : size; }; // shrink text that would run past the card's edges
    const label = typeof item.label === "function" ? item.label() : item.label;
    textAt(label, c.x + c.w / 2, ty + 28 * c.s, fit(label, 19 * c.s), "center", "#fff");
    textAt(info.tag, c.x + c.w / 2, ty + 50 * c.s, fit(info.tag, 11 * c.s), "center", "#c8ced8");
    const bt = info.badge(); ctx.font = `bold ${Math.round(11 * c.s)}px sans-serif`; const bw = ctx.measureText(bt).width + 18 * c.s;
    roundRect(c.x + c.w / 2 - bw / 2, ty + 62 * c.s, bw, 20 * c.s, 10 * c.s); ctx.fillStyle = shade(info.col, -0.35); ctx.fill();
    textAt(bt, c.x + c.w / 2, ty + 76 * c.s, 11 * c.s, "center", "#fff");
    ctx.restore();
    ctx.restore();
  }
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock / 9); // pulsing arrows at the sides
  if (sel > 0) textAt("<", 14 - Math.sin(clock / 9) * 3, 272, 34, "left", "#fff");
  if (sel < MAIN_MENU.length - 1) textAt(">", W - 14 + Math.sin(clock / 9) * 3, 272, 34, "right", "#fff");
  ctx.globalAlpha = 1;
}
function drawGear(x, y, r, teeth, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, rr = i % 2 ? r * 0.78 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a + TAU / teeth / 2) * rr, Math.sin(a + TAU / teeth / 2) * rr); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = "#07080c"; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, TAU); ctx.fill(); ctx.restore();
}
function drawCardArt(art, w, h, col) { // centred on (0, 0) inside a w x h window
  const t = clock;
  if (art === "tour") { // city flags streaming past, a route line and your car
    ctx.fillStyle = "#0f2a44"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, h * 0.42 * Math.abs(Math.cos(t / 90 + k * 0.45)) + 1, 0, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < 7; k++) {
      const span = 46 * 7, raw = k * 46 - t * 0.9, x = ((raw % span) + span) % span - 46 * 3.5, y = Math.sin(k * 1.7 + t / 40) * 18 - 14;
      const lap = Math.floor(-raw / span), n = ROUTE.length; // each time a flag wraps round it becomes the next city along
      ctx.save(); ctx.translate(x - 13, y - 8); drawFlag(ROUTE[(((k + lap * 7) % n) + n) % n].flag, 26, 16); ctx.restore();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t; ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.28); ctx.quadraticCurveTo(0, h * 0.05, w / 2, h * 0.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(0, h * 0.18); ctx.rotate(Math.PI / 2); ctx.scale(0.42, 0.42); drawCar(TEAMS[equipped]); ctx.restore();
  } else if (art === "daily") { // a calendar page with today's date and city
    const d = new Date();
    ctx.fillStyle = "#1d1206"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.rotate(Math.sin(t / 30) * 0.04);
    roundRect(-46, -50, 92, 98, 8); ctx.fillStyle = "#f4f1ea"; ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-46, -50, 92, 24); textAt(d.toLocaleString("en", { month: "short" }).toUpperCase(), 0, -32, 13, "center", "#1d1206");
    textAt(String(d.getDate()), 0, 18, 40, "center", "#1d1206");
    ctx.save(); ctx.translate(-14, 26); drawFlag(ROUTE[dailyCity()].flag, 28, 17); ctx.restore();
    ctx.restore();
    for (let k = 0; k < 6; k++) { const a = t / 25 + k; glow(Math.cos(a) * w * 0.4, Math.sin(a * 1.3) * h * 0.38, 8, "255,210,63", 0.6); }
  } else if (art === "endless") { // a road rushing towards you forever
    const hor = -h * 0.3; ctx.fillStyle = "#0a1a10"; ctx.fillRect(-w / 2, -h / 2, w, h);
    const sky = ctx.createLinearGradient(0, -h / 2, 0, hor); sky.addColorStop(0, "#09131d"); sky.addColorStop(1, "#1f4d33"); ctx.fillStyle = sky; ctx.fillRect(-w / 2, -h / 2, w, hor + h / 2);
    ctx.fillStyle = "#2a2c33"; ctx.beginPath(); ctx.moveTo(-4, hor); ctx.lineTo(4, hor); ctx.lineTo(w * 0.55, h / 2); ctx.lineTo(-w * 0.55, h / 2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 9; k++) { const z = ((k / 9 + t / 70) % 1), y = hor + (h / 2 - hor) * z * z, ww = 1 + z * 5, hh = 2 + z * 14; ctx.fillStyle = col; ctx.fillRect(-ww / 2, y, ww, hh); }
    glow(0, hor, 40, "61,255,110", 0.5);
  } else if (art === "vs") { // you and the CPU, neck and neck
    ctx.fillStyle = "#1e0b0b"; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(-2, ((k * 30 + t * 3) % 180) - h / 2, 4, 14); }
    const lead = Math.sin(t / 35) * 14;
    ctx.save(); ctx.translate(-30, 6 - lead); ctx.scale(0.55, 0.55); drawCar(TEAMS[equipped]); ctx.restore();
    ctx.save(); ctx.translate(30, 6 + lead); ctx.scale(0.55, 0.55); drawCar(rivalTeam()); ctx.restore();
    textAt("VS", 0, -h / 2 + 30, 24, "center", col);
  } else if (art === "multi") { // P1 and P2 with their keys
    ctx.fillStyle = "#150b20"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-1, -h / 2, 2, h);
    for (const [s, team, lab, keys] of [[-1, TEAMS[equipped], "P1", "arrows"], [1, rivalTeam(), "P2", "WASD"]]) {
      ctx.save(); ctx.translate(s * w * 0.24, 4 + Math.sin(t / 20 + s) * 4); ctx.scale(0.5, 0.5); drawCar(team); ctx.restore();
      textAt(lab, s * w * 0.24, -h / 2 + 22, 15, "center", col); textAt(keys, s * w * 0.24, h / 2 - 10, 11, "center", "#ccc");
    }
  } else if (art === "garage") { // your car on a turntable
    ctx.fillStyle = "#06141c"; ctx.fillRect(-w / 2, -h / 2, w, h);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, h * 0.55); g.addColorStop(0, "rgba(95,212,255,0.35)"); g.addColorStop(1, "rgba(95,212,255,0)"); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "rgba(95,212,255,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h * 0.42, 0, TAU); ctx.stroke();
    ctx.save(); ctx.rotate(t / 60); ctx.scale(0.75, 0.75); drawCar(TEAMS[equipped]); ctx.restore();
  } else if (art === "stats") { // a trophy over rising bars
    ctx.fillStyle = "#1c1206"; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let k = 0; k < 5; k++) { const bh = (0.3 + 0.7 * Math.abs(Math.sin(t / 50 + k))) * h * 0.4; ctx.fillStyle = shade(col, -0.2 + k * 0.08); ctx.fillRect(-w * 0.4 + k * w * 0.17, h / 2 - bh, w * 0.12, bh); }
    ctx.save(); ctx.translate(0, -h * 0.08); ctx.scale(1.6, 1.6); ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.lineTo(10, 2); ctx.quadraticCurveTo(0, 8, -10, 2); ctx.closePath(); ctx.fill(); ctx.fillRect(-2.5, 4, 5, 8); ctx.fillRect(-9, 12, 18, 4);
    ctx.restore();
    for (let k = 0; k < 4; k++) { const a = t / 20 + k * 1.6, x = Math.cos(a) * 34, y = -h * 0.12 + Math.sin(a) * 20; glow(x, y, 7 + 3 * Math.sin(t / 7 + k), "255,240,180", 0.8); }
  } else { // settings: gears turning together
    ctx.fillStyle = "#101318"; ctx.fillRect(-w / 2, -h / 2, w, h);
    drawGear(-18, 6, 34, 10, t / 40, "#7d8794"); drawGear(32, -24, 22, 7, -t / 40 * (10 / 7) + 0.2, "#aab4c0"); drawGear(34, 34, 16, 6, -t / 40 * (10 / 6), "#5f6873");
  }
}

function drawConfetti(oy) { // tumbling paper rectangles (oy undoes the menu centring: confetti fills the whole screen)
  for (const c of confetti) {
    ctx.save(); ctx.translate(c.x, c.y + oy); ctx.rotate(c.rot); ctx.scale(1, Math.abs(Math.cos(c.ph * 1.3)) + 0.15);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
  }
}

// ---- title screen: animated logo over the demo race, your tour progress, press any key ----
function drawLogo(cx, cy, k) {
  ctx.save(); ctx.translate(cx, cy + Math.sin(clock / 30) * 3); ctx.scale(k, k); ctx.transform(1, 0, -0.18, 1, 0, 0); // a racing lean
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  const word = (s, y, size, fill) => {
    ctx.font = `900 ${size}px sans-serif`;
    ctx.lineWidth = size / 6; ctx.strokeStyle = "#120a04"; ctx.strokeText(s, 0, y);
    ctx.fillStyle = fill; ctx.fillText(s, 0, y);
    const w = ctx.measureText(s).width, p = ((clock % 150) / 150) * (w + 200) - w / 2 - 100; // a shine sweeping across the letters
    const sh = ctx.createLinearGradient(p - 40, 0, p + 40, 0); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,0.75)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.fillText(s, 0, y);
  };
  const g = ctx.createLinearGradient(0, -60, 0, 0); g.addColorStop(0, "#ffe25a"); g.addColorStop(1, "#ff6a1a");
  word("EXTREME", -6, 58, g);
  word("RACER", 44, 46, "#ffffff");
  ctx.restore();
}
function drawTitle(moy) {
  ctx.fillStyle = "rgba(10,10,16,0.45)"; ctx.fillRect(0, -moy, W, H);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; // speed streaks rushing past behind the logo
  for (let i = 0; i < (settings.lowfx ? 8 : 22); i++) {
    const y = 120 + ((i * 37) % 120), len = 60 + (i % 5) * 30, x = W - ((clock * (6 + (i % 4) * 2) + i * 97) % (W + len * 2));
    ctx.strokeStyle = `rgba(255,${150 + (i % 3) * 40},60,${0.18 + (i % 4) * 0.06})`; ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
  ctx.restore();
  drawLogo(W / 2, 190, Math.min(1, (W - 30) / 330));
  text("WORLD TOUR", 262, 16, "center", "#ff5a5a");
  const next = Math.min(tourCleared, ROUTE.length - 1), st = ROUTE[next];
  const prog = tourCleared >= ROUTE.length ? "Tour complete!" : `Next stop: ${st.venue}  -  city ${st.n} of ${ROUTE.length}`;
  text(prog, 296, 14, "center", "#ddd");
  if (totalStars()) { drawStar(W / 2 - 34, 318, 7, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W / 2 - 22, 323, 13, "left", "#ffd23f"); }
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock / 12);
  text(hasTouch ? "TAP TO START" : "PRESS ANY KEY", 392, 20, "center", "#fff");
  ctx.globalAlpha = 1;
}

function drawUpgrades() {
  text("UPGRADES", 46, 30);
  text(`Coins ${wallet}`, 74, 16, "center", "#ffd23f");
}
function drawUpgradeRows() { // on top of the row buttons: name, what it does now (and next), level pips, next price
  const menu = currentMenu();
  UPGRADES.forEach((u, i) => {
    const r = btnRect(menu, i), l = upLvl(u.key), max = l >= 5, cost = UPG_COST[l];
    textAt(u.name, r.x + 14, r.y + 22, 16, "left");
    textAt(max ? u.now(l) : `${u.now(l)}  >  ${u.next(l + 1)}`, r.x + 14, r.y + 44, 11, "left", "#cfd8e3");
    for (let k = 0; k < 5; k++) { roundRect(r.x + r.w - 150 + k * 16, r.y + 12, 12, 12, 3); ctx.fillStyle = k < l ? "#3dff6e" : "rgba(255,255,255,0.18)"; ctx.fill(); }
    textAt(max ? "MAX" : `${cost}c`, r.x + r.w - 14, r.y + 24, 15, "right", max ? "#3dff6e" : wallet >= cost ? "#ffd23f" : "#ff7b7b");
  });
}

function drawGauge(r) {
  const cx = 58, cy = H - 8, R = 40, f = clamp(effV(r) / NITRO_MAX, 0, 1);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.arc(cx, cy, R + 6, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(cx, cy, R - 4, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = r.nitro > 0 ? "#5fd4ff" : f < 0.45 ? "#4cd964" : f < 0.76 ? "#ffcc00" : "#ff3b30";
  ctx.beginPath(); ctx.arc(cx, cy, R - 4, Math.PI, Math.PI + f * Math.PI); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 11; i++) { const a = Math.PI + i / 11 * Math.PI; ctx.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); }
  ctx.stroke();
  const a = Math.PI + f * Math.PI + (f > 0.98 ? Math.sin(clock * 1.9) * 0.035 + rnd(-0.015, 0.015) : 0); // pinned: the needle quivers
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); ctx.stroke();
  textAt(String(Math.round(r.v * 60)), cx, cy - 12, 15);
  textAt("km/h", cx, cy - 1, 9, "center", "#ccc");
  textAt(`G${gearOf(r.v)}`, cx + R + 10, cy - 6, 14, "left");
  if (r.v >= 4.6) textAt("SLIPSTREAM", cx + R + 10, cy - 22, 11, "left", "#39ff14");
}

const roundLabel = st => level && level.daily && state !== "map" && state !== "brief" ? `DAILY CHALLENGE` : st.n === ROUTE.length ? `GRAND FINAL` : st.venue.toUpperCase() === st.country ? `ROUND ${st.n}` : `ROUND ${st.n}  -  ${st.venue.toUpperCase()}`; // no 'ABU DHABI - ABU DHABI'
function drawStageBar() { // which city you're in, and how far through it
  const st = ROUTE[stageIdx], x0 = 130, w = 140, y = H - 14;
  ctx.font = "bold 12px sans-serif";
  const tw = ctx.measureText(st.country).width, fw = 18, fx = W / 2 - (tw + fw + 6) / 2;
  ctx.save(); ctx.translate(fx, y - 30); drawFlag(st.flag, fw, 12); ctx.restore();
  textAt(st.country, fx + fw + 6, y - 19, 12, "left", "#fff");
  ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(x0, y - 4, w, 5, 2.5); ctx.fill();
  ctx.fillStyle = "#fff"; roundRect(x0, y - 4, Math.max(5, w * stageFrac), 5, 2.5); ctx.fill();
  textAt(`${st.n}/${ROUTE.length}   ${runKm()} km`, W / 2, y + 12, 11, "center", "#ddd");
}

function drawBanner() { // a small card that slides in from the left edge and leaves again, clear of the road
  const t = banner.t, st = ROUTE[banner.idx];
  const inK = smooth(Math.min(t, 24) / 24), outK = t > 170 ? smooth((t - 170) / 30) : 0;
  ctx.save();
  ctx.globalAlpha = clamp(1 - outK, 0, 1);
  ctx.translate(6 - (1 - inK) * 150 - outK * 150, 104);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(0, 0, 150, 44, 9); ctx.fill();
  ctx.save(); ctx.translate(8, 11); drawFlag(st.flag, 32, 22); ctx.restore();
  ctx.font = "bold 12px sans-serif";
  textAt(st.country, 48, 19, st.country.length > 12 ? 11 : 12, "left", "#fff");
  textAt(roundLabel(st), 48, 34, 9, "left", "#ffd23f");
  ctx.restore();
}

function drawCameraIcon() {
  ctx.save();
  ctx.translate(24, 24);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; roundRect(-8, -4.5, 16, 11, 2.5); ctx.fill(); ctx.fillRect(-3.5, -7.5, 7, 4);
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(0, 1, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-1, 0, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

// First touch race only: light up the two halves of the screen so it's obvious where to tap to change lanes
function drawSteerHint() {
  const top = 160, bot = pedalRects().gas.y - 14, mid = (top + bot) / 2, pulse = 0.5 + 0.5 * Math.sin(clock / 9);
  for (const side of [-1, 1]) {
    const x = side < 0 ? 0 : W / 2, cx = side < 0 ? W * 0.25 : W * 0.75;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.06 * pulse})`; ctx.fillRect(x + 6, top, W / 2 - 12, bot - top);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(x + 6, top, W / 2 - 12, bot - top); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; poly([[cx - side * 16, mid - 22], [cx - side * 16, mid + 22], [cx + side * 20, mid]]); // arrow pointing outwards
    textAt("TAP", cx, mid + 48, 18);
    textAt(side < 0 ? "to move left" : "to move right", cx, mid + 66, 12, "center", "#ddd");
  }
}

// a five-pointed star; gold when earned, an empty outline when not
function drawStar(cx, cy, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { ctx.fillStyle = "#ffd23f"; ctx.fill(); ctx.strokeStyle = "#b8860b"; } else { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; }
  ctx.lineWidth = 2; ctx.stroke();
}

// the Daily Challenge's card on the grid: today's city, best and streak
function drawDailyCard() {
  const st = ROUTE[level.idx], y = 168;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; roundRect(W / 2 - 120, y, 240, 100, 12); ctx.fill();
  textAt("DAILY CHALLENGE", W / 2, y + 22, 14, "center", "#ffd23f");
  textAt(`${st.venue}, ${st.country}`, W / 2, y + 45, 13);
  textAt(`Today's best: ${dailyBest()}`, W / 2, y + 68, 13, "center", "#9be89b");
  textAt(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"} in a row`, W / 2, y + 89, 12, "center", "#ffb347");
}

// before the lights go green in a tour city: what each star needs
function drawTargets() {
  const tg = starTargets(level.idx), y = 168, rows = [[1, level.final ? "Beat the CPU to the line" : "Finish the city"], [2, `Score ${tg[0]}`], [3, `Score ${tg[1]}`]];
  ctx.fillStyle = "rgba(0,0,0,0.6)"; roundRect(W / 2 - 110, y, 220, 104, 12); ctx.fill();
  textAt("CITY TARGETS", W / 2, y + 20, 13, "center", "#ffd23f");
  rows.forEach(([n, label], i) => {
    for (let k = 0; k < 3; k++) drawStar(W / 2 - 84 + k * 15, y + 40 + i * 24, 6, k < n);
    textAt(label, W / 2 - 30, y + 45 + i * 24, 13, "left", (cityStars[level.idx] || 0) >= n ? "#9be89b" : "#fff");
  });
}

function drawHud() {
  const p0 = racers[0];
  if (mode === "single" || mode === "tour" || mode === "daily") {
    text(p0.score, 56, 36);
    text(`Coins ${p0.coins}`, 30, 15, "left", "#ffd23f");
    if (level && level.daily) { if (!grid.done) drawDailyCard(); else text(`Today's best ${dailyBest()}`, 78, 12, "center", "#9be89b"); }
    else if (level) { // the next star to chase, right under the score
      const tg = starTargets(level.idx), next = p0.score < tg[0] ? [2, tg[0]] : p0.score < tg[1] ? [3, tg[1]] : null;
      if (next) { for (let k = 0; k < next[0]; k++) drawStar(W / 2 - 38 + k * 12, 75, 5, true); textAt(`${next[1]}`, W / 2 - 38 + next[0] * 12, 80, 12, "left", "#ffd23f"); }
      else { for (let k = 0; k < 3; k++) drawStar(W / 2 - 18 + k * 12, 75, 5, true); }
      if (!grid.done) drawTargets();
      if (level.final) { // where the CPU really is: 1st / 2nd and the gap in seconds
        const c = racers[1], cy = c.trueY === undefined ? c.y : c.trueY, first = !c.alive || racers[0].y <= cy, gap = Math.abs(cy - racers[0].y) / Math.max(1, racers[0].v * 60);
        text(first ? "1st" : "2nd", 34, 20, "right", first ? "#3dff6e" : "#ff5a5a");
        if (grid.done && racers[0].v > 1) text(`${first ? "+" : "-"}${gap.toFixed(1)}s`, 56, 13, "right", "#ddd");
      }
    }
  } else {
    racers.forEach((r, i) => {
      text(`${r.label} ${r.score}`, 34, 20, i === 0 ? "left" : "right");
      text(`${Math.round(r.v * 60)} km/h`, 72, 12, i === 0 ? "left" : "right", "#ddd");
    });
  }
  if (p0.shield && p0.alive) drawShieldIcon(24, 64, 11, clock); // shield ready (under the camera button)
  if (p0.comboT > 0 && p0.combo >= 2) { // the live combo and how long it has left
    const y = level ? 104 : 86, k = p0.comboT / COMBO_T, pulse = 1 + 0.15 * Math.max(0, 1 - (COMBO_T - p0.comboT) / 10);
    textAt(`COMBO x${p0.combo}`, W / 2, y, 16 * pulse, "center", p0.combo >= 5 ? "#ff7a1a" : "#ffd23f");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, y + 5, 80, 4, 2); ctx.fill();
    ctx.fillStyle = p0.combo >= 5 ? "#ff7a1a" : "#ffd23f"; roundRect(W / 2 - 40, y + 5, Math.max(4, 80 * k), 4, 2); ctx.fill();
  }
  for (const p of pops) { // "CLOSE!" rising beside the car
    const s = racerScreen(p.r), side = s.x < W / 2 ? 1 : -1;
    ctx.globalAlpha = clamp((50 - p.t) / 15, 0, 1);
    textAt(p.text, s.x + side * 58, s.y - p.t * 0.8, 15 + Math.min(p.t, 6), "center", "#7fffd4");
    ctx.globalAlpha = 1;
  }
  if (p0.alive && p0.nitro > 0) { // nitro burn bar
    const w = 130, x = W / 2 - w / 2, y = 10, g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff");
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(x - 2, y - 2, w + 4, 12, 6); ctx.fill();
    ctx.fillStyle = g; roundRect(x, y, Math.max(6, w * p0.nitro / (p0.nitroMax || NITRO_FRAMES)), 8, 4); ctx.fill();
  }
  if (p0.alive && cam !== 2) drawGauge(p0);
  if (cam === 2) text(`${ROUTE[stageIdx].country}  ${runKm()} km`, 48, 11, "left", "#fff"); // the wheel covers the bottom bar
  else drawStageBar();
  if (state === "playing" && (!grid.done || frame < grid.goFrame + 120)) { // what to do, tucked low so it never covers the road
    const f = grid.done ? clamp((grid.goFrame + 120 - frame) / 30, 0, 1) : 1;
    ctx.globalAlpha = f;
    if (hasTouch && mode !== "multi") { // short enough to sit between the two pedals on a phone
      if (grid.done) text("Tap a side to steer", H - 78, 13);
      else text("Hold GAS - go on green!", H - 86, 13);
    } else if (grid.done) text(mode === "multi" ? "P1: Arrows    P2: W A S D" : "Left/Right steer   Up/Down speed", H - 78, 13);
    else {
      text(mode === "multi" ? "Hold Up / W - go on green!" : "Hold Up (or RT) - go on green!", H - 86, 13);
    }
    ctx.globalAlpha = 1;
  }
  if (banner && state === "playing") drawBanner();
  drawCameraIcon();
  if (hasTouch) { // touch pedals, only shown once the screen has actually been touched
    if (steerHint && state === "playing") drawSteerHint();
    const pr = pedalRects();
    for (const [r, on, label, col] of [[pr.brake, touch.brake, "BRAKE", "#ff4d4d"], [pr.gas, touch.gas, "GAS", "#39d353"]]) {
      ctx.globalAlpha = on ? 0.9 : 0.55;
      ctx.fillStyle = on ? col : "rgba(0,0,0,0.6)"; roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; roundRect(r.x, r.y, r.w, r.h, 14); ctx.stroke();
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 8, up = label === "GAS"; // an arrow pointing the way the speed goes
      ctx.fillStyle = on ? "#fff" : col; poly([[cx, cy + (up ? -14 : 14)], [cx + 14, cy + (up ? 8 : -8)], [cx - 14, cy + (up ? 8 : -8)]]);
      textAt(label, cx, r.y + r.h - 12, 13);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.arc(W - 24, H - 24, 14, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(W - 29, H - 31, 4, 14); ctx.fillRect(W - 21, H - 31, 4, 14);
}

function draw() {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!window.R3D) { drawWorld(); drawAtmosphere(); postFX(); } // with the 3D renderer on, the world is drawn behind this canvas

  if (state === "playing" || state === "paused" || state === "camera") drawHud();
  if (flashT > 0.02) { ctx.fillStyle = `rgba(255,255,255,${flashT})`; ctx.fillRect(0, 0, W, H); }

  const moy = menuOY(); // menus and overlays are laid out for a 480-high screen: centre them on taller ones
  ctx.save(); ctx.translate(0, moy);

  if (state === "title" || state === "menu") { ctx.save(); ctx.translate(0, -moy); drawVersion(); ctx.restore(); }
  if (state === "title") drawTitle(moy);
  if (state === "menu" || state === "tutorial" || state === "difficulty" || state === "garage" || state === "upgrades" || state === "options" || state === "songs" || state === "controls" || state === "credits" || state === "map" || state === "brief" || state === "stats") {
    ctx.fillStyle = "rgba(15,15,20,0.66)"; // fade the highway behind the title
    ctx.fillRect(0, -moy, W, H);
    if (state === "map") drawMap();
    else if (state === "stats") drawStats();
    else if (state === "brief") drawBrief();
    else if (state === "tutorial") drawTutorial();
    else if (state === "garage") drawGarage();
    else if (state === "upgrades") drawUpgrades();
    else if (state === "options") {
      text("SETTINGS", 46, 30);
      text(`Now playing: ${music.playing ? music.name : "-"}`, 74, 12, "center", "#ccc");
    } else if (state === "credits") { drawCredits();
    } else if (state === "songs" || state === "controls") { // drawn after the buttons, below
    } else {
      if (state === "difficulty") { drawLogo(W / 2, 84, Math.min(0.58, (W - 30) / 330)); text("VS Computer: pick a level", 175, 18); }
      else {
        drawLogo(W / 2, 58, Math.min(0.45, (W - 30) / 330)); // smaller up top: the cards get the room
        const line = `Coins ${wallet}     `, tail = `${totalStars()} / ${ROUTE.length * 3}`;
        ctx.font = "bold 13px sans-serif";
        const w1 = ctx.measureText(line).width, w2 = ctx.measureText(tail).width, x0 = W / 2 - (w1 + 16 + w2) / 2;
        textAt(line, x0, 112, 13, "left", "#ffd23f"); drawStar(x0 + w1 + 6, 107, 6, true); textAt(tail, x0 + w1 + 16, 112, 13, "left", "#ffd23f");
      }
    }
    if (state === "menu") drawCarousel(); else drawButtons();
    if (state === "upgrades") drawUpgradeRows();
    if (state === "options") drawSliders();
    if (state === "songs") { text("SONGS", 96, 30); text(`Now playing: ${music.playing ? music.name : "-"}`, 128, 12, "center", "#ccc"); }
    if (state === "controls") drawControls();
    ctx.fillStyle = "#ccc";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    const musicNote = music.on && sound.on ? (music.playing ? `Now playing: ${music.name}   (N = next)` : "Press any key to start the music") : "";
    if (state === "menu" && musicNote) ctx.fillText(musicNote, W / 2, 448);
    ctx.fillText(state === "menu" ? (hasTouch ? "Swipe or tap a card" : "Left / Right to choose, Enter to go") : state === "brief" || state === "stats" || state === "controls" || state === "credits" ? "" /* buttons sit there */ : state === "upgrades" ? (hasTouch ? "Tap an upgrade to buy its next level" : "Up / Down to choose, Enter to upgrade") : state === "tutorial" ? (hasTouch ? "Tap Next, or Skip to go straight in" : "Enter = next   Esc = skip") : state === "garage" ? "Left / Right to browse, Enter to pick" : state === "map" ? "" /* the map has its own Back button there */ : `Up / Down + Enter, or tap an option${hasPad ? "  |  Controller ready" : ""}`, W / 2, 470);
  }

  if (state === "paused") {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, -moy, W, H);
    text("PAUSED", 200, 40);
    text(sel === 1 ? "Left / Right or tap to change the camera" : CAMS[cam].desc, 235, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "camera") {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, -moy, W, H);
    text("CAMERA", 140, 36);
    text(CAMS[sel] ? CAMS[sel].desc : "Back to the race", 175, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "cleared") { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, -moy, W, H); drawConfetti(-moy); }
  if (state === "cleared" && level.daily) { // the Daily: score, today's best, streak
    const r = racers[0], s = Math.floor(levelTime);
    text("DAILY COMPLETE", 118, Math.min(34, (W - 24) / 9.4), "center", "#ffd23f");
    text(`${ROUTE[level.idx].venue}  -  ${dayKey()}`, 150, 14, "center", "#ddd");
    text(`Score ${r.score}`, 192, 24);
    text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}   speed bonus +${level.bonus}`, 222, 13, "center", "#9be89b");
    text(level.newBest ? "NEW BEST TODAY!" : `Today's best ${dailyBest()}`, 252, 16, "center", "#ffd23f");
    text(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}`, 278, 13, "center", "#ffb347");
    drawButtons();
  } else if (state === "cleared") {
    const st = ROUTE[level.idx], r = racers[0], s = Math.floor(levelTime);
    text(lastCity() ? "TOUR CHAMPION!" : "CITY COMPLETE", 118, Math.min(34, (W - 24) / 9.4), "center", "#ffd23f");
    text(`${st.venue}, ${st.country}  -  ${st.n} / ${ROUTE.length}`, 150, 14, "center", "#ddd");
    text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, 186, 20);
    text(`Score ${r.score}   Cars ${r.passed}   Coins +${r.coins}`, 214, 15);
    text(`${level.bonus ? `incl. speed bonus +${level.bonus}   ` : ""}Finish reward +${level.reward} coins   Missions ${missionState(level.idx).filter(Boolean).length}/3`, 232, 11, "center", "#9be89b");
    for (let i = 0; i < 3; i++) { // the stars fill in one at a time, the newest one popping bigger
      const on = starAnim && i < starAnim.shown, pop = on && i === starAnim.shown - 1 ? 1 + 0.5 * Math.max(0, 1 - starAnim.t / 12) : 1;
      drawStar(W / 2 + (i - 1) * 64, 270, 22 * pop, on);
    }
    if (starAnim && starAnim.shown >= starAnim.got && starAnim.got > starAnim.prev && starAnim.prev > 0) text("New best!", 296, 12, "center", "#ffd23f");
    for (const p of uiFx) { ctx.globalAlpha = clamp(p.life / 30, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    drawButtons();
  }

  if (state === "over") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, -moy, W, H);
    const reached = `Reached ${ROUTE[stageIdx].country}  -  ${runKm()} km`, rc = "#ffd23f";
    text(result, 130, 38);
    if (mode === "daily") {
      const r = racers[0];
      text(`Score ${r.score}`, 170, 20);
      text(level.newBest ? "NEW BEST TODAY!" : `Today's best ${dailyBest()}`, 200, 16, "center", "#ffd23f");
      text(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}   -   ${Math.round(stageFrac * 100)}% of ${ROUTE[level.idx].venue}`, 228, 13, "center", "#ffb347");
    } else if (mode === "tour") {
      const r = racers[0];
      text(`Score ${r.score}   Cars ${r.passed}`, 170, 20);
      text(`Reached ${Math.round(stageFrac * 100)}% of ${ROUTE[level.idx].venue}`, 228, 16);
    } else if (mode === "single") {
      const r = racers[0];
      text(`Score ${r.score}   Best ${best}`, 170, 20);
      if (newBest) text("NEW BEST!", 198, 18, "center", "#ffd23f");
      text(`Cars ${r.passed}   Coins +${r.coins}`, 228, 16);
      text(reached, 258, 14, "center", rc);
    } else {
      text(racers.map(r => `${r.label} ${r.score}`).join("    "), 180, 22);
      text(racers.map(r => `${r.label}: ${r.passed} cars, ${r.coins} coins`).join("   "), 210, 13);
      text(reached, 240, 14, "center", rc);
    }
    drawButtons();
    if (!hasTouch) text(hasPad ? "R or A to retry" : "R to retry", 470, 12, "center", "#bbb");
  }

  if (toast) { // brief notices: controller connected, songs added...
    const a = clamp(Math.min(toast.t / 10, (150 - toast.t) / 20), 0, 1);
    ctx.globalAlpha = a;
    ctx.font = "bold 13px sans-serif";
    const w = ctx.measureText(toast.text).width + 24;
    ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(W / 2 - w / 2, 396, w, 26, 13); ctx.fill();
    textAt(toast.text, W / 2, 414, 13);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
