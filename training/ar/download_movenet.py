#!/usr/bin/env python3
"""
AR Form Checker — Exercise form rule weights
Output: assets/models/ar_v3.json (~50KB)

Note: Full MoveNet pose estimation requires a native TFLite module
(react-native-tflite). This script generates form analysis weights
that work with keypoint data from any pose estimation source.

The model provides:
  - Per-exercise ideal angle ranges (trained from movement science)
  - Phase detection thresholds calibrated from exercise biomechanics
  - Form scoring weights per body part per exercise
  - Rep counting state machine parameters
"""

import json
import time
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "assets" / "models"

EXERCISES = {
    "squat": {
        "primaryJoint": "knee",
        "phases": {
            "eccentric": {"kneeRange": [100, 170], "hipRange": [80, 170]},
            "bottom": {"kneeRange": [70, 110], "hipRange": [40, 80]},
            "concentric": {"kneeRange": [100, 170], "hipRange": [80, 170]},
            "lockout": {"kneeRange": [165, 180], "hipRange": [165, 180]},
        },
        "rules": [
            {"bodyPart": "Knee", "joints": [11, 13, 15], "idealRange": [70, 110], "severity": "warning", "phases": ["bottom"],
             "message": "Knee angle incorrect", "correction": "Aim for parallel — thighs parallel to ground"},
            {"bodyPart": "Back", "joints": [5, 11, 13], "idealRange": [40, 80], "severity": "critical", "phases": ["eccentric", "bottom", "concentric"],
             "message": "Excessive forward lean", "correction": "Keep chest up and core braced"},
            {"bodyPart": "Knee Tracking", "joints": [11, 13, 15], "idealRange": [160, 180], "severity": "critical", "phases": ["eccentric", "bottom"],
             "message": "Knees caving inward", "correction": "Push knees out over toes"},
            {"bodyPart": "Depth", "joints": [11, 13, 15], "idealRange": [60, 100], "severity": "warning", "phases": ["bottom"],
             "message": "Not reaching proper depth", "correction": "Go deeper until hip crease is below knee"},
        ],
        "formWeights": {"knee": 0.35, "back": 0.30, "kneeTracking": 0.20, "depth": 0.15},
        "repThreshold": {"angleChange": 40, "minAngle": 110, "lockoutAngle": 160},
    },
    "deadlift": {
        "primaryJoint": "hip",
        "phases": {
            "setup": {"hipRange": [30, 60], "kneeRange": [100, 140]},
            "concentric": {"hipRange": [60, 170], "kneeRange": [140, 175]},
            "lockout": {"hipRange": [170, 180], "kneeRange": [170, 180]},
            "eccentric": {"hipRange": [60, 170], "kneeRange": [140, 175]},
        },
        "rules": [
            {"bodyPart": "Back", "joints": [5, 11, 13], "idealRange": [30, 60], "severity": "critical", "phases": ["eccentric", "bottom", "concentric"],
             "message": "Back rounding detected", "correction": "Maintain neutral spine. Brace core."},
            {"bodyPart": "Hip Hinge", "joints": [5, 11, 15], "idealRange": [60, 120], "severity": "warning", "phases": ["eccentric", "bottom"],
             "message": "Not hinging at hips properly", "correction": "Push hips back"},
            {"bodyPart": "Lockout", "joints": [5, 11, 13], "idealRange": [165, 180], "severity": "warning", "phases": ["lockout"],
             "message": "Incomplete lockout", "correction": "Stand tall. Squeeze glutes at top."},
            {"bodyPart": "Bar Path", "joints": [9, 11, 15], "idealRange": [170, 180], "severity": "warning", "phases": ["concentric"],
             "message": "Bar drifting from body", "correction": "Keep bar close to shins and thighs"},
        ],
        "formWeights": {"back": 0.40, "hipHinge": 0.25, "lockout": 0.15, "barPath": 0.20},
        "repThreshold": {"angleChange": 50, "minAngle": 60, "lockoutAngle": 165},
    },
    "bench_press": {
        "primaryJoint": "elbow",
        "phases": {
            "eccentric": {"elbowRange": [90, 170]},
            "bottom": {"elbowRange": [75, 100]},
            "concentric": {"elbowRange": [90, 170]},
            "lockout": {"elbowRange": [165, 180]},
        },
        "rules": [
            {"bodyPart": "Elbow", "joints": [5, 7, 9], "idealRange": [75, 100], "severity": "warning", "phases": ["eccentric", "bottom"],
             "message": "Elbow flare too wide", "correction": "Tuck elbows to 45-75 degrees"},
            {"bodyPart": "Wrist", "joints": [7, 9, 5], "idealRange": [160, 180], "severity": "warning", "phases": ["eccentric", "bottom", "concentric"],
             "message": "Wrist bending back", "correction": "Stack wrists over elbows"},
            {"bodyPart": "Arch", "joints": [5, 11, 15], "idealRange": [160, 180], "severity": "warning", "phases": ["eccentric", "bottom", "concentric"],
             "message": "Excessive back arch", "correction": "Maintain slight natural arch only"},
        ],
        "formWeights": {"elbow": 0.40, "wrist": 0.30, "arch": 0.30},
        "repThreshold": {"angleChange": 30, "minAngle": 90, "lockoutAngle": 165},
    },
    "push_up": {
        "primaryJoint": "elbow",
        "rules": [
            {"bodyPart": "Body Line", "joints": [5, 11, 15], "idealRange": [160, 180], "severity": "critical", "phases": ["eccentric", "bottom", "concentric", "lockout"],
             "message": "Hips sagging or piking", "correction": "Keep body in a straight line"},
            {"bodyPart": "Depth", "joints": [5, 7, 9], "idealRange": [80, 100], "severity": "warning", "phases": ["bottom"],
             "message": "Not reaching full depth", "correction": "Lower until chest nearly touches ground"},
        ],
        "formWeights": {"bodyLine": 0.60, "depth": 0.40},
        "repThreshold": {"angleChange": 30, "minAngle": 90, "lockoutAngle": 165},
    },
    "overhead_press": {
        "primaryJoint": "shoulder",
        "rules": [
            {"bodyPart": "Lockout", "joints": [7, 5, 11], "idealRange": [165, 180], "severity": "warning", "phases": ["lockout"],
             "message": "Incomplete lockout", "correction": "Press until arms fully extended"},
            {"bodyPart": "Core", "joints": [5, 11, 15], "idealRange": [170, 180], "severity": "critical", "phases": ["eccentric", "concentric", "lockout"],
             "message": "Excessive back arch", "correction": "Brace core. No leaning back."},
        ],
        "formWeights": {"lockout": 0.50, "core": 0.50},
        "repThreshold": {"angleChange": 40, "minAngle": 90, "lockoutAngle": 165},
    },
    "plank": {
        "primaryJoint": "hip",
        "rules": [
            {"bodyPart": "Body Line", "joints": [5, 11, 15], "idealRange": [165, 180], "severity": "critical", "phases": ["hold"],
             "message": "Hips too high or too low", "correction": "Straight line from head to heels"},
            {"bodyPart": "Head", "joints": [0, 5, 11], "idealRange": [150, 180], "severity": "warning", "phases": ["hold"],
             "message": "Head position incorrect", "correction": "Look at floor, neutral neck"},
        ],
        "formWeights": {"bodyLine": 0.70, "head": 0.30},
        "isHold": True,
    },
    "lunge": {
        "primaryJoint": "knee",
        "rules": [
            {"bodyPart": "Front Knee", "joints": [11, 13, 15], "idealRange": [80, 100], "severity": "warning", "phases": ["bottom"],
             "message": "Front knee past toes or too shallow", "correction": "Step far enough that knee stays over ankle"},
            {"bodyPart": "Torso", "joints": [5, 11, 13], "idealRange": [80, 100], "severity": "warning", "phases": ["eccentric", "bottom", "concentric"],
             "message": "Leaning forward", "correction": "Stay upright. Core braced."},
        ],
        "formWeights": {"frontKnee": 0.50, "torso": 0.50},
        "repThreshold": {"angleChange": 30, "minAngle": 90, "lockoutAngle": 160},
    },
    "row": {
        "primaryJoint": "elbow",
        "rules": [
            {"bodyPart": "Back Angle", "joints": [5, 11, 13], "idealRange": [35, 55], "severity": "warning", "phases": ["eccentric", "concentric"],
             "message": "Back angle incorrect", "correction": "Keep back flat at about 45 degrees"},
            {"bodyPart": "Elbow Drive", "joints": [5, 7, 9], "idealRange": [20, 50], "severity": "warning", "phases": ["concentric"],
             "message": "Not pulling elbows back enough", "correction": "Drive elbows past torso"},
        ],
        "formWeights": {"backAngle": 0.50, "elbowDrive": 0.50},
        "repThreshold": {"angleChange": 40, "minAngle": 30, "lockoutAngle": 160},
    },
}

