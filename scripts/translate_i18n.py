#!/usr/bin/env python3
"""
FitQuest i18n Translation Pipeline
Uses deep-translator (Google Translate, free) to fill missing translations.
Designed for weak machines: small batches, delays, incremental saves.

Usage:
  python scripts/translate_i18n.py extract          # Step 1: Extract English keys to JSON
  python scripts/translate_i18n.py translate <lang>  # Step 2: Translate one language
  python scripts/translate_i18n.py translate all      # Step 2: Translate all languages
  python scripts/translate_i18n.py generate          # Step 3: Generate updated translations.ts
"""

import json
import os
import re
import sys
import time

TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'translations.ts')
WORK_DIR = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'i18n_work')
ENGLISH_JSON = os.path.join(WORK_DIR, 'en.json')

# Language codes for Google Translate
LANG_CODES = {
    'af': 'af',   # Afrikaans
    'zu': 'zu',   # Zulu
    'xh': 'xh',   # Xhosa
    'st': 'st',   # Sesotho
    'es': 'es',   # Spanish
    'fr': 'fr',   # French
    'de': 'de',   # German
    'pt': 'pt',   # Portuguese
    'zh': 'zh-CN',# Chinese Simplified
    'ja': 'ja',   # Japanese
    'ko': 'ko',   # Korean
    'ar': 'ar',   # Arabic
    'hi': 'hi',   # Hindi
    'sw': 'sw',   # Swahili
}

