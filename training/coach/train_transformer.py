#!/usr/bin/env python3
"""
Transformer FitCoach Training Script
=====================================
Trains an encoder-decoder transformer model for workout generation.
Encoder: user profile → context embedding
Decoder: auto-regressive exercise sequence generation

Dual-path:
  1. PyTorch (preferred) — full transformer encoder-decoder
  2. scikit-learn (fallback) — MLP approximation exported as transformer JSON

Data: training/output/fitcoach_train.jsonl, fitcoach_test.jsonl
Output: assets/models/fitcoach_transformer.json
"""

import json
import os
import sys
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TRAIN_DATA = PROJECT_ROOT / "training" / "output" / "fitcoach_train.jsonl"
TEST_DATA = PROJECT_ROOT / "training" / "output" / "fitcoach_test.jsonl"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "models"

# Architecture constants
HIDDEN_SIZE = 128
NUM_HEADS = 4
ENCODER_LAYERS = 2
DECODER_LAYERS = 2
MAX_EXERCISES = 8
DROPOUT = 0.1

# Exercise vocabulary (mapped from training data)
EXERCISE_DATABASE = []


def load_data(path):
    """Load JSONL training data."""
    data = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data


def build_exercise_vocab(train_data):
    """Build exercise vocabulary from training data."""
    exercises = {}
    for item in train_data:
        output = item.get("output", {})
        if isinstance(output, dict):
            for ex in output.get("exercises", []):
                eid = ex.get("exerciseId", 0)
                if eid not in exercises:
                    exercises[eid] = {
                        "id": eid,
                        "name": ex.get("name", f"Exercise_{eid}"),
                        "category": ex.get("category", "general"),
                        "targetMuscle": ex.get("targetMuscle", "general"),
                        "isCompound": ex.get("isCompound", False),
                        "equipment": ex.get("equipment", []),
                        "difficulty": ex.get("difficulty", "intermediate"),
                        "defaultSets": ex.get("sets", 3),
                        "defaultReps": ex.get("reps", 10),
                        "defaultRest": ex.get("restSeconds", 60),
                        "defaultRpe": ex.get("rpe", 7),
                    }
    return exercises


def extract_features(item):
    """Extract numerical features from a training example."""
    inp = item.get("input", {})
    features = []

    # Experience (4)
    exp_map = {"beginner": [1,0,0,0], "intermediate": [0,1,0,0],
               "advanced": [0,0,1,0], "elite": [0,0,0,1]}
    features.extend(exp_map.get(inp.get("experience", "intermediate"), [0,1,0,0]))

    # Goal (5)
    goal_map = {"strength": [1,0,0,0,0], "hypertrophy": [0,1,0,0,0],
                "endurance": [0,0,1,0,0], "fat_loss": [0,0,0,1,0],
                "calisthenics": [0,0,0,0,1]}
    features.extend(goal_map.get(inp.get("goal", "hypertrophy"), [0,1,0,0,0]))

    # Time (1)
    features.append(inp.get("timeMinutes", 45) / 90.0)

    # Equipment (8)
    equip_list = ["barbell", "dumbbell", "kettlebell", "pullup_bar",
                  "bench", "cables", "bands", "bodyweight"]
    user_equip = inp.get("equipment", [])
    for eq in equip_list:
        features.append(1.0 if eq in user_equip else 0.0)

    # Fatigue (9)
    muscle_groups = ["chest", "back", "shoulders", "biceps", "triceps",
                     "quads", "hamstrings", "glutes", "core"]
    fatigue = inp.get("fatigueMap", {})
    for mg in muscle_groups:
        features.append(fatigue.get(mg, 0.0))

    # Target groups (9)
    targets = inp.get("targetGroups", [])
    for mg in muscle_groups:
        features.append(1.0 if mg in targets else 0.0)

    # Injuries (5)
    injury_areas = ["shoulder", "knee", "lower_back", "wrist", "ankle"]
    injuries = inp.get("injuries", [])
    for inj in injury_areas:
        features.append(1.0 if inj in injuries else 0.0)

    return features  # 41 features


def extract_targets(item, exercise_vocab):
    """Extract target values from a training example."""
    output = item.get("output", {})
    exercises = output.get("exercises", [])

    # Target: sequence of (exerciseId, sets, reps, rest, rpe)
    targets = []
    for ex in exercises[:MAX_EXERCISES]:
        eid = ex.get("exerciseId", 0)
        targets.append({
            "exerciseId": eid,
            "sets": ex.get("sets", 3),
            "reps": ex.get("reps", 10),
            "restSeconds": ex.get("restSeconds", 60),
            "rpe": ex.get("rpe", 7),
        })
    return targets


