// =====================================================================
// 02_motion.js  —  Moving signs (wave = Hello, nod = Yes, shake = No)
// =====================================================================
// A still photo of a hand can't tell "Hello" from "Five". Movement can.
// We keep ~1.2 seconds of hand positions and count how many times the
// hand reverses direction ("zig-zags"). Waving = many left/right reversals.
// Everything is measured relative to hand size, so it works at any distance.
// =====================================================================

const WINDOW_MS = 1200;   // how much history to look at
let history = [];         // [{ t, x, y, shape }]

export function resetMotion() { history = []; }

// Count direction reversals in a list of numbers.
// A reversal only counts if the hand travelled at least `swing` before turning,
// which ignores small tremors.
function zigzag(values, swing) {
  let dir = 0;            // 0 = unknown, 1 = moving up/right, -1 = moving down/left
  let ref = values[0];    // the furthest point reached in the current direction
  let reversals = 0;
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (dir === 0) {
      if (v - ref > swing) { dir = 1; ref = v; }
      else if (ref - v > swing) { dir = -1; ref = v; }
    } else if (dir === 1) {
      if (v > ref) ref = v;
      else if (ref - v > swing) { dir = -1; ref = v; reversals++; }
    } else {
      if (v < ref) ref = v;
      else if (v - ref > swing) { dir = 1; ref = v; reversals++; }
    }
  }
  return reversals;
}

// Which hand shapes may be used for each motion sign
const RULES = {
  wave:  { shapes: ["five", "stop"],  axis: "x", minTurns: 3 },
  shake: { shapes: ["point", "u"],    axis: "x", minTurns: 3 },
  nod:   { shapes: ["fist"],          axis: "y", minTurns: 2 },
};

// Call once per frame. Returns "wave" | "shake" | "nod" | null
//   shape = the raw shape id for this frame (from classify())
//   lm    = the 21 landmarks;  now = timestamp in ms
export function detectMotion(shape, lm, now) {
  history.push({ t: now, x: lm[9].x, y: lm[9].y, shape }); // landmark 9 = middle knuckle (palm centre)
  while (history.length && now - history[0].t > WINDOW_MS) history.shift();
  if (history.length < 8) return null;

  // hand size = wrist to middle knuckle; swing must be about a third of that
  const palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
  const swing = palm * 0.35;
  const xTurns = zigzag(history.map((p) => p.x), swing);
  const yTurns = zigzag(history.map((p) => p.y), swing);

  for (const name in RULES) {
    const r = RULES[name];
    // at least 60% of recent frames must show the right hand shape
    const good = history.filter((p) => r.shapes.includes(p.shape)).length / history.length;
    if (good < 0.6) continue;
    const main = r.axis === "x" ? xTurns : yTurns;
    const other = r.axis === "x" ? yTurns : xTurns;
    if (main >= r.minTurns && other < 2) {
      history = [];       // clear so one wave doesn't fire twice
      return name;
    }
  }
  return null;
}