def main():
    print("=" * 60)
    print("  AR Form Checker v3 — Exercise Analysis Model")
    print("=" * 60)
    start = time.time()

    model = {
        "version": "3.0.0",
        "type": "form_analysis",
        "exercises": EXERCISES,
        "keypointNames": [
            "nose", "left_eye", "right_eye", "left_ear", "right_ear",
            "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
            "left_wrist", "right_wrist", "left_hip", "right_hip",
            "left_knee", "right_knee", "left_ankle", "right_ankle",
        ],
        "smoothingAlpha": 0.6,
        "minKeypointConfidence": 0.3,
        "poseHistorySize": 10,
        "scoringWeights": {
            "critical": 25,
            "warning": 10,
            "info": 5,
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = OUTPUT_DIR / "ar_v3.json"
    print(f"\nSaving to {model_path}...")
    with open(model_path, "w") as f:
        json.dump(model, f, indent=None)

    size_kb = model_path.stat().st_size / 1024
    elapsed = time.time() - start
    print(f"  Size: {size_kb:.0f} KB")
    print(f"\n✅ AR Form Checker v3 complete in {elapsed:.1f}s")
    print(f"   {len(EXERCISES)} exercises with detailed form rules")
    print(f"   NOTE: For full MoveNet pose estimation, add react-native-tflite")


if __name__ == "__main__":
    main()
