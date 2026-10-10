// ---------- drawing: UI ----------

// ---------- the look: the same style as the Garage (css/garage.css) - its font, dark glass panels with an orange accent line, italic 900 headings ----------
const UI_FONT = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
const UI_ACC = "#ffb21a", UI_ACC_RGB = "255,178,26";
let uiSeen = "", uiT0 = 0; // menu transitions: the screen shown last frame, and when the current one opened
const uiIn = (delay = 0) => smooth(clamp((performance.now() - uiT0 - delay) / 280, 0, 1)); // 0 -> 1 as a screen opens (delay in ms staggers its parts)
function glass(x, y, w, h, r = 14, acc = UI_ACC) { // a dark glass panel: gradient, hairline border, a glowing accent line along the top
  ctx.save();
  roundRect(x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(26,30,46,0.78)"); g.addColorStop(1, "rgba(8,10,17,0.86)");
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
  if (acc) {
    ctx.clip(); const ag = ctx.createLinearGradient(x, 0, x + w, 0); ag.addColorStop(0, "rgba(0,0,0,0)"); ag.addColorStop(0.5, acc); ag.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ag; ctx.fillRect(x, y, w, 2);
    const hg = ctx.createLinearGradient(0, y, 0, y + 26); hg.addColorStop(0, "rgba(255,255,255,0.07)"); hg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = hg; ctx.fillRect(x, y, w, 26);
  }
  ctx.restore();
}
function heading(str, y, size = 28, x = W / 2) { // italic 900 capitals with the slanted accent bar in front, like the Garage title
  ctx.save(); ctx.font = `italic 900 ${size}px ${UI_FONT}`; ctx.textAlign = "left"; try { ctx.letterSpacing = `${(size * 0.05).toFixed(1)}px`; } catch (e) {}
  let s = size; while (ctx.measureText(str).width > W - 60 && s > 12) { s--; ctx.font = `italic 900 ${s}px ${UI_FONT}`; }
  const w = ctx.measureText(str).width, bar = s * 0.32, left = x - (w + bar * 1.6) / 2, bh = s * 0.74;
  ctx.fillStyle = UI_ACC; ctx.shadowColor = `rgba(${UI_ACC_RGB},0.9)`; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(left + bar * 0.55, y - bh); ctx.lineTo(left + bar, y - bh); ctx.lineTo(left + bar * 0.45, y); ctx.lineTo(left, y); ctx.closePath(); ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; ctx.fillStyle = "#f3f6fb"; ctx.fillText(str, left + bar * 1.6, y);
  ctx.restore();
}
function menuBackdrop(moy) { // darker at the top and bottom where the text is, lighter in the middle (like the title)
  const g = ctx.createLinearGradient(0, -moy, 0, H - moy); g.addColorStop(0, "rgba(6,8,16,0.86)"); g.addColorStop(0.45, "rgba(6,8,16,0.58)"); g.addColorStop(1, "rgba(6,8,16,0.88)");
  ctx.fillStyle = g; ctx.fillRect(0, -moy, W, H);
}
function pill(x, y, w, h, fill = "rgba(10,12,20,0.6)") { roundRect(x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke(); }

// ---------- popups: one stack, top centre under the score; never two of the same ----------
function drawToasts() {
  const racing = state === "playing" || state === "paused" || state === "camera";
  let top = 10;
  if (racing && mode !== "vs" && mode !== "multi") { const p0 = racers[0]; top = level ? 92 : 74; if (p0.comboT > 0 && p0.combo >= 2) top += 28; if (p0.alive && p0.bypass) top += 34; }
  else if (racing) top = 98;
  let y = top;
  for (let i = 0; i < Math.min(3, toasts.length); i++) {
    const t = toasts[i], a = clamp(Math.min(t.t / 8, (t.life - t.t) / 18), 0, 1);
    t.y = t.y === undefined ? y : t.y + (y - t.y) * 0.25; // slide up smoothly when the one above leaves
    let fs = 13; ctx.font = `700 ${fs}px ${UI_FONT}`; while (ctx.measureText(t.text).width > W - 56 && fs > 9) { fs--; ctx.font = `700 ${fs}px ${UI_FONT}`; }
    const w = ctx.measureText(t.text).width + 30, x = W / 2 - w / 2;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * -6);
    glass(x, t.y, w, 24, 12, t.col || UI_ACC);
    ctx.fillStyle = t.col || UI_ACC; ctx.beginPath(); ctx.arc(x + 12, t.y + 12, 3, 0, TAU); ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = "#f3f6fb"; ctx.fillText(t.text, W / 2 + 5, t.y + 16.5);
    ctx.restore();
    y += 28;
  }
}


function textAt(str, x, y, size, align = "center", color = "#fff") {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.62)";
  ctx.lineWidth = Math.max(1.6, size / 7);
  ctx.lineJoin = "round";
  ctx.font = `800 ${size}px ${UI_FONT}`;
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
    const r0 = btnRect(menu, i), e = uiIn(60 + i * 45), r = { x: r0.x, y: r0.y + (1 - e) * 16, w: r0.w, h: r0.h };
    const on = i === sel, lab = typeof item.label === "function" ? item.label() : item.label, rich = !lab, rad = Math.min(14, r.h * 0.36);
    ctx.save(); ctx.globalAlpha *= e;
    let ink = "#f3f6fb";
    if (item.big) { // the main action (RACE, RETRY, NEXT CITY): accent gradient with dark text, like the Garage's Buy button
      if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.85)`; ctx.shadowBlur = 22; }
      roundRect(r.x, r.y, r.w, r.h, rad); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "#ffd98a"); g.addColorStop(0.5, UI_ACC); g.addColorStop(1, "#ff8a1a"); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
      if (on) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
      ink = "#1a1006";
    } else if (on && !rich) { // the chosen button: bright white, accent glow ring
      ctx.shadowColor = `rgba(${UI_ACC_RGB},0.7)`; ctx.shadowBlur = 16;
      roundRect(r.x, r.y, r.w, r.h, rad); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "rgba(255,255,255,0.84)"); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${UI_ACC_RGB},0.95)`; ctx.lineWidth = 2; roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, rad + 2); ctx.stroke();
      ink = "#0b0d12";
    } else { // the rest: dark glass (rows drawn over by their own screen keep this look when chosen, with the accent ring)
      roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = on ? "rgba(40,46,66,0.9)" : "rgba(12,14,22,0.72)"; ctx.fill();
      ctx.strokeStyle = on ? `rgba(${UI_ACC_RGB},0.95)` : "rgba(255,255,255,0.2)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.55)`; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0; }
    }
    if (lab) {
      ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = item.big ? `italic 900 ${Math.min(24, r.h * 0.5)}px ${UI_FONT}` : `700 ${Math.min(17, r.h * 0.48)}px ${UI_FONT}`;
      ctx.fillText(lab, W / 2, r.y + r.h / 2 + 1);
      ctx.textBaseline = "alphabetic";
      if (!onTouch()) { // the button's own shortcut (Esc / B for Back, R / X for Retry), or Enter / A on the chosen one
        const short = /^(Back|Resume|Menu)$/i.test(lab) ? "back" : /^(Retry|Restart)$/i.test(lab) ? "retry" : on ? "confirm" : null;
        if (short) { const s = Math.min(18, r.h - 14), g = glyphsFor(short)[0]; ctx.globalAlpha *= on ? 1 : 0.7; drawGlyph(g, r.x + r.w - glyphWidth(g, s) - 9, r.y + r.h / 2, s); }
      }
    }
    ctx.restore();
  });
}

