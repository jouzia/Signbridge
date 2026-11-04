// =====================================================================
// 04_app.js  —  Camera, MediaPipe, live captions, chat, practice mode
// =====================================================================
// Every frame:
//   camera -> MediaPipe landmarks -> classify() + detectMotion()
//   -> smooth -> LIVE caption (instant) -> hold timer -> sentence + speech
// Nothing is recorded or saved. Video stays inside this browser tab.
//
// SPEED NOTES (why this version is smooth):
//   * runs on requestVideoFrameCallback = only when a NEW camera frame exists
//   * caps detection at ~30 fps and never queues work
//   * only touches the page (DOM) when a value actually changed
//   * drawing the skeleton can be switched off ("Lite mode")
// =====================================================================
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
import { classify, describeHand, SHAPES, MOTIONS } from "./01_gestures.js";
import { detectMotion, resetMotion } from "./02_motion.js";
import * as Voice from "./03_speech.js";

const $ = (id) => document.getElementById(id);
const video = $("video"), overlay = $("overlay"), ctx = overlay.getContext("2d");

// ---- tiny helper: only write to the page when the value changed ----
function setText(el, value) { if (el._v !== value) { el._v = value; el.textContent = value; } }

// ---- settings and state ----
const SMOOTH_FRAMES = 4;      // majority vote (lower = faster, higher = steadier)
const MIN_INTERVAL = 30;      // ms between detections (~33 fps max)
const MOTION_LATCH = 1200;    // how long a "Hello/Yes/No" stays on screen
let landmarker = null, running = false;
let sentence = "";
let recent = [];              // last few frame results
let candidate = null, holdStart = 0, armed = true;
let motionKey = null, motionUntil = 0, suppressUntil = 0;
let lastRun = 0, frames = 0, lastFpsTime = 0, slowSeconds = 0;

const mode = () => document.querySelector('input[name="mode"]:checked').value;

// Skeleton lines for the hand drawing
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
];

// ------------------------------------------------------------------
// What does a shape (or motion) type in the current mode?
//   key = "five", "stop"...  (still shape)   or   "m:wave"... (moving sign)
// ------------------------------------------------------------------
function outputFor(key) {
  if (!key) return null;
  if (key.startsWith("m:")) return mode() === "words" ? MOTIONS[key.slice(2)].word : null;
  const s = SHAPES[key];
  if (mode() === "words") return s.word === false ? null : (s.word ?? s.letter);
  return s.letter;
}
function isWordOutput(key) {
  if (key.startsWith("m:")) return true;
  return mode() === "words" && !!SHAPES[key].word;
}
function hintFor(key) {
  return key.startsWith("m:") ? MOTIONS[key.slice(2)].hint : SHAPES[key].hint;
}

// ------------------------------------------------------------------
// Sentence + speech
// ------------------------------------------------------------------
function renderSentence() {
  const el = $("sentence");
  el.textContent = sentence || "Your sentence appears here";
  el.classList.toggle("empty", !sentence);
}
function commit(text, isWord) {
  if (isWord) {
    if (sentence && !sentence.endsWith(" ")) sentence += " ";
    sentence += text + " ";
  } else {
    sentence += text;           // letters join to spell a word
  }
  renderSentence();
  if ($("autoSpeak").checked) Voice.speak(text);  // spoken as soon as it is typed
}

// ------------------------------------------------------------------
// Chat (two-way conversation log, lives only on this page)
// ------------------------------------------------------------------
function addBubble(who, text) {
  if (!text) return;
  const b = document.createElement("div");
  b.className = "bubble " + who;                 // "me" = signed, "them" = spoken
  b.textContent = text;                          // textContent = safe, no HTML injection
  $("chat").appendChild(b);
  $("chat").scrollTop = $("chat").scrollHeight;
  $("chatEmpty").hidden = true;
}

// Quick phrases (useful in emergencies: one tap = spoken aloud + shown in chat)
const PHRASES = [
  "I am deaf. Please speak slowly and face me.",
  "I need help.",
  "Please call my family.",
  "Thank you.",
  "Please write it down.",
  "I don't understand.",
];
function buildPhrases() {
  for (const p of PHRASES) {
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.addEventListener("click", () => { addBubble("me", p); Voice.speak(p); });
    $("phrases").appendChild(btn);
  }
}

// ------------------------------------------------------------------
// Sign guide
// ------------------------------------------------------------------
function buildGuide() {
  const list = $("guide");
  for (const id in SHAPES) {
    const s = SHAPES[id];
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="g-word">${s.word || "—"}</span><span class="g-letter">${s.letter ?? "—"}</span>` +
      `<span class="g-hint">${s.hint}</span>`;
    list.appendChild(li);
  }
  for (const id in MOTIONS) {
    const m = MOTIONS[id];
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="g-word">${m.word}</span><span class="g-letter">move</span><span class="g-hint">${m.hint}</span>`;
    list.appendChild(li);
  }
}

