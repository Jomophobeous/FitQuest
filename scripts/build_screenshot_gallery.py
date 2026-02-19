from pathlib import Path

base = Path('App screenshots')
images = sorted([p for p in base.glob('*.jpg') if p.name != '_contact_sheet.jpg'])

cards = []
for idx, img in enumerate(images, 1):
    cards.append(
        f'''<article class="card">
  <a href="../App%20screenshots/{img.name.replace(' ', '%20')}" target="_blank" rel="noreferrer">
    <img src="../App%20screenshots/{img.name.replace(' ', '%20')}" alt="{img.name}" loading="lazy" />
  </a>
  <div class="meta">
    <div class="id">#{idx:02d}</div>
    <div class="name">{img.name}</div>
  </div>
</article>'''
    )

html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FitQuest Screenshot Gallery</title>
  <style>
    :root {{ --bg:#0b0f14; --card:#141a22; --text:#e6edf3; --muted:#95a1ad; --border:#263241; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--text); }}
    header {{ position:sticky; top:0; background:rgba(11,15,20,.92); backdrop-filter: blur(6px); border-bottom:1px solid var(--border); padding:12px 16px; z-index:1; }}
    h1 {{ margin:0; font-size:16px; }}
    .sub {{ color:var(--muted); font-size:12px; margin-top:4px; }}
    main {{ padding:14px; display:grid; grid-template-columns: repeat(auto-fill,minmax(180px,1fr)); gap:12px; }}
    .card {{ background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; }}
    img {{ width:100%; height:360px; object-fit:cover; display:block; background:#000; }}
    .meta {{ padding:8px; }}
    .id {{ font-size:12px; color:#7dd3fc; font-weight:700; }}
    .name {{ font-size:11px; color:var(--muted); line-height:1.35; word-break:break-all; margin-top:4px; }}
  </style>
</head>
<body>
  <header>
    <h1>FitQuest Screenshot Gallery</h1>
    <div class="sub">{len(images)} images. Click any tile to open full-size image.</div>
  </header>
  <main>
    {''.join(cards)}
  </main>
</body>
</html>'''

out = Path('reports/screenshot-gallery.html')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out)