# Order: SA languages first, then international
LANG_ORDER = ['st', 'af', 'zu', 'xh', 'sw', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi']

BATCH_SIZE = 20       # keys merged per API call
DELAY_BETWEEN = 0.5   # seconds between API calls
SEPARATOR = ' ||| '   # separator for merging texts (survives translation)


def extract_keys_from_ts(content, lang_name):
    """Extract key-value pairs from a TypeScript const block."""
    # Find the block for this language
    pattern = rf"const {lang_name}(?:\s*:\s*[^=]+)?\s*=\s*\{{(.*?)\n\}};"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return {}
    
    block = match.group(1)
    pairs = {}
    # Match 'key.subkey': 'value' or "key.subkey": "value"
    for m in re.finditer(r"""['"]([\w.]+)['"]\s*:\s*['"](.+?)['"],?\s*$""", block, re.MULTILINE):
        key = m.group(1)
        val = m.group(2)
        pairs[key] = val
    
    # Also handle template literals and escaped quotes
    for m in re.finditer(r"""['"]([\w.]+)['"]\s*:\s*['"](.*?)(?<!\\)['"],?\s*$""", block, re.MULTILINE):
        key = m.group(1)
        if key not in pairs:
            val = m.group(2)
            pairs[key] = val
    
    return pairs


def cmd_extract():
    """Extract English keys to JSON."""
    os.makedirs(WORK_DIR, exist_ok=True)
    
    with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    en_keys = extract_keys_from_ts(content, 'en')
    
    # Also extract existing translations for all languages
    for lang in LANG_ORDER:
        lang_keys = extract_keys_from_ts(content, lang)
        lang_file = os.path.join(WORK_DIR, f'{lang}_existing.json')
        with open(lang_file, 'w', encoding='utf-8') as f:
            json.dump(lang_keys, f, ensure_ascii=False, indent=2)
        print(f"  {lang}: {len(lang_keys)} existing keys")
    
    with open(ENGLISH_JSON, 'w', encoding='utf-8') as f:
        json.dump(en_keys, f, ensure_ascii=False, indent=2)
    
    print(f"\nExtracted {len(en_keys)} English keys to {ENGLISH_JSON}")
    
    # Summary of what needs translating
    print("\nTranslation needed per language:")
    for lang in LANG_ORDER:
        lang_file = os.path.join(WORK_DIR, f'{lang}_existing.json')
        with open(lang_file, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        missing = len(en_keys) - len(existing)
        print(f"  {lang}: {missing} keys to translate ({len(existing)} already done)")


def cmd_translate(target_lang):
    """Translate missing keys for one language using Google Translate."""
    from deep_translator import GoogleTranslator
    
    if not os.path.exists(ENGLISH_JSON):
        print("Run 'extract' first!")
        return
    
    with open(ENGLISH_JSON, 'r', encoding='utf-8') as f:
        en_keys = json.load(f)
    
    # Load existing translations
    existing_file = os.path.join(WORK_DIR, f'{target_lang}_existing.json')
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            existing = json.load(f)
    else:
        existing = {}
    
    # Load any previously translated keys (resume support)
    translated_file = os.path.join(WORK_DIR, f'{target_lang}_translated.json')
    if os.path.exists(translated_file):
        with open(translated_file, 'r', encoding='utf-8') as f:
            translated = json.load(f)
    else:
        translated = {}
    
    # Merge existing into translated (existing take priority - they're human-verified)
    for k, v in existing.items():
        translated[k] = v
    
    # Find what's still missing
    missing_keys = [k for k in en_keys if k not in translated]
    
    if not missing_keys:
        print(f"  {target_lang}: All {len(en_keys)} keys already translated!")
        return
    
    print(f"  {target_lang}: {len(missing_keys)} keys to translate...")
    
    google_code = LANG_CODES[target_lang]
    translator = GoogleTranslator(source='en', target=google_code)
    
    # Process in batches - merge multiple values into single API call
    total_batches = (len(missing_keys) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for i in range(0, len(missing_keys), BATCH_SIZE):
        batch_keys = missing_keys[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        batch_values = [en_keys[k] for k in batch_keys]
        
        try:
            # Merge values with separator and translate in one API call
            merged = SEPARATOR.join(batch_values)
            merged_result = translator.translate(merged)
            
            if merged_result:
                # Split back by separator (handle variations Google might produce)
                parts = re.split(r'\s*\|\|\|\s*', merged_result)
                
                # If split count doesn't match, fall back to individual translation
                if len(parts) != len(batch_keys):
                    # Try smaller separator variations
                    for sep_pattern in [r'\|\|\|', r'\| \| \|', r'\|\s*\|\s*\|']:
                        parts = re.split(sep_pattern, merged_result)
                        parts = [p.strip() for p in parts if p.strip()]
                        if len(parts) == len(batch_keys):
                            break
                
                if len(parts) == len(batch_keys):
                    for key, result in zip(batch_keys, parts):
                        translated[key] = result.strip()
                else:
                    # Separator got mangled - fall back to individual calls
                    for key in batch_keys:
                        try:
                            result = translator.translate(en_keys[key])
                            translated[key] = result if result else en_keys[key]
                            time.sleep(0.3)
                        except Exception:
                            translated[key] = en_keys[key]
            
            # Progress
            done = min(i + BATCH_SIZE, len(missing_keys))
            print(f"    [{batch_num}/{total_batches}] {done}/{len(missing_keys)} translated")
            
        except Exception as e:
            print(f"    Error on batch {batch_num}: {e}")
            # Save progress so far
            with open(translated_file, 'w', encoding='utf-8') as f:
                json.dump(translated, f, ensure_ascii=False, indent=2)
            print(f"    Progress saved ({len(translated)} keys). Re-run to resume.")
            return
        
        # Save progress after each batch
        if batch_num % 5 == 0 or i + BATCH_SIZE >= len(missing_keys):
            with open(translated_file, 'w', encoding='utf-8') as f:
                json.dump(translated, f, ensure_ascii=False, indent=2)
        
        # Rate limiting delay
        if i + BATCH_SIZE < len(missing_keys):
            time.sleep(DELAY_BETWEEN)
    
    # Final save
    with open(translated_file, 'w', encoding='utf-8') as f:
        json.dump(translated, f, ensure_ascii=False, indent=2)
    
    print(f"  {target_lang}: Complete! {len(translated)} total keys saved.")


def cmd_translate_all():
    """Translate all languages sequentially."""
    for lang in LANG_ORDER:
        print(f"\n--- Translating: {lang} ({LANG_CODES[lang]}) ---")
        cmd_translate(lang)
        print(f"--- Done: {lang} ---")
        time.sleep(2)  # Extra pause between languages


def cmd_generate():
    """Generate the updated translations.ts file from translated JSONs."""
    if not os.path.exists(ENGLISH_JSON):
        print("Run 'extract' first!")
        return
    
    with open(ENGLISH_JSON, 'r', encoding='utf-8') as f:
        en_keys = json.load(f)
    
    with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
        original = f.read()
    
    result = original
    
    for lang in LANG_ORDER:
        translated_file = os.path.join(WORK_DIR, f'{lang}_translated.json')
        if not os.path.exists(translated_file):
            print(f"  {lang}: No translated file found, skipping.")
            continue
        
        with open(translated_file, 'r', encoding='utf-8') as f:
            translated = json.load(f)
        
        # Build the new const block
        lines = [f"const {lang}: Record<string, string> = {{"]
        
        # Group keys by category for readability
        categories = {}
        for key in en_keys:
            cat = key.split('.')[0]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(key)
        
        first_cat = True
        for cat, keys in categories.items():
            if not first_cat:
                lines.append('')  # blank line between categories
            first_cat = False
            
            for key in keys:
                val = translated.get(key, en_keys[key])
                # Escape single quotes in value
                val_escaped = val.replace("\\", "\\\\").replace("'", "\\'")
                lines.append(f"  '{key}': '{val_escaped}',")
        
        lines.append('};')
        new_block = '\n'.join(lines)
        
        # Replace the old block in the file
        pattern = rf"const {lang}(?:\s*:\s*Record<string,\s*string>)?\s*=\s*\{{.*?\n\}};"
        match = re.search(pattern, result, re.DOTALL)
        if match:
            result = result[:match.start()] + new_block + result[match.end():]
            print(f"  {lang}: Replaced with {len(translated)} keys")
        else:
            print(f"  {lang}: WARNING - could not find block to replace!")
    
    # Write the updated file
    with open(TRANSLATIONS_FILE, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"\nUpdated {TRANSLATIONS_FILE}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    cmd = sys.argv[1]
    
    if cmd == 'extract':
        cmd_extract()
    elif cmd == 'translate':
        if len(sys.argv) < 3:
            print("Usage: translate <lang|all>")
            print(f"Available: {', '.join(LANG_ORDER)}")
            return
        target = sys.argv[2]
        if target == 'all':
            cmd_translate_all()
        elif target in LANG_CODES:
            cmd_translate(target)
        else:
            print(f"Unknown language: {target}")
            print(f"Available: {', '.join(LANG_ORDER)}")
    elif cmd == 'generate':
        cmd_generate()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == '__main__':
    main()
