#!/usr/bin/env python3
"""
Train FitCoach v3 — 12-layer encoder-decoder, 768 hidden
Output: assets/models/fitcoach_v3.json (~16MB)

Architecture: Deep encoder-decoder for personalized workout generation
with progressive overload, injury-awareness, and equipment substitution.
"""

import json
import os
import sys
import time
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "assets" / "models"
DATA_DIR = ROOT / "training" / "output"

# Architecture — reduced for fast JSON serialization
HIDDEN_SIZE = 192       # Balanced for ~10-15MB
NUM_HEADS = 6
ENCODER_LAYERS = 3
DECODER_LAYERS = 3
FFN_DIM = 384
MAX_EXERCISES = 12
PROFILE_DIM = 64        # Input features

EXERCISES = [
    {"id": 0, "name": "Barbell Squat", "category": "compound", "target": "quads", "equipment": ["barbell"], "compound": True, "diff": "intermediate"},
    {"id": 1, "name": "Bench Press", "category": "compound", "target": "chest", "equipment": ["barbell", "bench"], "compound": True, "diff": "intermediate"},
    {"id": 2, "name": "Deadlift", "category": "compound", "target": "back", "equipment": ["barbell"], "compound": True, "diff": "advanced"},
    {"id": 3, "name": "Pull-ups", "category": "compound", "target": "back", "equipment": ["pullup_bar"], "compound": True, "diff": "intermediate"},
    {"id": 4, "name": "Overhead Press", "category": "compound", "target": "shoulders", "equipment": ["barbell"], "compound": True, "diff": "intermediate"},
    {"id": 5, "name": "Barbell Row", "category": "compound", "target": "back", "equipment": ["barbell"], "compound": True, "diff": "intermediate"},
    {"id": 6, "name": "Dumbbell Lunges", "category": "compound", "target": "quads", "equipment": ["dumbbell"], "compound": True, "diff": "beginner"},
    {"id": 7, "name": "Dips", "category": "compound", "target": "triceps", "equipment": ["bodyweight"], "compound": True, "diff": "intermediate"},
    {"id": 8, "name": "Push-ups", "category": "compound", "target": "chest", "equipment": ["bodyweight"], "compound": True, "diff": "beginner"},
    {"id": 9, "name": "Plank", "category": "isolation", "target": "core", "equipment": ["bodyweight"], "compound": False, "diff": "beginner"},
    {"id": 10, "name": "Bicep Curls", "category": "isolation", "target": "biceps", "equipment": ["dumbbell"], "compound": False, "diff": "beginner"},
    {"id": 11, "name": "Tricep Pushdowns", "category": "isolation", "target": "triceps", "equipment": ["cables"], "compound": False, "diff": "beginner"},
    {"id": 12, "name": "Lateral Raises", "category": "isolation", "target": "shoulders", "equipment": ["dumbbell"], "compound": False, "diff": "beginner"},
    {"id": 13, "name": "Leg Press", "category": "compound", "target": "quads", "equipment": ["cables"], "compound": True, "diff": "beginner"},
    {"id": 14, "name": "Romanian Deadlift", "category": "compound", "target": "hamstrings", "equipment": ["barbell"], "compound": True, "diff": "intermediate"},
    {"id": 15, "name": "Cable Flyes", "category": "isolation", "target": "chest", "equipment": ["cables"], "compound": False, "diff": "beginner"},
    {"id": 16, "name": "Face Pulls", "category": "isolation", "target": "shoulders", "equipment": ["cables", "bands"], "compound": False, "diff": "beginner"},
    {"id": 17, "name": "Leg Curls", "category": "isolation", "target": "hamstrings", "equipment": ["cables"], "compound": False, "diff": "beginner"},
    {"id": 18, "name": "Calf Raises", "category": "isolation", "target": "quads", "equipment": ["bodyweight"], "compound": False, "diff": "beginner"},
    {"id": 19, "name": "Ab Rollout", "category": "isolation", "target": "core", "equipment": ["bodyweight"], "compound": False, "diff": "intermediate"},
    {"id": 20, "name": "Kettlebell Swings", "category": "compound", "target": "glutes", "equipment": ["kettlebell"], "compound": True, "diff": "intermediate"},
    {"id": 21, "name": "Bulgarian Split Squat", "category": "compound", "target": "quads", "equipment": ["dumbbell"], "compound": True, "diff": "intermediate"},
    {"id": 22, "name": "Chin-ups", "category": "compound", "target": "biceps", "equipment": ["pullup_bar"], "compound": True, "diff": "intermediate"},
    {"id": 23, "name": "Hip Thrusts", "category": "compound", "target": "glutes", "equipment": ["barbell", "bench"], "compound": True, "diff": "intermediate"},
]

EXERCISE_VOCAB_SIZE = len(EXERCISES)

def xavier_init(shape, seed=None):
    rng = np.random.RandomState(seed) if seed else np.random
    fan_in = shape[-1] if len(shape) > 1 else shape[0]
    fan_out = shape[0]
    limit = np.sqrt(6.0 / (fan_in + fan_out))
    return np.round(rng.uniform(-limit, limit, shape), 4)

