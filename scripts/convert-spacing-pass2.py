#!/usr/bin/env python3
"""Pass 2: Convert ALL remaining raw spacing values caught by lint (inline JSX and StyleSheet)."""

import re
import os
import subprocess

WORKSPACE = '/home/kheleli/dev/backend/projects/mobile_without_server'

PX_TO_KEY = {
    0: '0', 1: "'px'", 2: '0.5', 3: '0.75', 4: '1', 5: '1.25',
    6: '1.5', 7: '2', 8: '2', 10: '2.5', 12: '3', 14: '3.5',
    16: '4', 18: '4.5', 20: '5', 24: '6', 28: '7', 32: '8',
    36: '9', 40: '10', 48: '12', 56: '14', 60: '15', 80: '20', 100: '25',
}

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

def process_file(filepath, violations):
    """Process specific line numbers from lint output."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    changes = 0
    props_pattern = '|'.join(re.escape(p) for p in SPACING_PROPS)
    
    for line_num in violations:
        idx = line_num - 1
        if idx < 0 or idx >= len(lines):
            continue
        line = lines[idx]
        
        # Skip if already converted (has spacing[)
        # Only convert raw numeric values
        def replace_spacing(m):
            nonlocal changes
            prop = m.group(1)
            neg = m.group(2) or ''
            px_val = int(m.group(3))
            
            if px_val not in PX_TO_KEY:
                return m.group(0)
            
            key = PX_TO_KEY[px_val]
            changes += 1
            if neg:
                return f"{prop}: -spacing[{key}]"
            return f"{prop}: spacing[{key}]"
        
        # Only replace if it's a raw number (not already spacing[...])
        new_line = re.sub(rf'({props_pattern}):\s*(-?)(\d+)(?!\s*\])', replace_spacing, line)
        lines[idx] = new_line
    
    if changes > 0:
        content = ''.join(lines)
        
        # Ensure spacing import
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
    
    return changes

def main():
    # Run lint and parse output
    result = subprocess.run(
        ['node', 'ui-system/rules/lint.js'],
        capture_output=True, text=True, cwd=WORKSPACE
    )
    
    output = result.stdout + result.stderr
    
    # Parse violations: "  file.tsx\n    ⚠ L123:45  marginTop: 2 — ..."
    file_violations = {}
    current_file = None
    
    for line in output.split('\n'):
        line = line.strip()
        if line.endswith('.tsx') or line.endswith('.ts'):
            current_file = os.path.join(WORKSPACE, line)
        elif line.startswith('⚠') and current_file and 'no-raw-spacing' in line:
            m = re.search(r'L(\d+):', line)
            if m:
                line_num = int(m.group(1))
                if current_file not in file_violations:
                    file_violations[current_file] = []
                file_violations[current_file].append(line_num)
    
    total = 0
    for filepath, violations in sorted(file_violations.items()):
        n = process_file(filepath, violations)
        if n > 0:
            rel = os.path.relpath(filepath, WORKSPACE)
            print(f"  {rel}: {n} replacements")
            total += n
    
    print(f"\nTotal: {total} inline spacing replacements")

if __name__ == '__main__':
    main()
