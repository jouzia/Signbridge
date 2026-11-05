// =====================================================================
// 02_app.js  —  Camera, MediaPipe, sentence builder, speech
// =====================================================================
// Flow every frame:
//   camera frame -> MediaPipe hand landmarks -> classify() (01_gestures.js)
//   -> smooth over a few frames -> must be HELD for N ms -> added to sentence
// Nothing is recorded or saved. Video stays inside this browser tab.
// =====================================================================
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
import { classify, describeHand, SHAPES } from "./01_gestures.js";

// ---- Grab every element we need from the page ----
const $ = (id) => document.getElementById(id);
const video = $("video"), overlay = $("overlay"), ctx = overlay.getContext("2d");
const startBtn = $("startBtn"), statusEl = $("status");
const readout = $("readout"), readoutSub = $("readoutSub"), ring = $("ring");
const sentenceEl = $("sentence");
const holdSlider = $("holdSlider"), holdVal = $("holdVal");
const autoSpeak = $("autoSpeak"), debugBox = $("debug");
const listenBtn = $("listenBtn"), captions = $("captions");
const liveCaption = $("liveCaption"); // big text shown instantly over the video

// ---- App state ----
let landmarker = null;       // MediaPipe hand model
let running = false;         // camera loop on/off
let sentence = "";           // the text built from signs
let recent = [];             // last few frame results (for smoothing)
let candidate = null;        // shape currently being held
let holdStart = 0;           // when the candidate started being held
let armed = true;            // must release / change sign before the same sign can repeat
let lastSeen = 0;            // last time any hand was visible
const SMOOTH_FRAMES = 4;     // majority vote over this many frames (lower = faster, higher = steadier)

// Finger joints to draw the hand skeleton on the video
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
];

