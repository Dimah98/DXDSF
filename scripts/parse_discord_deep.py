import os
import sys
import json
import re
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path(r"d:\SF\data\discord_exports")

def check_files():
    files = list(DATA_DIR.glob("*.json"))
    ready = []
    locked = []
    for f in files:
        try:
            with open(f, "rb") as fp:
                pass
            ready.append(f)
        except Exception:
            locked.append(f)
    return ready, locked

def analyze_file(file_path):
    print(f"\n==================== ANALYZING: {file_path.name} ====================")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    messages = data.get("messages", [])
    print(f"Total messages: {len(messages)}")

    # Sort by reactions
    reacted = []
    for m in messages:
        reactions = m.get("reactions", [])
        total_reacts = sum(r.get("count", 0) for r in reactions)
        content = m.get("content", "").strip()
        if content:
            reacted.append((total_reacts, m))

    reacted.sort(key=lambda x: x[0], reverse=True)

    print("\n--- TOP REACTED / PINNED MESSAGES ---")
    for count, m in reacted[:15]:
        pin = "[PINNED] " if m.get("isPinned") else ""
        print(f"[{count} reacts] {pin}{m['author']['name']} ({m['timestamp'][:10]}): {m['content']}")
        print("-" * 40)

if __name__ == "__main__":
    ready, locked = check_files()
    print(f"Ready files ({len(ready)}): {[f.name for f in ready]}")
    print(f"Locked / downloading files ({len(locked)}): {[f.name for f in locked]}")
    for f in ready:
        analyze_file(f)
