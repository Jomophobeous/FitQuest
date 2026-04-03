#!/usr/bin/env python3
"""Convert fontSize: X, // lint-ok → fontSize: typography.sizes.TOKEN across all files."""

import re
import os
import sys

# px → token mapping (includes snaps for non-standard sizes)
PX_TO_TOKEN = {
    8: 'xxs',
    9: 'micro',
    10: 'xs',
    11: 'captionSm',
    12: 'caption',
    13: 'label',
    14: 'bodySmall',
    15: 'bodyMid',
    16: 'body',
    17: 'h4',        # snap 17→18
    18: 'h4',
    20: 'h3',
    22: 'h3',        # snap 22→20
    24: 'h2',
    26: 'h2',        # snap 26→24
    28: 'h1Sm',
    32: 'h1',
    34: 'display',   # snap 34→36
    36: 'display',
    40: 'displayLg',
    48: 'hero',
    56: 'jumbo',
    120: 'mega',
}

WORKSPACE = '/home/kheleli/dev/backend/projects/mobile_without_server'
THEME_MODULE = 'src/design/theme-system'

def get_relative_import(filepath):
    """Calculate relative path from file to theme-system.ts."""
    file_dir = os.path.dirname(filepath)
    theme_path = os.path.join(WORKSPACE, THEME_MODULE)
    rel = os.path.relpath(theme_path, file_dir)
    # Ensure starts with ./ or ../
    if not rel.startswith('.'):
        rel = './' + rel
    return rel

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    changes = 0
    snaps = []
    
    # Pattern: fontSize: 14, // lint-ok  OR  fontSize: 14 // lint-ok
    # Also handle fontSize: 14,// lint-ok (no space before //)
    def replace_fontsize(match):
        nonlocal changes
        prefix = match.group(1)  # everything before the number
        px_val = int(match.group(2))
        suffix = match.group(3)  # comma or nothing
        
        if px_val not in PX_TO_TOKEN:
            print(f"  WARNING: No token for fontSize: {px_val} in {filepath}")
            return match.group(0)  # leave unchanged
        
        token = PX_TO_TOKEN[px_val]
        actual_px = {
            'xxs': 8, 'micro': 9, 'xs': 10, 'captionSm': 11, 'caption': 12,
            'label': 13, 'bodySmall': 14, 'bodyMid': 15, 'body': 16,
            'h4': 18, 'h3': 20, 'h2': 24, 'h1Sm': 28, 'h1': 32,
            'display': 36, 'displayLg': 40, 'hero': 48, 'jumbo': 56, 'mega': 120,
        }
        
        # Track snaps
        if px_val != actual_px[token]:
            snaps.append(f"  SNAP: {px_val}px → {token} ({actual_px[token]}px)")
        
        changes += 1
        return f"{prefix}typography.sizes.{token}{suffix}"
    
    # Match: fontSize: 14, // lint-ok  and  fontSize: 14 // lint-ok
    pattern = r'(fontSize:\s*)(\d+)(,?\s*)//\s*lint-ok'
    content = re.sub(pattern, replace_fontsize, content)
    
    if changes == 0:
        return 0, []
    
    # Add typography import if not present
    if 'typography' not in original or 'import' not in content.split('typography')[0][-200:]:
        # Check if file already imports from theme-system
        rel_path = get_relative_import(filepath)
        theme_import_pattern = r"import\s*\{([^}]*)\}\s*from\s*['\"]" + re.escape(rel_path).replace(r'\./', r'\.?/?') + r"['\"]"
        
        # More flexible: check for any import from theme-system
        has_theme_import = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"].*theme-system['\"]", content)
        
        if has_theme_import and 'typography' not in has_theme_import.group(1):
            # Add typography to existing import
            old_imports = has_theme_import.group(1)
            new_imports = old_imports.rstrip() + ', typography'
            content = content.replace(has_theme_import.group(0),
                                     has_theme_import.group(0).replace(old_imports, new_imports))
        elif not has_theme_import:
            # Check if there's any import of typography already
            if not re.search(r"import.*typography.*from", content):
                # Add new import after last import
                import_line = f"import {{ typography }} from '{rel_path}';\n"
                # Find last import statement
                last_import = None
                for m in re.finditer(r'^import\s+.*?[;\n]', content, re.MULTILINE):
                    last_import = m
                if last_import:
                    insert_pos = last_import.end()
                    content = content[:insert_pos] + import_line + content[insert_pos:]
                else:
                    content = import_line + content
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    return changes, snaps

def main():
    # Get all files with fontSize lint-ok
    import subprocess
    result = subprocess.run(
        ['grep', '-rl', 'fontSize.*// lint-ok', 'app/', 'src/components/',
         '--include=*.tsx', '--include=*.ts'],
        capture_output=True, text=True, cwd=WORKSPACE
    )
    
    files = [os.path.join(WORKSPACE, f.strip()) for f in result.stdout.strip().split('\n') if f.strip()]
    
    total_changes = 0
    total_snaps = []
    
    for filepath in sorted(files):
        changes, snaps = process_file(filepath)
        if changes > 0:
            rel = os.path.relpath(filepath, WORKSPACE)
            print(f"  {rel}: {changes} replacements")
            total_changes += changes
            total_snaps.extend(snaps)
    
    print(f"\nTotal: {total_changes} fontSize replacements across {len(files)} files")
    if total_snaps:
        print(f"\nSnaps ({len(total_snaps)}):")
        for s in total_snaps:
            print(s)

if __name__ == '__main__':
    main()
