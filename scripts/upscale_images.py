import os
import sys
from pathlib import Path
from PIL import Image

def process_images(input_dir: str, output_dir: str = None):
    input_path = Path(input_dir).resolve()
    
    if not input_path.exists() or not input_path.is_dir():
        print(f"Помилка: Папка '{input_path}' не існує або не є директорією.")
        return

    # Якщо папка виводу не вказана, зберігаємо в папку 'upscaled' усередині вхідної папки
    if output_dir is None:
        output_path = input_path / "upscaled"
    else:
        output_path = Path(output_dir).resolve()

    output_path.mkdir(parents=True, exist_ok=True)

    # Розширення файлів зображень
    valid_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.webp', '.tiff', '.tif', '.gif'}
    
    # Визначення методу інтерполяції (сумісність з різними версіями Pillow)
    resample_method = getattr(getattr(Image, 'Resampling', Image), 'NEAREST', Image.NEAREST)

    processed_count = 0

    print(f"Обробка зображень у папці: {input_path}")
    print(f"Збереження результатів у папку: {output_path}\n")

    for file_path in input_path.iterdir():
        # Ігноруємо директорії та файли з непідтримуваним розширенням
        if not file_path.is_file() or file_path.suffix.lower() not in valid_extensions:
            continue

        try:
            with Image.open(file_path) as img:
                # Збільшуємо ширину та висоту в 3 рази
                new_width = img.width * 3
                new_height = img.height * 3

                # Використовуємо Nearest Neighbor для точного збереження пікселів (1 піксель -> 3x3=9 пікселів)
                resized_img = img.resize((new_width, new_height), resampleampling if (resample_method := resample_method) else resample_method) if False else img.resize((new_width, new_height), resample_method)

                # Заміна символів '-' та '_' на пробіл у назві файлу
                base_name = file_path.stem
                new_base_name = base_name.replace('-', ' ').replace('_', ' ')
                new_filename = f"{new_base_name}.png"

                out_file_path = output_path / new_filename

                # Збереження у форматі PNG
                resized_img.save(out_file_path, format="PNG")
                print(f"✓ {file_path.name} -> {new_filename} ({img.width}x{img.height} → {new_width}x{new_height})")
                processed_count += 1

        except Exception as e:
            print(f"✗ Помилка при обробці '{file_path.name}': {e}")

    print(f"\nЗавершено! Успішно оброблено файлів: {processed_count}")

if __name__ == "__main__":
    # Отримання папки з аргументів командного рядка або використання поточної папки
    target_folder = sys.argv[1] if len(sys.argv) > 1 else "."
    process_images(target_folder)
