# SignBridge

**Sign language → text and speech, right in your browser.**
Free. No install. No account. No recording. Your video never leaves your device.

SignBridge reads hand shapes through your webcam, turns them into words or letters,
builds a sentence, and speaks it aloud. A second mode listens to the hearing person
and shows large live captions, so both sides can talk.

## What makes it different

| Feature | Why it matters |
|---|---|
| Runs 100% in the browser | Zero cost, zero setup, works on any laptop with a webcam |
| Private by design | Only hand-point coordinates are processed, and nothing is stored or uploaded |
| Two-way conversation | Signs become speech; speech becomes captions |
| Words mode and Letters mode | One handshape can mean a word (Hello) or a letter (B) |
| Live captions | The translation appears instantly over the video as you sign |
| Hold-to-add | Hold a sign briefly to add it to the sentence; hold time is adjustable |
| Rule-based, no dataset | Works instantly; every rule is readable and editable |
| Built-in sign guide | Shows exactly how to form each supported sign |

## Try it

You need a webcam, and the page must be served over **https** or **localhost**
(browsers block cameras on plain `file://` pages).

**Option A — GitHub Pages (recommended, free):**
1. Push this folder to a GitHub repository.
2. Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main** → folder **/ (root)** → **Save**.
3. Open the link GitHub shows (`https://<your-username>.github.io/<repo>/`).

**Option B — on your computer:**
```bash
python -m http.server 8000
# then open http://localhost:8000
```

## How it works

```
Webcam frame
   └─ MediaPipe Hand Landmarker (21 points per hand, runs in-browser)
        └─ 01_gestures.js  measures finger distances → picks a hand shape
             └─ 02_app.js  smooths frames, waits for a steady hold, types it
                  └─ Web Speech API  speaks the sentence
```

A finger counts as *straight* when its tip is far from the wrist compared with its knuckle,
and as *folded* when it is close. Because this uses ratios between landmarks, it works
for different hand sizes, distances and skin tones.

## Project files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Look and layout |
| `01_gestures.js` | Hand-shape rules and the sign table |
| `02_app.js` | Camera, MediaPipe, sentence builder, speech |

## Supported signs (v1)

16 static hand shapes, based on widely used fingerspelling and common signs:
Hello, Stop/B, I love you, Good/A, Bad, Yes/S, You/D, L, I, Call me/Y, Peace/V, Two/U,
Water/W, OK/F, Zero/O, Cup/C.

## Add your own sign

1. Open the page, tick **Developer view**, and make the shape. You'll see each finger's state.
2. In `01_gestures.js`, add an entry to `SHAPES` and a rule in `classify()`.
3. Reload. The on-screen guide updates automatically.

## Honest limits

- Version 1 recognises **static hand shapes**, not full sentences or moving signs.
  Real sign languages also use motion, facial expression and both hands.
- Sign languages differ by country. The shapes here follow common ASL fingerspelling and widely understood signs.
- Letters that depend on motion (J, Z) or finger crossing (R, K) are not included yet.
- Speech captions use the browser's speech recognition, which works best in Chrome and Edge.

## Roadmap

- Motion signs (wave for Hello, Please, Thank you) using landmark trajectories
- Two-hand signs
- More languages through community-contributed sign tables
- Small neural classifier trained on public datasets to improve accuracy

## Tech

MediaPipe Tasks Vision (Hand Landmarker) · JavaScript (ES modules) · Web Speech API · GitHub Pages

## License

MIT — free to use, change and share.
