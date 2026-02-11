#!/usr/bin/env python3
"""
FitQuest 2.0 MAX — Train All v3 Models

Runs all training scripts sequentially and produces a summary.
Models are saved directly to assets/models/.

Usage:
    python training/train_all_v3.py
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SCRIPTS = [
    ("Intent Router v3",        "training/intent/train_v3_large.py",   "intent_v3.json"),
    ("FitCoach v3",             "training/coach/train_v3_large.py",    "fitcoach_v3.json"),
    ("Activity Classifier v3",  "training/activity/train_v3_deep.py",  "activity_v3.json"),
    ("Neural Summarizer v3",    "training/summarizer/train_bert.py",   "summarizer_v3.json"),
    ("Semantic Search v3",      "training/search/train_minilm.py",     "search_v3.json"),
    ("Voice Command Parser v3", "training/voice/download_whisper.py",  "voice_v3.json"),
    ("AR Form Checker v3",      "training/ar/download_movenet.py",     "ar_v3.json"),
]


def run_script(name, script_path, expected_output):
    """Run a training script and report results."""
    full_path = ROOT / script_path
    output_path = ROOT / "assets" / "models" / expected_output

    print(f"\n{'='*60}")
    print(f"  Training: {name}")
    print(f"  Script:   {script_path}")
    print(f"{'='*60}")

    start = time.time()
    result = subprocess.run(
        [sys.executable, str(full_path)],
        cwd=str(ROOT),
        capture_output=False,
    )
    elapsed = time.time() - start

    if result.returncode != 0:
        print(f"  ❌ FAILED (exit code {result.returncode})")
        return {"name": name, "status": "FAILED", "size": 0, "time": elapsed}

    if output_path.exists():
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"  ✅ SUCCESS — {size_mb:.1f}MB in {elapsed:.1f}s")
        return {"name": name, "status": "OK", "size": size_mb, "time": elapsed, "path": str(output_path)}
    else:
        print(f"  ⚠️  Script finished but output not found: {expected_output}")
        return {"name": name, "status": "MISSING", "size": 0, "time": elapsed}


def main():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║        FITQUEST 2.0 MAX — FULL MODEL TRAINING PIPELINE     ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    total_start = time.time()
    results = []

    for name, script, output in SCRIPTS:
        results.append(run_script(name, script, output))

    # Summary
    total_elapsed = time.time() - total_start
    total_size = sum(r["size"] for r in results)
    passed = sum(1 for r in results if r["status"] == "OK")

    print(f"\n{'='*60}")
    print(f"  TRAINING SUMMARY")
    print(f"{'='*60}")
    print(f"{'Model':<30} {'Status':<10} {'Size':>8} {'Time':>8}")
    print(f"{'-'*30} {'-'*10} {'-'*8} {'-'*8}")
    for r in results:
        status = "✅" if r["status"] == "OK" else "❌"
        size = f"{r['size']:.1f}MB" if r["size"] > 0 else "—"
        time_str = f"{r['time']:.1f}s"
        print(f"{r['name']:<30} {status:<10} {size:>8} {time_str:>8}")

    print(f"{'-'*30} {'-'*10} {'-'*8} {'-'*8}")
    print(f"{'TOTAL':<30} {passed}/{len(results):<8} {total_size:>7.1f}MB {total_elapsed:>7.1f}s")

    if passed == len(results):
        print(f"\n🎉 All {len(results)} models trained successfully!")
    else:
        print(f"\n⚠️  {len(results) - passed} model(s) failed. Check output above.")

    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
