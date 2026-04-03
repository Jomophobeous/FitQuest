#!/usr/bin/env python3
"""Convert margin/padding/gap: X, // lint-ok → spacing[KEY] across all files."""

import re
import os
import subprocess

WORKSPACE = '/home/kheleli/dev/backend/projects/mobile_without_server'

# Pixel value → spacing key (as string for script use)
PX_TO_KEY = {
    0: '0',
    1: "'px'",
    2: '0.5',
    3: '0.75',
    4: '1',
    5: '1.25',
    6: '1.5',
    7: '2',       # snap 7→8
    8: '2',
    10: '2.5',
    12: '3',
    14: '3.5',
    16: '4',
    18: '4.5',
    20: '5',
    24: '6',
    28: '7',
    32: '8',
    36: '9',
    40: '10',
    48: '12',
    56: '14',
    60: '15',
    80: '20',
    100: '25',
}

# Properties to convert
SPACING_PROPS = [
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'marginHorizontal', 'marginVertical',
    'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'paddingHorizontal', 'paddingVertical',
    'gap', 'rowGap', 'columnGap',
]

def get_relative_import(filepath):
    file_dir = os.path.dirname(filepath)
    theme_path = os.path.join(WORKSPACE, 'src/design/theme-system')
    rel = os.path.relpath(theme_path, file_dir)
    if not rel.startswith('.'):
        rel = './' + rel
    return rel

def process_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    changes = 0
    unmatched = []
    new_lines = []
    
    # Build regex for spacing properties
    props_pattern = '|'.join(re.escape(p) for p in SPACING_PROPS)
    
    for i, line in enumerate(lines):
        if '// lint-ok' not in line:
            new_lines.append(line)
            continue
        
        # Check if this line has a spacing property with // lint-ok
        has_spacing = re.search(rf'({props_pattern}):\s*-?\d+', line)
        if not has_spacing:
            new_lines.append(line)
            continue
        
        # Replace all spacing props on this line
        def replace_spacing(m):
            nonlocal changes
            prop = m.group(1)
            neg = m.group(2) or ''
            px_val = int(m.group(3))
            
            if px_val not in PX_TO_KEY:
                unmatched.append(f"  L{i+1}: {prop}: {neg}{px_val} — no token")
                return m.group(0)
            
            key = PX_TO_KEY[px_val]
            changes += 1
            if neg:
                return f"{prop}: -spacing[{key}]"
            return f"{prop}: spacing[{key}]"
        
        line = re.sub(rf'({props_pattern}):\s*(-?)(\d+)', replace_spacing, line)
        # Remove // lint-ok 
        line = re.sub(r'\s*//\s*lint-ok\s*$', '\n', line)
        new_lines.append(line)
    
    if changes == 0:
        return 0, unmatched
    
    content = ''.join(new_lines)
    
    # Add spacing import if not present
    if not re.search(r"import.*\bspacing\b.*from.*theme-system", content):
        has_theme = re.search(r"(import\s*\{)([^}]*)(}\s*from\s*['\"].*theme-system['\"];?)", content)
        if has_theme and 'spacing' not in has_theme.group(2):
            old = has_theme.group(0)
            imports_str = has_theme.group(2).rstrip()
            new = has_theme.group(1) + imports_str + ', spacing ' + has_theme.group(3)
            content = content.replace(old, new, 1)
        elif not has_theme:
            rel_path = get_relative_import(filepath)
            import_line = f"import {{ spacing }} from '{rel_path}';\n"
            last_pos = 0
            for m in re.finditer(r'^import\s+.*?;\s*$', content, re.MULTILINE):
                last_pos = m.end()
            if last_pos > 0:
                content = content[:last_pos] + import_line + content[last_pos:]
            else:
                content = import_line + content
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    return changes, unmatched

def main():
    result = subprocess.run(
        ['grep', '-rl', '// lint-ok', 'app/', 'src/components/',
         '--include=*.tsx', '--include=*.ts'],
        capture_output=True, text=True, cwd=WORKSPACE
    )
    
    files = [os.path.join(WORKSPACE, f.strip()) for f in result.stdout.strip().split('\n') if f.strip()]
    total = 0
    all_unmatched = []
    
    for filepath in sorted(files):
        n, um = process_file(filepath)
        if n > 0:
            rel = os.path.relpath(filepath, WORKSPACE)
            print(f"  {rel}: {n} replacements")
            total += n
        all_unmatched.extend(um)
    
    print(f"\nTotal: {total} spacing replacements across {len(files)} files")
    
    if all_unmatched:
        print(f"\nUnmatched ({len(all_unmatched)}):")
        for u in all_unmatched:
            print(u)

if __name__ == '__main__':
    main()
