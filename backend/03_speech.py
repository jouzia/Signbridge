# =====================================================================
# 03_speech.py  -  Speech OUT (text -> voice) and speech IN (voice -> text)
# =====================================================================
# Speech OUT uses pyttsx3: free, works OFFLINE, uses your computer's voices.
# Speech IN  uses SpeechRecognition + microphone (OPTIONAL, needs internet).
# =====================================================================
import queue
import threading


class Speaker:
    """Speaks text on a background thread so the camera never freezes.
    Words are QUEUED, so fast signing never cuts a word off."""

    def __init__(self, rate=170):
        self.rate = rate
        self.ok = True
        self.q = queue.Queue()
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        # pyttsx3 must be created and used in the SAME thread
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", self.rate)
        except Exception as e:
            print("Speech output unavailable:", e)
            self.ok = False
            return
        while True:
            text = self.q.get()
            if text is None:
                break
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception as e:
                print("Speech error:", e)

    def say(self, text):
        if self.ok and text:
            self.q.put(text)

    def clear(self):
        """Drop anything still waiting to be spoken."""
        try:
            while True:
                self.q.get_nowait()
        except queue.Empty:
            pass

    def close(self):
        self.q.put(None)


class Listener:
    """Listens to the microphone and sends recognised sentences to on_text().
    Optional: if SpeechRecognition / PyAudio are not installed, available = False."""

    def __init__(self, on_text):
        self.on_text = on_text
        self.stop_fn = None
        self.available = True
        try:
            import speech_recognition as sr
            self.sr = sr
        except Exception:
            self.available = False

    @property
    def running(self):
        return self.stop_fn is not None

    def start(self):
        if not self.available or self.running:
            return False
        try:
            self.recognizer = self.sr.Recognizer()
            mic = self.sr.Microphone()
            with mic as source:   # learn the background noise level first
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
            # runs on its own thread; calls self._callback for every phrase heard
            self.stop_fn = self.recognizer.listen_in_background(mic, self._callback, phrase_time_limit=8)
            return True
        except Exception as e:
            print("Microphone unavailable:", e)
            self.available = False
            return False

    def _callback(self, recognizer, audio):
        try:
            text = recognizer.recognize_google(audio)   # free Google web recogniser (needs internet)
            self.on_text(text)
        except self.sr.UnknownValueError:
            pass                                        # nothing understood, ignore
        except Exception:
            self.on_text("(speech service unavailable, check internet)")

    def stop(self):
        if self.stop_fn:
            self.stop_fn(wait_for_stop=False)
            self.stop_fn = None
