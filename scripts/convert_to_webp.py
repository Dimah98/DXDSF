import os
import sys
from pathlib import Path
from PIL import Image

def convert_to_webp(input_dir: str, output_dir: str = None, quality: int = 80, lossless: bool = False):
    input_path = Path(input_dir).resolve()

    if not input_path.exists() or not input_path.is_dir():
        print(f"Помилка: Папка '{input_path}' не існує або не є директорією.")
        return

    # Якщо папка виводу не вказана, зберігаємо в папку 'webp_output' всередині вхідної папки
    if output_dir is None:
        output_path = input_path / "webp_output"
    else:
        output_path = Path(output_dir).resolve()

    output_path.mkdir(parents=True, exist_ok=True)

    # Підтримувані розширення файлів зображень
    valid_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.gif'}

    processed_count = 0
    total_saved_bytes = 0

    mode_str = "Без втрати якості (Lossless)" if lossless else f"Зі стисненням (Якість: {quality}%)"
    print(f"Конвертація зображень у формат WebP...")
    print(f"Вхідна папка: {input_path}")
    print(f"Папка збереження: {output_path}")
    print(f"Режим: {mode_str}\n")

    for file_path in input_path.iterdir():
        # Пропускаємо неосновні файли та файли, які вже є .webp
        if not file_path.is_file() or file_path.suffix.lower() not in valid_extensions:
            continue

        try:
            with Image.open(file_path) as img:
                # Зберігаємо альфа-канал (прозорість) якщо вона є
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    converted_img = img.convert("RGBA")
                else:
                    converted_img = img.convert("RGB")

                new_filename = f"{file_path.stem}.webp"
                out_file_path = output_path / new_filename

                # Збереження у форматі WebP
                converted_img.save(out_file_path, format="WEBP", quality=quality, lossless=lossless)

                original_size = file_path.stat().st_size
                new_size = out_file_path.stat().st_size
                saved_percent = ((original_size - new_size) / original_size * 100) if original_size > 0 else 0

                print(f"✓ {file_path.name} -> {new_filename} ({original_size / 1024:.1f} КБ → {new_size / 1024:.1f} КБ, Економія: {saved_percent:.1f}%)")
                processed_count += 1
                total_saved_bytes += (original_size - new_size)

        except Exception as e:
            print(f"✗ Помилка при обробці '{file_path.name}': {e}")

    print(f"\nЗавершено! Конвертовано файлів: {processed_count}")
    if total_saved_bytes > 0:
        print(f"Загалом економія дискового простору: {total_saved_bytes / (1024 * 1024):.2f} МБ")

if __name__ == "__main__":
    # Отримання папки з аргументів командного рядка або використання поточної папки
    target_folder = sys.argv[1] if len(sys.argv) > 1 else "."
    convert_to_webp(target_folder)
