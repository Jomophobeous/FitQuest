from pathlib import Path
import json
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

base = Path('App screenshots')
fast_path = base / '_analysis_report_fast.json'
if not fast_path.exists():
    raise SystemExit('Missing _analysis_report_fast.json')

fast = json.loads(fast_path.read_text(encoding='utf-8'))
# take top 12 by previous score and bottom density
targets = fast[:12]
ocr = RapidOCR()
results = []

for item in targets:
    p = base / item['file']
    if not p.exists():
        continue

    img = np.array(Image.open(p).convert('RGB'))
    h, w = img.shape[:2]
    area = h * w

    ocr_result, _ = ocr(img)
    boxes = []
    text_samples = []
    if ocr_result:
        for rec in ocr_result:
            pts = np.array(rec[0], dtype=np.float32)
            txt = str(rec[1]).strip()
            conf = float(rec[2])
            if not txt:
                continue
            x1, y1 = pts[:, 0].min(), pts[:, 1].min()
            x2, y2 = pts[:, 0].max(), pts[:, 1].max()
            bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
            boxes.append((x1, y1, x2, y2, bw, bh, conf))
            if len(text_samples) < 10:
                text_samples.append(txt)

    text_count = len(boxes)
    avg_text_h = float(np.mean([b[5] for b in boxes])) if boxes else 0.0
    text_area = sum(b[4] * b[5] for b in boxes)
    text_density = float(text_area / area) if area else 0.0

    bottom_cut = h * 0.65
    bottom_area = w * (h - bottom_cut)
    bottom_text_area = 0.0
    for b in boxes:
        overlap = max(0.0, min(b[3], h) - max(b[1], bottom_cut))
        if overlap > 0:
            bottom_text_area += b[4] * overlap
    bottom_text_density = float(bottom_text_area / max(bottom_area, 1.0))

    faults = []
    if text_count > 28:
        faults.append('Too many text elements on one screen')
    if avg_text_h < 20 and text_count > 16:
        faults.append('Small text with high label count')
    if text_density > 0.11:
        faults.append('Overall text crowding')
    if bottom_text_density > 0.12:
        faults.append('Bottom CTA/navigation crowding')

    # add contrast fault from fast report
    for f in item.get('faults', []):
        if 'contrast' in f.lower() and f not in faults:
            faults.append(f)

    severity = len(faults) * 2
    if bottom_text_density > 0.10:
        severity += 1

    results.append({
        'file': item['file'],
        'severity': severity,
        'faults': faults,
        'text_count': text_count,
        'avg_text_height_px': round(avg_text_h, 2),
        'text_density': round(text_density, 4),
        'bottom_text_density': round(bottom_text_density, 4),
        'sample_text': text_samples,
    })

results.sort(key=lambda x: x['severity'], reverse=True)
out = base / '_analysis_report_targeted.json'
out.write_text(json.dumps(results, indent=2), encoding='utf-8')

print(f'Analyzed {len(results)} target screenshots')
print(f'Report: {out}')
for r in results:
    print(f"- {r['file']} | severity={r['severity']} | faults={'; '.join(r['faults']) if r['faults'] else 'none'}")
