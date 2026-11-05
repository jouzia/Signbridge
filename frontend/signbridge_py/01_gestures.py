# =====================================================================
# 01_gestures.py  -  Hand-shape classifier (rule-based, no training data)
# =====================================================================
# MediaPipe gives 21 landmarks per hand. We never look at pixels here,
# only at DISTANCES between landmarks. That keeps it tiny, fast, and
# independent of skin tone, lighting and camera resolution.
#
# Landmark numbers (MediaPipe Hands):
#   0 = wrist
#   thumb : 1,2,3,4      (4 = tip)
#   index : 5,6,7,8      (5 = knuckle, 8 = tip)
#   middle: 9,10,11,12
#   ring  : 13,14,15,16
#   pinky : 17,18,19,20
# =====================================================================
import math

# ---- Tunable thresholds (change these if detection feels too strict) ----
THRESH = {
    "extended": 1.5,    # tip-to-wrist / knuckle-to-wrist ratio: above = finger straight
    "curled": 1.25,     # ratio below this = finger folded into the palm
    "thumb_out": 0.85,  # thumb tip distance from index knuckle (relative to palm width)
    "pinch": 0.28,      # thumb tip close to index tip (relative to palm length)
    "spread": 0.32,     # index and middle tips far apart = "V" instead of "U"
    "thumb_vert": 0.6,  # how far above/below the wrist the thumb must point
}

# ---- Every still hand shape SignBridge knows ----------------------------
# word   = typed in "words" mode   (None = use the letter, False = nothing)
# letter = typed in "letters" mode (None = nothing)
# hint   = plain description shown in the guide
SHAPES = {
    "five":       {"word": "Five",       "letter": None, "hint": "Open hand, all five fingers up and spread"},
    "stop":       {"word": "Stop",       "letter": "B",  "hint": "Flat hand, four fingers together, thumb tucked"},
    "iloveyou":   {"word": "I love you", "letter": None, "hint": "Thumb, index and pinky out; middle and ring folded"},
    "thumbsup":   {"word": "Good",       "letter": "A",  "hint": "Fist with thumb pointing up"},
    "thumbsdown": {"word": "Bad",        "letter": None, "hint": "Fist with thumb pointing down"},
    "fist":       {"word": False,        "letter": "S",  "hint": "Closed fist, thumb across the fingers"},
    "point":      {"word": "You",        "letter": "D",  "hint": "Index finger up, other fingers folded"},
    "lshape":     {"word": None,         "letter": "L",  "hint": "Thumb and index finger out like an L"},
    "ihand":      {"word": "I",          "letter": "I",  "hint": "Only the pinky up, thumb tucked"},
    "callme":     {"word": "Call me",    "letter": "Y",  "hint": "Thumb and pinky out (phone shape)"},
    "peace":      {"word": "Peace",      "letter": "V",  "hint": "Index and middle up and spread apart"},
    "u":          {"word": "Two",        "letter": "U",  "hint": "Index and middle up, held together"},
    "water":      {"word": "Water",      "letter": "W",  "hint": "Index, middle and ring up; pinky folded"},
    "ok":         {"word": "OK",         "letter": "F",  "hint": "Thumb touches index tip; other three fingers up"},
    "o":          {"word": "Zero",       "letter": "O",  "hint": "All fingertips curve to touch the thumb (round O)"},
    "c":          {"word": "Cup",        "letter": "C",  "hint": "Curved hand like holding a cup, thumb out"},
}

# ---- Moving signs (detected over time by 02_motion.py) -------------------
MOTIONS = {
    "wave":  {"word": "Hello", "hint": "Open hand, wave side to side"},
    "nod":   {"word": "Yes",   "hint": "Closed fist, nod it up and down"},
    "shake": {"word": "No",    "hint": "Index finger up, shake side to side"},
}


def dist(a, b):
    """Distance between two landmarks (x/y only; depth is too noisy)."""
    return math.hypot(a.x - b.x, a.y - b.y)


