#!/usr/bin/env python3
"""
Focused translator for slow/African languages.
Uses individual API calls instead of merged text.
More reliable but slower - designed to not hang.
"""

import json
import os
import re
import sys
import time
import signal

WORK_DIR = os.path.join(os.path.dirname(__file__), 'i18n_work')
ENGLISH_JSON = os.path.join(WORK_DIR, 'en.json')

LANG_CODES = {
    'st': 'st', 'zu': 'zu', 'xh': 'xh', 'sw': 'sw',
}


class TimeoutError(Exception):
    pass


def timeout_handler(signum, frame):
    raise TimeoutError("API call timed out")


def translate_slow_lang(target_lang):
    from deep_translator import GoogleTranslator

    with open(ENGLISH_JSON, 'r', encoding='utf-8') as f:
        en_keys = json.load(f)

    translated_file = os.path.join(WORK_DIR, f'{target_lang}_translated.json')

    # Load existing + previously translated
    existing_file = os.path.join(WORK_DIR, f'{target_lang}_existing.json')
    translated = {}
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            translated = json.load(f)
    if os.path.exists(translated_file):
        with open(translated_file, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        # Existing human translations take priority
        for k in translated:
            prev[k] = translated[k]
        translated = prev

    missing_keys = [k for k in en_keys if k not in translated]
    if not missing_keys:
        print(f"  {target_lang}: All {len(en_keys)} keys done!")
        return

    print(f"  {target_lang}: {len(missing_keys)} keys remaining...")

    google_code = LANG_CODES[target_lang]
    translator = GoogleTranslator(source='en', target=google_code)

    # Individual calls with timeout protection
    done = 0
    errors = 0
    for key in missing_keys:
        en_val = en_keys[key]

        try:
            # Set alarm for 15 second timeout
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(15)

            result = translator.translate(en_val)
            signal.alarm(0)  # Cancel alarm

            if result:
                translated[key] = result
            else:
                translated[key] = en_val  # fallback to English
            done += 1
            errors = 0  # Reset consecutive error count

        except TimeoutError:
            signal.alarm(0)
            translated[key] = en_val  # fallback
            done += 1
            errors += 1
            # Recreate translator after timeout
            translator = GoogleTranslator(source='en', target=google_code)

        except Exception as e:
            signal.alarm(0)
            translated[key] = en_val  # fallback
            done += 1
            errors += 1
            if errors > 10:
                print(f"    Too many consecutive errors, saving and stopping.")
                break
            # Recreate translator after error
            translator = GoogleTranslator(source='en', target=google_code)

        # Progress every 20 keys
        if done % 20 == 0:
            print(f"    {done}/{len(missing_keys)} ({len(translated)}/1033 total)")
            # Save periodically
            with open(translated_file, 'w', encoding='utf-8') as f:
                json.dump(translated, f, ensure_ascii=False, indent=2)

        # Small delay between calls
        time.sleep(0.3)

    # Final save
    with open(translated_file, 'w', encoding='utf-8') as f:
        json.dump(translated, f, ensure_ascii=False, indent=2)
    print(f"  {target_lang}: Saved {len(translated)}/1033 keys")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python translate_slow.py <st|zu|xh|sw|all>")
        sys.exit(1)

    target = sys.argv[1]
    if target == 'all':
        for lang in ['st', 'zu', 'xh', 'sw']:
            print(f"\n--- {lang} ---")
            translate_slow_lang(lang)
            time.sleep(2)
    elif target in LANG_CODES:
        translate_slow_lang(target)
    else:
        print(f"Unknown: {target}. Use st, zu, xh, sw, or all")