# ============================================
# PyTorch path
# ============================================

def try_torch_training(X_train, y_train, X_test, y_test, exercise_vocab):
    """Train with PyTorch if available."""
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import Dataset, DataLoader
        print("[PyTorch] Training encoder-decoder transformer...")
    except ImportError:
        print("[PyTorch] Not available, skipping")
        return None

    vocab_size = max(exercise_vocab.keys()) + 1 if exercise_vocab else 100
    input_dim = len(X_train[0])

    class WorkoutDataset(Dataset):
        def __init__(self, X, Y):
            self.X = X
            self.Y = Y

        def __len__(self):
            return len(self.X)

        def __getitem__(self, idx):
            x = torch.FloatTensor(self.X[idx])
            # Encode target sequence
            y = self.Y[idx]
            ex_ids = [e["exerciseId"] for e in y[:MAX_EXERCISES]]
            sets = [e["sets"] / 6.0 for e in y[:MAX_EXERCISES]]
            reps = [e["reps"] / 30.0 for e in y[:MAX_EXERCISES]]
            rest = [(e["restSeconds"] - 30) / 270.0 for e in y[:MAX_EXERCISES]]
            rpe = [(e["rpe"] - 5) / 5.0 for e in y[:MAX_EXERCISES]]

            # Pad
            seq_len = len(ex_ids)
            while len(ex_ids) < MAX_EXERCISES:
                ex_ids.append(0)
                sets.append(0)
                reps.append(0)
                rest.append(0)
                rpe.append(0)

            return {
                "profile": x,
                "exercise_ids": torch.LongTensor(ex_ids),
                "sets": torch.FloatTensor(sets),
                "reps": torch.FloatTensor(reps),
                "rest": torch.FloatTensor(rest),
                "rpe": torch.FloatTensor(rpe),
                "seq_len": seq_len,
            }

    class TransformerCoachNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.profile_proj = nn.Linear(input_dim, HIDDEN_SIZE)

            encoder_layer = nn.TransformerEncoderLayer(
                d_model=HIDDEN_SIZE, nhead=NUM_HEADS,
                dim_feedforward=HIDDEN_SIZE * 4, dropout=DROPOUT,
                batch_first=True, activation="gelu",
            )
            self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=ENCODER_LAYERS)

            self.exercise_emb = nn.Embedding(vocab_size, HIDDEN_SIZE)
            self.position_emb = nn.Embedding(MAX_EXERCISES, HIDDEN_SIZE)

            decoder_layer = nn.TransformerDecoderLayer(
                d_model=HIDDEN_SIZE, nhead=NUM_HEADS,
                dim_feedforward=HIDDEN_SIZE * 4, dropout=DROPOUT,
                batch_first=True, activation="gelu",
            )
            self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=DECODER_LAYERS)

            self.exercise_head = nn.Linear(HIDDEN_SIZE, vocab_size)
            self.sets_head = nn.Linear(HIDDEN_SIZE, 1)
            self.reps_head = nn.Linear(HIDDEN_SIZE, 1)
            self.rest_head = nn.Linear(HIDDEN_SIZE, 1)
            self.rpe_head = nn.Linear(HIDDEN_SIZE, 1)
            self.done_head = nn.Linear(HIDDEN_SIZE, 1)

        def forward(self, profile, tgt_ids, tgt_mask=None):
            # Encode profile
            prof_emb = self.profile_proj(profile).unsqueeze(1)  # [B, 1, H]
            memory = self.encoder(prof_emb)  # [B, 1, H]

            # Decode
            B, T = tgt_ids.shape
            positions = torch.arange(T, device=tgt_ids.device).unsqueeze(0).expand(B, T)
            tgt = self.exercise_emb(tgt_ids) + self.position_emb(positions)
            dec_out = self.decoder(tgt, memory, tgt_mask=tgt_mask)

            return {
                "exercise_logits": self.exercise_head(dec_out),
                "sets": torch.sigmoid(self.sets_head(dec_out)).squeeze(-1),
                "reps": torch.sigmoid(self.reps_head(dec_out)).squeeze(-1),
                "rest": torch.sigmoid(self.rest_head(dec_out)).squeeze(-1),
                "rpe": torch.sigmoid(self.rpe_head(dec_out)).squeeze(-1),
                "done": torch.sigmoid(self.done_head(dec_out)).squeeze(-1),
            }

    model = TransformerCoachNet()
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)

    train_dataset = WorkoutDataset(X_train, y_train)
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)

    ce_loss = nn.CrossEntropyLoss(ignore_index=0)
    mse_loss = nn.MSELoss()

    model.train()
    for epoch in range(30):
        total_loss = 0
        for batch in train_loader:
            optimizer.zero_grad()

            causal_mask = nn.Transformer.generate_square_subsequent_mask(MAX_EXERCISES)
            outputs = model(batch["profile"], batch["exercise_ids"], causal_mask)

            # Exercise prediction loss
            ex_logits = outputs["exercise_logits"][:, :-1].reshape(-1, vocab_size)
            ex_targets = batch["exercise_ids"][:, 1:].reshape(-1)
            loss = ce_loss(ex_logits, ex_targets)

            # Parameter regression losses
            for key in ["sets", "reps", "rest", "rpe"]:
                loss += 0.5 * mse_loss(outputs[key], batch[key])

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg = total_loss / len(train_loader)
        if (epoch + 1) % 5 == 0:
            print(f"  Epoch {epoch+1}/30 — Loss: {avg:.4f}")

    # Export
    return export_pytorch_model(model, exercise_vocab, X_train)


