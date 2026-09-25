/**
 * Утиліти для безпечного завантаження та обробки зображень інвентарю та гри
 */

export const DEFAULT_NO_IMAGE_SVG =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23374151"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239CA3AF" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';

export const MINI_QUESTION_SVG =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="4" fill="%23374151"/%3E%3Ctext x="12" y="15" font-family="Arial" font-size="9" fill="%239CA3AF" text-anchor="middle"%3E?%3C/text%3E%3C/svg%3E';

/**
 * Нормалізує URL зображення, уникаючи подвійного кодування (%2520) та дублювання префіксів
 */
export function getCleanImageUrl(url?: string | null): string {
  if (!url) return '';
  try {
    let clean = url.trim();

    // Видаляємо дубльовані слеші на початку
    clean = clean.replace(/^\/+/, '/');

    // Видаляємо дублювання шляху типу "/api/im//api/im/" або "/api/im/api/im/"
    clean = clean.replace(/^\/api\/im\/?(api\/)?im\//i, '/api/im/');

    // Якщо шлях починається з "/im/", змінюємо на "/api/im/"
    if (clean.startsWith('/im/')) {
      clean = `/api/im/${clean.slice(4)}`;
    } else if (!clean.startsWith('/api/') && !clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:')) {
      clean = `/api/im/${clean}`;
    }

    // Повністю розкодовуємо всі рівні кодування (%2520 -> %20 -> ' ')
    while (clean.includes('%')) {
      const next = decodeURIComponent(clean);
      if (next === clean) break;
      clean = next;
    }

    // Кодуємо рівно один раз
    return encodeURI(clean);
  } catch {
    return encodeURI(url || '');
  }
}

/**
 * Обробник помилок завантаження із захистом від кешування старих 404 у браузері
 */
export function handleImageErrorWithCacheBust(
  e: React.SyntheticEvent<HTMLImageElement>,
  placeholderSvg: string = DEFAULT_NO_IMAGE_SVG
): void {
  const img = e.currentTarget;
  const current = img.getAttribute('src') || '';

  // Якщо це вже SVG або placeholder — припиняємо
  if (current.startsWith('data:')) return;

  const retryCount = parseInt(img.dataset.retried || '0', 10);

  if (retryCount === 0) {
    // Спроба 1: повторний запит із параметром cache-bust ?t=..., щоб обійти закешований браузером 404
    img.dataset.retried = '1';
    const cleanUrl = getCleanImageUrl(current);
    const sep = cleanUrl.includes('?') ? '&' : '?';
    img.src = `${cleanUrl}${sep}t=${Date.now()}`;
    return;
  }

  if (retryCount === 1) {
    // Спроба 2: нижній регістр назви файлу
    img.dataset.retried = '2';
    try {
      const parts = current.split('?')[0].split('/');
      const fileName = parts.pop() || '';
      const baseDir = parts.join('/');
      img.src = `${baseDir}/${encodeURIComponent(fileName.toLowerCase())}?t=${Date.now()}`;
      return;
    } catch {
      // fallback
    }
  }

  // Якщо всі спроби вичерпано — показуємо плейсхолдер без циклу
  img.onerror = null;
  img.src = placeholderSvg;
}
