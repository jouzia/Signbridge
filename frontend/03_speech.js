// =====================================================================
// 03_speech.js  —  Speech OUT (text -> voice) and speech IN (voice -> text)
// =====================================================================
// Uses the browser's built-in Web Speech API: free, no server, no keys.
// =====================================================================

let voices = [];
let chosenVoice = null;
let rate = 1;

// ---------- Speech OUT ----------
// Voices load asynchronously in most browsers, so we listen for changes.
export function loadVoices(onReady) {
  if (!("speechSynthesis" in window)) return;
  const refresh = () => { voices = window.speechSynthesis.getVoices(); onReady(voices); };
  refresh();
  window.speechSynthesis.onvoiceschanged = refresh;
}
export function setVoice(name) { chosenVoice = voices.find((v) => v.name === name) || null; }
export function setRate(r) { rate = r; }

// Words are QUEUED (not cancelled) so fast signing never cuts a word off.
export function speak(text) {
  if (!text || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  if (chosenVoice) { u.voice = chosenVoice; u.lang = chosenVoice.lang; } else { u.lang = "en-US"; }
  u.rate = rate;
  window.speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ---------- Speech IN ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const listeningSupported = !!SR;

// Returns { start(), stop() }. Chrome ends recognition after a pause,
// so we restart automatically while the user still wants it on.
export function createListener({ onInterim, onFinal, onState }) {
  let rec = null;
  let wanted = false;

  function begin() {
    rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) onFinal(text.trim()); else interim += text;
      }
      onInterim(interim);
    };
    rec.onend = () => { if (wanted) setTimeout(begin, 250); else onState(false); };
    rec.onerror = (e) => { if (e.error === "not-allowed") { wanted = false; onState(false); } };
    try { rec.start(); onState(true); } catch { /* already started */ }
  }
  return {
    start() { wanted = true; begin(); },
    stop() { wanted = false; if (rec) rec.stop(); onState(false); },
  };
}