def export_pytorch_model(model, exercise_vocab, X_train):
    """Export PyTorch model to JSON for TypeScript inference."""
    import torch

    state = model.state_dict()
    result = {
        "version": "2.0",
        "architecture": "encoder-decoder",
        "hiddenSize": HIDDEN_SIZE,
        "numHeads": NUM_HEADS,
        "encoderLayers": ENCODER_LAYERS,
        "decoderLayers": DECODER_LAYERS,
        "maxExercises": MAX_EXERCISES,
        "exerciseVocabSize": len(exercise_vocab),
        "profileProjectionWeight": state["profile_proj.weight"].tolist(),
        "profileProjectionBias": state["profile_proj.bias"].tolist(),
        "encoder": [],
        "decoder": [],
        "exerciseEmbeddings": state["exercise_emb.weight"].tolist(),
        "positionEmbeddings": state["position_emb.weight"].tolist(),
        "exerciseHead": {
            "weight": state["exercise_head.weight"].tolist(),
            "bias": state["exercise_head.bias"].tolist(),
        },
        "setsHead": {
            "weight": state["sets_head.weight"].tolist(),
            "bias": state["sets_head.bias"].tolist(),
        },
        "repsHead": {
            "weight": state["reps_head.weight"].tolist(),
            "bias": state["reps_head.bias"].tolist(),
        },
        "restHead": {
            "weight": state["rest_head.weight"].tolist(),
            "bias": state["rest_head.bias"].tolist(),
        },
        "rpeHead": {
            "weight": state["rpe_head.weight"].tolist(),
            "bias": state["rpe_head.bias"].tolist(),
        },
        "doneHead": {
            "weight": state["done_head.weight"].tolist(),
            "bias": state["done_head.bias"].tolist(),
        },
        "exerciseDatabase": list(exercise_vocab.values()),
    }

    # Extract encoder layers
    for i in range(ENCODER_LAYERS):
        prefix = f"encoder.layers.{i}"
        result["encoder"].append(extract_transformer_layer(state, prefix))

    # Extract decoder layers
    for i in range(DECODER_LAYERS):
        prefix = f"decoder.layers.{i}"
        result["decoder"].append(extract_transformer_layer(state, prefix))

    # Compute input scaler
    X = np.array(X_train)
    result["inputScaler"] = {
        "mean": X.mean(axis=0).tolist(),
        "scale": np.maximum(X.std(axis=0), 1e-8).tolist(),
    }

    return result


