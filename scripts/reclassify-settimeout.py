#!/usr/bin/env python3
"""Replace // lint-ok on setTimeout lines with proper semantic tags (// animation or // debounce)."""

import re
import os

WORKSPACE = '/home/kheleli/dev/backend/projects/mobile_without_server'

# Classification rules based on context
ANIMATION_KEYWORDS = [
    'Badge', 'badge', 'Shown', 'shown', 'visible', 'shake', 'fade',
    'confetti', 'Confetti', 'Ready', 'ready', 'onReady', 'TICK_MS',
    'tick', 'scrollTo', 'scroll', 'MIN_SPLASH', 'safetyTimer',
    'refreshing', 'Refreshing', 'levelUp', 'LevelUp', 'MindExercise',
    'focus', 'selectedExercise'
]

DEBOUNCE_KEYWORDS = [
    'Debounce', 'debounce', 'search', 'Search', 'loadTimer', 'LoadTimer',
    'Load', 'biometric', 'Biometric', 'backoff', 'Backoff', 'timeout',
    'Timeout', 'generate', 'replace', 'router', 'Promise'
]

def classify_line(line):
    """Determine if setTimeout usage is animation or debounce."""
    for kw in ANIMATION_KEYWORDS:
        if kw in line:
            return 'animation'
    for kw in DEBOUNCE_KEYWORDS:
        if kw in line:
            return 'debounce'
    return 'debounce'  # default: debounce (safer tag)

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    changes = 0
    
    def replace_lint_ok_on_settimeout(m):
        nonlocal changes
        full_match = m.group(0)
        if 'setTimeout' not in full_match:
            return full_match
        
        tag = classify_line(full_match)
        changes += 1
        return full_match.replace('// lint-ok', f'// {tag}')
    
    # Match lines with setTimeout and // lint-ok
    content = re.sub(r'^.*setTimeout.*//\s*lint-ok.*$', replace_lint_ok_on_settimeout, content, flags=re.MULTILINE)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
    
    return changes

def main():
    import subprocess
    result = subprocess.run(
        ['grep', '-rl', '// lint-ok', 'app/', 'src/components/',
         '--include=*.tsx', '--include=*.ts'],
        capture_output=True, text=True, cwd=WORKSPACE
    )
    
    if not result.stdout.strip():
        print("No files with // lint-ok found")
        return
    
    files = [os.path.join(WORKSPACE, f.strip()) for f in result.stdout.strip().split('\n') if f.strip()]
    total = 0
    
    for filepath in sorted(files):
        n = process_file(filepath)
        if n > 0:
            rel = os.path.relpath(filepath, WORKSPACE)
            print(f"  {rel}: {n} reclassified")
            total += n
    
    print(f"\nTotal: {total} setTimeout lines reclassified")

if __name__ == '__main__':
    main()
