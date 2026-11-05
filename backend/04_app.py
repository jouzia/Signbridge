# =====================================================================
# 04_app.py  -  SignBridge (Python): camera, live captions, speech
# =====================================================================
# Run:  python 04_app.py
# Every frame:
#   camera -> MediaPipe landmarks -> classify() + MotionDetector
#   -> smooth -> LIVE caption (instant) -> hold timer -> sentence + speech
# Nothing is recorded or saved. Video never leaves your computer.
#
# Keys:  M mode | S speak | C clear | BACKSPACE delete | SPACE add space
#        P practice | L listen (mic) | V lite mode | [ ] hold time | Q quit
# =====================================================================
import importlib
import platform
import random
import textwrap
import time

import cv2
import mediapipe as mp

# Python can't "import 01_gestures" (names can't start with a digit),
# so we load the numbered files with importlib instead.
G = importlib.import_module("01_gestures")
M = importlib.import_module("02_motion")
S = importlib.import_module("03_speech")

SMOOTH_FRAMES = 4        # majority vote over this many frames
MOTION_LATCH = 1200      # ms a "Hello / Yes / No" stays on screen
WINDOW = "SignBridge  (Q to quit)"

# Hand skeleton lines (pairs of landmark numbers)
CONNECTIONS = [
    (0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),
    (9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17),
]
MINT, SUN, WHITE, GREY = (208, 231, 110), (102, 209, 255), (255, 255, 255), (170, 170, 170)  # BGR colours


def put_text(img, text, org, scale=0.7, color=WHITE, thick=2):
    """Text with a dark outline so it is readable on any background."""
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thick + 3, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


