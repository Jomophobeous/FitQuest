from pathlib import Path
import json
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

base = Path('App screenshots')
files = sorted([p for p in base.glob('*.jpg') if p.name != '_contact_sheet.jpg'])
ocr = RapidOCR()

rows = []
for p in files:
    img = np.array(Image.open(p).convert('RGB'))
    result, _ = ocr(img)
    texts = []
    if result:
        for item in result:
            txt = str(item[1]).strip()
            conf = float(item[2])
            if txt and conf >= 0.4:
                texts.append(txt)
    merged = ' | '.join(texts[:20])
    rows.append({'file': p.name, 'labels': texts[:10], 'merged': merged})

out = base / '_ocr_labels.json'
out.write_text(json.dumps(rows, indent=2), encoding='utf-8')
print('wrote', out, 'count', len(rows))
for r in rows:
    print(r['file'])
    print('  ', ' ; '.join(r['labels'][:6]))
