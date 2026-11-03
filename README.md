SignBridge 
Sign language → text and speech, right in your browser.

Free. No install. No account. No recording. Your video never leaves your device.

SignBridge reads hand shapes through your webcam, converts them into words or letters, builds a sentence, and speaks it aloud. It also features a second mode that listens to a hearing speaker and displays large live captions for two-way communication.

What Makes It Different
Feature	Why It Matters
Runs 100% in Browser	
Zero cost, zero setup, and works on any device with a webcam.

Private by Design	
Processes only hand-point coordinates; zero video data stored or uploaded.

Two-Way Communication	
Translates signs to speech and converts spoken words into live captions.

Words & Letters Modes	
Recognizes both whole-word gestures (e.g., Hello) and individual letters (e.g., B).

Live Captions	
Displays instant translations overlaid directly on the video feed.

Hold-to-Add	
Holds a sign briefly to append it to the active sentence (adjustable hold duration).

Rule-Based Engine	
Fast execution without external heavy datasets; every rule is human-readable and editable.

Built-in Sign Guide	
Includes an interactive visual guide showing how to form supported signs.

Quick Start & Live Demo
Note: Browsers require an HTTPS connection or localhost to access the camera (file:// protocol is blocked).

Option A: GitHub Pages (Recommended)
Push this repository to GitHub.

Go to Settings → Pages.

Under Source, select Deploy from a branch → set branch to main and folder to / (root) → Save.

Launch your web app at https://<your-username>.github.io/<repo-name>/.

Option B: Run Locally
Bash
# Clone the repository
git clone https://github.com/jouzia/Signbridge.git
cd Signbridge

# Start a local HTTP server
python -m http.server 8000
Open http://localhost:8000 in your web browser.

How It Works
Plaintext
Webcam Frame
 └─ MediaPipe Hand Landmarker (21 keypoints per hand running in-browser)
     └─ 01_gestures.js (Calculates relative finger distances & ratios)
         └─ 02_app.js (Frame smoothing, hold-to-type validation, UI state)
             └─ Web Speech API (Converts final sentence string to audio output)
Finger states are evaluated using normalized coordinate ratios (distance relative to the wrist vs. knuckle height). This ensures reliable recognition regardless of hand size, distance from camera, or skin tone.

File Structure
File	Purpose
index.html	
Application markup & structural layout.

style.css	
Styling, theme, and responsive interface layout.

01_gestures.js	
Hand landmark rules, classifier, and shape dictionary.

02_app.js	
MediaPipe stream initialization, camera pipeline, hold logic, speech synthesis.

Supported Signs (v1)
Supports 16 static hand shapes based on common ASL fingerspelling and universally recognized signs:

Words / Gestures: Hello, Stop/B, I love you, Good/A, Bad, Yes/S, You/D, Call me/Y, Peace/V, Two/U, Water/W, OK/F, Zero/O, Cup/C, L, I.

Adding Custom Signs
Open the app, activate Developer view, and perform your desired hand gesture to inspect current finger coordinates.

Open 01_gestures.js.

Add a new target entry into SHAPES and declare your evaluation condition in classify().

Reload the page; the interactive on-screen sign guide will update automatically.

Limitations
Static Gestures: Version 1 detects static hand shapes rather than continuous motion signs or facial expressions.

Regional Variations: Hand shapes currently mirror standard American Sign Language (ASL) fingerspelling.

Complex Movement: Motion-dependent letters (e.g., J, Z) and intersecting finger signs (e.g., R, K) are excluded in the current release.

Browser Compatibility: Speech-to-text recognition relies on the Web Speech API (best supported on Google Chrome and Microsoft Edge).

Roadmap
[ ] Dynamic motion gesture recognition (wave for Hello, Please, Thank You).

[ ] Dual-hand landmark tracking.

[ ] Multi-language sign tables.

[ ] Lightweight custom ML classifier integration.

Tech Stack
Computer Vision: MediaPipe Tasks Vision (Hand Landmarker)

Language & Core: JavaScript (ES Modules), HTML5, CSS3

Browser APIs: Web Speech API (SpeechSynthesis & SpeechRecognition), MediaDevices API

Hosting: GitHub Pages

License
This project is licensed under the MIT License — free to use, modify, and distribute.
