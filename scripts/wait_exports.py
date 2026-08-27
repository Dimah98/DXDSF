import os
import sys
import time
import json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
DATA_DIR = Path(r"d:\SF\data\discord_exports")

def wait_for_all_files(timeout=180):
    print("Очікування завершення завантаження всіх файлів DiscordChatExporter...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        files = list(DATA_DIR.glob("*.json"))
        if not files:
            time.sleep(2)
            continue
            
        all_ready = True
        for f in files:
            try:
                with open(f, "rb") as fp:
                    pass
            except Exception:
                all_ready = False
                break
                
        if all_ready:
            print("Всі файли успішно вивантажені та готові до аналізу!")
            return files
            
        time.sleep(3)
        print(".", end="", flush=True)
        
    return list(DATA_DIR.glob("*.json"))

if __name__ == "__main__":
    ready_files = wait_for_all_files()
    print("\nЗнайдені файли:", [f.name for f in ready_files])
