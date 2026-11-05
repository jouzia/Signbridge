
#  SignBridge: Real-Time Sign Language to Text & Speech Translator

> **Submission Topic:** Future Tech: FT-04 - Sign Language to Text/Speech Translator  
> **Live Demo:** [signbridge-omega-seven.vercel.app](https://signbridge-omega-seven.vercel.app)

---

##  Creators & Team
* **Shaik Jouzia Afreen H** (Lead Developer & Computer Vision Architecture)[cite: 4]
* **Mufidah Mehnaz MZ** (UI/UX Design & Speech Engine Integration)[cite: 4]
* **Santhorhini T** (Feature Testing, Gesture Rule Logic & QA)[cite: 4]

---

##  Overview
**SignBridge** is a privacy-first, zero-backend translation platform designed to bridge the communication gap between sign language users and hearing individuals[cite: 4]. By combining high-performance browser-based computer vision with a Python desktop implementation, SignBridge converts hand gestures into written text and natural spoken voice in real-time.

---

##  Repository Structure

```text
Signbridge/
├── frontend/           # Progressive Web App (PWA) client-side application
│   ├── index.html      # Main UI and layout
│   ├── style.css       # High-contrast dark mode & glassmorphism styling
│   ├── sw.js           # Service Worker for offline caching & PWA support
│   ├── manifest.webmanifest # PWA app manifest
│   ├── 01_gestures.js  # Static hand shape & ratio classification
│   ├── 02_motion.js    # Sliding window dynamic motion tracking
│   ├── 03_speech.js    # Web Speech API (TTS & STT live captions)
│   └── 04_app.py / .js # Application controller & camera pipeline
│
├── backend/            # Python desktop & analytical implementation
│   ├── 01_gestures.py  # Spatial ratio calculation rules
│   ├── 02_motion.py    # Trajectory tracking engine
│   ├── 03_speech.py    # Audio & speech synthesis modules
│   ├── 04_app.py       # OpenCV & MediaPipe desktop loop
│   └── requirements.txt# Python dependency list
│
└── README.md

```

---

##  Key Features

* **Real-Time Hand Landmark Tracking:** Powered by Google MediaPipe to track 21 3D hand keypoints simultaneously.


* **Static & Dynamic Gestures:** Recognizes both fixed alphabet/word signs and dynamic trajectory gestures (e.g., waving, sweeping).


* **Two-Way Communication:** Translates sign language into text/speech, and converts spoken audio into live visual captions.


* **100% Privacy-First:** All video frames are processed locally inside your browser or device memory. No video streams are ever recorded or uploaded to an external server.


* **Offline PWA Support:** Built-in Service Workers allow the web app to be installed and run seamlessly even without an active internet connection.



---

##  Getting Started & Execution

### Option A: Run the Web Frontend (PWA)

1. Navigate to the `frontend/` directory.
2. Open `index.html` directly in your browser or run a local server:
```bash
python -m http.server 8000

```


3. Visit `http://localhost:8000` in your browser.



### Option B: Run the Python Backend Application

1. Navigate to the `backend/` directory:
```bash
cd backend

```


2. Create and activate a virtual environment:
```bash
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Mac/Linux:
source .venv/bin/activate

```


3. Install dependencies:
```bash
pip install -r requirements.txt

```


4. Run the application script:
```bash
python 04_app.py

```



---

##  Technology Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules), Service Workers


* **Computer Vision:** Google MediaPipe (Hand Landmarker Model)


* **Speech & Audio:** Web Speech API (SpeechSynthesis & SpeechRecognition) / PyTTSx3


* **Backend & Environment:** Python, OpenCV, FastAPI, Vercel & GitHub Pages Deployment



---

##  License

Released under the [MIT License](https://www.google.com/search?q=LICENSE).

```

---

### How to add this README to your repo:
1. Inside your `signbridge` folder, replace or update your `README.md` file with the markdown text above.
2. Run these commands in your terminal to save and push it to GitHub:
   ```powershell
   git add README.md
   git commit -m "Update comprehensive project README with team and architecture details"
   git push origin main

```
