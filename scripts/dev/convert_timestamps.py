import json
import re
from datetime import datetime

# Read the JSON file
with open('d:\\SF\\FF.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Function to convert timestamp to readable format
def convert_timestamp(match):
    timestamp_ms = int(match.group())
    # Convert milliseconds to seconds
    timestamp_s = timestamp_ms / 1000
    # Convert to datetime
    dt = datetime.fromtimestamp(timestamp_s)
    # Format as readable string
    return f'"{dt.strftime("%Y-%m-%d %H:%M:%S")}"'

# Find all 13-digit timestamps (Unix milliseconds)
# Pattern: standalone 13-digit numbers (not part of larger numbers)
pattern = r'(?<!\d)(\d{13})(?!\d)'

# Replace all timestamps
content_converted = re.sub(pattern, convert_timestamp, content)

# Write back to file
with open('d:\\SF\\FF.json', 'w', encoding='utf-8') as f:
    f.write(content_converted)

print("Timestamps converted successfully!")