def finger_state(lm, mcp, tip):
    """'ext' (straight), 'curl' (folded) or 'half'.
    A straight finger puts its tip FAR from the wrist compared with its knuckle."""
    ratio = dist(lm[tip], lm[0]) / dist(lm[mcp], lm[0])
    if ratio >= THRESH["extended"]:
        return "ext"
    if ratio <= THRESH["curled"]:
        return "curl"
    return "half"


def describe_hand(lm):
    """Turn 21 landmarks into a small readable description of the hand."""
    palm_len = dist(lm[0], lm[9])    # wrist -> middle knuckle (hand size)
    palm_wid = dist(lm[5], lm[17])   # index knuckle -> pinky knuckle

    d = {
        "index": finger_state(lm, 5, 8),
        "middle": finger_state(lm, 9, 12),
        "ring": finger_state(lm, 13, 16),
        "pinky": finger_state(lm, 17, 20),
    }
    # Thumb is "out" when its tip is far from the base of the index finger
    d["thumb_out"] = dist(lm[4], lm[5]) / palm_wid > THRESH["thumb_out"]
    d["pinch"] = dist(lm[4], lm[8]) / palm_len < THRESH["pinch"]      # thumb + index touching
    d["spread"] = dist(lm[8], lm[12]) / palm_len > THRESH["spread"]   # index/middle apart

    # Thumb direction: negative y = up on screen
    dy = (lm[4].y - lm[0].y) / palm_len
    d["thumb_dir"] = "up" if dy < -THRESH["thumb_vert"] else "down" if dy > THRESH["thumb_vert"] else "side"
    return d


def classify(lm):
    """Landmarks in -> shape id (a key of SHAPES) or None.
    Rules run top to bottom; the FIRST match wins, so order matters."""
    h = describe_hand(lm)
    fingers = [h["index"], h["middle"], h["ring"], h["pinky"]]
    ext = lambda s: s == "ext"
    curl = lambda s: s == "curl"
    half_count = sum(1 for s in fingers if s == "half")

    # OK / F: thumb + index touch, other three fingers straight
    if h["pinch"] and ext(h["middle"]) and ext(h["ring"]) and ext(h["pinky"]):
        return "ok"
    # All four straight: thumb out = Five, thumb tucked = Stop / B
    if all(ext(s) for s in fingers):
        return "five" if h["thumb_out"] else "stop"
    # Thumb + index + pinky out, middle + ring folded = I love you
    if ext(h["index"]) and curl(h["middle"]) and curl(h["ring"]) and ext(h["pinky"]) and h["thumb_out"]:
        return "iloveyou"
    # Index, middle, ring straight, pinky folded = W / Water
    if ext(h["index"]) and ext(h["middle"]) and ext(h["ring"]) and curl(h["pinky"]):
        return "water"
    # Index + middle straight, others folded: apart = V / Peace, together = U / Two
    if ext(h["index"]) and ext(h["middle"]) and curl(h["ring"]) and curl(h["pinky"]):
        return "peace" if h["spread"] else "u"
    # Only index straight: thumb out = L, thumb tucked = D / You
    if ext(h["index"]) and curl(h["middle"]) and curl(h["ring"]) and curl(h["pinky"]):
        return "lshape" if h["thumb_out"] else "point"
    # Only pinky straight: thumb out = Y / Call me, thumb tucked = I
    if curl(h["index"]) and curl(h["middle"]) and curl(h["ring"]) and ext(h["pinky"]):
        return "callme" if h["thumb_out"] else "ihand"
    # Round shapes (no finger fully straight)
    if not any(ext(s) for s in fingers) and half_count >= 2:
        if h["pinch"]:
            return "o"
        if h["thumb_out"] and half_count >= 3:
            return "c"
    # Fist family: every finger folded
    if all(curl(s) for s in fingers):
        if h["thumb_out"] and h["thumb_dir"] == "down":
            return "thumbsdown"
        if h["thumb_out"]:
            return "thumbsup"    # thumb up or beside the fist (A)
        return "fist"
    return None   # unknown / transition between shapes
