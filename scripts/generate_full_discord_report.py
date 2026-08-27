import os
import sys
import json
import re
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = Path(r"d:\SF\data\discord_exports")
OUTPUT_FILE = Path(r"d:\SF\DISCORD_INSIGHTS_REPORT.md")

DEV_USERNAMES = {"adamhannigan", "craig", "spencer", "kegw", "kegw7689", "tourist", "touristador", "shinchan"}

def load_json_safe(file_path):
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    try:
        return json.loads(text)
    except Exception:
        # Attempt repair if truncated
        last_idx = text.rfind("\n    },")
        if last_idx == -1:
            last_idx = text.rfind("  },")
        if last_idx != -1:
            fixed_text = text[:last_idx + 6] + "\n  ]\n}"
            try:
                return json.loads(fixed_text)
            except Exception as e:
                print(f"Repair failed for {file_path.name}: {e}")
    return None

def run_analysis():
    files = list(DATA_DIR.glob("*.json"))
    all_messages = []

    for f in files:
        if f.name.endswith(".repaired.json"):
            continue
        data = load_json_safe(f)
        if not data:
            continue
        ch_name = data.get("channel", {}).get("name", f.stem)
        msgs = data.get("messages", [])
        print(f"Loaded #{ch_name}: {len(msgs)} messages")
        for m in msgs:
            m["_channel"] = ch_name
            all_messages.append(m)

    print(f"Total messages across all channels: {len(all_messages)}")

    # Specific topic definitions
    topics = {
        "updates": {
            "title": "📢 1. Офіційні Оновлення, Зміни Балансу та Патчноути (Updates & Balance)",
            "keywords": ["update", "patch", "changelog", "rebalance", "nerf", "buff", "chapter", "season", "auction", "maintenance"],
            "items": []
        },
        "fishing_meta": {
            "title": "🎣 2. Риболовля, Снасті, Легендарні Улови та Наживки (Fishing Meta)",
            "keywords": ["fish", "bait", "flake", "squid", "helmet", "shark", "puzzle", "crab pot", "crab hat", "rod", "chum", "aged shark"],
            "items": []
        },
        "skills_ascension": {
            "title": "🌳 3. Дерево Навичок, Вознесіння та Оптимальні Білди (Skills & Ascension)",
            "keywords": ["skill", "ascension", "shard", "reset", "respec", "tough tree", "fire kiss", "skill point", "shards"],
            "items": []
        },
        "pets_xp": {
            "title": "🐶 4. Вихованці, Фракції та Бусти Досвіду (Pets, Factions & XP Multipliers)",
            "keywords": ["pet", "bumpkin pet", "streak", "50%", "xp bonus", "feed pet", "faction", "quiver", "shield"],
            "items": []
        },
        "volcano_oil_desert": {
            "title": "🌋 5. Вулкан, Пустеля, Обсидіан та Нафта (Volcano, Desert, Oil & Obsidian)",
            "keywords": ["obsidian", "shrine", "volcano", "oil", "desert", "pepper", "drill", "lava", "purple glove"],
            "items": []
        },
        "crops_bees_animals": {
            "title": "🌻 6. Врожаї, Бджільництво, Тварини та Мутації (Crops, Bees & Animals)",
            "keywords": ["crop", "giant", "mutation", "mutant", "bee", "honey", "swarm", "sprout", "rapid root", "greenhouse", "barley", "cow", "sheep", "chicken"],
            "items": []
        },
        "economy_lifehacks": {
            "title": "💡 7. Топ Лайфхаків, Економіка, Калькулятори та Секрети (Secrets & Lifehacks)",
            "keywords": ["sfl", "calculator", "roi", "coin", "gold", "market", "profit", "wood", "burn", "stella", "secret", "trick", "tip", "best way"],
            "items": []
        },
        "dev_insights": {
            "title": "🛠️ 8. Інсайди від Розробників та Корисні API / Посилання (Dev Info & Links)",
            "keywords": ["api", "endpoint", "docs", "release", "github", "bug", "feature"],
            "items": []
        }
    }

    for m in all_messages:
        content = m.get("content", "").strip()
        if not content:
            continue
        c_lower = content.lower()
        reactions = sum(r.get("count", 0) for r in m.get("reactions", []))
        is_pinned = m.get("isPinned", False)
        author = m.get("author", {}).get("name", "")
        author_lower = author.lower()
        date = m.get("timestamp", "")[:10]
        channel = m.get("_channel", "")

        msg_obj = {
            "id": m.get("id"),
            "author": author,
            "channel": channel,
            "date": date,
            "content": content,
            "reactions": reactions,
            "pinned": is_pinned
        }

        # Dev insights
        if any(d in author_lower for d in DEV_USERNAMES):
            topics["dev_insights"]["items"].append(msg_obj)

        for k, v in topics.items():
            if k == "dev_insights":
                continue
            if any(kw in c_lower for kw in v["keywords"]):
                v["items"].append(msg_obj)

    # Build report
    lines = [
        "# 🌻 Sunflower Land: Детальний Аналітичний Звіт (Discord Insights)",
        "",
        "> Звіт складено на основі аналізу повідомлень з офіційного Discord сервера гри (`#farmers-chat`, `#strategy`, `#coders-chat`) за серпень 2026 року.",
        f"> **Всього проаналізовано повідомлень**: {len(all_messages)}",
        ""
    ]

    for k, v in topics.items():
        lines.append(f"## {v['title']}")
        lines.append("")
        
        # Deduplicate
        uniq = {}
        for it in v["items"]:
            uniq[it["id"]] = it
            
        sorted_items = sorted(uniq.values(), key=lambda x: (x["pinned"], x["reactions"], x["date"]), reverse=True)

        if not sorted_items:
            lines.append("_Немає повідомлень у цій категорії._\n")
            continue

        for it in sorted_items[:10]:
            pin = "📌 **[ЗАКРІПЛЕНО]** " if it["pinned"] else ""
            reacts = f"🔥 **+{it['reactions']}** | " if it["reactions"] > 0 else ""
            lines.append(f"**[{it['date']}] #{it['channel']} — @{it['author']}** ({reacts}{pin})")
            
            # Format content
            c_text = "\n".join(f"> {l}" for l in it["content"].split("\n") if l.strip())
            lines.append(c_text)
            lines.append("")
            
        lines.append("---")
        lines.append("")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Звіт успішно збережено у {OUTPUT_FILE}")

if __name__ == "__main__":
    run_analysis()
