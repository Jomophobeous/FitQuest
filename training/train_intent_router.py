#!/usr/bin/env python3
"""
FitQuest AI — Intent Router Trainer
Trains a text classifier using TF-IDF + Multi-class SVM/RandomForest.
Exports model as lightweight JSON for on-device JS inference.

Architecture: TF-IDF vectorizer → classifier → JSON weights export
  - No TensorFlow/PyTorch dependency needed at inference time
  - Model exported as pure JSON (tokenizer + weights)
  - On-device inference runs in <5ms via TypeScript
"""

import json
import os
import sys
import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import cross_val_score
from collections import Counter


class IntentRouterTrainer:
    def __init__(self, max_features=5000, ngram_range=(1, 2)):
        self.max_features = max_features
        self.ngram_range = ngram_range
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            sublinear_tf=True,
            strip_accents='unicode',
            analyzer='word',
            token_pattern=r'(?u)\b\w+\b',
            min_df=2
        )
        self.label_encoder = LabelEncoder()
        self.model = None
        self.best_model_name = None

    def load_data(self, train_path: str, test_path: str):
        """Load JSONL training data"""
        train_texts, train_labels = [], []
        test_texts, test_labels = [], []

        with open(train_path) as f:
            for line in f:
                ex = json.loads(line)
                train_texts.append(ex['text'])
                train_labels.append(ex['intent'])

        with open(test_path) as f:
            for line in f:
                ex = json.loads(line)
                test_texts.append(ex['text'])
                test_labels.append(ex['intent'])

        return train_texts, train_labels, test_texts, test_labels

    def train(self, X_train_raw, y_train_raw, X_test_raw, y_test_raw):
        """Train and select best model"""
        print("\n📊 Preprocessing...")

        # Vectorize
        X_train = self.vectorizer.fit_transform(X_train_raw)
        X_test = self.vectorizer.transform(X_test_raw)

        # Encode labels
        y_train = self.label_encoder.fit_transform(y_train_raw)
        y_test = self.label_encoder.transform(y_test_raw)

        print(f"   Vocabulary size: {len(self.vectorizer.vocabulary_)}")
        print(f"   Feature matrix: {X_train.shape}")
        print(f"   Classes: {list(self.label_encoder.classes_)}")

        # Train multiple models and pick best
        models = {
            'LinearSVC': LinearSVC(
                C=1.0,
                max_iter=10000,
                class_weight='balanced',
                dual='auto'
            ),
            'RandomForest': RandomForestClassifier(
                n_estimators=200,
                max_depth=30,
                n_jobs=-1,
                class_weight='balanced',
                random_state=42
            ),
        }

        best_acc = 0
        best_model = None
        results = {}

        for name, model in models.items():
            print(f"\n🔄 Training {name}...")
            start = time.time()

            model.fit(X_train, y_train)
            train_time = time.time() - start

            # Evaluate
            y_pred = model.predict(X_test)
            acc = accuracy_score(y_test, y_pred)

            # Cross-validation
            cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')

            results[name] = {
                'accuracy': acc,
                'cv_mean': cv_scores.mean(),
                'cv_std': cv_scores.std(),
                'train_time': train_time,
            }

            print(f"   Accuracy: {acc:.4f}")
            print(f"   CV Mean:  {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
            print(f"   Time:     {train_time:.2f}s")

            if acc > best_acc:
                best_acc = acc
                best_model = model
                self.best_model_name = name

        self.model = best_model
        print(f"\n🏆 Best model: {self.best_model_name} ({best_acc:.4f})")

        return X_test, y_test

    def evaluate(self, X_test, y_test):
        """Detailed evaluation"""
        y_pred = self.model.predict(X_test)

        print("\n" + "=" * 60)
        print("CLASSIFICATION REPORT")
        print("=" * 60)
        print(classification_report(
            y_test,
            y_pred,
            target_names=self.label_encoder.classes_
        ))

        # Per-class accuracy
        acc = accuracy_score(y_test, y_pred)
        print(f"Overall Accuracy: {acc:.4f} ({acc*100:.1f}%)")

        # Confusion analysis
        misclassified = []
        for i in range(len(y_test)):
            if y_test[i] != y_pred[i]:
                true_label = self.label_encoder.inverse_transform([y_test[i]])[0]
                pred_label = self.label_encoder.inverse_transform([y_pred[i]])[0]
                misclassified.append((true_label, pred_label))

        if misclassified:
            print("\nMost common misclassifications:")
            confusion = Counter(misclassified)
            for (true, pred), count in confusion.most_common(10):
                print(f"  {true} → {pred}: {count}")

        return acc

    def export_for_mobile(self, output_dir: str):
        """Export model as JSON for on-device TypeScript inference"""
        os.makedirs(output_dir, exist_ok=True)

        # 1. Export vocabulary (TF-IDF weights)
        vocab = self.vectorizer.vocabulary_
        idf = self.vectorizer.idf_.tolist()
        feature_names = self.vectorizer.get_feature_names_out().tolist()

        # Create word → index mapping
        word_to_idx = {word: int(idx) for word, idx in vocab.items()}

        # 2. Export model weights
        if self.best_model_name == 'LinearSVC':
            # SVM: coefficients matrix [n_classes, n_features]
            coef = self.model.coef_.tolist()
            intercept = self.model.intercept_.tolist()

            model_data = {
                'type': 'linear_svc',
                'coef': coef,
                'intercept': intercept,
            }
        else:
            # RandomForest: export decision function scores via predict_proba
            # For RF, we'll export a simplified scoring matrix
            # by computing mean class probabilities from training data
            model_data = {
                'type': 'random_forest',
                'note': 'RF model - use keyword scoring fallback on device'
            }

        # 3. Package everything
        export_data = {
            'version': '1.0.0',
            'model_type': self.best_model_name,
            'vocabulary': word_to_idx,
            'idf_weights': idf,
            'feature_names': feature_names,
            'labels': self.label_encoder.classes_.tolist(),
            'model': model_data,
            'config': {
                'max_features': self.max_features,
                'ngram_range': list(self.ngram_range),
                'confidence_threshold': 0.3,
            }
        }

        # Save main model
        model_path = os.path.join(output_dir, 'intent_model.json')
        with open(model_path, 'w') as f:
            json.dump(export_data, f, indent=2)

        size_kb = os.path.getsize(model_path) / 1024
        print(f"\n📦 Model exported: {model_path}")
        print(f"   Size: {size_kb:.1f} KB")

        # Save compact version (no indentation)
        compact_path = os.path.join(output_dir, 'intent_model.min.json')
        with open(compact_path, 'w') as f:
            json.dump(export_data, f, separators=(',', ':'))

        compact_size = os.path.getsize(compact_path) / 1024
        print(f"   Compact: {compact_size:.1f} KB")

        # 4. Save label mapping separately (for quick reference)
        labels_path = os.path.join(output_dir, 'intent_labels.json')
        with open(labels_path, 'w') as f:
            json.dump({
                'labels': self.label_encoder.classes_.tolist(),
                'label_to_idx': {label: int(idx) for idx, label in enumerate(self.label_encoder.classes_)}
            }, f, indent=2)

        print(f"   Labels: {labels_path}")

        return model_path

    def test_predictions(self, test_queries):
        """Test model on example queries"""
        print("\n" + "=" * 60)
        print("LIVE PREDICTIONS")
        print("=" * 60)

        for query in test_queries:
            X = self.vectorizer.transform([query.lower()])
            pred_idx = self.model.predict(X)[0]
            pred_label = self.label_encoder.inverse_transform([pred_idx])[0]

            # Get decision scores for confidence
            if hasattr(self.model, 'decision_function'):
                scores = self.model.decision_function(X)[0]
                # Softmax-like normalization
                exp_scores = np.exp(scores - np.max(scores))
                probs = exp_scores / exp_scores.sum()
                confidence = probs[pred_idx]

                # Top 2
                top2_idx = np.argsort(probs)[-2:][::-1]
                top2 = [(self.label_encoder.inverse_transform([i])[0], probs[i]) for i in top2_idx]
            else:
                probs = self.model.predict_proba(X)[0]
                confidence = probs[pred_idx]
                top2_idx = np.argsort(probs)[-2:][::-1]
                top2 = [(self.label_encoder.inverse_transform([i])[0], probs[i]) for i in top2_idx]

            print(f"\n  \"{query}\"")
            print(f"    → {pred_label} ({confidence*100:.1f}%)")
            if len(top2) > 1:
                print(f"    → Alt: {top2[1][0]} ({top2[1][1]*100:.1f}%)")


def main():
    print("=" * 60)
    print("🧠 FitQuest Intent Router Training")
    print("=" * 60)

    trainer = IntentRouterTrainer()

    # 1. Load data
    print("\n1️⃣  Loading data...")
    train_path = 'output/intent_train.jsonl'
    test_path = 'output/intent_test.jsonl'

    if not os.path.exists(train_path):
        print("   ❌ Training data not found. Run generate_intent_data.py first!")
        sys.exit(1)

    X_train, y_train, X_test, y_test = trainer.load_data(train_path, test_path)
    print(f"   Train: {len(X_train)}, Test: {len(y_test)}")

    # 2. Train
    print("\n2️⃣  Training models...")
    X_test_vec, y_test_enc = trainer.train(X_train, y_train, X_test, y_test)

    # 3. Evaluate
    print("\n3️⃣  Evaluating...")
    accuracy = trainer.evaluate(X_test_vec, y_test_enc)

    # 4. Export for mobile
    print("\n4️⃣  Exporting for mobile deployment...")
    model_path = trainer.export_for_mobile('output')

    # 5. Test live predictions
    test_queries = [
        "Create a chest workout",
        "How do I squat properly?",
        "Summarize this chapter",
        "What does metabolic adaptation mean?",
        "How did I sleep last night?",
        "Start tracking my run",
        "Hey there",
        "Thanks, bye",
        "Build me a 30 minute arm session",
        "What's my body fat percentage?",
        "Show me deadlift technique",
        "Give me the key takeaways",
    ]
    trainer.test_predictions(test_queries)

    print("\n" + "=" * 60)
    print(f"✅ Training complete!")
    print(f"   Model: {trainer.best_model_name}")
    print(f"   Accuracy: {accuracy:.2%}")
    print(f"   Export: {model_path}")
    print("=" * 60)


if __name__ == '__main__':
    main()