function drawTutorial() {
  const tip = TIPS[tipIdx], pw = Math.min(W - 32, 360), px = (W - pw) / 2;
  glass(px, 60, pw, 252, 16);
  textAt(`TIP ${tipIdx + 1} / ${TIPS.length}`, W / 2, 84, 11, "center", UI_ACC);
  heading(tip.title, 118, 22);
  ctx.save(); ctx.translate(W / 2, 186); tip.icon(); ctx.restore();
  const ls = onTouch() && tip.touch ? tip.touch : onPad() && tip.pad ? tip.pad : tip.lines;
  ls.forEach((s, i) => textAt(s, W / 2, 264 + i * 20, 13, "center", "#dfe5ef"));
  if (tip.prompt) drawPrompt(tip.prompt, W / 2, 262 + ls.length * 20 + 4, 16);
}

function drawBrief() { // the city card between the map and the race
  const i = mapIdx, st = ROUTE[i], tg = starTargets(i), stars = cityStars[i] || 0, pw = Math.min(W - 24, 380), px = (W - pw) / 2;
  glass(px, 40, pw, 322, 16);
  ctx.save(); ctx.translate(W / 2 - 30, 56); drawFlag(st.flag, 60, 38); ctx.restore();
  heading(st.venue.toUpperCase(), 128, 26); text(`${st.country}  -  ${roundLabel(st)}`, 148, 11, "center", "rgba(255,255,255,0.65)");
  for (let k = 0; k < 3; k++) drawStar(W / 2 - 26 + k * 26, 172, 10, k < stars);
  pill(W / 2 - Math.min(pw - 40, 300) / 2, 188, Math.min(pw - 40, 300), 24, "rgba(255,178,26,0.12)");
  text(i === ROUTE.length - 1 ? `Win the final   2 stars ${tg[0]}   3 stars ${tg[1]}` : `TARGETS   2 stars: ${tg[0]}     3 stars: ${tg[1]}`, 205, 12, "center", "#ffd23f");
  textAt("MISSIONS", px + 18, 238, 11, "left", "rgba(255,255,255,0.55)");
  cityMissions(i).forEach((m, k) => {
    const done = missionState(i)[k], y = 262 + k * 30;
    roundRect(px + 18, y - 13, 16, 16, 5); ctx.fillStyle = done ? "#7cfc9a" : "rgba(255,255,255,0.12)"; ctx.fill();
    if (done) { ctx.strokeStyle = "#0b2d14"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 22, y - 5); ctx.lineTo(px + 25, y - 1); ctx.lineTo(px + 31, y - 9); ctx.stroke(); } // tick
    textAt(m.label, px + 44, y, 13, "left", done ? "#9be89b" : "#f3f6fb");
    textAt(done ? "done" : `+${missionReward(i)}c`, px + pw - 16, y, 12, "right", done ? "#9be89b" : "#ffd23f");
  });
}

