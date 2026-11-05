# SignBridge (Python)

**Sign language → live text and speech, in real time, on your computer.**
Free. Works offline. No recording. Your video never leaves your machine.

Show a hand sign to the webcam. The translation appears instantly on screen and is spoken aloud.

## Features

| Feature | What it does |
|---|---|
| **Live text** | Big caption appears the moment you sign |
| **Live speech** | Each sign is spoken out loud (offline voice, no internet needed) |
| **Moving signs** | Wave = Hello, nod a fist = Yes, shake a finger = No |
| **Words and Letters modes** | One hand shape can mean a word or a fingerspelled letter |
| **Sentence builder** | Hold a sign briefly to add it; speak the whole sentence anytime |
| **Two-way listening** | Optional: the other person's voice shows as captions (press `L`) |
| **Practice mode** | Learn signs: copy the sign shown and get a score |
| **Fast** | Lightweight hand model, background speech thread, Lite mode |
| **Private** | Only hand-point coordinates are processed; nothing is saved |

## Install (Windows)

You need **Python 3.10, 3.11 or 3.12** and a webcam.

```bash
cd signbridge_py
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python 04_app.py
```

Optional microphone captions:
```bash
pip install SpeechRecognition PyAudio
```

## Keys

| Key | Action |
|---|---|
| `M` | Switch Words / Letters mode |
| `S` | Speak the whole sentence |
| `C` | Clear sentence |
| `Backspace` | Delete last character |
| `Space` | Add a space |
| `P` | Practice mode on/off |
| `L` | Listen to microphone on/off (optional) |
| `V` | Lite mode (hides hand drawing, faster) |
| `[` and `]` | Shorter / longer hold time |
| `Q` or `Esc` | Quit |

## How it works

```
Webcam frame
  └─ MediaPipe Hands (21 landmarks)
       ├─ 01_gestures.py  finger distances → hand shape
       ├─ 02_motion.py    1.2 s of movement → wave / nod / shake
       └─ 04_app.py       smoothing → live caption → hold timer → sentence
            └─ 03_speech.py  text → voice (pyttsx3), voice → captions (optional)
```

A finger counts as straight when its tip is far from the wrist compared with its knuckle.
It uses ratios between landmarks, so it works for different hand sizes, distances and skin tones.

## Files

| File | Purpose |
|---|---|
| `01_gestures.py` | Hand-shape rules and the sign table |
| `02_motion.py` | Moving-sign detection |
| `03_speech.py` | Speech out and speech in |
| `04_app.py` | Camera window, live captions, keys, practice |
| `requirements.txt` | Libraries to install |

## Supported signs

Still: Five, Stop/B, I love you, Good/A, Bad, You/D, L, I, Call me/Y, Peace/V, Two/U, Water/W, OK/F, Zero/O, Cup/C, S.
Moving: Hello (wave), Yes (nod), No (shake).

## Add your own sign

1. Add an entry to `SHAPES` in `01_gestures.py`.
2. Add a rule in `classify()`. Order matters: the first match wins.
3. Run again. Tune `THRESH` at the top of the file if detection feels too strict.

## Troubleshooting

- **Black or no camera:** close apps using the webcam (Zoom, Teams), then run again.
- **Slow:** press `V` for Lite mode, close other apps, face a lamp or window.
- **No voice:** check your Windows sound output; pyttsx3 uses the built-in Windows voices.
- **Press keys with the video window selected**, not the terminal.

## Honest limits

- A small set of still shapes plus three moving signs, not full sentences.
- Real sign languages also use facial expression, both hands and grammar.
- Sign languages differ by country. Shapes follow common ASL fingerspelling and widely understood signs.
- Letters needing motion (J, Z) or finger crossing (R, K) are not included yet.
- Microphone captions use a free web recogniser and need internet.

## Roadmap

- Two-hand signs and more moving signs
- A small neural classifier trained on public datasets for higher accuracy
- Packaging as a one-click Windows app

## License

MIT
