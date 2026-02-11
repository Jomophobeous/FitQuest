#!/usr/bin/env python3
"""
FitQuest AI — Master Training Pipeline
Runs all model training in sequence and deploys to app assets.

Usage: python train_all.py [--models intent,fitcoach,activity]
"""

import argparse
import json
import os
import sys
import shutil
import time
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
ASSETS_DIR = PROJECT_ROOT / 'assets' / 'models'
OUTPUT_DIR = SCRIPT_DIR / 'output'


def run_step(name: str, func):
    """Run a training step with timing"""
    print(f"\n{'='*60}")
    print(f"🚀 {name}")
    print(f"{'='*60}")

    start = time.time()
    try:
        result = func()
        elapsed = time.time() - start
        print(f"\n✅ {name} completed in {elapsed:.1f}s")
        return result
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n❌ {name} FAILED after {elapsed:.1f}s: {e}")
        import traceback
        traceback.print_exc()
        return None


def train_intent_router():
    """Step 1: Intent Router"""
    from generate_intent_data import main as generate_data
    from train_intent_router import main as train_model

    generate_data()
    train_model()
    return True


def train_fitcoach():
    """Step 2: FitCoach Engine"""
    from generate_fitcoach_data import main as generate_data
    from train_fitcoach import main as train_model

    generate_data()
    train_model()
    return True


def train_activity():
    """Step 3: Activity Classifier"""
    from train_activity_classifier import main as train_model

    train_model()
    return True


def deploy_models():
    """Copy trained models to app assets"""
    os.makedirs(ASSETS_DIR, exist_ok=True)

    model_files = [
        ('intent_model.min.json', 'intent_model.json'),
        ('intent_labels.json', 'intent_labels.json'),
        ('fitcoach_model.min.json', 'fitcoach_model.json'),
        ('activity_model.min.json', 'activity_model.json'),
    ]

    deployed = []
    for src_name, dst_name in model_files:
        src = OUTPUT_DIR / src_name
        dst = ASSETS_DIR / dst_name
        if src.exists():
            shutil.copy2(src, dst)
            size = os.path.getsize(dst) / 1024
            print(f"  📦 {dst_name}: {size:.1f} KB")
            deployed.append(dst_name)
        else:
            print(f"  ⚠️  {src_name} not found, skipping")

    return deployed


def print_summary(results: dict, deployed: list):
    """Print final summary"""
    print("\n" + "=" * 60)
    print("📊 TRAINING PIPELINE SUMMARY")
    print("=" * 60)

    headers = f"{'Model':<25} {'Status':<10} {'Time':<10}"
    print(headers)
    print("-" * 45)

    for name, (status, elapsed) in results.items():
        status_icon = "✅" if status else "❌"
        time_str = f"{elapsed:.1f}s" if elapsed else "N/A"
        print(f"  {name:<23} {status_icon:<10} {time_str:<10}")

    print(f"\n📦 Deployed models: {len(deployed)}")
    total_size = sum(
        os.path.getsize(ASSETS_DIR / f) / 1024
        for f in deployed
        if (ASSETS_DIR / f).exists()
    )
    print(f"   Total size: {total_size:.1f} KB ({total_size/1024:.2f} MB)")

    print(f"\n📁 Assets directory: {ASSETS_DIR}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='FitQuest AI Training Pipeline')
    parser.add_argument('--models', type=str, default='all',
                        help='Comma-separated models to train: intent,fitcoach,activity,all')
    parser.add_argument('--skip-deploy', action='store_true',
                        help='Skip deploying models to assets')
    args = parser.parse_args()

    # Change to training directory
    os.chdir(SCRIPT_DIR)

    models_to_train = args.models.split(',') if args.models != 'all' else ['intent', 'fitcoach', 'activity']

    print("🧠 FitQuest AI Training Pipeline")
    print(f"   Models: {', '.join(models_to_train)}")
    print(f"   Output: {OUTPUT_DIR}")
    print(f"   Deploy: {ASSETS_DIR}")

    results = {}
    pipeline_start = time.time()

    # Train models
    if 'intent' in models_to_train:
        start = time.time()
        success = run_step("Intent Router", train_intent_router)
        results['Intent Router'] = (success, time.time() - start)

    if 'fitcoach' in models_to_train:
        start = time.time()
        success = run_step("FitCoach Engine", train_fitcoach)
        results['FitCoach Engine'] = (success, time.time() - start)

    if 'activity' in models_to_train:
        start = time.time()
        success = run_step("Activity Classifier", train_activity)
        results['Activity Classifier'] = (success, time.time() - start)

    # Deploy
    deployed = []
    if not args.skip_deploy:
        print(f"\n{'='*60}")
        print("📦 Deploying models to app assets...")
        deployed = deploy_models()

    # Summary
    total_time = time.time() - pipeline_start
    print_summary(results, deployed)
    print(f"\n⏱️  Total pipeline time: {total_time:.1f}s ({total_time/60:.1f} min)")


if __name__ == '__main__':
    main()