def extract_transformer_layer(state, prefix):
    """Extract weights from a PyTorch TransformerEncoderLayer/DecoderLayer."""
    # nn.TransformerEncoderLayer uses:
    # self_attn.in_proj_weight, self_attn.in_proj_bias (Q/K/V concatenated)
    # self_attn.out_proj.weight, self_attn.out_proj.bias
    # linear1.weight, linear1.bias (FFN)
    # linear2.weight, linear2.bias (FFN output)
    # norm1.weight, norm1.bias
    # norm2.weight, norm2.bias

    in_proj_w = state.get(f"{prefix}.self_attn.in_proj_weight")
    in_proj_b = state.get(f"{prefix}.self_attn.in_proj_bias")

    if in_proj_w is not None:
        h = HIDDEN_SIZE
        qw = in_proj_w[:h].tolist()
        kw = in_proj_w[h:2*h].tolist()
        vw = in_proj_w[2*h:].tolist()
        qb = in_proj_b[:h].tolist()
        kb = in_proj_b[h:2*h].tolist()
        vb = in_proj_b[2*h:].tolist()
    else:
        # Separate Q/K/V projections
        qw = state.get(f"{prefix}.self_attn.q_proj_weight",
              state.get(f"{prefix}.multihead_attn.in_proj_weight", np.zeros((HIDDEN_SIZE, HIDDEN_SIZE)))).tolist() if hasattr(state.get(f"{prefix}.self_attn.q_proj_weight", None), 'tolist') else np.zeros((HIDDEN_SIZE, HIDDEN_SIZE)).tolist()
        kw = np.zeros((HIDDEN_SIZE, HIDDEN_SIZE)).tolist()
        vw = np.zeros((HIDDEN_SIZE, HIDDEN_SIZE)).tolist()
        qb = np.zeros(HIDDEN_SIZE).tolist()
        kb = np.zeros(HIDDEN_SIZE).tolist()
        vb = np.zeros(HIDDEN_SIZE).tolist()

    return {
        "queryWeight": qw,
        "queryBias": qb,
        "keyWeight": kw,
        "keyBias": kb,
        "valueWeight": vw,
        "valueBias": vb,
        "attOutputWeight": state[f"{prefix}.self_attn.out_proj.weight"].tolist(),
        "attOutputBias": state[f"{prefix}.self_attn.out_proj.bias"].tolist(),
        "attLayerNormWeight": state[f"{prefix}.norm1.weight"].tolist(),
        "attLayerNormBias": state[f"{prefix}.norm1.bias"].tolist(),
        "ffnWeight": state[f"{prefix}.linear1.weight"].tolist(),
        "ffnBias": state[f"{prefix}.linear1.bias"].tolist(),
        "ffnOutputWeight": state[f"{prefix}.linear2.weight"].tolist(),
        "ffnOutputBias": state[f"{prefix}.linear2.bias"].tolist(),
        "outputLayerNormWeight": state[f"{prefix}.norm2.weight"].tolist(),
        "outputLayerNormBias": state[f"{prefix}.norm2.bias"].tolist(),
    }


# ============================================
# scikit-learn fallback
# ============================================

def train_lightweight_model(X_train, y_train, X_test, y_test, exercise_vocab):
    """Train a multi-output MLP as a transformer-compatible fallback."""
    from sklearn.neural_network import MLPRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import mean_squared_error, r2_score
    print("[sklearn] Training MLP fallback for workout generation...")

    # Flatten targets: for each sample, predict flat vector
    # [ex0_id, ex0_sets, ex0_reps, ex0_rest, ex0_rpe, ..., exN_*, done_0..done_N]
    vocab_list = sorted(exercise_vocab.keys())
    vocab_map = {eid: idx for idx, eid in enumerate(vocab_list)}
    n_exercises = MAX_EXERCISES
    params_per_ex = 5  # id, sets, reps, rest, rpe

    def flatten_target(y_item):
        flat = []
        for i in range(n_exercises):
            if i < len(y_item):
                ex = y_item[i]
                flat.append(vocab_map.get(ex["exerciseId"], 0) / max(1, len(vocab_list)))
                flat.append(ex["sets"] / 6.0)
                flat.append(ex["reps"] / 30.0)
                flat.append((ex["restSeconds"] - 30) / 270.0)
                flat.append((ex["rpe"] - 5) / 5.0)
            else:
                flat.extend([0.0] * params_per_ex)
        # Done flags
        for i in range(n_exercises):
            flat.append(0.0 if i < len(y_item) else 1.0)
        return flat

    Y_train = np.array([flatten_target(y) for y in y_train])
    Y_test = np.array([flatten_target(y) for y in y_test])

    X_train_np = np.array(X_train)
    X_test_np = np.array(X_test)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_np)
    X_test_scaled = scaler.transform(X_test_np)

    model = MLPRegressor(
        hidden_layer_sizes=(256, 256, 128),
        activation="relu",
        solver="adam",
        max_iter=200,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=15,
        learning_rate_init=1e-3,
        verbose=True,
        random_state=42,
    )

    model.fit(X_train_scaled, Y_train)

    y_pred = model.predict(X_test_scaled)
    r2 = r2_score(Y_test, y_pred)
    mse = mean_squared_error(Y_test, y_pred)
    print(f"\n  Test R²: {r2:.4f}")
    print(f"  Test MSE: {mse:.6f}")

    return export_sklearn_model(model, scaler, exercise_vocab, vocab_list)