function drawStats() { // lifetime numbers on top, the achievements underneath
  heading("STATS & AWARDS", 32, 24);
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
  heading("WORLD TOUR", 38, 26);
  drawStar(W / 2 - 40, 53, 7, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W / 2 - 28, 58, 13, "left", "#ffd23f");
  ROUTE.forEach((st, i) => {
    const r0 = mapTile(i), open = unlocked(i), on = i === mapIdx, stars = cityStars[i] || 0, e = uiIn(Math.min(i, 21) * 12), r = { ...r0, x: r0.x + (1 - e) * (i < MAP_ROWS ? -18 : 18) };
    ctx.save(); ctx.globalAlpha *= e;
    roundRect(r.x, r.y, r.w, r.h, 9);
    if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.7)`; ctx.shadowBlur = 14; const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(255,255,255,0.1)"); ctx.fillStyle = "rgba(14,16,26,0.9)"; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; }
    else { ctx.fillStyle = open ? "rgba(12,14,22,0.74)" : "rgba(12,14,22,0.5)"; ctx.fill(); }
    ctx.strokeStyle = on ? UI_ACC : "rgba(255,255,255,0.16)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    ctx.globalAlpha *= open ? 1 : 0.45;
    textAt(String(st.n), r.x + 14, r.y + 20, 11, "center", on ? UI_ACC : "rgba(255,255,255,0.55)");
    ctx.save(); ctx.translate(r.x + 26, r.y + 9); drawFlag(st.flag, 20, 13); ctx.restore();
    const room = r.w - 52 - (open ? 46 : 32); // shrink long names to fit between the flag and the stars, then shorten them if needed
    let nm = st.venue, fs = 12;
    const fits = () => { ctx.font = `800 ${fs}px ${UI_FONT}`; return ctx.measureText(nm).width + 4 <= room; };
    while (!fits() && fs > 10) fs--;
    while (!fits() && nm.length > 4) nm = nm.slice(0, nm.endsWith(".") ? -2 : -1).trimEnd() + ".";
    textAt(nm, r.x + 52, r.y + 20, fs, "left", "#fff");
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= e;
    if (open) {
      for (let k = 0; k < 3; k++) drawStar(r.x + r.w - 40 + k * 13, r.y + r.h / 2 + 2, 5.5, k < stars);
      missionState(i).forEach((d, k) => { ctx.fillStyle = d ? "#7cfc9a" : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(r.x + r.w - 40 + k * 13, r.y + 5, 2.2, 0, TAU); ctx.fill(); }); // missions done
    }
    else { // a little padlock
      const lx = r.x + r.w - 22, ly = r.y + r.h / 2;
      ctx.strokeStyle = "#8a909c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly - 3, 4, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = "#8a909c"; ctx.fillRect(lx - 6, ly - 3, 12, 9);
    }
    ctx.restore();
  });
}

function drawGarage() {
  const t = TEAMS[garageIdx], isOwned = owned.includes(garageIdx);
  text("GARAGE", 58, 34);
  text(`Coins ${wallet}`, 84, 16, "center", "#ffd23f");
  ctx.save();
  ctx.translate(W / 2, 190);
  ctx.scale(2.0, 2.0);
  if (!window.R3D) drawCar(t, { slip: false }); // with 3D on, the car is on the turntable behind this canvas
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
    textAt(it.name, r.x + 14, r.y + r.h / 2 + 5, 14, "left");
    roundRect(b.x, b.y + 2, b.w, b.h - 4, 4); ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fill();
    const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0); g.addColorStop(0, "#ff8a1a"); g.addColorStop(1, "#ffd98a");
    roundRect(b.x, b.y + 2, Math.max(b.h - 4, b.w * v), b.h - 4, 4); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x + Math.max(3, b.w * v), b.y + b.h / 2, 6, 0, TAU); ctx.fill(); // the handle
    textAt(`${Math.round(v * 100)}%`, r.x + r.w - 12, r.y + r.h / 2 + 5, 13, "right");
  });
}
function drawCredits() {
  drawLogo(W / 2, 120, Math.min(0.8, (W - 30) / 330));
  text("Made by Ashish", 196, 22, "center", "#ffd23f");
  text(`Version ${VERSION}`, 222, 13, "center", "#ccc");
  text(window.R3D ? "3D models by Kenney, skies by Poly Haven (both CC0)," : "Everything you see and hear is drawn and synthesised in code:", 262, 12, "center", "#ddd");
  text(window.R3D ? "Three.js engine. Music and sounds are made in code." : "no image or sound files.", 280, 12, "center", "#ddd");
  text("All teams, cars and liveries are fictional.", 314, 12, "center", "#ddd");
  text("Thanks for playing!", 366, 18);
}
const drawVersion = () => textAt(`v${VERSION}`, W - 14, H - 10, 10, "right", "rgba(255,255,255,0.55)"); // bottom-right of the title and main menu

// footer prompts per menu screen (keyboard / controller; touch keeps its own words)
const FOOTER = {
  menu: [["change", "Choose"], ["confirm", "Go"]], tutorial: [["confirm", "Next"], ["back", "Skip"]], garage: [["browse", "Browse"], ["confirm", "Pick"], ["back", "Back"]],
  upgrades: [["change", "Choose"], ["confirm", "Upgrade"], ["back", "Back"]], graphics: [["choose", "Setting"], ["change", "Change"], ["back", "Back"]],
  options: [["choose", "Choose"], ["change", "Adjust"], ["confirm", "Select"], ["back", "Back"]], tyres: [["change", "Tyre"], ["confirm", "Race"], ["back", "Back"]],
  difficulty: [["choose", "Choose"], ["confirm", "Select"], ["back", "Back"]], songs: [["choose", "Choose"], ["confirm", "Select"], ["back", "Back"]],
};
// every way to play: three pages (Keyboard, Controller, Touch); Left / Right flips between them, and it opens on the one you are using
const CONTROL_PAGES = [
  ["KEYBOARD", () => [[["k:←", "k:→", "/", "k:A", "k:D"], "Change lane"], [["k:↑", "/", "k:W"], "Gas"], [["k:↓", "/", "k:S", "/", "k:Space"], "Brake"], [["k:↑", "+", "k:↓"], "Hold on the grid: launch"],
    [["k:C"], "Camera menu"], [["k:V", "/", "k:1", "k:2", "k:3"], "Next camera / pick one"], [["k:Esc", "/", "k:P"], "Pause"], [["k:R"], "Restart (paused) / retry"], [["k:P"], "Photo mode (paused)"],
    [["k:Q", "k:E"], "Turn the car (Garage)"], [["k:M", "k:F", "k:N"], "Mute / fullscreen / song"], [[], "Multiplayer: P1 arrows, P2 W A S D"]]],
  ["CONTROLLER", () => [[["p:LS", "/", "p:DLR"], "Change lane"], [["p:RT", "/", "p:A"], "Gas"], [["p:LT", "/", "p:B", "/", "p:X"], "Brake"], [["p:RT", "+", "p:LT"], "Hold on the grid: launch"],
    [["p:Y", "/", "p:VIEW"], "Camera menu"], [["p:LB", "p:RB"], "Next camera"], [["p:START"], "Pause"], [["p:X"], "Restart (paused) / retry"], [["p:Y"], "Photo mode (paused)"],
    [["p:RS"], "Turn the car (Garage)"], [["p:LB", "p:RB"], "Browse cars (Garage)"], [["p:Y"], "Next song (menus)"]]],
  ["TOUCH", () => [[[], "Tap the left / right half: change lane"], [[], "GAS and BRAKE pads at the bottom"], [[], "Hold both on the grid: launch"], [[], "Camera top-left, pause bottom-right"], [[], "Drag the car to turn it (Garage)"], [[], "Swipe the main menu cards"]]],
];
function drawControls() {
  heading("CONTROLS", 40, 28);
  const tw = Math.min(110, (W - 70) / 3), x0 = W / 2 - tw * 1.5;
  CONTROL_PAGES.forEach(([name], i) => { roundRect(x0 + i * tw + 2, 54, tw - 4, 24, 12); ctx.fillStyle = i === controlsTab ? "#1d70f5" : "rgba(0,0,0,0.5)"; ctx.fill(); textAt(name, x0 + i * tw + tw / 2, 71, 11, "center", i === controlsTab ? "#fff" : "#aaa"); });
  if (!onTouch()) { const a = onPad() ? "p:LB" : "k:←", b = onPad() ? "p:RB" : "k:→"; drawGlyph(a, x0 - glyphWidth(a, 16) - 4, 66, 16); drawGlyph(b, x0 + tw * 3 + 4, 66, 16); }
  const using = onPad() ? PAD_NAME[padKind] : onTouch() ? "the touch screen" : "the keyboard";
  text(`You are using ${using}`, 96, 11, "center", "#7fffd4");
  const rows = CONTROL_PAGES[controlsTab][1](), lx = W / 2 - 20;
  const was = inputDev; if (controlsTab === 1) inputDev = "pad"; else if (controlsTab === 0) inputDev = "kb"; // (each page draws its own device's glyphs, whatever you hold)
  rows.forEach(([toks, label], i) => {
    const y = 120 + i * 25;
    if (!toks.length) { textAt(label, W / 2, y + 4, 12, "center", "#ddd"); return; }
    let w = 0; toks.forEach(t => w += glyphWidth(t, 18) + 3); let x = lx - w;
    for (const t of toks) x += drawGlyph(t, x, y, 18) + 3;
    textAt(label, lx + 8, y + 4, 12, "left", "#ddd");
  });
  inputDev = was;
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
    const room = c.w - 18 * c.s, fit = (str, size) => { ctx.font = `800 ${size}px ${UI_FONT}`; const w = ctx.measureText(str).width; return w > room ? size * room / w : size; }; // shrink text that would run past the card's edges
    const label = typeof item.label === "function" ? item.label() : item.label;
    textAt(label, c.x + c.w / 2, ty + 28 * c.s, fit(label, 19 * c.s), "center", "#fff");
    textAt(info.tag, c.x + c.w / 2, ty + 50 * c.s, fit(info.tag, 11 * c.s), "center", "#c8ced8");
    const bt = info.badge(); ctx.font = `800 ${Math.round(11 * c.s)}px ${UI_FONT}`; const bw = ctx.measureText(bt).width + 18 * c.s;
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
// ---- the title screen: your car gliding through a golden-hour city, a big glowing logo, and nothing else in the way ----
const TITLE_FONT = `900 italic %spx "Arial Black", Impact, "Helvetica Neue", sans-serif`;
function spaced(s, x, y, gap, mode) { // text drawn letter by letter with extra spacing, centred on x; mode "stroke" | "fill"
  let w = 0; for (const c of s) w += ctx.measureText(c).width + gap; w -= gap; let px = x - w / 2;
  ctx.textAlign = "left"; for (const c of s) { if (mode === "stroke") ctx.strokeText(c, px, y); else ctx.fillText(c, px, y); px += ctx.measureText(c).width + gap; }
  return w;
}
function drawTitleLogo(cx, cy, k) {
  ctx.save(); ctx.translate(cx, cy + Math.sin(clock / 45) * 2); ctx.scale(k, k); ctx.transform(1, 0, -0.16, 1, 0, 0); ctx.lineJoin = "round"; ctx.textBaseline = "alphabetic";
  // racing stripes either side of RACER
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { ctx.fillStyle = ["#ff3b30", "#ff9500", "#ffd60a"][i]; ctx.globalAlpha = 0.95 - i * 0.12; ctx.save(); ctx.scale(s, 1); ctx.beginPath(); ctx.moveTo(86 + i * 9, 30 + i * 9); ctx.lineTo(210 + i * 9, 30 + i * 9); ctx.lineTo(200 + i * 9, 38 + i * 9); ctx.lineTo(80 + i * 9, 38 + i * 9); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = 1;
  // EXTREME: warm metal gradient, a dark edge, an orange glow
  ctx.font = TITLE_FONT.replace("%s", 70);
  const g = ctx.createLinearGradient(0, -62, 0, 6); g.addColorStop(0, "#fffbe8"); g.addColorStop(0.45, "#ffd84a"); g.addColorStop(1, "#ff5a14");
  ctx.shadowColor = "rgba(255,120,30,0.65)"; ctx.shadowBlur = 28; ctx.lineWidth = 12; ctx.strokeStyle = "#1a0b05"; spaced("EXTREME", 0, 0, 2, "stroke"); ctx.shadowBlur = 0;
  ctx.fillStyle = g; const w = spaced("EXTREME", 0, 0, 2, "fill");
  // a bright glint sweeping across the word every few seconds
  const cyc = (clock % 260) / 260, px = (cyc * 1.6 - 0.3) * w - w / 2; if (cyc < 0.6) { const sh = ctx.createLinearGradient(px - 40, -60, px + 40, 10); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,0.85)"); sh.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = sh; spaced("EXTREME", 0, 0, 2, "fill"); }
  // RACER: crisp white, wide-set
  ctx.font = TITLE_FONT.replace("%s", 56); ctx.lineWidth = 10; ctx.strokeStyle = "#0d0f1c"; ctx.shadowColor = "rgba(120,170,255,0.5)"; ctx.shadowBlur = 20; spaced("RACER", 0, 62, 14, "stroke"); ctx.shadowBlur = 0;
  const g2 = ctx.createLinearGradient(0, 20, 0, 66); g2.addColorStop(0, "#ffffff"); g2.addColorStop(1, "#b9d4ff"); ctx.fillStyle = g2; spaced("RACER", 0, 62, 14, "fill");
  ctx.restore();
}
function drawTitle(moy) {
  const top = -moy, bot = H - moy;
  // light, cinematic grading: dark at the top and bottom, clear in the middle where the car is
  let g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, "rgba(6,8,20,0.78)"); g.addColorStop(0.3, "rgba(6,8,20,0.18)"); g.addColorStop(0.62, "rgba(6,8,20,0.05)"); g.addColorStop(1, "rgba(6,8,20,0.88)");
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H);
  // thin golden letterbox lines
  ctx.fillStyle = "rgba(255,200,90,0.55)"; ctx.fillRect(0, top + 14, W, 1); ctx.fillRect(0, bot - 14, W, 1);
  // warm light motes drifting up
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < (settings.lowfx ? 10 : 34); i++) {
    const sp = 0.15 + (i % 5) * 0.07, x = (i * 97 + Math.sin(clock / 90 + i) * 14) % W, y = bot - ((clock * sp + i * 53) % (H + 40)), r = 1 + (i % 3) * 0.9;
    ctx.fillStyle = `rgba(255,${190 + (i % 4) * 15},120,${0.12 + (i % 4) * 0.05})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  drawTitleLogo(W / 2, 128, Math.min(1.05, (W - 24) / 400));
  // tagline between two thin rules
  ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = "center";
  const tag = "22 CITIES   -   ONE WORLD TOUR", tw = (() => { let w = 0; for (const c of tag) w += ctx.measureText(c).width + 3; return w; })();
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(W / 2 - tw / 2 - 52, 224, 40, 1); ctx.fillRect(W / 2 + tw / 2 + 12, 224, 40, 1);
  ctx.fillStyle = "#cfd8ff"; spaced(tag, W / 2, 229, 3, "fill");
  // where you are in the tour
  const next = Math.min(tourCleared, ROUTE.length - 1), st = ROUTE[next], done = tourCleared >= ROUTE.length;
  textAt(done ? "TOUR COMPLETE" : `NEXT STOP  ${st.venue.toUpperCase()}`, W / 2 + (done ? 0 : 12), 438, 13, "center", "#ffd23f");
  if (!done) { ctx.save(); ctx.translate(W / 2 - ctx.measureText(`NEXT STOP  ${st.venue.toUpperCase()}`).width / 2 - 10, 427); drawFlag(st.flag, 18, 12); ctx.restore(); }
  // the 22 flags: the ones you have raced bright, the rest dim
  const fw = Math.min(17, (W - 40) / ROUTE.length - 3), fh = fw * 0.66, x0 = W / 2 - (ROUTE.length * (fw + 3) - 3) / 2;
  ROUTE.forEach((c, i) => { ctx.globalAlpha = i < tourCleared ? 1 : i === tourCleared ? 0.85 : 0.32; ctx.save(); ctx.translate(x0 + i * (fw + 3), 452); drawFlag(c.flag, fw, fh); ctx.restore(); });
  ctx.globalAlpha = 1;
  if (totalStars()) { drawStar(W - 60, 438, 6, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W - 50, 442, 12, "left", "#ffd23f"); }
  // the prompt: breathing, with a little chevron
  const pulse = 0.6 + 0.4 * Math.sin(clock / 14);
  ctx.globalAlpha = pulse; ctx.font = `800 19px ${UI_FONT}`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(255,255,255,0.7)"; ctx.shadowBlur = 12;
  spaced(onTouch() ? "TAP TO START" : onPad() || hasPad ? "PRESS ANY BUTTON" : "PRESS ANY KEY", W / 2, 398, 4, "fill"); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

function drawUpgrades() {
  heading("UPGRADES", 46, 30);
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

function drawGauge(r) { // the speedo: a half dial at the bottom left (low enough to sit under the touch pedals), the speed big inside it, the gear beside it
  const cx = 60, cy = H - 8, R = 46, f = clamp(effV(r) / NITRO_MAX, 0, 1), nitro = r.nitro > 0;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 7, Math.PI, TAU); ctx.closePath();
  const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, R + 7); bg.addColorStop(0, "rgba(8,10,17,0.9)"); bg.addColorStop(1, "rgba(22,26,40,0.78)"); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.lineCap = "round"; ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.arc(cx, cy, R - 3, Math.PI, TAU); ctx.stroke();
  const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  if (nitro) { g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff"); } else { g.addColorStop(0, "#4cd964"); g.addColorStop(0.55, "#ffd23f"); g.addColorStop(1, "#ff3b30"); }
  ctx.strokeStyle = g; ctx.shadowColor = nitro ? "rgba(95,212,255,0.9)" : `rgba(${UI_ACC_RGB},0.6)`; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, Math.PI, Math.PI + Math.max(0.02, f) * Math.PI); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.lineCap = "butt"; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, k = i % 5 ? 0 : 3; ctx.moveTo(cx + Math.cos(a) * (R - 10 - k), cy + Math.sin(a) * (R - 10 - k)); ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); }
  ctx.stroke();
  const a = Math.PI + f * Math.PI + (f > 0.98 ? Math.sin(clock * 1.9) * 0.035 + rnd(-0.015, 0.015) : 0); // pinned: the tip quivers
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), 3.6, 0, TAU); ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `italic 900 21px ${UI_FONT}`; ctx.fillText(String(Math.round(r.v * 60)), cx, cy - 11);
  ctx.font = `700 8px ${UI_FONT}`; ctx.fillStyle = "rgba(255,255,255,0.6)"; try { ctx.letterSpacing = "1px"; } catch (e) {} ctx.fillText("KM/H", cx, cy - 1); try { ctx.letterSpacing = "0px"; } catch (e) {}
  // the gear: a small glass tile
  const gx = cx + R + 10, gy = cy - 34;
  roundRect(gx, gy, 26, 30, 7); ctx.fillStyle = "rgba(10,12,20,0.72)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.stroke();
  ctx.fillStyle = UI_ACC; ctx.fillRect(gx + 7, gy, 12, 2);
  ctx.fillStyle = "#fff"; ctx.font = `italic 900 17px ${UI_FONT}`; ctx.fillText(String(gearOf(r.v)), gx + 13, gy + 20);
  ctx.font = `700 6px ${UI_FONT}`; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText("GEAR", gx + 13, gy + 27);
  ctx.restore();
  if (r.v >= 4.6) textAt("SLIPSTREAM", gx, gy - 6, 10, "left", "#39ff14");
}

