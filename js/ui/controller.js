// ---------- controller ----------

const padPrev = {};

function pollPads() {
  padG = [0, 0]; padB = [0, 0]; garageSpin = 0;
  let list = [];
  try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) {} // an iframe can block controllers (permissions policy): then there just aren't any
  const pads = Array.from(list || []).filter(g => g && g.connected);
  hasPad = pads.length > 0;
  pads.forEach((g, k) => {
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed), val = i => (g.buttons[i] ? g.buttons[i].value : 0);
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    const now = { left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13), a: b(0), b: b(1), y: b(3), start: b(9), back: b(8), lb: b(4), rb: b(5) };
    const prev = padPrev[g.index] || {}, edge = n => now[n] && !prev[n];
    padPrev[g.index] = now;

    if (state === "playing") {
      const rid = mode === "multi" && pads.length > 1 ? k : 0; // a second controller drives player 2
      if (rid > 1 || (mode !== "multi" && k > 0)) return;
      if (edge("left")) steer(racers[rid], -1);
      if (edge("right")) steer(racers[rid], 1);
      const gas = Math.max(val(7), b(0) ? 1 : 0, now.up ? 1 : 0), brake = Math.max(val(6), b(1) ? 1 : 0, b(2) ? 1 : 0, now.down ? 1 : 0);
      padG[rid] = gas; padB[rid] = brake;
      if (edge("start")) pause();
      else if (edge("y") || edge("back")) openCamera();
    } else if (k === 0 && state === "title") {
      if (Object.keys(now).some(n => edge(n))) leaveTitle();
    } else if (k === 0) {
      if (state === "garage" || state === "upgrades") { const rx = g.axes[2] || 0; garageSpin = Math.abs(rx) > 0.18 ? rx : 0; } // right stick: spin the turntable
      if (state === "garage") { if (edge("lb")) menuAction("left"); if (edge("rb")) menuAction("right"); } // shoulder buttons browse the cars too
      if (edge("up")) menuAction("up");
      if (edge("down")) menuAction("down");
      if (edge("left")) menuAction("left");
      if (edge("right")) menuAction("right");
      if (edge("a")) menuAction("confirm");
      if (edge("b") || edge("start")) menuAction("back");
      if (edge("y")) menuAction("next");
    }
  });
}
