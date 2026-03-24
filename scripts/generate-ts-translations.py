#!/usr/bin/env python3
"""
Generate TypeScript exercise translation files from JSON translations.
Reads from scripts/exercise_translations/{lang}_47.json
Outputs to src/i18n/translations/exercises-{lang}.ts

Usage:
  python3 scripts/generate-ts-translations.py hi sw
  python3 scripts/generate-ts-translations.py --all    # All JSON files
"""

import json
import os
import sys

LANG_META = {
    'af': ('Afrikaans', 'motivational, evolution-focused'),
    'zu': ('isiZulu', 'strong, empowering'),
    'xh': ('isiXhosa', 'dynamic, community-spirited'),
    'st': ('Sesotho', 'warm, encouraging'),
    'es': ('Spanish', 'energetic, motivating'),
    'fr': ('French', 'elegant, precise'),
    'de': ('German', 'precise, structured'),
    'pt': ('Portuguese', 'dynamic, warm'),
    'zh': ('Chinese', 'concise, respectful'),
    'ja': ('Japanese', 'respectful, encouraging'),
    'ko': ('Korean', 'energetic, supportive'),
    'ar': ('Arabic', 'powerful, inspiring'),
    'hi': ('Hindi', 'motivational, warm'),
    'sw': ('Swahili', 'empowering, community-focused'),
}

TRANSLATIONS_DIR = os.path.join(os.path.dirname(__file__), 'exercise_translations')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'translations')


def escape_ts_string(s: str) -> str:
    """Escape string for TypeScript single-quoted string literal."""
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')


def generate_ts_file(lang_code: str, data: dict) -> str:
    """Generate TypeScript file content from translation data."""
    lang_name, tone = LANG_META.get(lang_code, (lang_code.upper(), 'neutral'))
    count = len(data)

    lines = [
        f'/**',
        f' * {lang_name} ({lang_code}) Exercise Translations — {count} exercises',
        f' * Tone: {tone}',
        f' * Exercise names: kept recognizable with {lang_name} adaptation',
        f' */',
        f"import {{ registerLanguageTranslations }} from '../exercise-translation-seed';",
        f'',
        f"registerLanguageTranslations('{lang_code}', {{",
    ]

    exercise_ids = sorted(data.keys(), key=lambda x: (x.split('_')[0], int(x.split('_')[1]) if x.split('_')[1].isdigit() else 0))

    for eid in exercise_ids:
        entry = data[eid]
        name = escape_ts_string(entry['name'])
        instructions = entry.get('instructions', [])
        audio = entry.get('audio', {})

        lines.append(f'  {eid}: {{')
        lines.append(f"    name: '{name}',")
        lines.append(f'    instructions: [')
        for step in instructions:
            lines.append(f"      '{escape_ts_string(step)}',")
        lines.append(f'    ],')
        lines.append(f'    audio: {{')
        lines.append(f"      intro: '{escape_ts_string(audio.get('intro', ''))}',")
        lines.append(f"      setup: '{escape_ts_string(audio.get('setup', ''))}',")
        lines.append(f"      execution: '{escape_ts_string(audio.get('execution', ''))}',")
        lines.append(f"      transition: '{escape_ts_string(audio.get('transition', ''))}',")
        lines.append(f'    }},')
        lines.append(f'  }},')

    lines.append(f'}});')
    lines.append(f'')

    return '\n'.join(lines)


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 generate-ts-translations.py <lang_code> [<lang_code> ...]')
        print('       python3 generate-ts-translations.py --all')
        sys.exit(1)

    if sys.argv[1] == '--all':
        # Find all *_47.json files
        langs = []
        for f in os.listdir(TRANSLATIONS_DIR):
            if f.endswith('_47.json') and not f.startswith('_'):
                langs.append(f.replace('_47.json', ''))
        if not langs:
            print('No *_47.json files found in', TRANSLATIONS_DIR)
            sys.exit(1)
    else:
        langs = sys.argv[1:]

    for lang in langs:
        json_path = os.path.join(TRANSLATIONS_DIR, f'{lang}_47.json')
        if not os.path.exists(json_path):
            print(f'[SKIP] {json_path} not found')
            continue

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        ts_content = generate_ts_file(lang, data)
        out_path = os.path.join(OUTPUT_DIR, f'exercises-{lang}.ts')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(ts_content)

        print(f'[OK] exercises-{lang}.ts — {len(data)} exercises')


if __name__ == '__main__':
    main()
