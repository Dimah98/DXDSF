import os
import sys
import json
import re
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path(r"d:\SF\data\discord_exports")

def get_strategy_data():
    strategy_file = list(DATA_DIR.glob("*strategy*.json"))[0]
    with open(strategy_file, "r", encoding="utf-8") as f:
        return json.load(f)

def topic_search(messages, keywords):
    matches = []
    for m in messages:
        c = m.get("content", "")
        if not c:
            continue
        c_lower = c.lower()
        if any(k.lower() in c_lower for k in keywords):
            reactions = sum(r.get("count", 0) for r in m.get("reactions", []))
            matches.append((reactions, m))
    return matches

def main():
    data = get_strategy_data()
    messages = data["messages"]
    print(f"Total strategy messages: {len(messages)}")

    topics = {
        "🎣 Риболовля (Fishing, Bait, Helmet, Squid)": ["fish", "bait", "flake", "squid", "helmet", "puzzle", "rod", "crab pot"],
        "🌳 Навички та Скидання (Skills, Ascension, Respec, Skill Tree)": ["skill", "ascension", "shard", "reset", "tree", "build", "respec"],
        "🐶 Вихованці та Бонуси (Pets, Level, XP, Bumpkin XP)": ["pet", "level 8", "bonus", "bumpkin pet", "50%"],
        "⚔️ Фракції (Factions, Quiver, Emblems, Events)": ["faction", "quiver", "nightshade", "goblin", "sunflorian"],
        "🌾 Врожаї, Добрива та Мутації (Crops, Giant, Mutation, Fertilizer)": ["crop", "seed", "giant", "mutation", "mutant", "fertilizer", "sprout"],
        "💎 Економіка, Калькулятори та Оптимізація (SFL, Coins, ROI, Calculator)": ["sfl", "calculator", "roi", "coin", "gold", "market", "profit", "burn"],
        "🛢️ Нафта, Пустеля та Лава (Oil, Desert, Obsidian, Lava)": ["oil", "desert", "obsidian", "lava", "drill"]
    }

    for topic_name, kws in topics.items():
        print(f"\n==================== {topic_name} ====================")
        matches = topic_search(messages, kws)
        print(f"Total matches: {len(matches)}")
        
        # Sort by reactions then timestamp
        matches.sort(key=lambda x: (x[0], x[1]["timestamp"]), reverse=True)
        for r_count, m in matches[:8]:
            print(f"[{m['timestamp'][:10]}] {m['author']['name']} ({r_count} reacts): {m['content']}")
            print("-" * 30)

if __name__ == "__main__":
    main()