class App:
    def __init__(self):
        self.mode = "words"            # "words" or "letters"
        self.sentence = ""
        self.hold_ms = 500             # hold a sign this long to add it
        self.lite = False              # True = skip drawing the skeleton (faster)
        self.recent = []               # last few frame results
        self.candidate = None          # sign currently being held
        self.hold_start = 0
        self.armed = True              # must change sign to repeat the same one
        self.motion = M.MotionDetector()
        self.motion_key = None
        self.motion_until = 0
        self.suppress_until = 0
        self.progress = 0.0
        self.live = ""                 # live caption text
        self.hint = ""
        self.heard = ""                # last thing the other person said (mic)
        # practice mode
        self.practice_on = False
        self.p_key = None
        self.p_since = 0
        self.p_lock = 0
        self.p_score = 0
        self.p_msg = ""
        self.next_after = 0            # when to move to the next practice target
        # speech
        self.speaker = S.Speaker()
        self.listener = S.Listener(self.on_heard)

    # ---------- what does a shape / motion type in the current mode? ----------
    def output_for(self, key):
        if key is None:
            return None
        if key.startswith("m:"):
            return G.MOTIONS[key[2:]]["word"] if self.mode == "words" else None
        s = G.SHAPES[key]
        if self.mode == "words":
            if s["word"] is False:
                return None
            return s["word"] or s["letter"]
        return s["letter"]

    def is_word(self, key):
        return key.startswith("m:") or (self.mode == "words" and bool(G.SHAPES[key]["word"]))

    def hint_for(self, key):
        return G.MOTIONS[key[2:]]["hint"] if key.startswith("m:") else G.SHAPES[key]["hint"]

    # ---------- sentence + speech ----------
    def commit(self, text, is_word):
        if is_word:
            if self.sentence and not self.sentence.endswith(" "):
                self.sentence += " "
            self.sentence += text + " "
        else:
            self.sentence += text          # letters join to spell a word
        self.speaker.say(text)             # spoken as soon as it is typed

    def on_heard(self, text):              # called from the microphone thread
        self.heard = text

    # ---------- practice mode ----------
    def next_target(self):
        pool = [k for k in G.SHAPES if self.output_for(k)]
        if self.mode == "words":
            pool += ["m:" + m for m in G.MOTIONS]
        pool = [k for k in pool if k != self.p_key]
        self.p_key = random.choice(pool)
        self.p_since, self.p_lock, self.p_msg = 0, 0, ""

    def practice_check(self, key, now):
        if now < self.p_lock:
            return
        if key == self.p_key:
            if not self.p_since:
                self.p_since = now
            if now - self.p_since >= 350:        # held the right sign for 0.35 s
                self.p_score += 1
                self.p_msg = "Correct!"
                self.p_lock = now + 1200
                self.next_after = now + 1200
        else:
            self.p_since = 0

    # ---------- per-frame logic ----------
    def handle_frame(self, lm, now):
        raw = G.classify(lm) if lm else None

        # 1) smoothing: majority vote over the last few frames
        self.recent.append(raw)
        self.recent = self.recent[-SMOOTH_FRAMES:]
        best = max(set(self.recent), key=self.recent.count)
        stable = best if self.recent.count(best) >= (SMOOTH_FRAMES + 1) // 2 else None

        # 2) moving signs (words mode only)
        if lm is None:
            self.motion.reset()
        elif self.mode == "words":
            m = self.motion.detect(raw, lm, now)
            if m:
                self.motion_key = "m:" + m
                self.motion_until = now + MOTION_LATCH
                self.suppress_until = self.motion_until + 700   # ignore the pose that ends a wave
        key = self.motion_key if now < self.motion_until else (None if now < self.suppress_until else stable)

        # 3) hold timer restarts whenever the sign changes
        if key != self.candidate:
            self.candidate, self.hold_start, self.armed = key, now, True

        # practice: move to the next target after the "Correct!" pause
        if self.practice_on:
            if self.next_after and now >= self.next_after:
                self.next_after = 0
                self.next_target()
            self.practice_check(key, now)

        # 4) LIVE caption: shown instantly
        out = self.output_for(key)
        self.live = out or ""
        if not key or not out:
            self.progress, self.hint = 0.0, ("Not used in this mode" if key else ("Looking..." if lm else "No hand"))
            return
        self.hint = self.hint_for(key)

        # 5) hold long enough -> add to sentence + speak (moving signs are instant)
        need = 0 if key.startswith("m:") else self.hold_ms
        self.progress = 1.0 if need == 0 else min(1.0, (now - self.hold_start) / need)
        if not self.practice_on and self.armed and self.progress >= 1.0:
            self.commit(out, self.is_word(key))
            self.armed = False

    # ---------- keyboard ----------
    def key(self, k):
        if k in (ord("m"), ord("M")):
            self.mode = "letters" if self.mode == "words" else "words"
            self.candidate, self.recent = None, []
            self.motion.reset()
            if self.practice_on:
                self.next_target()
        elif k in (ord("s"), ord("S")):
            self.speaker.say(self.sentence.strip())
        elif k in (ord("c"), ord("C")):
            self.sentence = ""
            self.speaker.clear()
        elif k == 8:                                   # backspace
            self.sentence = self.sentence[:-1]
        elif k == 32:                                  # space bar
            self.sentence += " "
        elif k in (ord("p"), ord("P")):
            self.practice_on = not self.practice_on
            if self.practice_on:
                self.p_score = 0
                self.next_target()
        elif k in (ord("v"), ord("V")):
            self.lite = not self.lite
        elif k in (ord("l"), ord("L")):
            if not self.listener.available:
                self.heard = "(Mic not available. Install SpeechRecognition + PyAudio)"
            elif self.listener.running:
                self.listener.stop()
                self.heard = ""
            elif self.listener.start():
                self.heard = "Listening..."
        elif k == ord("["):
            self.hold_ms = max(200, self.hold_ms - 100)
        elif k == ord("]"):
            self.hold_ms = min(2000, self.hold_ms + 100)

    # ---------- drawing ----------
    def draw(self, frame, lm, fps):
        h, w = frame.shape[:2]
        if lm is not None and not self.lite:
            pts = [(int(p.x * w), int(p.y * h)) for p in lm]
            for a, b in CONNECTIONS:
                cv2.line(frame, pts[a], pts[b], MINT, 2, cv2.LINE_AA)
            for p in pts:
                cv2.circle(frame, p, 3, SUN, -1, cv2.LINE_AA)

        # top-left: mode, hold time, fps
        put_text(frame, f"{self.mode.upper()}  hold {self.hold_ms/1000:.1f}s  {fps:.0f} fps" + ("  LITE" if self.lite else ""),
                 (10, 24), 0.55, GREY, 1)

        # top: the sentence (last 2 lines)
        lines = textwrap.wrap(self.sentence, 36)[-2:] or ["(your sentence appears here)"]
        for i, line in enumerate(lines):
            put_text(frame, line, (10, 56 + i * 32), 0.9, WHITE if self.sentence else GREY, 2)

        # practice panel
        if self.practice_on and self.p_key:
            put_text(frame, f"PRACTICE  score {self.p_score}", (10, 140), 0.65, SUN, 2)
            put_text(frame, f"Make: {self.output_for(self.p_key)}", (10, 172), 0.9, SUN, 2)
            put_text(frame, self.hint_for(self.p_key), (10, 198), 0.5, GREY, 1)
            if self.p_msg:
                put_text(frame, self.p_msg, (10, 230), 0.9, MINT, 2)

        # what the other person said (microphone)
        if self.heard:
            put_text(frame, "Them: " + self.heard[-50:], (10, h - 110), 0.65, SUN, 2)

        # bottom: BIG live caption + hold bar + hint
        if self.live:
            scale = 1.8
            while cv2.getTextSize(self.live, cv2.FONT_HERSHEY_SIMPLEX, scale, 3)[0][0] > w - 20 and scale > 0.6:
                scale -= 0.1
            tw = cv2.getTextSize(self.live, cv2.FONT_HERSHEY_SIMPLEX, scale, 3)[0][0]
            put_text(frame, self.live, ((w - tw) // 2, h - 55), scale, MINT, 3)
            cv2.rectangle(frame, (10, h - 42), (10 + int((w - 20) * self.progress), h - 34), SUN, -1)
        put_text(frame, self.hint, (10, h - 12), 0.5, GREY, 1)


def open_camera(index=0):
    """Open the webcam. DirectShow starts much faster on Windows."""
    backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
    cap = cv2.VideoCapture(index, backend)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # smaller buffer = less delay
    return cap


def main():
    cap = open_camera()
    if not cap.isOpened():
        print("Could not open the camera. Close other apps that use it and try again.")
        return
    app = App()
    last, fps = time.time(), 0.0

    # model_complexity=0 is the fast model; one hand is enough
    with mp.solutions.hands.Hands(max_num_hands=1, model_complexity=0,
                                  min_detection_confidence=0.6, min_tracking_confidence=0.5) as hands:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)                       # mirror: feels like a mirror
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False                      # lets MediaPipe skip a copy = faster
            result = hands.process(rgb)
            lm = result.multi_hand_landmarks[0].landmark if result.multi_hand_landmarks else None

            now = time.time() * 1000
            app.handle_frame(lm, now)

            t = time.time()
            fps = 0.9 * fps + 0.1 / max(t - last, 1e-6)      # smoothed frames per second
            last = t
            app.draw(frame, lm, fps)
            cv2.imshow(WINDOW, frame)

            k = cv2.waitKey(1) & 0xFF
            if k in (ord("q"), ord("Q"), 27):                # Q or Esc
                break
            if k != 255:
                app.key(k)

    app.listener.stop()
    app.speaker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