def export_sklearn_model(model, scaler, exercise_vocab, vocab_list):
    """Export sklearn MLP as a transformer-compatible JSON."""
    weights = model.coefs_
    biases = model.intercepts_

    n_layers = len(weights)
    input_dim = weights[0].shape[0]

    # Map MLP layers to pseudo-transformer structure
    # Layer 0 → profile projection
    # Layer 1,2 → encoder layers (as FFN-only blocks)
    # Final layer → split output heads

    # Profile projection (first hidden layer)
    h_size = min(weights[0].shape[1], HIDDEN_SIZE)

    # Pad/truncate to HIDDEN_SIZE
    def pad_to_hidden(w, target_rows=HIDDEN_SIZE, target_cols=None):
        if target_cols is None:
            target_cols = w.shape[1] if len(w.shape) > 1 else w.shape[0]
        if len(w.shape) == 2:
            padded = np.zeros((target_rows, target_cols))
            r = min(w.shape[0], target_rows)
            c = min(w.shape[1], target_cols)
            padded[:r, :c] = w[:r, :c]
            return padded
        else:
            padded = np.zeros(target_rows)
            r = min(w.shape[0], target_rows)
            padded[:r] = w[:r]
            return padded

    # Create identity-like transformer layers (pass-through attention)
    def make_identity_block(hidden):
        h = hidden
        return {
            "queryWeight": np.eye(h).tolist(),
            "queryBias": np.zeros(h).tolist(),
            "keyWeight": np.eye(h).tolist(),
            "keyBias": np.zeros(h).tolist(),
            "valueWeight": np.eye(h).tolist(),
            "valueBias": np.zeros(h).tolist(),
            "attOutputWeight": np.eye(h).tolist(),
            "attOutputBias": np.zeros(h).tolist(),
            "attLayerNormWeight": np.ones(h).tolist(),
            "attLayerNormBias": np.zeros(h).tolist(),
            "ffnWeight": np.eye(h).tolist(),
            "ffnBias": np.zeros(h).tolist(),
            "ffnOutputWeight": np.eye(h).tolist(),
            "ffnOutputBias": np.zeros(h).tolist(),
            "outputLayerNormWeight": np.ones(h).tolist(),
            "outputLayerNormBias": np.zeros(h).tolist(),
        }

    def make_ffn_block(w1, b1, w2, b2, hidden):
        block = make_identity_block(hidden)
        block["ffnWeight"] = pad_to_hidden(w1, hidden, hidden).tolist()
        block["ffnBias"] = pad_to_hidden(b1, hidden).tolist()
        block["ffnOutputWeight"] = pad_to_hidden(w2, hidden, hidden).tolist()
        block["ffnOutputBias"] = pad_to_hidden(b2, hidden).tolist()
        return block

    # Build encoder blocks from MLP hidden layers
    encoder_blocks = []
    for i in range(min(ENCODER_LAYERS, n_layers - 1)):
        if i + 1 < n_layers:
            encoder_blocks.append(
                make_ffn_block(weights[i+1] if i+1 < n_layers else np.eye(HIDDEN_SIZE),
                               biases[i+1] if i+1 < n_layers else np.zeros(HIDDEN_SIZE),
                               np.eye(HIDDEN_SIZE),
                               np.zeros(HIDDEN_SIZE),
                               HIDDEN_SIZE)
            )
        else:
            encoder_blocks.append(make_identity_block(HIDDEN_SIZE))

    while len(encoder_blocks) < ENCODER_LAYERS:
        encoder_blocks.append(make_identity_block(HIDDEN_SIZE))

    # Decoder blocks (identity for fallback — just uses encoder output)
    decoder_blocks = [make_identity_block(HIDDEN_SIZE) for _ in range(DECODER_LAYERS)]

    # Output heads from final MLP layer
    final_w = weights[-1]  # shape: [hidden, output_dim]
    final_b = biases[-1]
    output_dim = final_w.shape[1]

    # Split output into exercise heads
    n_exercises = MAX_EXERCISES
    params_per_ex = 5
    total_params = n_exercises * params_per_ex + n_exercises  # + done flags

    def make_head(start, size, source_hidden):
        end = min(start + size, output_dim)
        w_slice = final_w[:, start:end]  # [hidden, size]
        b_slice = final_b[start:end]
        head_w = np.zeros((size, source_hidden))
        head_b = np.zeros(size)
        r = min(w_slice.shape[0], source_hidden)
        c = min(w_slice.shape[1], size)
        head_w[:c, :r] = w_slice[:r, :c].T
        head_b[:c] = b_slice[:c]
        return {"weight": head_w.tolist(), "bias": head_b.tolist()}

    ex_vocab_size = len(vocab_list)

    # Create exercise embeddings (random init for fallback — model doesn't really use them)
    np.random.seed(42)
    exercise_embeddings = (np.random.randn(ex_vocab_size + 1, HIDDEN_SIZE) * 0.02).tolist()
    position_embeddings = (np.random.randn(MAX_EXERCISES, HIDDEN_SIZE) * 0.02).tolist()

    result = {
        "version": "2.0-lightweight",
        "architecture": "encoder-decoder",
        "hiddenSize": HIDDEN_SIZE,
        "numHeads": NUM_HEADS,
        "encoderLayers": ENCODER_LAYERS,
        "decoderLayers": DECODER_LAYERS,
        "maxExercises": MAX_EXERCISES,
        "exerciseVocabSize": ex_vocab_size,
        "profileProjectionWeight": pad_to_hidden(weights[0].T, HIDDEN_SIZE, weights[0].shape[0]).tolist(),
        "profileProjectionBias": pad_to_hidden(biases[0], HIDDEN_SIZE).tolist(),
        "encoder": encoder_blocks,
        "decoder": decoder_blocks,
        "exerciseEmbeddings": exercise_embeddings,
        "positionEmbeddings": position_embeddings,
        "exerciseHead": make_head(0, ex_vocab_size, HIDDEN_SIZE),
        "setsHead": make_head(0, 1, HIDDEN_SIZE),
        "repsHead": make_head(1, 1, HIDDEN_SIZE),
        "restHead": make_head(2, 1, HIDDEN_SIZE),
        "rpeHead": make_head(3, 1, HIDDEN_SIZE),
        "doneHead": make_head(n_exercises * params_per_ex, 1, HIDDEN_SIZE),
        "exerciseDatabase": list(exercise_vocab.values()),
        "inputScaler": {
            "mean": scaler.mean_.tolist(),
            "scale": np.maximum(scaler.scale_, 1e-8).tolist(),
        },
    }

    return result