// ------------------------------------------------------------------
// Practice mode: learn signs with instant feedback
// ------------------------------------------------------------------
const practice = { on: false, key: null, since: 0, lockUntil: 0, score: 0 };
function practicePool() {
  const keys = Object.keys(SHAPES).filter((k) => outputFor(k));
  if (mode() === "words") for (const m in MOTIONS) keys.push("m:" + m);
  return keys;
}
function nextTarget() {
  const pool = practicePool().filter((k) => k !== practice.key);
  practice.key = pool[Math.floor(Math.random() * pool.length)];
  practice.since = 0;
  practice.lockUntil = 0;
  $("pTarget").textContent = outputFor(practice.key);
  $("pHint").textContent = hintFor(practice.key);
  $("pMsg").textContent = "";
}
function practiceCheck(key, now) {
  if (now < practice.lockUntil) return;
  if (key === practice.key) {
    if (!practice.since) practice.since = now;
    if (now - practice.since >= 350) {            // held the right sign for 0.35 s
      practice.score++;
      $("pScore").textContent = practice.score;
      $("pMsg").textContent = "Correct!";
      practice.lockUntil = now + 1200;
      setTimeout(nextTarget, 1200);
    }
  } else {
    practice.since = 0;
  }
}
$("practiceBtn").addEventListener("click", () => {
  practice.on = !practice.on;
  $("practiceBox").hidden = !practice.on;
  $("practiceBtn").textContent = practice.on ? "Stop practice" : "Start practice";
  if (practice.on) { practice.score = 0; $("pScore").textContent = "0"; nextTarget(); }
});

// ------------------------------------------------------------------
// Start-up: load the model, then the camera
// ------------------------------------------------------------------
async function start() {
  $("startBtn").disabled = true;
  try {
    setText($("status"), "Step 1 of 3: loading engine…");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    setText($("status"), "Step 2 of 3: loading hand model…");
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 1,                 // one hand = fastest
    });
    try { landmarker = await make("GPU"); } catch { landmarker = await make("CPU"); }

    setText($("status"), "Step 3 of 3: allow the camera when asked.");
    const stream = await navigator.mediaDevices.getUserMedia({
      // a smaller picture = much less work per frame = no lag
      video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    document.querySelector(".hint-empty").hidden = true;

    // warm-up: the very first detection is slow, so do it before the user signs
    try { landmarker.detectForVideo(video, performance.now()); } catch {}

    running = true;
    lastFpsTime = performance.now();
    $("startBtn").textContent = "Camera on";
    setText($("status"), "Ready. Show a sign.");
    schedule();
  } catch (err) {
    console.error(err);
    $("startBtn").disabled = false;
    setText($("status"), err.name === "NotAllowedError"
      ? "Camera blocked. Click the camera icon in the address bar, allow it, and press Start again."
      : "Could not start: " + err.message);
  }
}

// ------------------------------------------------------------------
// Main loop
// ------------------------------------------------------------------
function schedule() {
  if (!running) return;
  if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(tick);
  else requestAnimationFrame(tick);
}
function tick() {
  const now = performance.now();
  if (now - lastRun >= MIN_INTERVAL) {              // skip frames if we are ahead
    lastRun = now;
    try {
      const result = landmarker.detectForVideo(video, now);
      const lm = result.landmarks && result.landmarks[0];
      if (!$("lite").checked) { ctx.clearRect(0, 0, overlay.width, overlay.height); if (lm) drawHand(lm); }
      handleFrame(lm || null, now);
      if ($("debug").checked) showDebug(lm);
    } catch (e) { console.error(e); }
    trackSpeed(now);
  }
  schedule();
}

// Show frames-per-second; if it stays low, switch on Lite mode automatically
function trackSpeed(now) {
  frames++;
  if (now - lastFpsTime >= 1000) {
    const fps = Math.round(frames * 1000 / (now - lastFpsTime));
    setText($("fps"), fps + " fps");
    slowSeconds = fps < 12 ? slowSeconds + 1 : 0;
    if (slowSeconds >= 3 && !$("lite").checked) {
      $("lite").checked = true;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      setText($("status"), "Running slowly, so Lite mode was turned on. Close other tabs for more speed.");
    }
    frames = 0; lastFpsTime = now;
  }
}

