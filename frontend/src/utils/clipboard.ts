/**
 * Надійне копіювання тексту в буфер обміну, що працює як в HTTPS/localhost,
 * так і в HTTP (наприклад, по локальному IP http://192.168.0.107:5173).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text === undefined || text === null) return false;
  const str = String(text);

  // 1. Спроба через сучасний Clipboard API (якщо є підтримка і безпечний контекст)
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {
      // Ігноруємо і переходимо до фолбеку
    }
  }

  // 2. Фолбек через створення прихованого textarea і document.execCommand('copy')
  // Працює надійно на HTTP і локальних IP-адресах
  try {
    const textArea = document.createElement('textarea');
    textArea.value = str;

    // Запобігаємо скролу сторінки під час фокусування
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, str.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Помилка копіювання в буфер обміну:', err);
    return false;
  }
}
