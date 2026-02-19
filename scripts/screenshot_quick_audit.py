from pathlib import Path
import json
import numpy as np
from PIL import Image

base = Path('App screenshots')
files = sorted([p for p in base.glob('*.jpg') if p.name != '_contact_sheet.jpg'])

report = []
for p in files:
    img = Image.open(p).convert('L')
    arr = np.array(img)
    h, w = arr.shape

    top = arr[: h // 3, :]
    mid = arr[h // 3 : 2 * h // 3, :]
    bot = arr[2 * h // 3 :, :]

    def grad_energy(a: np.ndarray) -> float:
        gy, gx = np.gradient(a.astype(np.float32))
        return float(np.mean(np.hypot(gx, gy)))

    edge = grad_energy(arr)
    edge_top = grad_energy(top)
    edge_mid = grad_energy(mid)
    edge_bottom = grad_energy(bot)

    contrast_std = float(arr.std())
    brightness = float(arr.mean())

    faults = []
    if contrast_std < 34:
        faults.append('Low tonal contrast')
    if edge_bottom > edge_top + 1.8:
        faults.append('Bottom region denser than top')
    if edge_mid > edge_top + 2.0:
        faults.append('Middle block visual density spike')

    score = len(faults)
    if 'Bottom region denser than top' in faults:
        score += 1

    report.append(
        {
            'file': p.name,
            'score': score,
            'faults': faults,
            'edge': round(edge, 3),
            'edge_top': round(edge_top, 3),
            'edge_mid': round(edge_mid, 3),
            'edge_bottom': round(edge_bottom, 3),
            'contrast_std': round(contrast_std, 3),
            'brightness': round(brightness, 3),
        }
    )

report.sort(key=lambda x: (x['score'], x['edge_bottom'], x['edge_mid']), reverse=True)

(base / '_analysis_report_fast.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
(base / '_index_map.json').write_text(
    json.dumps([{'id': i + 1, 'file': r['file']} for i, r in enumerate(report)], indent=2),
    encoding='utf-8',
)

print(f'Analyzed {len(report)} screenshots')
for row in report:
    print(f"{row['file']} | score={row['score']} | faults={'; '.join(row['faults']) if row['faults'] else 'none'}")
