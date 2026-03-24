#!/usr/bin/env python3
"""Analyze FitQuest screenshots: OCR + visual audit."""
import json, os, sys
from pathlib import Path
from PIL import Image
import numpy as np

SCREENSHOTS_DIR = Path(__file__).parent.parent / "App screenshots"
OUTPUT = SCREENSHOTS_DIR / "_march20_analysis.json"

def analyze_image(path: Path) -> dict:
    """Extract visual metrics from a screenshot."""
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    # Split into thirds
    third = h // 3
    top = arr[:third]
    mid = arr[third:2*third]
    bot = arr[2*third:]
    
    def region_stats(region):
        return {
            "brightness": float(np.mean(region)),
            "std": float(np.std(region)),
            "dark_pct": float(np.mean(region < 30) * 100),  # % very dark pixels
            "light_pct": float(np.mean(region > 220) * 100),  # % very light pixels
            "green_accent": float(np.mean((region[:,:,1] > 150) & (region[:,:,0] < 100) & (region[:,:,2] < 150)) * 100),
        }
    
    # Dominant colors (sample)
    flat = arr.reshape(-1, 3)
    sample = flat[np.random.choice(len(flat), min(5000, len(flat)), replace=False)]
    
    return {
        "file": path.name,
        "size": f"{w}x{h}",
        "overall_brightness": float(np.mean(arr)),
        "overall_std": float(np.std(arr)),
        "top": region_stats(top),
        "mid": region_stats(mid),
        "bot": region_stats(bot),
        "has_white_bg": float(np.mean(arr > 240)) > 0.15,  # >15% near-white = likely light bg issue
        "has_status_bar": bool(np.mean(top[:50]) < 40),  # dark status bar area
    }

def run_ocr_batch(files):
    """Run EasyOCR on all files."""
    try:
        import easyocr
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        results = {}
        for i, f in enumerate(files):
            print(f"  OCR {i+1}/{len(files)}: {f.name}", flush=True)
            try:
                text_data = reader.readtext(str(f), detail=1)
                # Extract text + bounding boxes + confidence
                texts = []
                for bbox, text, conf in text_data:
                    texts.append({
                        "text": text,
                        "confidence": round(conf, 3),
                        "y_pos": int(bbox[0][1]),  # top-left Y position
                    })
                results[f.name] = texts
            except Exception as e:
                results[f.name] = [{"error": str(e)}]
        return results
    except ImportError:
        print("  EasyOCR not available, skipping OCR", flush=True)
        return {}

def main():
    # Get March 20 screenshots
    march_files = sorted([
        f for f in SCREENSHOTS_DIR.iterdir()
        if f.name.startswith("Screenshot_20260320") and f.suffix == ".jpg"
    ])
    
    print(f"Found {len(march_files)} March 20 screenshots", flush=True)
    
    # Visual analysis
    print("\n--- Visual Analysis ---", flush=True)
    visual_results = []
    for f in march_files:
        print(f"  Analyzing: {f.name}", flush=True)
        try:
            visual_results.append(analyze_image(f))
        except Exception as e:
            visual_results.append({"file": f.name, "error": str(e)})
    
    # OCR
    print("\n--- OCR Analysis ---", flush=True)
    ocr_results = run_ocr_batch(march_files)
    
    # Merge results
    combined = []
    for vis in visual_results:
        fname = vis["file"]
        ocr = ocr_results.get(fname, [])
        # Get top text elements for screen identification
        if ocr and not any("error" in t for t in ocr):
            texts_sorted = sorted(ocr, key=lambda x: x.get("y_pos", 9999))
            top_texts = [t["text"] for t in texts_sorted[:15]]
            all_texts = [t["text"] for t in texts_sorted]
        else:
            top_texts = []
            all_texts = []
        
        combined.append({
            **vis,
            "ocr_top": top_texts,
            "ocr_all": " | ".join(all_texts) if all_texts else "(no OCR)",
            "ocr_count": len(ocr),
        })
    
    # Write output
    with open(OUTPUT, "w") as f:
        json.dump(combined, f, indent=2, default=str)
    print(f"\nResults written to {OUTPUT}", flush=True)
    
    # Summary
    print("\n=== QUICK SUMMARY ===", flush=True)
    for item in combined:
        fname = item["file"].replace("Screenshot_20260320_", "").replace("_FitQuest.jpg", "")
        brightness = item.get("overall_brightness", 0)
        has_white = item.get("has_white_bg", False)
        top_text = " | ".join(item.get("ocr_top", [])[:5])
        flag = "⚠️ WHITE BG" if has_white else ""
        print(f"  {fname}: bright={brightness:.0f} {flag} → {top_text[:80]}", flush=True)

if __name__ == "__main__":
    main()
