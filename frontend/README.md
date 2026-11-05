### SignBridge 

**Sign Language → Text & Speech, Right in Your Browser**

> *Free. Zero Installation. Private by Design.*

---

**SignBridge** is a web-based, real-time sign language translation platform engineered to break communication barriers between deaf, hard-of-hearing, and hearing individuals. Operating entirely client-side inside modern browsers, SignBridge processes webcam video feeds locally without storing, recording, or transmitting video frames—ensuring 100% data privacy.

```text
 ┌────────────────┐      ┌─────────────────────────┐      ┌────────────────────────┐      ┌─────────────────┐
 │  Webcam Feed   │ ───► │  MediaPipe Vision (3D)  │ ───► │ 01_gestures.js / Rules │ ───► │ Web Speech API  │
 │  (Client-Side) │      │  21 Hand Keypoints      │      │ 02_app.js / State      │      │ (Text-to-Speech)│
 └────────────────┘      └─────────────────────────┘      └────────────────────────┘      └─────────────────┘

```

---

### Core Features

* ** Zero-Setup Execution:** Runs 100% inside your web browser on standard hardware—no app downloads, server sign-ups, or hardware installation required.


* ** Privacy-First Pipeline:** Computer vision algorithms extract normalized 3D joint coordinates locally; zero video content ever leaves your machine.


* ** Two-Way Accessibility:**
* **Signing Mode:** Translates hand shapes into written text and spoken audio output.


* **Hearing Mode:** Uses real-time speech recognition to display prominent live captions over video feeds.




* ** Scale & Lighting Agnostic:** Uses normalized spatial ratios (tip-to-wrist distance versus knuckle height) to reliably recognize hand shapes regardless of lighting, skin tone, or distance from the camera.


* ** Developer-Friendly Rules:** Built on a readable, modular JavaScript rule engine (`01_gestures.js` and `02_app.js`), enabling developers to quickly define and add custom signs using built-in developer view debugging tools.



---

###  Supported Gestures & Sign Dictionary (v1)

SignBridge currently supports **16 core static gestures and fingerspelling shapes** based on standard ASL and universally recognized signs:

| Category | Supported Shapes / Signs |
| --- | --- |
| **Common Words & Phrases** | `Hello`, `Stop / B`, `I Love You`, `Good / A`, `Bad`, `Yes / S`, `You / D`, `Call Me / Y`, `Water / W`, `OK / F`, `Zero / O`, `Cup / C`

 |
| **Letters & Numbers** | `Peace / V`, `Two / U`, `L`, `I`

 |

---

###  Tech Stack

```text
Frontend Framework  │ Vanilla JavaScript (ES Modules), HTML5, CSS3
Computer Vision     │ MediaPipe Tasks Vision (21 3D Hand Landmarks)
Browser Native APIs │ Web Speech API (SpeechSynthesis & SpeechRecognition), MediaDevices API
Deployment Engine   │ Static Hosting (GitHub Pages / Local HTTP Server)
License             │ MIT License (Open-Source & Free for Personal/Commercial Use)

```