const roundLabel = st => level && level.daily && state !== "map" && state !== "brief" ? `DAILY CHALLENGE` : st.n === ROUTE.length ? `GRAND FINAL` : st.venue.toUpperCase() === st.country ? `ROUND ${st.n}` : `ROUND ${st.n}  -  ${st.venue.toUpperCase()}`; // no 'ABU DHABI - ABU DHABI'
function drawStageBar() { // which city you're in, and how far through it: a glass track between the speedo and the pause button, halfway and finish marked, your car on it
  const st = ROUTE[stageIdx], x0 = Math.max(150, W / 2 - 140), x1 = Math.min(W - 52, W / 2 + 140), w = x1 - x0, y = H - 16, mid = (x0 + x1) / 2;
  ctx.font = `800 12px ${UI_FONT}`;
  const tw = ctx.measureText(st.country).width, fw = 18, fx = mid - (tw + fw + 6) / 2, top = level ? 22 : 0; // (the country line moves up to make room for the labels)
  ctx.save(); ctx.translate(fx, y - 30 - top); drawFlag(st.flag, fw, 12); ctx.restore();
  textAt(st.country, fx + fw + 6, y - 19 - top, 12, "left", "#fff");
  pill(x0 - 2, y - 6, w + 4, 10, "rgba(10,12,20,0.7)");
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "#ff8a1a"); g.addColorStop(1, "#ffd98a");
  ctx.save(); ctx.shadowColor = `rgba(${UI_ACC_RGB},0.8)`; ctx.shadowBlur = 8; roundRect(x0, y - 4, Math.max(6, w * clamp(stageFrac, 0, 1)), 6, 3); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  if (level) {
    const hx = x0 + w / 2, past = stageFrac >= 0.5, fx2 = x1, carX = x0 + w * clamp(stageFrac, 0, 1);
    ctx.fillStyle = past ? "#7CFC9A" : "rgba(255,255,255,0.85)"; ctx.fillRect(hx - 1, y - 11, 2, 13); // halfway
    textAt("HALFWAY", hx, y - 14, 8, "center", past ? "#7CFC9A" : "rgba(255,255,255,0.85)");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(fx2 - 1, y - 20, 1.5, 22); // finish: a chequered flag on a pole
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#ffffff" : "#111111"; ctx.fillRect(fx2 + 0.5 + i * 3, y - 20 + j * 3, 3, 3); }
    textAt("FINISH", fx2 + 6, y - 24, 8, "center", "#ffffff");
    ctx.save(); ctx.translate(carX, y - 1); ctx.rotate(Math.PI / 2); ctx.scale(0.17, 0.17); drawCar(racers[0] ? racers[0].team : TEAMS[equipped], { slip: false }); ctx.restore(); // your own car, in your colours
    if (Math.abs(carX - hx) > 24 && Math.abs(carX - fx2) > 24 && carX > x0 + 38) textAt("YOU", carX, y - 10, 8, "center", "#ffe11a"); else textAt("YOU", carX, y + 13, 8, "center", "#ffe11a");
  }
  textAt(`${st.n}/${ROUTE.length}   ${runKm()} km`, mid, y + 13, 10, "center", "rgba(255,255,255,0.75)");
}

