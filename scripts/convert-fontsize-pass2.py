#!/usr/bin/env python3
"""Pass 2: Convert fontSize: X on lines that end with // lint-ok (but fontSize isn't adjacent to the comment)."""

import re
import os
import subprocess

PX_TO_TOKEN = {
    8: 'xxs', 9: 'micro', 10: 'xs', 11: 'captionSm', 12: 'caption',
    13: 'label', 14: 'bodySmall', 15: 'bodyMid', 16: 'body',
    17: 'h4', 18: 'h4', 20: 'h3', 22: 'h3', 24: 'h2', 26: 'h2',
    28: 'h1Sm', 32: 'h1', 34: 'display', 36: 'display',
    40: 'displayLg', 48: 'hero', 56: 'jumbo', 120: 'mega',
}

WORKSPACE = '/home/kheleli/dev/backend/projects/mobile_without_server'

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
    new_lines = []
    
    for line in lines:
        # Check if line has both fontSize: X and // lint-ok
        if 'fontSize:' in line and '// lint-ok' in line:
            # Replace fontSize: X with fontSize: typography.sizes.TOKEN
            def replace_fs(m):
                nonlocal changes
                px = int(m.group(1))
                if px in PX_TO_TOKEN:
                    changes += 1
                    return f'fontSize: typography.sizes.{PX_TO_TOKEN[px]}'
                return m.group(0)
            
            line = re.sub(r'fontSize:\s*(\d+)', replace_fs, line)
            # Remove // lint-ok from end of line
            line = re.sub(r'\s*//\s*lint-ok\s*$', '\n', line)
        
        new_lines.append(line)
    
    if changes > 0:
        # Check/add typography import
        content = ''.join(new_lines)
        if not re.search(r"import.*typography.*from.*theme-system", content):
            # Check if there's an existing theme-system import
            has_theme = re.search(r"(import\s*\{)([^}]*)(}\s*from\s*['\"].*theme-system['\"];?)", content)
            if has_theme and 'typography' not in has_theme.group(2):
                old = has_theme.group(0)
                imports_str = has_theme.group(2).rstrip()
                new = has_theme.group(1) + imports_str + ', typography ' + has_theme.group(3)
                content = content.replace(old, new, 1)
            elif not has_theme:
                rel_path = get_relative_import(filepath)
                import_line = f"import {{ typography }} from '{rel_path}';\n"
                # Insert after last import
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
    result = subprocess.run(
        ['grep', '-rl', 'fontSize.*// lint-ok', 'app/', 'src/components/',
         '--include=*.tsx', '--include=*.ts'],
        capture_output=True, text=True, cwd=WORKSPACE
    )
    
    files = [os.path.join(WORKSPACE, f.strip()) for f in result.stdout.strip().split('\n') if f.strip()]
    total = 0
    
    for filepath in sorted(files):
        n = process_file(filepath)
        if n > 0:
            rel = os.path.relpath(filepath, WORKSPACE)
            print(f"  {rel}: {n} replacements")
            total += n
    
    print(f"\nPass 2 total: {total} fontSize replacements across {len(files)} files")

if __name__ == '__main__':
    main()
