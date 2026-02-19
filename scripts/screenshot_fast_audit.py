from PIL import Image
from pathlib import Path
import json
import numpy as np

base = Path('App screenshots')
files = sorted([p for p in base.glob('*.jpg') if p.name != '_contact_sheet.jpg'])
report = []

for p in files:
    img = Image.open(p).convert('L')
    arr = np.array(img)
    h, w = arr.shape

    gy, gx = np.gradient(arr.astype(float))
    edge = float(np.mean(np.hypot(gx, gy)))

    top = arr[: h // 3, :]
    mid = arr[h // 3 : 2 * h // 3, :]
    bot = arr[2 * h // 3 :, :]

    def edge_metric(a: np.ndarray) -> float:
        gy2, gx2 = np.gradient(a.astype(float))
        return float(np.mean(np.hypot(gx2, gy2)))

    edge_top = edge_metric(top)
    edge_mid = edge_metric(mid)
    edge_bottom = edge_metric(bot)

    faults = []
    if edge > 18:
        faults.append('High visual density')
    if edge_bottom > 20:
        faults.append('Bottom-region crowding')
    if arr.std() < 42:
        faults.append('Low tonal contrast')

    score = len(faults) * 2
    if edge_bottom > edge_top + 2.5:
        score += 2

    report.append(
        {
            'file': p.name,
            'score': score,
            'faults': faults,
            'edge': round(edge, 2),
            'edge_top': round(edge_top, 2),
            'edge_mid': round(edge_mid, 2),
            'edge_bottom': round(edge_bottom, 2),
            'brightness': round(float(arr.mean()), 2),
            'contrast_std': round(float(arr.std()), 2),
        }
    )

report.sort(key=lambda x: (x['score'], x['edge_bottom'], x['edge']), reverse=True)
out = base / '_analysis_report_fast.json'
out.write_text(json.dumps(report, indent=2), encoding='utf-8')

print(f'Analyzed {len(report)} screenshots')
print(f'Report: {out}')
print('Top 12 issues:')
for item in report[:12]:
    print(f"- {item['file']} | score={item['score']} | faults={'; '.join(item['faults']) if item['faults'] else 'none'}")