// ------------------------------------------------------------------
// Build the "signs you can use" guide from SHAPES so it never goes stale
// ------------------------------------------------------------------
function buildGuide() {
  const list = $("guide");
  list.innerHTML = "";
  for (const id in SHAPES) {
    const s = SHAPES[id];
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="g-word">${s.word ?? "—"}</span>` +
      `<span class="g-letter">${s.letter ?? "—"}</span>` +
      `<span class="g-hint">${s.hint}</span>`;
    list.appendChild(li);
  }
}

// What does this shape type in the current mode? (null = nothing)
function outputFor(shapeId) {
  if (!shapeId) return null;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const s = SHAPES[shapeId];
  // In Words mode, fall back to the letter if a shape has no word
  return mode === "words" ? (s.word ?? s.letter) : s.letter;
}

// ------------------------------------------------------------------
// Sentence editing
// ------------------------------------------------------------------
function render() {
  sentenceEl.textContent = sentence || "Your sentence appears here";
  sentenceEl.classList.toggle("empty", !sentence);
}
function speak(text) {
  if (!text || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();                       // stop any earlier speech
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}
function commit(text, isWord) {
  if (isWord) {
    if (sentence && !sentence.endsWith(" ")) sentence += " ";
    sentence += text + " ";
  } else {
    sentence += text; // letters join together to spell words
  }
  render();
  if (autoSpeak.checked) speak(text);
}

// ------------------------------------------------------------------
// Camera + model start-up
// ------------------------------------------------------------------
async function start() {
  startBtn.disabled = true;
  try {
    statusEl.textContent = "Loading hand model… (first time takes a few seconds)";
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    const opts = (delegate) => ({
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
    try { landmarker = await HandLandmarker.createFromOptions(fileset, opts("GPU")); }
    catch { landmarker = await HandLandmarker.createFromOptions(fileset, opts("CPU")); } // GPU not available

    statusEl.textContent = "Allow camera access when your browser asks.";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    document.querySelector(".hint-empty").hidden = true; // hide "Camera is off"
    running = true;
    startBtn.textContent = "Camera on";
    statusEl.textContent = "Show a sign to the camera.";
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    startBtn.disabled = false;
    statusEl.textContent =
      "Could not start: " + (err.name === "NotAllowedError"
        ? "camera permission was blocked. Allow it in the address bar and try again."
        : err.message);
  }
}

// ------------------------------------------------------------------
// Main loop — runs once per video frame
// ------------------------------------------------------------------
let lastVideoTime = -1;
function loop() {
  if (!running) return;
  if (video.currentTime !== lastVideoTime) {      // only process NEW frames
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, performance.now());
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (result.landmarks && result.landmarks.length) {
      const lm = result.landmarks[0];
      lastSeen = performance.now();
      drawHand(lm);
      handleShape(classify(lm));
      if (debugBox.checked) showDebug(describeHand(lm));
    } else {
      handleShape(null);
      if (debugBox.checked) $("debugOut").textContent = "No hand";
    }
  }
  requestAnimationFrame(loop);
}

// Smooth the noisy per-frame result, then run the "hold to type" timer
function handleShape(shapeId) {
  recent.push(shapeId);
  if (recent.length > SMOOTH_FRAMES) recent.shift();

  // majority vote across recent frames
  const counts = {};
  for (const r of recent) counts[r] = (counts[r] || 0) + 1;
  let best = null, bestN = 0;
  for (const k in counts) if (counts[k] > bestN) { best = k === "null" ? null : k; bestN = counts[k]; }
  const stable = bestN >= Math.ceil(SMOOTH_FRAMES / 2) ? best : null;

  const now = performance.now();
  const out = outputFor(stable);

  // Shape changed -> restart the timer and re-arm
  if (stable !== candidate) {
    candidate = stable;
    holdStart = now;
    armed = true;
  }

  // LIVE caption: show the translation immediately (no waiting for the hold timer)
  liveCaption.textContent = out || "";

  if (!stable || !out) {
    readout.textContent = "…";
    readoutSub.textContent = stable ? "Not used in this mode" : "No sign";
    setRing(0);
    return;
  }

  readout.textContent = out;
  readoutSub.textContent = SHAPES[stable].hint;

  const holdMs = Number(holdSlider.value);
  const progress = Math.min(1, (now - holdStart) / holdMs);
  setRing(armed ? progress : 1);

  // Held long enough -> type it once, then wait for a release/change
  if (armed && progress >= 1) {
    commit(out, document.querySelector('input[name="mode"]:checked').value === "words" && SHAPES[stable].word != null);
    armed = false;
  }
}

// Fill the progress ring (0..1)
function setRing(p) {
  ring.style.setProperty("--p", p);
  ring.classList.toggle("done", p >= 1);
}

// Draw the skeleton on top of the (mirrored) video
function drawHand(lm) {
  const w = overlay.width, h = overlay.height;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(110, 231, 208, 0.9)";
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffd166";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Developer view: shows finger states so you can tune thresholds
function showDebug(d) {
  $("debugOut").textContent =
    `index:${d.index}  middle:${d.middle}  ring:${d.ring}  pinky:${d.pinky}\n` +
    `thumbOut:${d.thumbOut}  pinch:${d.pinch}  spread:${d.spread}  thumb:${d.thumbDir}`;
}

// ------------------------------------------------------------------
// Buttons
// ------------------------------------------------------------------
startBtn.addEventListener("click", start);
$("speakBtn").addEventListener("click", () => speak(sentence.trim()));
$("clearBtn").addEventListener("click", () => { sentence = ""; render(); });
$("spaceBtn").addEventListener("click", () => { sentence += " "; render(); });
$("backBtn").addEventListener("click", () => { sentence = sentence.slice(0, -1); render(); });
$("copyBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(sentence.trim()); statusEl.textContent = "Copied."; }
  catch { statusEl.textContent = "Copy was blocked by the browser."; }
});
holdSlider.addEventListener("input", () => { holdVal.textContent = (holdSlider.value / 1000).toFixed(1) + " s"; });
debugBox.addEventListener("change", () => { $("debugPanel").hidden = !debugBox.checked; });
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => { candidate = null; recent = []; })
);

// ------------------------------------------------------------------
// Two-way conversation: hearing person speaks -> big captions on screen
// (uses the browser's built-in speech recognition; works best in Chrome/Edge)
// ------------------------------------------------------------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false;
if (!SR) {
  listenBtn.disabled = true;
  listenBtn.title = "Speech recognition is not supported in this browser (try Chrome or Edge)";
}
listenBtn.addEventListener("click", () => {
  if (!SR) return;
  if (listening) { recog.stop(); return; }
  recog = new SR();
  recog.lang = "en-US";
  recog.continuous = true;
  recog.interimResults = true;
  recog.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    captions.textContent = text;
    captions.classList.remove("empty");
  };
  recog.onend = () => { listening = false; listenBtn.textContent = "Start listening"; };
  recog.onerror = () => { listening = false; listenBtn.textContent = "Start listening"; };
  recog.start();
  listening = true;
  listenBtn.textContent = "Stop listening";
});

// ---- Initial paint ----
buildGuide();
render();
holdVal.textContent = (holdSlider.value / 1000).toFixed(1) + " s";
