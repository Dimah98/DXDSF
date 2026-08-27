import os
import json
import re
from pathlib import Path

# Директорії
DATA_DIR = Path(r"d:\SF\data\discord_exports")
OUTPUT_REPORT = Path(r"d:\SF\DISCORD_INSIGHTS_REPORT.md")

KEYWORDS_UPDATES = ["update", "patch", "changelog", "release", "chapter", "season", "nerf", "buff", "rebalance", "announcement", "оновлення", "патч"]
KEYWORDS_MECHANICS = ["mechanic", "formula", "mutation", "giant crop", "fertilizer", "boost", "faction", "oil", "obsidian", "lava", "pet", "bee", "honey", "flower", "fishing", "bait", "механіка", "мутація", "бджоли"]
KEYWORDS_SECRETS_HACKS = ["secret", "trick", "lifehack", "tip", "hidden", "exploit", "roi", "xp", "strategy", "guide", "best way", "optimal", "секрет", "лайфхак", "порада", "стратегія"]

def load_exports():
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        return []
    
    files = list(DATA_DIR.glob("*.json")) + list(DATA_DIR.glob("*.txt"))
    return files

def parse_json_export(file_path):
    results = {
        "channel": file_path.stem,
        "updates": [],
        "mechanics": [],
        "secrets_hacks": [],
        "top_reacted": []
    }
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        messages = data.get("messages", [])
        channel_name = data.get("channel", {}).get("name", file_path.stem)
        results["channel"] = channel_name

        for msg in messages:
            content = msg.get("content", "").strip()
            if not content:
                continue
            
            author = msg.get("author", {}).get("name", "Unknown")
            is_bot = msg.get("author", {}).get("isBot", False)
            timestamp = msg.get("timestamp", "")
            reactions = msg.get("reactions", [])
            reaction_count = sum(r.get("count", 0) for r in reactions)
            
            msg_obj = {
                "author": author,
                "timestamp": timestamp,
                "content": content,
                "reactions": reaction_count,
                "pinned": msg.get("isPinned", False)
            }
            
            content_lower = content.lower()
            
            # Categorize
            if any(k in content_lower for k in KEYWORDS_UPDATES):
                results["updates"].append(msg_obj)
            if any(k in content_lower for k in KEYWORDS_MECHANICS):
                results["mechanics"].append(msg_obj)
            if any(k in content_lower for k in KEYWORDS_SECRETS_HACKS):
                results["secrets_hacks"].append(msg_obj)
            if reaction_count >= 5 or msg.get("isPinned", False):
                results["top_reacted"].append(msg_obj)
                
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        
    return results

def generate_markdown_report(all_results):
    lines = [
        "# 🌻 Sunflower Land — Звіт аналізу Discord каналів",
        "",
        "> Цей звіт згенеровано автоматично на основі експортованих повідомлень з офіційного Discord сервера.",
        ""
    ]
    
    for res in all_results:
        lines.append(f"## 📢 Канал: #{res['channel']}")
        lines.append("")
        
        # Updates
        lines.append("### 🚀 Оновлення та Патчі")
        if res["updates"]:
            for item in res["updates"][:20]:
                lines.append(f"- **[{item['timestamp'][:10]}] {item['author']}**: {item['content']}")
        else:
            lines.append("_Не знайдено прямих згадок про оновлення в цьому каналі._")
        lines.append("")
        
        # Mechanics
        lines.append("### ⚙️ Цікаві механіки та формули")
        if res["mechanics"]:
            for item in res["mechanics"][:20]:
                lines.append(f"- **[{item['timestamp'][:10]}] {item['author']}**: {item['content']}")
        else:
            lines.append("_Не знайдено специфічних обговорень механік._")
        lines.append("")

        # Secrets & Hacks
        lines.append("### 💡 Секрети, лайфхаки та стратегії")
        if res["secrets_hacks"]:
            for item in res["secrets_hacks"][:20]:
                lines.append(f"- **[{item['timestamp'][:10]}] {item['author']}**: {item['content']}")
        else:
            lines.append("_Не знайдено лайфхаків._")
        lines.append("")
        
        # Top reacted
        if res["top_reacted"]:
            lines.append("### 🔥 Найпопулярніші дописи / Закріплені повідомлення")
            for item in sorted(res["top_reacted"], key=lambda x: x["reactions"], reverse=True)[:15]:
                pin_mark = "📌 " if item.get("pinned") else ""
                lines.append(f"- {pin_mark}**({item['reactions']} реакцій) {item['author']}**: {item['content']}")
            lines.append("")

        lines.append("---")
        lines.append("")

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Звіт успішно збережено у: {OUTPUT_REPORT}")

def main():
    files = load_exports()
    if not files:
        print(f"Не знайдено файлів експорту в {DATA_DIR}. Збережіть .json або .txt файли з DiscordChatExporter у папку data/discord_exports.")
        return

    all_results = []
    for file in files:
        if file.suffix == ".json":
            res = parse_json_export(file)
            all_results.append(res)

    generate_markdown_report(all_results)

if __name__ == "__main__":
    main()