function drawBanner() { // a small card that slides in from the left edge and leaves again, clear of the road
  const t = banner.t, st = ROUTE[banner.idx];
  const inK = smooth(Math.min(t, 24) / 24), outK = t > 170 ? smooth((t - 170) / 30) : 0;
  // fit the text: the card grows to the widest line, and a line that is still too wide shrinks (long names like "BRUSSELS" were spilling out of the box)
  const line2 = roundLabel(st), fit = (s, size, max) => { ctx.font = `800 ${size}px ${UI_FONT}`; const w = ctx.measureText(s).width; return w > max ? Math.max(7, Math.floor(size * max / w)) : size; };
  const maxW = Math.min(W * 0.55, 230);
  const s1 = fit(st.country, 12, maxW - 58), s2 = fit(line2, 9, maxW - 58);
  ctx.font = `800 ${s1}px ${UI_FONT}`; const w1 = ctx.measureText(st.country).width; ctx.font = `800 ${s2}px ${UI_FONT}`; const w2 = ctx.measureText(line2).width;
  const cardW = Math.max(150, 48 + Math.max(w1, w2) + 12);
  ctx.save();
  ctx.globalAlpha = clamp(1 - outK, 0, 1);
  ctx.translate(6 - (1 - inK) * (cardW + 6) - outK * (cardW + 6), 104);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(0, 0, cardW, 44, 9); ctx.fill();
  ctx.save(); ctx.translate(8, 11); drawFlag(st.flag, 32, 22); ctx.restore();
  textAt(st.country, 48, 19, s1, "left", "#fff");
  textAt(line2, 48, 34, s2, "left", "#ffd23f");
  ctx.restore();
}

