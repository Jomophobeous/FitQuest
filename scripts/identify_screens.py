#!/usr/bin/env python3
"""Deep screenshot analysis: identify screens, extract key regions, detect UI issues."""
import json, os
from pathlib import Path
from PIL import Image
import numpy as np

SCREENSHOTS_DIR = Path(__file__).parent.parent / "App screenshots"

def get_pixel_row(img_arr, y, x_start, x_end):
    """Get avg color of a horizontal strip."""
    strip = img_arr[max(0,y-2):y+3, x_start:x_end]
    return tuple(int(x) for x in np.mean(strip.reshape(-1, 3), axis=0))

def identify_screen(img_path):
    """Identify screen type from visual signature."""
    img = Image.open(img_path).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    # Key region analysis
    # Status bar (top 40px)
    status_bar = arr[:40]
    # Title area (40-120px)  
    title_area = arr[40:120]
    # Tab bar (bottom 100px)
    tab_bar = arr[h-100:]
    # Content area
    content = arr[120:h-100]
    
    # Check for tab bar icons (bottom navigation)
    tab_bar_brightness = float(np.mean(tab_bar))
    has_tab_bar = tab_bar_brightness > 15  # tab bar usually has some brightness
    
    # Check for green gradient buttons
    green_mask = (arr[:,:,1] > 120) & (arr[:,:,0] < 80) & (arr[:,:,2] < 100)
    green_pixels = np.sum(green_mask)
    green_pct = green_pixels / (h * w) * 100
    
    # Check for bright content (modals, images)
    bright_content = float(np.mean(content > 200))
    
    # Title region - check for text color patterns
    title_bright = float(np.mean(title_area))
    
    # Check for specific UI patterns
    # XP bar: green horizontal line in top area
    top_quarter = arr[80:200]
    green_line = np.sum((top_quarter[:,:,1] > 140) & (top_quarter[:,:,0] < 60)) / (top_quarter.shape[0] * top_quarter.shape[1]) * 100
    
    # Check for circular elements (rings, avatars)
    center_region = arr[h//4:h//2, w//3:2*w//3]
    
    # Tab highlight detection (which tab is active)
    tab_sections = []
    tab_w = w // 5  # 5 tabs
    for i in range(5):
        section = tab_bar[:, i*tab_w:(i+1)*tab_w]
        section_green = np.sum((section[:,:,1] > 100) & (section[:,:,0] < 80)) / (section.shape[0] * section.shape[1]) * 100
        tab_sections.append(round(section_green, 1))
    
    # Find active tab (highest green %)
    active_tab_idx = tab_sections.index(max(tab_sections)) if max(tab_sections) > 0.5 else -1
    tab_names = ["Home/Dashboard", "Train/FitQuest", "Move", "Library/FitMind", "Profile"]
    active_tab = tab_names[active_tab_idx] if active_tab_idx >= 0 else "Unknown/NoTabBar"
    
    # Check for modal/overlay (very bright middle, dark edges)
    mid_strip = arr[h//3:2*h//3]
    is_modal = float(np.mean(mid_strip)) > 45 and float(np.mean(arr[:h//4])) < 15
    
    # Check for image display
    mid_variance = float(np.std(mid_strip))
    has_image = mid_variance > 55 and float(np.mean(mid_strip)) > 40
    
    # Detect text density (high edge content)
    # Convert to grayscale for edge detection
    gray = np.mean(arr, axis=2)
    # Simple edge detection via difference
    edges_h = np.abs(np.diff(gray, axis=0))
    edges_v = np.abs(np.diff(gray, axis=1))
    edge_density = float(np.mean(edges_h) + np.mean(edges_v))
    
    # Specific screen signatures
    screen_guess = "Unknown"
    confidence = "low"
    
    # Dashboard: XP bar at top, tab bar, moderate green
    if green_line > 2 and active_tab_idx == 0:
        screen_guess = "Dashboard"
        confidence = "high"
    elif is_modal:
        screen_guess = "Modal/Dialog"
        confidence = "medium"
    elif has_image:
        screen_guess = "Exercise Detail/Image"
        confidence = "medium"
    elif active_tab_idx == 0 and title_bright > 20:
        screen_guess = "Dashboard/Home"
        confidence = "medium"
    elif active_tab_idx == 1:
        screen_guess = "Train/FitQuest"
        confidence = "medium"
    elif active_tab_idx == 2:
        screen_guess = "Move"
        confidence = "medium"
    elif active_tab_idx == 3:
        screen_guess = "Library/FitMind"
        confidence = "medium"
    elif active_tab_idx == 4:
        screen_guess = "Profile"
        confidence = "medium"
    elif not has_tab_bar:
        screen_guess = "Sub-screen (no tab bar)"
        confidence = "medium"
    
    # Detect potential issues
    issues = []
    
    # Issue: Excessive darkness (content hard to read)
    if float(np.mean(content)) < 15:
        issues.append("VERY_DARK_CONTENT: content area extremely dark, may be hard to read")
    
    # Issue: Low contrast text areas
    content_std = float(np.std(content))
    if content_std < 20 and float(np.mean(content)) < 25:
        issues.append("LOW_CONTRAST: content area has very low contrast")
    
    # Issue: White/light areas in dark theme
    light_areas = np.sum(arr > 240) / (h * w * 3) * 100
    if light_areas > 5:
        issues.append(f"LIGHT_LEAK: {light_areas:.1f}% near-white pixels (dark theme violation?)")
    
    # Issue: Uneven spacing (large empty dark regions)
    content_rows = np.mean(content, axis=(1,2))
    dark_rows = np.sum(content_rows < 8)
    if dark_rows > len(content_rows) * 0.4:
        issues.append(f"EMPTY_SPACE: {dark_rows/len(content_rows)*100:.0f}% of content rows are nearly black")
    
    # Issue: Cut-off content at bottom
    bottom_content = arr[h-110:h-90]
    if float(np.mean(bottom_content)) > 30 and float(np.std(bottom_content)) > 25:
        issues.append("CONTENT_NEAR_TAB_BAR: content may be overlapping with tab bar")
    
    # Sample key pixel colors for debugging
    key_colors = {
        "top_left_100": get_pixel_row(arr, 100, 10, 50),
        "center_200": get_pixel_row(arr, 200, w//2-20, w//2+20),
        "center_mid": get_pixel_row(arr, h//2, w//2-20, w//2+20),
        "bottom_nav": get_pixel_row(arr, h-50, w//2-20, w//2+20),
    }
    
    return {
        "screen_guess": screen_guess,
        "confidence": confidence,
        "active_tab": active_tab,
        "active_tab_idx": active_tab_idx,
        "tab_green_pcts": tab_sections,
        "green_pct": round(green_pct, 2),
        "green_line_top": round(green_line, 2),
        "is_modal": is_modal,
        "has_image": has_image,
        "edge_density": round(edge_density, 2),
        "content_brightness": round(float(np.mean(content)), 2),
        "content_std": round(content_std, 2),
        "issues": issues,
        "key_colors": key_colors,
    }

def main():
    march_files = sorted([
        f for f in SCREENSHOTS_DIR.iterdir()
        if f.name.startswith("Screenshot_20260320") and f.suffix == ".jpg"
    ])
    
    results = []
    for f in march_files:
        print(f"Analyzing: {f.name}", flush=True)
        try:
            info = identify_screen(f)
            info["file"] = f.name
            info["timestamp"] = f.name.split("_")[1] + "_" + f.name.split("_")[2][:6]
            results.append(info)
        except Exception as e:
            results.append({"file": f.name, "error": str(e)})
    
    # Write detailed analysis
    output = SCREENSHOTS_DIR / "_march20_screen_analysis.json"
    with open(output, "w") as fh:
        json.dump(results, fh, indent=2, default=str)
    
    # Print summary
    print("\n" + "="*80, flush=True)
    print("SCREEN IDENTIFICATION SUMMARY", flush=True)
    print("="*80, flush=True)
    for r in results:
        ts = r.get("timestamp", "???")
        screen = r.get("screen_guess", "ERROR")
        conf = r.get("confidence", "?")
        tab = r.get("active_tab", "?")
        issues = r.get("issues", [])
        issue_str = " | ".join(issues) if issues else "OK"
        print(f"  {ts}: [{conf:6s}] {screen:30s} (tab: {tab})", flush=True)
        if issues:
            for iss in issues:
                print(f"           ⚠️  {iss}", flush=True)
    
    print("\n" + "="*80, flush=True)
    print("ISSUE SUMMARY", flush=True)
    print("="*80, flush=True)
    all_issues = []
    for r in results:
        for iss in r.get("issues", []):
            all_issues.append((r.get("timestamp", "?"), iss))
    
    if all_issues:
        for ts, iss in all_issues:
            print(f"  {ts}: {iss}", flush=True)
    else:
        print("  No issues detected!", flush=True)
    
    print(f"\nTotal screenshots: {len(results)}", flush=True)
    print(f"Screens with issues: {sum(1 for r in results if r.get('issues'))}", flush=True)

if __name__ == "__main__":
    main()