# ============================================
# Main
# ============================================

def main():
    print("=" * 60)
    print("  FitCoach Transformer Training Pipeline")
    print("=" * 60)

    # Check data
    if not TRAIN_DATA.exists():
        print(f"[ERROR] Training data not found: {TRAIN_DATA}")
        print("  Run: python training/generate_fitcoach_data.py first")
        sys.exit(1)

    if not TEST_DATA.exists():
        print(f"[ERROR] Test data not found: {TEST_DATA}")
        sys.exit(1)

    # Load data
    print(f"\nLoading training data from {TRAIN_DATA}...")
    train_data = load_data(TRAIN_DATA)
    test_data = load_data(TEST_DATA)
    print(f"  Train: {len(train_data)} samples")
    print(f"  Test:  {len(test_data)} samples")

    # Build exercise vocab
    exercise_vocab = build_exercise_vocab(train_data)
    print(f"  Exercise vocab: {len(exercise_vocab)} exercises")

    # Extract features
    print("\nExtracting features...")
    X_train = [extract_features(item) for item in train_data]
    y_train = [extract_targets(item, exercise_vocab) for item in train_data]
    X_test = [extract_features(item) for item in test_data]
    y_test = [extract_targets(item, exercise_vocab) for item in test_data]
    print(f"  Feature dimension: {len(X_train[0])}")

    # Try PyTorch first
    model_data = try_torch_training(X_train, y_train, X_test, y_test, exercise_vocab)

    # Fall back to sklearn
    if model_data is None:
        model_data = train_lightweight_model(X_train, y_train, X_test, y_test, exercise_vocab)

    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "fitcoach_transformer.json"
    with open(out_path, "w") as f:
        json.dump(model_data, f)

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"\n  Saved: {out_path}")
    print(f"  Size:  {size_mb:.2f} MB")

    # Also save minified
    min_path = OUTPUT_DIR / "fitcoach_transformer.min.json"
    with open(min_path, "w") as f:
        json.dump(model_data, f, separators=(",", ":"))
    min_size = min_path.stat().st_size / (1024 * 1024)
    print(f"  Minified: {min_size:.2f} MB")

    print("\n✅ FitCoach Transformer training complete!")


if __name__ == "__main__":
    main()