// ------------------------------------------------------------------
// Per-frame logic: smooth -> motion -> live caption -> hold -> commit
// ------------------------------------------------------------------
function handleFrame(lm, now) {
  const raw = lm ? classify(lm) : null;

  // 1) smoothing: majority vote over the last few frames
  recent.push(raw);
  if (recent.length > SMOOTH_FRAMES) recent.shift();
  const counts = new Map();
  for (const r of recent) counts.set(r, (counts.get(r) || 0) + 1);
  let best = null, bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  const stable = bestN >= Math.ceil(SMOOTH_FRAMES / 2) ? best : null;

  // 2) moving signs (Words mode only)
  if (!lm) resetMotion();
  else if (mode() === "words") {
    const m = detectMotion(raw, lm, now);
    if (m) {
      motionKey = "m:" + m;
      motionUntil = now + MOTION_LATCH;
      suppressUntil = motionUntil + 700;     // ignore the still pose that ends a wave
    }
  }
  const key = now < motionUntil ? motionKey : (now < suppressUntil ? null : stable);

  // 3) hold timer restarts whenever the sign changes
  if (key !== candidate) { candidate = key; holdStart = now; armed = true; }

  // 4) LIVE caption: shown instantly, no waiting
  const out = outputFor(key);
  setText($("liveCaption"), out || "");
  if (practice.on) practiceCheck(key, now);

  if (!key || !out) {
    setText($("readout"), "…");
    setText($("readoutSub"), key ? "Not used in this mode" : (lm ? "Looking…" : "No hand"));
    setRing(0);
    return;
  }
  setText($("readout"), out);
  setText($("readoutSub"), hintFor(key));

  // 5) hold long enough -> add to sentence + speak (moving signs are instant)
  const need = key.startsWith("m:") ? 0 : Number($("holdSlider").value);
  const progress = need === 0 ? 1 : Math.min(1, (now - holdStart) / need);
  setRing(armed ? progress : 1);
  if (!practice.on && armed && progress >= 1) {
    commit(out, isWordOutput(key));
    armed = false;                          // must change sign (or drop hand) to repeat
  }
}

let lastRing = -1;
function setRing(p) {
  const r = Math.round(p * 50) / 50;        // 2% steps = fewer page updates
  if (r === lastRing) return;
  lastRing = r;
  $("ring").style.setProperty("--p", r);
  $("ring").classList.toggle("done", r >= 1);
}

function drawHand(lm) {
  const w = overlay.width, h = overlay.height;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(110, 231, 208, 0.9)";
  ctx.beginPath();                          // ONE path for all lines = faster
  for (const [a, b] of CONNECTIONS) { ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); }
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3.5, 0, 6.283); ctx.fill(); }
}

function showDebug(lm) {
  if (!lm) { setText($("debugOut"), "No hand"); return; }
  const d = describeHand(lm);
  setText($("debugOut"),
    `index:${d.index}  middle:${d.middle}  ring:${d.ring}  pinky:${d.pinky}\n` +
    `thumbOut:${d.thumbOut}  pinch:${d.pinch}  spread:${d.spread}  thumb:${d.thumbDir}`);
}

// ------------------------------------------------------------------
// Buttons and settings
// ------------------------------------------------------------------
$("startBtn").addEventListener("click", start);
$("speakBtn").addEventListener("click", () => Voice.speak(sentence.trim()));
$("sendBtn").addEventListener("click", () => { addBubble("me", sentence.trim()); sentence = ""; renderSentence(); });
$("spaceBtn").addEventListener("click", () => { sentence += " "; renderSentence(); });
$("backBtn").addEventListener("click", () => { sentence = sentence.slice(0, -1); renderSentence(); });
$("clearBtn").addEventListener("click", () => { sentence = ""; renderSentence(); Voice.stopSpeaking(); });
$("copyBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(sentence.trim()); setText($("status"), "Copied."); }
  catch { setText($("status"), "Copy was blocked by the browser."); }
});
$("holdSlider").addEventListener("input", () => { $("holdVal").textContent = ($("holdSlider").value / 1000).toFixed(1) + " s"; });
$("debug").addEventListener("change", () => { $("debugPanel").hidden = !$("debug").checked; });
$("lite").addEventListener("change", () => { if ($("lite").checked) ctx.clearRect(0, 0, overlay.width, overlay.height); });
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => { candidate = null; recent = []; resetMotion(); if (practice.on) nextTarget(); })
);

// Voice picker + speed
Voice.loadVoices((voices) => {
  const sel = $("voiceSel");
  sel.innerHTML = "";
  voices.forEach((v) => {
    const o = document.createElement("option");
    o.value = v.name; o.textContent = `${v.name} (${v.lang})`;
    sel.appendChild(o);
  });
  const en = voices.find((v) => v.lang.startsWith("en"));   // prefer an English voice
  if (en) { sel.value = en.name; Voice.setVoice(en.name); }
});
$("voiceSel").addEventListener("change", (e) => Voice.setVoice(e.target.value));
$("rateSlider").addEventListener("input", (e) => Voice.setRate(Number(e.target.value)));
$("testVoice").addEventListener("click", () => Voice.speak("Hello. SignBridge is ready."));

// Two-way: the other person speaks -> live captions + chat bubbles
const listener = Voice.listeningSupported ? Voice.createListener({
  onInterim: (t) => { $("captions").textContent = t || "Listening…"; },
  onFinal: (t) => { addBubble("them", t); $("captions").textContent = "Listening…"; },
  onState: (on) => { $("listenBtn").textContent = on ? "Stop listening" : "Start listening"; if (!on) $("captions").textContent = ""; },
}) : null;
if (!listener) { $("listenBtn").disabled = true; $("listenBtn").title = "Not supported here. Use Chrome or Edge."; }
$("listenBtn").addEventListener("click", () => {
  if (!listener) return;
  $("listenBtn").textContent === "Stop listening" ? listener.stop() : listener.start();
});

// Offline support: caches the app after the first visit
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// ---- first paint ----
buildGuide();
buildPhrases();
renderSentence();
