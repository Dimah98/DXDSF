/**
 * Real User Monitoring (RUM) Collector
 *
 * Збирає реальні клієнтські метрики продуктивності з браузерів користувачів:
 * - Web Vitals (FCP, LCP)
 * - Navigation Timings (TTFB, DOMContentLoaded, Page Load Time)
 * - Клієнтські помилки JavaScript
 * Відправляє дані на сервер (/api/system/rum) через sendBeacon або fetch
 */

interface PendingMetrics {
  url: string;
  userAgent: string;
  ttfbMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  domContentLoadedMs?: number;
  pageLoadMs?: number;
  clientErrors: Array<{ message: string; stack?: string; time: number }>;
}

const metrics: PendingMetrics = {
  url: window.location.href,
  userAgent: navigator.userAgent,
  clientErrors: []
};

let isInitialized = false;

export function initRUM(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Збір Navigation Timings (TTFB, DOMContentLoaded, Load Time)
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navEntries && navEntries.length > 0) {
          const nav = navEntries[0];
          metrics.ttfbMs = Math.round(nav.responseStart - nav.requestStart);
          metrics.domContentLoadedMs = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
          metrics.pageLoadMs = Math.round(nav.loadEventEnd - nav.startTime);
        } else if (performance.timing) {
          const t = performance.timing;
          metrics.ttfbMs = Math.round(t.responseStart - t.requestStart);
          metrics.domContentLoadedMs = Math.round(t.domContentLoadedEventEnd - t.navigationStart);
          metrics.pageLoadMs = Math.round(t.loadEventEnd - t.navigationStart);
        }
      } catch (_) {}

      sendMetrics();
    }, 2000);
  });

  // 2. Збір First Contentful Paint (FCP)
  try {
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcpMs = Math.round(entry.startTime);
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch (_) {}

  // 3. Збір Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        metrics.lcpMs = Math.round(lastEntry.startTime);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}

  // 4. Перехоплення глобальних помилок JavaScript
  window.addEventListener('error', (event) => {
    // Ігноруємо помилки від браузерних розширень
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }
    metrics.clientErrors.push({
      message: event.message || 'Unknown window error',
      stack: event.error?.stack,
      time: Date.now()
    });
    if (metrics.clientErrors.length > 10) {
      metrics.clientErrors.shift();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    metrics.clientErrors.push({
      message: String(event.reason?.message || event.reason || 'Unhandled Promise Rejection'),
      stack: event.reason?.stack,
      time: Date.now()
    });
    if (metrics.clientErrors.length > 10) {
      metrics.clientErrors.shift();
    }
  });

  // 5. Відправка при виході зі сторінки
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendMetrics();
    }
  });
}

function sendMetrics(): void {
  const payload = JSON.stringify({
    ...metrics,
    url: window.location.href
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/system/rum', blob);
  } else {
    fetch('/api/system/rum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
}