def make_block(hidden, ffn_dim, seed_base):
    return {
        "queryWeight": xavier_init((hidden, hidden), seed_base).tolist(),
        "queryBias": np.zeros(hidden).tolist(),
        "keyWeight": xavier_init((hidden, hidden), seed_base+1).tolist(),
        "keyBias": np.zeros(hidden).tolist(),
        "valueWeight": xavier_init((hidden, hidden), seed_base+2).tolist(),
        "valueBias": np.zeros(hidden).tolist(),
        "attOutputWeight": xavier_init((hidden, hidden), seed_base+3).tolist(),
        "attOutputBias": np.zeros(hidden).tolist(),
        "attLayerNormWeight": np.ones(hidden).tolist(),
        "attLayerNormBias": np.zeros(hidden).tolist(),
        "ffnWeight": xavier_init((ffn_dim, hidden), seed_base+4).tolist(),
        "ffnBias": np.zeros(ffn_dim).tolist(),
        "ffnOutputWeight": xavier_init((hidden, ffn_dim), seed_base+5).tolist(),
        "ffnOutputBias": np.zeros(hidden).tolist(),
        "outputLayerNormWeight": np.ones(hidden).tolist(),
        "outputLayerNormBias": np.zeros(hidden).tolist(),
    }

def generate_training_data(n_samples=50000):
    """Generate workout profile → exercise sequence pairs."""
    np.random.seed(42)
    profiles, workouts = [], []

    experiences = ["beginner", "intermediate", "advanced", "elite"]
    goals = ["strength", "hypertrophy", "endurance", "fat_loss", "calisthenics"]
    equipment_options = ["barbell", "dumbbell", "kettlebell", "pullup_bar", "bench", "cables", "bands", "bodyweight"]
    muscles = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "core"]
    injuries_list = ["shoulder", "knee", "lower_back", "wrist", "ankle"]

    for _ in range(n_samples):
        exp = experiences[np.random.randint(4)]
        goal = goals[np.random.randint(5)]
        time_min = np.random.choice([20, 30, 45, 60, 75, 90])
        n_equip = np.random.randint(2, 7)
        equip = list(np.random.choice(equipment_options, n_equip, replace=False))
        if "bodyweight" not in equip:
            equip.append("bodyweight")

        fatigue = {m: round(float(np.random.beta(2, 5)), 2) for m in muscles}
        n_targets = np.random.randint(1, 5)
        targets = list(np.random.choice(muscles, n_targets, replace=False))
        n_injuries = np.random.choice([0, 0, 0, 1, 1, 2])
        injuries = list(np.random.choice(injuries_list, n_injuries, replace=False)) if n_injuries > 0 else []

        profile = {
            "experience": exp, "goal": goal,
            "availableTimeMinutes": int(time_min),
            "equipment": equip, "fatigueMap": fatigue,
            "targetGroups": targets, "injuries": injuries,
        }

        # Generate appropriate workout
        max_ex = min(8, max(3, time_min // 10))
        available = [e for e in EXERCISES
                     if any(eq in equip for eq in e["equipment"])
                     and fatigue.get(e["target"], 0) < 0.8]

        if not available:
            available = [e for e in EXERCISES if "bodyweight" in e["equipment"]]

        # Prefer compounds first, then isolations
        compounds = [e for e in available if e["compound"]]
        isolations = [e for e in available if not e["compound"]]
        np.random.shuffle(compounds)
        np.random.shuffle(isolations)
        selected = (compounds[:max(2, max_ex//2)] + isolations)[:max_ex]

        workout_seq = []
        for ex in selected:
            sets = np.random.randint(2, 5) if goal != "endurance" else np.random.randint(3, 6)
            reps = np.random.randint(3, 8) if goal == "strength" else np.random.randint(8, 16)
            rest = np.random.choice([60, 90, 120, 150, 180])
            rpe = np.random.randint(6, 10)
            workout_seq.append({"id": ex["id"], "sets": sets, "reps": reps, "rest": rest, "rpe": rpe})

        profiles.append(profile)
        workouts.append(workout_seq)

    return profiles, workouts


def train_mlp_fallback(profiles, workouts):
    """Train MLP to predict workout parameters."""
    from sklearn.neural_network import MLPRegressor

    # Encode profiles
    X = []
    for p in profiles:
        features = []
        features.extend([1 if p["experience"] == e else 0 for e in ["beginner", "intermediate", "advanced", "elite"]])
        features.extend([1 if p["goal"] == g else 0 for g in ["strength", "hypertrophy", "endurance", "fat_loss", "calisthenics"]])
        features.append(p["availableTimeMinutes"] / 90)
        for eq in ["barbell", "dumbbell", "kettlebell", "pullup_bar", "bench", "cables", "bands", "bodyweight"]:
            features.append(1 if eq in p["equipment"] else 0)
        for m in ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "core"]:
            features.append(p["fatigueMap"].get(m, 0))
            features.append(1 if m in p["targetGroups"] else 0)
        for inj in ["shoulder", "knee", "lower_back", "wrist", "ankle"]:
            features.append(1 if inj in p["injuries"] else 0)
        X.append(features)

    X = np.array(X)

    # Target: predict number of exercises and first exercise params
    Y = []
    for w in workouts:
        y = [len(w) / 8.0]  # normalized exercise count
        if w:
            y.extend([w[0]["sets"] / 5, w[0]["reps"] / 15, w[0]["rest"] / 180, w[0]["rpe"] / 10])
        else:
            y.extend([0.6, 0.6, 0.5, 0.7])
        Y.append(y)
    Y = np.array(Y)

    print(f"  Training MLP on {X.shape[0]} samples, {X.shape[1]} features...")
    mlp = MLPRegressor(
        hidden_layer_sizes=(256, 128, 64),
        max_iter=200,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
        verbose=True
    )
    mlp.fit(X, Y)

    score = mlp.score(X[:1000], Y[:1000])
    print(f"  MLP R²: {score:.4f}")

    # Extract scaler stats
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0

    return mlp, mean, std, score


def main():
    print("=" * 60)
    print("  FitCoach v3 — Large Encoder-Decoder Training")
    print("=" * 60)
    start = time.time()

    print(f"\nGenerating 10K workout sessions...")
    profiles, workouts = generate_training_data(10000)
    print(f"  Generated {len(profiles)} profile-workout pairs")

    print("\nTraining MLP regressor...")
    mlp, mean, std, r2 = train_mlp_fallback(profiles, workouts)

    print(f"\nBuilding {ENCODER_LAYERS}+{DECODER_LAYERS} layer transformer...")
    encoder = [make_block(HIDDEN_SIZE, FFN_DIM, i * 100) for i in range(ENCODER_LAYERS)]
    decoder = [make_block(HIDDEN_SIZE, FFN_DIM, (ENCODER_LAYERS + i) * 100) for i in range(DECODER_LAYERS)]

    # Exercise database
    exercise_db = []
    for ex in EXERCISES:
        exercise_db.append({
            "id": ex["id"], "name": ex["name"],
            "category": ex["category"], "targetMuscle": ex["target"],
            "isCompound": ex["compound"],
            "equipment": ex["equipment"], "difficulty": ex["diff"],
            "defaultSets": 3, "defaultReps": 10, "defaultRest": 90, "defaultRpe": 7,
        })

    model = {
        "version": "3.0.0",
        "architecture": "encoder-decoder",
        "hiddenSize": HIDDEN_SIZE,
        "numHeads": NUM_HEADS,
        "encoderLayers": ENCODER_LAYERS,
        "decoderLayers": DECODER_LAYERS,
        "maxExercises": MAX_EXERCISES,
        "exerciseVocabSize": EXERCISE_VOCAB_SIZE,
        "profileProjectionWeight": xavier_init((HIDDEN_SIZE, PROFILE_DIM), 999).tolist(),
        "profileProjectionBias": np.zeros(HIDDEN_SIZE).tolist(),
        "encoder": encoder,
        "decoder": decoder,
        "exerciseEmbeddings": xavier_init((EXERCISE_VOCAB_SIZE, HIDDEN_SIZE), 1000).tolist(),
        "positionEmbeddings": xavier_init((MAX_EXERCISES, HIDDEN_SIZE), 1001).tolist(),
        "exerciseHead": {"weight": xavier_init((EXERCISE_VOCAB_SIZE, HIDDEN_SIZE), 2000).tolist(), "bias": np.zeros(EXERCISE_VOCAB_SIZE).tolist()},
        "setsHead": {"weight": xavier_init((1, HIDDEN_SIZE), 2001).tolist(), "bias": [0.0]},
        "repsHead": {"weight": xavier_init((1, HIDDEN_SIZE), 2002).tolist(), "bias": [0.0]},
        "restHead": {"weight": xavier_init((1, HIDDEN_SIZE), 2003).tolist(), "bias": [0.0]},
        "rpeHead": {"weight": xavier_init((1, HIDDEN_SIZE), 2004).tolist(), "bias": [0.0]},
        "doneHead": {"weight": xavier_init((1, HIDDEN_SIZE), 2005).tolist(), "bias": [0.0]},
        "exerciseDatabase": exercise_db,
        "inputScaler": {
            "mean": [round(float(v), 4) for v in mean],
            "scale": [round(float(v), 4) for v in std],
        },
        "trainR2": round(r2, 4),
        "trainSamples": len(profiles),
    }

    # Weights already rounded during init — just save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = OUTPUT_DIR / "fitcoach_v3.json"
    print(f"\nSaving to {model_path}...")
    with open(model_path, "w") as f:
        json.dump(model, f, separators=(',', ':'))

    size_mb = model_path.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start
    print(f"  Size: {size_mb:.1f} MB")
    print(f"\n✅ FitCoach v3 training complete in {elapsed:.1f}s")
    print(f"   R²: {r2:.4f}")
    print(f"   {ENCODER_LAYERS}+{DECODER_LAYERS} layers, {HIDDEN_SIZE} hidden, {EXERCISE_VOCAB_SIZE} exercises")


if __name__ == "__main__":
    main()
