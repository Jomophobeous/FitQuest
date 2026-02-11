#!/usr/bin/env python3
"""
FitQuest AI — FitCoach Engine Trainer
Trains a neural network to map user profiles → workout plans.
Uses scikit-learn MLPRegressor (works on Python 3.14).
Exports as JSON for on-device TypeScript inference.
"""

import json
import os
import sys
import time
import numpy as np
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.multioutput import MultiOutputRegressor
from sklearn.ensemble import GradientBoostingRegressor


class FitCoachTrainer:
    def __init__(self):
        self.input_scaler = StandardScaler()
        self.output_scaler = StandardScaler()
        self.model = None
        self.exercise_classifier = None  # Separate model for exercise selection

    def load_data(self):
        """Load encoded training data"""
        print("  Loading training data...")
        train_inputs, train_outputs = [], []
        test_inputs, test_outputs = [], []

        with open('output/fitcoach_train.jsonl') as f:
            for line in f:
                item = json.loads(line)
                train_inputs.append(item['encoded_input'])
                train_outputs.append(item['encoded_output'])

        with open('output/fitcoach_test.jsonl') as f:
            for line in f:
                item = json.loads(line)
                test_inputs.append(item['encoded_input'])
                test_outputs.append(item['encoded_output'])

        X_train = np.array(train_inputs, dtype=np.float32)
        y_train = np.array(train_outputs, dtype=np.float32)
        X_test = np.array(test_inputs, dtype=np.float32)
        y_test = np.array(test_outputs, dtype=np.float32)

        print(f"  Train: {X_train.shape}, Test: {X_test.shape}")
        print(f"  Input features: {X_train.shape[1]}")
        print(f"  Output features: {y_train.shape[1]}")

        return X_train, y_train, X_test, y_test

    def train(self, X_train, y_train, X_test, y_test):
        """Train the workout generation model"""

        # Scale inputs
        X_train_scaled = self.input_scaler.fit_transform(X_train)
        X_test_scaled = self.input_scaler.transform(X_test)

        # Separate exercise ID predictions from param predictions
        # Output: [ex_id, sets, reps, rest, rpe] * 8 exercises
        # Exercise IDs: indices 0, 5, 10, 15, 20, 25, 30, 35
        # Params: everything else

        # Mask out padding (-1 values)
        mask = y_train[:, ::5] >= 0  # Exercise ID positions

        # Train main regression model (params)
        print("\n  Training workout parameter model...")
        start = time.time()

        self.model = MLPRegressor(
            hidden_layer_sizes=(256, 128, 64),
            activation='relu',
            solver='adam',
            max_iter=500,
            early_stopping=True,
            validation_fraction=0.1,
            n_iter_no_change=20,
            learning_rate='adaptive',
            learning_rate_init=0.001,
            batch_size=256,
            random_state=42,
            verbose=True,
        )

        # Scale outputs (ignoring padding)
        y_train_clean = y_train.copy()
        y_train_clean[y_train_clean < 0] = 0  # Replace padding with 0 for training

        y_train_scaled = self.output_scaler.fit_transform(y_train_clean)
        self.model.fit(X_train_scaled, y_train_scaled)

        train_time = time.time() - start
        print(f"  Training time: {train_time:.1f}s")
        print(f"  Iterations: {self.model.n_iter_}")

        return X_test_scaled, y_test

    def evaluate(self, X_test_scaled, y_test):
        """Evaluate model quality"""
        y_pred_scaled = self.model.predict(X_test_scaled)
        y_pred = self.output_scaler.inverse_transform(y_pred_scaled)

        # Only evaluate non-padding positions
        mask = y_test[:, ::5] >= 0

        # Overall MAE
        valid_mask = y_test >= 0
        mae = mean_absolute_error(y_test[valid_mask], y_pred[valid_mask])
        rmse = np.sqrt(mean_squared_error(y_test[valid_mask], y_pred[valid_mask]))

        print(f"\n  Overall MAE:  {mae:.4f}")
        print(f"  Overall RMSE: {rmse:.4f}")

        # Per-feature evaluation
        feature_names = ['exercise_id', 'sets', 'reps', 'rest', 'rpe']
        for feat_idx, feat_name in enumerate(feature_names):
            indices = list(range(feat_idx, 40, 5))
            feat_true = y_test[:, indices]
            feat_pred = y_pred[:, indices]
            feat_mask = feat_true >= 0

            if feat_mask.any():
                feat_mae = mean_absolute_error(feat_true[feat_mask], feat_pred[feat_mask])
                print(f"  {feat_name:15s} MAE: {feat_mae:.4f}")

        return mae

    def export_for_mobile(self, output_dir: str):
        """Export model as JSON for on-device inference"""
        os.makedirs(output_dir, exist_ok=True)

        # Extract MLP weights
        weights = []
        biases = []
        for i, (coef, intercept) in enumerate(zip(self.model.coefs_, self.model.intercepts_)):
            weights.append(coef.tolist())
            biases.append(intercept.tolist())

        # Exercise database for decoding
        from generate_fitcoach_data import EXERCISES, EXERCISE_LIST, ALL_EQUIPMENT, ALL_MUSCLES

        export_data = {
            'version': '1.0.0',
            'model_type': 'mlp_regressor',
            'architecture': {
                'hidden_layers': list(self.model.hidden_layer_sizes),
                'activation': self.model.activation,
                'input_dim': self.model.coefs_[0].shape[0],
                'output_dim': self.model.coefs_[-1].shape[1],
            },
            'weights': weights,
            'biases': biases,
            'input_scaler': {
                'mean': self.input_scaler.mean_.tolist(),
                'scale': self.input_scaler.scale_.tolist(),
            },
            'output_scaler': {
                'mean': self.output_scaler.mean_.tolist(),
                'scale': self.output_scaler.scale_.tolist(),
            },
            'exercise_database': {
                ex_id: {
                    'name': ex['name'],
                    'primary': ex['primary'],
                    'secondary': ex['secondary'],
                    'equipment': ex['equipment'],
                    'difficulty': ex['difficulty'],
                    'category': ex['category'],
                }
                for ex_id, ex in EXERCISES.items()
            },
            'exercise_list': EXERCISE_LIST,
            'encoding': {
                'equipment_order': ALL_EQUIPMENT,
                'fatigue_muscles': ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'],
                'target_groups': ['chest', 'back', 'legs', 'shoulders', 'arms', 'core',
                                  'full_body', 'upper_body', 'lower_body'],
                'injury_types': ['shoulder', 'knee', 'back', 'wrist', 'elbow'],
                'experience_levels': ['beginner', 'intermediate', 'advanced'],
                'goals': ['strength', 'hypertrophy', 'endurance', 'fat_loss', 'maintenance'],
            },
        }

        # Save full model
        model_path = os.path.join(output_dir, 'fitcoach_model.json')
        with open(model_path, 'w') as f:
            json.dump(export_data, f)

        size_mb = os.path.getsize(model_path) / (1024 * 1024)
        print(f"\n📦 FitCoach model exported: {model_path}")
        print(f"   Size: {size_mb:.2f} MB")

        # Save compact
        compact_path = os.path.join(output_dir, 'fitcoach_model.min.json')
        with open(compact_path, 'w') as f:
            json.dump(export_data, f, separators=(',', ':'))

        compact_mb = os.path.getsize(compact_path) / (1024 * 1024)
        print(f"   Compact: {compact_mb:.2f} MB")

        return model_path


def main():
    print("=" * 60)
    print("🏋️ FitCoach Engine Training")
    print("=" * 60)

    if not os.path.exists('output/fitcoach_train.jsonl'):
        print("❌ Training data not found. Run generate_fitcoach_data.py first!")
        sys.exit(1)

    trainer = FitCoachTrainer()

    # 1. Load
    print("\n1️⃣  Loading data...")
    X_train, y_train, X_test, y_test = trainer.load_data()

    # 2. Train
    print("\n2️⃣  Training model...")
    X_test_scaled, y_test = trainer.train(X_train, y_train, X_test, y_test)

    # 3. Evaluate
    print("\n3️⃣  Evaluating...")
    mae = trainer.evaluate(X_test_scaled, y_test)

    # 4. Export
    print("\n4️⃣  Exporting for mobile...")
    trainer.export_for_mobile('output')

    print("\n" + "=" * 60)
    print(f"✅ FitCoach training complete!")
    print(f"   MAE: {mae:.4f}")
    print("=" * 60)


if __name__ == '__main__':
    main()