function drawCameraIcon() {
  ctx.save();
  ctx.translate(24, 24);
  ctx.fillStyle = "rgba(10,12,20,0.6)"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
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
    if (grid.done || mode === "single") { // (on the grid there is no score yet: keep the start lights clear)
      ctx.save(); ctx.font = `italic 900 34px ${UI_FONT}`; ctx.textAlign = "center"; try { ctx.letterSpacing = "1px"; } catch (e) {}
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = "#fff"; ctx.fillText(String(p0.score), W / 2, 54); ctx.restore();
    }
    ctx.font = `800 14px ${UI_FONT}`; const cw = ctx.measureText(String(p0.coins)).width; pill(44, 13, cw + 38, 22); drawCoin(57, 24, 7, 1); textAt(String(p0.coins), 70, 29, 14, "left", "#ffd23f");
    if (level && level.daily) { if (grid.done) text(`Today's best ${dailyBest()}`, 76, 12, "center", "#9be89b"); }
    else if (level) { // the next star to chase, right under the score
      const tg = starTargets(level.idx), next = p0.score < tg[0] ? [2, tg[0]] : p0.score < tg[1] ? [3, tg[1]] : null;
      if (grid.done) { // the next star to chase, in a small pill under the score
        ctx.font = `800 12px ${UI_FONT}`; const n = next ? next[0] : 3, lab = next ? String(next[1]) : "", pw = n * 11 + (lab ? ctx.measureText(lab).width + 10 : 0) + 16;
        pill(W / 2 - pw / 2, 64, pw, 18); for (let k = 0; k < n; k++) drawStar(W / 2 - pw / 2 + 13 + k * 11, 73, 4.5, true); if (lab) textAt(lab, W / 2 - pw / 2 + 10 + n * 11 + 4, 77.5, 12, "left", "#ffd23f");
      }
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
    const c = racers[1];
    if (mode === "vs" && c && c.alive && grid.done && p0.v > 1) { // where the CPU really is (it can be off screen): ahead of you or behind, in seconds
      const cy = c.trueY === undefined ? c.y : c.trueY, gap = Math.abs(cy - p0.y) / (p0.v * 60), ahead = cy < p0.y;
      text(gap < 0.05 ? "LEVEL" : `${ahead ? "AHEAD" : "BEHIND"} ${gap.toFixed(1)}s`, 88, 12, "right", gap < 0.05 ? "#ffd23f" : ahead ? "#ff5a5a" : "#3dff6e");
    }
  }
  if (p0.shield && p0.alive) drawShieldIcon(24, 64, 11, clock); // shield ready (under the camera button)
  if (p0.comboT > 0 && p0.combo >= 2) { // the live combo and how long it has left
    const y = level ? 104 : 88, k = p0.comboT / COMBO_T, pulse = 1 + 0.15 * Math.max(0, 1 - (COMBO_T - p0.comboT) / 10);
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
  if (p0.alive && p0.bypass) drawBypass(p0);
  if (p0.alive && cam !== 2 && !p0.ai && grid.done) drawTyreChip(p0); // (not on the grid: the tyre screen told you already)
  if (p0.alive && state === "playing" && !p0.launched && (!grid.done || p0.charging || p0.launchLocked) && !p0.ai) drawLaunchGauge(p0);
  if (p0.alive && p0.nitro > 0) { // nitro burn bar
    const w = 130, x = W / 2 - w / 2, y = 10, g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff");
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(x - 2, y - 2, w + 4, 12, 6); ctx.fill();
    ctx.fillStyle = g; roundRect(x, y, Math.max(6, w * p0.nitro / (p0.nitroMax || NITRO_FRAMES)), 8, 4); ctx.fill();
  }
  const menuUp = state === "paused" || state === "camera"; // (a menu is open over the race: the bottom of the HUD steps aside for its prompts)
  if (p0.alive && cam !== 2 && !menuUp) drawGauge(p0);
  if (menuUp) {} else if (cam === 2) textAt(`${ROUTE[stageIdx].country}  ${runKm()} km`, 46, 52, 11, "left", "#fff"); // (beside the shield icon, under the coins) // the wheel covers the bottom bar
  else drawStageBar();
  if (state === "playing" && (!grid.done || frame < grid.goFrame + 120)) { // what to do, tucked low so it never covers the road
    const f = grid.done ? clamp((grid.goFrame + 120 - frame) / 30, 0, 1) : 1;
    ctx.globalAlpha = f;
    // (on the grid the launch gauge carries the only hint; after the green, how to steer, up under the score and clear of the car)
    if (grid.done) { if (onTouch() && mode !== "multi") text("Tap a side to steer", 100, 13); else if (mode === "multi") text("P1: Arrows    P2: W A S D", 100, 13); else drawPrompt([["steer", "Steer"], ["gas", "Gas"], ["brake", "Brake"], ["camNext", "Camera"]], W / 2, 96, 15); }
    ctx.globalAlpha = 1;
  }
  if (banner && state === "playing" && grid.done) drawBanner(); // (the city card waits for the green: the tyre screen named the city)
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
  ctx.fillStyle = "rgba(10,12,20,0.6)";
  ctx.beginPath(); ctx.arc(W - 24, H - 24, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(W - 29, H - 31, 4, 14); ctx.fillRect(W - 21, H - 31, 4, 14);
}

function draw() {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!window.R3D) { drawWorld(); drawAtmosphere(); postFX(); } // with the 3D renderer on, the world is drawn behind this canvas
  if (window.R3D && R3D.photo.active) { drawPhotoHint(); return; } // photo mode: just a hint (or nothing at all when the HUD is hidden)

  if (state === "playing" || state === "paused" || state === "camera") drawHud();
  if (flashT > 0.02) { ctx.fillStyle = `rgba(255,255,255,${flashT})`; ctx.fillRect(0, 0, W, H); }

  garageUI.sync(); // the Garage / Upgrades screens are HTML over the 3D showroom: shown, hidden and refreshed here
  const moy = menuOY(); // menus and overlays are laid out for a 480-high screen: centre them on taller ones
  const uiKey = state + (state === "tutorial" ? tipIdx : "") + (state === "controls" ? controlsTab : ""); if (uiKey !== uiSeen) { uiSeen = uiKey; uiT0 = performance.now(); } // a new screen: its parts fade and slide in
  ctx.save(); ctx.translate(0, moy);

  if (state === "title" || state === "menu") { ctx.save(); ctx.translate(0, -moy); drawVersion(); ctx.restore(); }
  if (state === "title") drawTitle(moy);
  if (!domMenuActive() && (state === "menu" || state === "tutorial" || state === "difficulty" || state === "tyres" || state === "garage" || state === "upgrades" || state === "options" || state === "graphics" || state === "songs" || state === "controls" || state === "credits" || state === "map" || state === "brief" || state === "stats")) {
    if (!(window.R3D && state === "garage")) menuBackdrop(moy); // fade the road behind the menu (the 3D showroom needs no fade)
    if (state === "map") drawMap();
    else if (state === "stats") drawStats();
    else if (state === "brief") drawBrief();
    else if (state === "tutorial") drawTutorial();
    else if (state === "tyres") drawTyres();
    else if (state === "garage") drawGarage();
    else if (state === "upgrades") drawUpgrades();
    else if (state === "graphics") { heading("GRAPHICS", 46, 30); text(!window.R3D ? "3D is off here: showing the 2D game" : onTouch() ? "Tap a row to change it" : "", 64, 12, "center", "#ccc"); }
    else if (state === "options") {
      heading("SETTINGS", 46, 30);
      text(`Now playing: ${music.playing ? music.name : "-"}`, 74, 12, "center", "#ccc");
    } else if (state === "credits") { drawCredits();
    } else if (state === "songs" || state === "controls") { // drawn after the buttons, below
    } else {
      if (state === "difficulty") { drawTitleLogo(W / 2, 92, Math.min(0.62, (W - 24) / 400)); heading("VS COMPUTER", 180, 22); }
      else {
        drawTitleLogo(W / 2, 54, Math.min(0.5, (W - 24) / 400)); // the title screen's logo, smaller up top: the cards get the room
        const line = `Coins ${wallet}     `, tail = `${totalStars()} / ${ROUTE.length * 3}`;
        ctx.font = `800 13px ${UI_FONT}`;
        const w1 = ctx.measureText(line).width, w2 = ctx.measureText(tail).width, x0 = W / 2 - (w1 + 16 + w2) / 2;
        textAt(line, x0, 112, 13, "left", "#ffd23f"); drawStar(x0 + w1 + 6, 107, 6, true); textAt(tail, x0 + w1 + 16, 112, 13, "left", "#ffd23f");
      }
    }
    if (state === "menu") drawCarousel(); else drawButtons();
    if (state === "upgrades") drawUpgradeRows();
    if (state === "tyres") drawTyreRows();
    if (state === "options") drawSliders();
    if (state === "songs") { heading("SONGS", 96, 30); text(`Now playing: ${music.playing ? music.name : "-"}`, 128, 12, "center", "#ccc"); }
    if (state === "controls") drawControls();
    ctx.fillStyle = "#ccc";
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.textAlign = "center";
    const musicNote = music.on && sound.on ? (music.playing ? `Now playing: ${music.name}` : "Press any key to start the music") : "";
    if (state === "menu" && musicNote) { if (onTouch() || !music.playing) ctx.fillText(musicNote, W / 2, 448); else drawPrompt([[[], musicNote], ["song", "Next song"]], W / 2, 444, 14, "center", "#ccc"); }
    if (!onTouch()) { const fp = FOOTER[state]; if (fp) drawPrompt(fp, W / 2, 466, 15, "center", "#ddd"); }
    else ctx.fillText(state === "menu" ? (hasTouch ? "Swipe or tap a card" : "Left / Right to choose, Enter to go") : state === "brief" || state === "stats" || state === "controls" || state === "credits" ? "" /* buttons sit there */ : state === "upgrades" ? (hasTouch ? "Tap an upgrade to buy its next level" : "Up / Down to choose, Enter to upgrade") : state === "tutorial" ? (hasTouch ? "Tap Next, or Skip to go straight in" : "Enter = next   Esc = skip") : state === "garage" ? "Left / Right to browse, Enter to pick" : state === "map" ? "" /* the map has its own Back button there */ : "Tap an option", W / 2, 470);
  }

  if (state === "paused") {
    ctx.fillStyle = "rgba(6,8,16,0.55)"; ctx.fillRect(0, -moy, W, H);
    { const pw = Math.min(W - 24, 320), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 160 + (1 - e) * 12, pw, 284, 18); ctx.restore(); }
    heading("PAUSED", 206, 36);
    if (!onTouch()) drawPrompt([...(window.R3D ? [["photo", "Photo mode"]] : []), ["retry", "Restart"], ["back", "Resume"]], W / 2, 458, 15, "center", "#ddd");
    if (sel === 1 && !onTouch()) drawPrompt([["change", "Change camera"]], W / 2, 231, 15, "center", "#ccc");
    else text(sel === 1 ? "Tap to change the camera" : CAMS[cam].desc, 235, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "camera") {
    ctx.fillStyle = "rgba(6,8,16,0.6)"; ctx.fillRect(0, -moy, W, H);
    { const pw = Math.min(W - 24, 300); glass(W / 2 - pw / 2, 100, pw, 300, 18); }
    heading("CAMERA", 144, 32);
    text(CAMS[sel] ? CAMS[sel].desc : "Back to the race", 175, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "cleared") { menuBackdrop(moy); drawConfetti(-moy); const pw = Math.min(W - 20, 420), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 84 + (1 - e) * 14, pw, 214, 18, "#7cfc9a"); ctx.restore(); }
  if (state === "cleared" && level.daily) { // the Daily: score, today's best, streak
    const r = racers[0], s = Math.floor(levelTime);
    heading("DAILY COMPLETE", 124, Math.min(32, (W - 24) / 9.4));
    text(`${ROUTE[level.idx].venue}  -  ${dayKey()}`, 150, 14, "center", "#ddd");
    text(`Score ${r.score}`, 192, 24);
    text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}   speed bonus +${level.bonus}`, 222, 13, "center", "#9be89b");
    text(level.newBest ? "NEW BEST TODAY!" : `Today's best ${dailyBest()}`, 252, 16, "center", "#ffd23f");
    text(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}`, 278, 13, "center", "#ffb347");
    drawButtons();
  } else if (state === "cleared") {
    const st = ROUTE[level.idx], r = racers[0], s = Math.floor(levelTime);
    heading(lastCity() ? "TOUR CHAMPION!" : "CITY COMPLETE", 124, Math.min(32, (W - 24) / 9.4));
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

  if (state === "over" && !(window.R3D && performance.now() - overAt < R3D.overDelay())) { // (3D: the crash camera plays first)
    menuBackdrop(moy);
    { const pw = Math.min(W - 20, 420), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 88 + (1 - e) * 14, pw, (mode === "daily" ? 240 : mode === "tour" ? 244 : mode === "single" ? 272 : 256) - 88, 18, "#ff5a4a"); ctx.restore(); }
    const reached = `Reached ${ROUTE[stageIdx].country}  -  ${runKm()} km`, rc = "#ffd23f";
    heading(String(result).toUpperCase(), 136, 34);
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
    if (!onTouch()) drawPrompt([["retry", "Retry"], ["back", "Menu"]], W / 2, 466, 15, "center", "#ddd");
  }

  ctx.restore();
  drawToasts(); // (in screen space: the stack sits under the score in a race, at the top elsewhere)
  drawFps();
}

// ---- photo mode and the fps counter (3D renderer only) ----
function drawPhotoHint() {
  const ph = R3D.photo;
  if (ph.hideHud) return;
  ctx.save(); ctx.textAlign = "center";
  const pw = Math.min(W - 16, 470);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - pw / 2, H - 84, pw, 76, 10); ctx.fill();
  const pad = onPad(), P = (...t) => t.map(x => (pad ? "p:" : "k:") + x);
  drawPrompt([[[], "PHOTO MODE"], [P(pad ? "A" : "Enter"), "Save picture"], [P(pad ? "B" : "Esc"), "Back"]], W / 2, H - 70, 15);
  drawPrompt(pad ? [[P("LS"), "Move"], [P("RS"), "Look"], [P("LT", "RT"), "Down / up"], [P("LB", "RB"), "Zoom"]] : [[P("W", "A", "S", "D"), "Move"], [P("←", "→", "↑", "↓"), "Look"], [P("Q", "E"), "Down / up"], [P("Z", "X"), "Zoom"]], W / 2, H - 46, 13, "center", "#ddd");
  drawPrompt(pad ? [[P("X"), "Filter"], [P("Y"), "Blur"], [P("DUD"), "Hide this"]] : [[P("V"), "Filter"], [P("B"), "Blur"], [P("H"), "Hide this"], [[], "Drag: look, wheel: zoom"]], W / 2, H - 24, 13, "center", "#ddd");
  if (ph.note) { textAt(ph.note, W / 2, 30, 15, "center", "#ffd23f"); }
  ctx.restore();
}
function drawFps() {
  if (!settings.fps || !window.R3D) return;
  const q = R3D.quality;
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W - 112, 4, 108, 20);
  textAt(`${Math.round(R3D.fps)} fps  ${q.level}`, W - 58, 18, 12, "center", R3D.fps >= 55 ? "#7CFC9A" : R3D.fps >= 35 ? "#ffd23f" : "#ff7b7b"); ctx.restore();
}

// ---------- tyre choice (before every race) ----------
// a tyre seen from the side of the car: black rubber, a coloured band for the compound, a rim with spokes; `rot` turns it
function drawTyreIcon(cx, cy, r, tyre, rot) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = "#101114"; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#2a2c31"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.stroke();
  ctx.strokeStyle = tyre.band; ctx.lineWidth = Math.max(3, r * 0.07); ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke(); // the compound band
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = `800 ${Math.max(7, r * 0.12)}px ${UI_FONT}`; ctx.textAlign = "center";
  for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(rot * 0.3 + i / 12 * TAU); ctx.fillText("VELOCITA", 0, -r * 0.9); ctx.restore(); } // sidewall lettering
  ctx.rotate(rot);
  ctx.fillStyle = "#3a3d44"; ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); ctx.fill();
  ctx.fillStyle = "#8a8f98"; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i / 10 * TAU); ctx.fillRect(-r * 0.04, -r * 0.5, r * 0.08, r * 0.36); ctx.restore(); }
  ctx.fillStyle = "#c9ccd2"; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}
// a strip of the tread pattern: smooth for slicks, shallow grooves for intermediates, deep channels for wets
function drawTreadStrip(x, y, w, h, key) {
  ctx.fillStyle = "#17181c"; roundRect(x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = "#3d4048"; ctx.lineWidth = key === "wet" ? 3 : 2; ctx.beginPath();
  if (key === "dry") { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); }
  else { const step = key === "wet" ? 9 : 14; for (let i = 6; i < w - 4; i += step) { ctx.moveTo(x + i, y + h - 2); ctx.lineTo(x + i + (key === "wet" ? 6 : 3), y + 2); } if (key === "wet") { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); } }
  ctx.stroke();
}
function drawTyres() {
  const st = ROUTE[tyreCity], w = cityWetness(st), sel_ = TYRES[Math.min(sel, TYRES.length - 1)];
  heading("TYRES", 42, 28);
  const p = pendingStart || [], endless = p[0] === "single", line = endless ? "Weather changes as you travel" : `${st.venue.toUpperCase()}   -   ${wetLabel(w)}`;
  text(line, 66, 13, "center", w < 0.12 ? "#ffd23f" : "#7fd4ff");
  if (!endless) { // a little weather icon: sun, or cloud and rain
    ctx.save(); ctx.font = `800 13px ${UI_FONT}`; ctx.translate(W / 2 + ctx.measureText(line).width / 2 + 20, 62);
    if (w < 0.12) { ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = "#c9d3de"; ctx.beginPath(); ctx.arc(-4, 0, 6, 0, TAU); ctx.arc(4, -1, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = "#5fb4ff"; ctx.lineWidth = 2; for (let i = 0; i < (w > 0.75 ? 3 : 2); i++) { ctx.beginPath(); ctx.moveTo(-5 + i * 5, 8); ctx.lineTo(-7 + i * 5, 13); ctx.stroke(); } }
    ctx.restore();
  }
  // what the race asks of you (shown here, not over the car on the grid): the conditions, and the city's star targets
  const warn = endless ? "" : st.rain > 0.3 ? "Wet road: the right tyres matter - watch the grip bars" : st.night > 0.15 ? "Night race: distant cars show only their tail lights" : "";
  if (warn) text(warn, 86, 11, "center", "#ffb347");
  const tour = p[0] === "tour", isDaily = p[0] === "daily", idx = p[2] % ROUTE.length;
  if (tour || isDaily) {
    const pw = Math.min(W - 40, 330), px = W / 2 - pw / 2; pill(px, 96, pw, 22, "rgba(255,178,26,0.1)");
    if (isDaily) textAt(`DAILY   Today's best ${dailyBest()}   -   streak ${daily.streak}`, W / 2, 111, 11, "center", "#ffd23f");
    else {
      const tg = starTargets(idx), final = idx === ROUTE.length - 1, items = [[1, final ? "beat the CPU" : "finish"], [2, String(tg[0])], [3, String(tg[1])]];
      ctx.font = `800 11px ${UI_FONT}`; const iw = items.map(([n, l]) => n * 10 + 6 + ctx.measureText(l).width), tot = iw.reduce((a, b) => a + b, 0) + 22 * 2 + ctx.measureText("TARGETS").width + 14;
      let x = W / 2 - tot / 2; textAt("TARGETS", x, 111, 11, "left", "rgba(255,255,255,0.6)"); x += ctx.measureText("TARGETS").width + 14;
      items.forEach(([n, l], k) => { for (let s = 0; s < n; s++) drawStar(x + 5 + s * 10, 107, 4.5, true); textAt(l, x + n * 10 + 4, 111, 11, "left", (cityStars[idx] || 0) >= n ? "#9be89b" : "#fff"); x += iw[k] + 22; });
    }
  }
  drawTyreIcon(W / 2, 166, 36, sel_, clock * 0.04);
  drawTreadStrip(W / 2 - 40, 208, 80, 12, sel_.key);
  text(sel_.name + " TYRES", 238, 16, "center", sel_.band);
  const lines = []; ctx.font = `600 11px ${UI_FONT}`; { let cur = ""; for (const wd of sel_.blurb.split(" ")) { if (ctx.measureText(cur + wd).width > W - 60) { lines.push(cur); cur = ""; } cur += wd + " "; } lines.push(cur); }
  lines.slice(0, 1).forEach((s, i) => textAt(s.trim(), W / 2, 254 + i * 14, 10, "center", "#c8ced8"));
}
function drawTyreRows() { // on top of the three buttons: the compound's colour, name, what it is for, how well it grips today and whether it is the sensible pick
  const menu = currentMenu(), st = ROUTE[tyreCity], w = cityWetness(st), best = bestTyre(w), endless = pendingStart && pendingStart[0] === "single";
  TYRES.forEach((t, i) => {
    const r = btnRect(menu, i), g = endless ? gripOf(t.key, 0) : gripOf(t.key, w);
    ctx.fillStyle = t.band; ctx.beginPath(); ctx.arc(r.x + 22, r.y + r.h / 2, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
    textAt(t.name, r.x + 42, r.y + 21, 15, "left", "#fff"); textAt(t.sub, r.x + 42, r.y + 38, 11, "left", "#ccc");
    if (!endless) { // grip bar: how well this tyre holds in this city
      const bx = r.x + r.w - 120, by = r.y + 28;
      ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(bx, by, 90, 6, 3); ctx.fill();
      ctx.fillStyle = g > 0.85 ? "#4cd964" : g > 0.68 ? "#ffcc00" : "#ff5a4a"; roundRect(bx, by, Math.max(6, 90 * (g - 0.4) / 0.6), 6, 3); ctx.fill();
      textAt("GRIP", bx, by - 4, 9, "left", "#bbb");
      if (t.key === best) textAt("BEST", r.x + r.w - 14, r.y + 16, 11, "right", "#7CFC9A");
    } else if (t.key === "dry") textAt("USUAL", r.x + r.w - 14, r.y + 16, 11, "right", "#7CFC9A");
  });
}

// ---------- the launch gauge (on the grid) ----------
// A half dial: red / orange / green zones and a needle that sweeps up and down while you hold gas + brake together. Let go in the green.
function drawLaunchGauge(r) { // at the bottom right, clear of the car and the start lights; one short hint above it
  const R = W < 420 ? 40 : 46, cx = W - R - 16, cy = hasTouch ? pedalRects().gas.y - 14 : H - 52, a = n => Math.PI + n * Math.PI;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 8, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = "rgba(10,12,20,0.78)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.lineWidth = 9; ctx.lineCap = "butt";
  for (const [from, to, col] of [[0, 0.5, "#e03a3a"], [0.5, 0.72, "#ffa31a"], [0.72, 0.88, "#39ff6a"], [0.88, 0.95, "#ffa31a"], [0.95, 1, "#e03a3a"]]) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R - 5, a(from), a(to)); ctx.stroke(); }
  const live = r.charging, n = live ? r.needle || 0 : r.launchLocked ? r.needle || 0 : 0;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a(n)) * (R - 2), cy + Math.sin(a(n)) * (R - 2)); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, TAU); ctx.fill();
  ctx.restore();
  const lx = W - 12, ly = cy - R - 16;
  if (r.launchLocked && r.launchZone) textAt(`${r.launchZone.name}  ${Math.round(r.launchZone.v * 60)} km/h`, lx, ly, 13, "right", r.launchZone.color);
  else if (live) textAt("LET GO IN THE GREEN", lx, ly, 12, "right", "#39ff6a");
  else if (mode === "multi") textAt("P1 ↑+↓   P2 W+S", lx, ly, 12, "right", "#fff");
  else if (onPad()) drawPrompt([[["p:RT", "+", "p:LT"], "HOLD"]], lx, ly - 4, 16, "right");
  else if (onTouch()) textAt("HOLD GAS + BRAKE", lx, ly, 12, "right", "#fff");
  else drawPrompt([[["k:↑", "+", "k:↓"], "HOLD"]], lx, ly - 4, 16, "right");
}

