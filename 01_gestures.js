// =====================================================================
// 01_gestures.js  —  Hand-shape classifier (rule-based, no training data)
// =====================================================================
// MediaPipe gives us 21 landmarks per hand (x, y, z). We NEVER look at
// pixels here — only at distances between landmarks. That makes the
// classifier tiny, fast, and independent of skin tone, lighting and
// camera resolution.
//
// Landmark numbers used below (MediaPipe Hand model):
//   0 = wrist
//   thumb : 1,2,3,4      (4 = tip)
//   index : 5,6,7,8      (5 = knuckle/MCP, 8 = tip)
//   middle: 9,10,11,12
//   ring  : 13,14,15,16
//   pinky : 17,18,19,20
// =====================================================================

// ---- Tunable thresholds (change these if detection feels too strict) ----
export const THRESH = {
  extended: 1.5,   // tip-to-wrist / knuckle-to-wrist ratio: above this = finger straight
  curled: 1.25,    // ratio below this = finger folded into the palm
  thumbOut: 0.85,  // thumb tip distance from index knuckle (relative to palm width)
  pinch: 0.28,     // thumb tip close to index tip (relative to palm length)
  spread: 0.32,    // index & middle tips far apart = "V" instead of "U"
  thumbVert: 0.6,  // how far above/below the wrist the thumb must point for up/down
};

// ---- Every hand shape SignBridge knows ----------------------------------
// word   = what is typed in "Words" mode   (null = not used in that mode)
// letter = what is typed in "Letters" mode (null = not used in that mode)
// hint   = plain-language description shown in the on-screen guide
export const SHAPES = {
  hello:      { word: "Hello",       letter: null, hint: "Open hand, all five fingers up and spread" },
  stop:       { word: "Stop",        letter: "B",  hint: "Flat hand, four fingers together, thumb tucked in" },
  iloveyou:   { word: "I love you",  letter: null, hint: "Thumb, index and pinky out; middle and ring folded" },
  thumbsup:   { word: "Good",        letter: "A",  hint: "Fist with thumb pointing up" },
  thumbsdown: { word: "Bad",         letter: null, hint: "Fist with thumb pointing down" },
  fist:       { word: "Yes",         letter: "S",  hint: "Closed fist, thumb across the fingers" },
  point:      { word: "You",         letter: "D",  hint: "Index finger up, other fingers folded" },
  lshape:     { word: null,          letter: "L",  hint: "Thumb and index finger out like an L" },
  ihand:      { word: "I",           letter: "I",  hint: "Only the pinky up, thumb tucked" },
  callme:     { word: "Call me",     letter: "Y",  hint: "Thumb and pinky out (phone shape)" },
  peace:      { word: "Peace",       letter: "V",  hint: "Index and middle up and spread apart" },
  u:          { word: "Two",         letter: "U",  hint: "Index and middle up, held together" },
  water:      { word: "Water",       letter: "W",  hint: "Index, middle and ring up; pinky folded" },
  ok:         { word: "OK",          letter: "F",  hint: "Thumb touches index tip; other three fingers up" },
  o:          { word: "Zero",        letter: "O",  hint: "All fingertips curve to touch the thumb (round O)" },
  c:          { word: "Cup",         letter: "C",  hint: "Curved hand like holding a cup, thumb out" },
};

// distance between two landmarks (we ignore depth, x/y only = stable)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Decide whether one finger is straight ("ext"), folded ("curl") or in between ("half").
// Idea: a straight finger puts its tip FAR from the wrist; a folded one doesn't.
function fingerState(lm, mcp, tip) {
  const ratio = dist(lm[tip], lm[0]) / dist(lm[mcp], lm[0]);
  if (ratio >= THRESH.extended) return "ext";
  if (ratio <= THRESH.curled) return "curl";
  return "half";
}

// Turn 21 landmarks into a small, readable description of the hand.
export function describeHand(lm) {
  const palmLen = dist(lm[0], lm[9]);   // wrist -> middle knuckle (hand size)
  const palmWid = dist(lm[5], lm[17]);  // index knuckle -> pinky knuckle

  const index  = fingerState(lm, 5, 8);
  const middle = fingerState(lm, 9, 12);
  const ring   = fingerState(lm, 13, 16);
  const pinky  = fingerState(lm, 17, 20);

  // Thumb is "out" when its tip is far from the base of the index finger
  const thumbOut = dist(lm[4], lm[5]) / palmWid > THRESH.thumbOut;

  const pinch  = dist(lm[4], lm[8]) / palmLen < THRESH.pinch;       // thumb + index touching
  const spread = dist(lm[8], lm[12]) / palmLen > THRESH.spread;     // index/middle apart

  // Thumb direction: negative y = up on screen
  const dy = (lm[4].y - lm[0].y) / palmLen;
  const thumbDir = dy < -THRESH.thumbVert ? "up" : dy > THRESH.thumbVert ? "down" : "side";

  return { index, middle, ring, pinky, thumbOut, pinch, spread, thumbDir, palmLen };
}

// Main entry point: landmarks in -> shape id (a key of SHAPES) or null.
// Rules run top to bottom; the FIRST match wins, so order matters.
export function classify(lm) {
  const h = describeHand(lm);
  const E = (s) => s === "ext";
  const C = (s) => s === "curl";
  const fingers = [h.index, h.middle, h.ring, h.pinky];
  const halfCount = fingers.filter((s) => s === "half").length;

  // OK / F : thumb+index touch, other three fingers straight
  if (h.pinch && E(h.middle) && E(h.ring) && E(h.pinky)) return "ok";

  // All four fingers straight: thumb out = Hello, thumb tucked = Stop / B
  if (fingers.every(E)) return h.thumbOut ? "hello" : "stop";

  // Thumb + index + pinky out, middle + ring folded = I love you
  if (E(h.index) && C(h.middle) && C(h.ring) && E(h.pinky) && h.thumbOut) return "iloveyou";

  // Index, middle, ring straight, pinky folded = W / Water
  if (E(h.index) && E(h.middle) && E(h.ring) && C(h.pinky)) return "water";

  // Index + middle straight, others folded: apart = V / Peace, together = U / Two
  if (E(h.index) && E(h.middle) && C(h.ring) && C(h.pinky)) return h.spread ? "peace" : "u";

  // Only index straight: thumb out = L, thumb tucked = D / You
  if (E(h.index) && C(h.middle) && C(h.ring) && C(h.pinky)) return h.thumbOut ? "lshape" : "point";

  // Only pinky straight: thumb out = Y / Call me, thumb tucked = I
  if (C(h.index) && C(h.middle) && C(h.ring) && E(h.pinky)) return h.thumbOut ? "callme" : "ihand";

  // Round shapes (no finger fully straight)
  if (!fingers.some(E) && halfCount >= 2) {
    if (h.pinch) return "o";             // fingertips meet thumb = O
    if (h.thumbOut && halfCount >= 3) return "c"; // open curve = C
  }

  // Fist family: every finger folded
  if (fingers.every(C)) {
    if (h.thumbOut && h.thumbDir === "up") return "thumbsup";
    if (h.thumbOut && h.thumbDir === "down") return "thumbsdown";
    if (h.thumbOut) return "thumbsup"; // thumb sideways beside the fist = A
    return "fist";
  }

  return null; // unknown / transition between shapes
}
