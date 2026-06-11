import os
import glob

directory = r'd:\SF\sl-bot-remote\app\src\main\java\com\example'
pattern = os.path.join(directory, '*Screen.kt')

def fix_line(line):
    try:
        # If the line was corrupted (utf-8 read as cp1251), then its characters
        # are in the cp1251 charset. Encoding them gives the original utf-8 bytes.
        # Decoding those bytes as utf-8 will succeed and give the proper string.
        # If the line is already proper Ukrainian text, encoding to cp1251 gives
        # cp1251 bytes, which are NOT valid utf-8 (most likely), so decode('utf-8')
        # will raise UnicodeDecodeError.
        fixed = line.encode('cp1251').decode('utf-8')
        return fixed
    except Exception:
        # Either couldn't encode as cp1251 or couldn't decode as utf-8.
        # This means the line is already fine, or contains other chars.
        return line

for file_path in glob.glob(pattern):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.lstrip('\ufeff')
        
        fixed_lines = []
        for line in content.split('\n'):
            fixed_lines.append(fix_line(line))
            
        fixed_content = '\n'.join(fixed_lines)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Processed: {file_path}")
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