// ---------- the bypass prompt ----------
function drawBypass(r) {
  const b = r.bypass; if (!b) return;
  const pulse = 0.6 + 0.4 * Math.sin(clock * 0.3);
  if (b.state === "armed") {
    const left = b.side < 0, x = left ? 26 : W - 26, y = 190;
    ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.fillStyle = "#3ad0ff";
    poly(left ? [[x + 14, y - 22], [x - 14, y], [x + 14, y + 22]] : [[x - 14, y - 22], [x + 14, y], [x - 14, y + 22]]);
    ctx.globalAlpha = 1;
    textAt(`BYPASS: steer ${left ? "LEFT" : "RIGHT"}`, W / 2, 128, 15, "center", "#7fffd4");
    if (!onTouch()) { const g = onPad() ? "p:DLR" : left ? "k:←" : "k:→"; drawGlyph(g, W / 2 + 92, 123, 18); }
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, 134, 80, 4, 2); ctx.fill(); ctx.fillStyle = "#7fffd4"; roundRect(W / 2 - 40, 134, Math.max(4, 80 * b.timeLeft / 600), 4, 2); ctx.fill();
  } else {
    textAt("BYPASS", W / 2, 128, 15, "center", "#7fffd4");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, 134, 80, 4, 2); ctx.fill(); ctx.fillStyle = "#3ad0ff"; roundRect(W / 2 - 40, 134, Math.max(4, 80 * (1 - b.d / b.L)), 4, 2); ctx.fill();
  }
}

// a little chip showing your tyres and how well they grip right now (only when it matters)
function drawTyreChip(r) {
  const t = TYRES.find(x => x.key === (r.tyre || "dry")) || TYRES[0], g = gripNow(r), x = 12, y = hasTouch ? pedalRects().brake.y - 12 : H - 70; // (above the brake pad on a touch screen)
  if (g > 0.96 && wetnessNow() < 0.12) return; // dry tyres on a dry road: nothing to say
  pill(x, y - 13, 86, 20);
  ctx.fillStyle = t.band; ctx.beginPath(); ctx.arc(x + 11, y - 3, 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke();
  textAt(`GRIP ${Math.round(g * 100)}%`, x + 22, y + 1, 11, "left", g > 0.85 ? "#7CFC9A" : g > 0.68 ? "#ffd23f" : "#ff7b7b");
}
