# =====================================================================
# 02_motion.py  -  Moving signs (wave = Hello, nod = Yes, shake = No)
# =====================================================================
# A still photo of a hand can't tell "Hello" from "Five". Movement can.
# We keep ~1.2 seconds of hand positions and count how many times the
# hand REVERSES direction ("zig-zags"). Waving = many left/right reversals.
# Everything is measured relative to hand size, so distance doesn't matter.
# =====================================================================
import math

WINDOW_MS = 1200   # how much history to look at

# Which hand shapes may be used for each motion, and how many turns we need
RULES = {
    "wave":  {"shapes": ("five", "stop"), "axis": "x", "min_turns": 3},
    "shake": {"shapes": ("point", "u"),   "axis": "x", "min_turns": 3},
    "nod":   {"shapes": ("fist",),        "axis": "y", "min_turns": 2},
}


def zigzag(values, swing):
    """Count direction reversals. A reversal only counts if the hand travelled
    at least `swing` before turning (this ignores small tremors)."""
    direction = 0          # 0 = unknown, 1 = moving up/right, -1 = down/left
    ref = values[0]        # furthest point reached in the current direction
    reversals = 0
    for v in values[1:]:
        if direction == 0:
            if v - ref > swing:
                direction, ref = 1, v
            elif ref - v > swing:
                direction, ref = -1, v
        elif direction == 1:
            if v > ref:
                ref = v
            elif ref - v > swing:
                direction, ref = -1, v
                reversals += 1
        else:
            if v < ref:
                ref = v
            elif v - ref > swing:
                direction, ref = 1, v
                reversals += 1
    return reversals


class MotionDetector:
    def __init__(self):
        self.history = []   # list of (time_ms, x, y, shape)

    def reset(self):
        self.history = []

    def detect(self, shape, lm, now_ms):
        """Call once per frame. Returns 'wave' | 'shake' | 'nod' | None."""
        # landmark 9 = middle knuckle = centre of the palm
        self.history.append((now_ms, lm[9].x, lm[9].y, shape))
        while self.history and now_ms - self.history[0][0] > WINDOW_MS:
            self.history.pop(0)
        if len(self.history) < 8:
            return None

        # hand size = wrist to middle knuckle; a swing must be ~1/3 of that
        palm = math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y)
        swing = palm * 0.35
        x_turns = zigzag([p[1] for p in self.history], swing)
        y_turns = zigzag([p[2] for p in self.history], swing)

        for name, r in RULES.items():
            # at least 60% of recent frames must show the right hand shape
            good = sum(1 for p in self.history if p[3] in r["shapes"]) / len(self.history)
            if good < 0.6:
                continue
            main, other = (x_turns, y_turns) if r["axis"] == "x" else (y_turns, x_turns)
            if main >= r["min_turns"] and other < 2:
                self.history = []   # clear so one wave doesn't fire twice
                return name
        return None
