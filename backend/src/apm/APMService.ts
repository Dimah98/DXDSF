/**
 * APMService - Application Performance Monitoring & Distributed Tracing
 *
 * Надає можливості:
 * 1. Distributed Transaction & Span Tracing (з p50, p95, p99 percentiles).
 * 2. Database Query Monitoring (фіксація slow queries > 20ms).
 * 3. Memory & Event Loop Profiling (виявлення витоків пам'яті та лагів Event Loop).
 * 4. Error Correlation (прив'язка помилок до конкретних traceId транзакцій).
 * 5. Real User Monitoring (RUM) для збору Web Vitals (FCP, LCP, TTFB) з фронтенду.
 * 6. OpenTelemetry OTLP-сумісний експорт трас для Jaeger, Datadog або Grafana.
 */

import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { createLogger } from '../logger';

const logger = createLogger('APM');

// ============================================================================
// Інтерфейси та Типи
// ============================================================================

export interface Span {
  id: string;
  name: string;
  type: 'middleware' | 'db' | 'browser' | 'websocket' | 'engine' | 'external';
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface Transaction {
  traceId: string;
  id: string;
  name: string;
  type: 'http' | 'ws' | 'job' | 'engine';
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'ok' | 'error' | 'in_progress';
  statusCode?: number;
  metadata: Record<string, any>;
  spans: Span[];
  error?: string;
  startSpan: (name: string, type: Span['type'], metadata?: Record<string, any>) => Span;
  endSpan: (spanId: string, error?: Error | string) => void;
  end: (status?: 'ok' | 'error', statusCode?: number, error?: Error | string) => void;
}

export interface SlowQueryRecord {
  id: string;
  sql: string;
  durationMs: number;
  timestamp: number;
  caller?: string;
  params?: any[];
  traceId?: string;
}

export interface MemorySnapshot {
  timestamp: number;
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  eventLoopLagMs: number;
  cpuPercent: number;
}

export interface RUMMetric {
  id: string;
  timestamp: number;
  url: string;
  userAgent: string;
  ttfbMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  domContentLoadedMs?: number;
  pageLoadMs?: number;
  routeDurationMs?: number;
  clientErrors?: Array<{ message: string; stack?: string; time: number }>;
}

export interface APMStatsSummary {
  uptimeSeconds: number;
  transactions: {
    total: number;
    active: number;
    errorRate: string;
    p50Ms: number;
    p90Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    maxMs: number;
  };
  database: {
    totalQueries: number;
    slowQueriesCount: number;
    avgQueryTimeMs: number;
    slowQueries: SlowQueryRecord[];
  };
  resources: {
    currentMemory: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
    };
    eventLoopLagMs: number;
    memoryLeakSuspected: boolean;
    history: MemorySnapshot[];
  };
  rum: {
    totalSessions: number;
    avgTtfbMs: number;
    avgFcpMs: number;
    avgLcpMs: number;
    avgPageLoadMs: number;
    webVitalsRating: 'Good' | 'Needs Improvement' | 'Poor';
    recentClientErrors: number;
  };
}

// ============================================================================
// Клас Сервісу APM
// ============================================================================

export class APMService {
  private static instance: APMService | null = null;

  // Кільцеві буфери (Ring Buffers) для запобігання росту пам'яті
  private readonly MAX_TRANSACTIONS = 200;
  private readonly MAX_SLOW_QUERIES = 50;
  private readonly MAX_MEMORY_SNAPSHOTS = 60;
  private readonly MAX_RUM_RECORDS = 100;
  private readonly SLOW_QUERY_THRESHOLD_MS = 20;

  private transactions: Transaction[] = [];
  private activeTransactionsCount = 0;
  private slowQueries: SlowQueryRecord[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private rumRecords: RUMMetric[] = [];

  private totalQueriesCount = 0;
  private totalQueryTimeMs = 0;

  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = performance.now();
  private currentEventLoopLag = 0;
  private monitorTimer: NodeJS.Timeout | null = null;
  private eventLoopTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startResourceMonitoring();
    this.startEventLoopLagMonitor();
    logger.info('APM Сервіс ініціалізовано: моніторинг транзакцій, БД, пам\'яті та RUM активовано');
  }

  public static getInstance(): APMService {
    if (!APMService.instance) {
      APMService.instance = new APMService();
    }
    return APMService.instance;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Transaction & Distributed Tracing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Створює нову транзакцію для запиту HTTP, WebSocket повідомлення або кроку BotEngine.
   */
  public startTransaction(
    name: string,
    type: Transaction['type'],
    metadata: Record<string, any> = {},
    customTraceId?: string
  ): Transaction {
    const traceId = customTraceId || crypto.randomUUID().replace(/-/g, '');
    const transactionId = crypto.randomBytes(8).toString('hex');
    const startTime = performance.now();

    this.activeTransactionsCount++;

    const spans: Span[] = [];

    const startSpan = (spanName: string, spanType: Span['type'], spanMeta?: Record<string, any>): Span => {
      const span: Span = {
        id: crypto.randomBytes(8).toString('hex'),
        name: spanName,
        type: spanType,
        startTime: performance.now(),
        metadata: spanMeta
      };
      spans.push(span);
      return span;
    };

    const endSpan = (spanId: string, error?: Error | string) => {
      const span = spans.find(s => s.id === spanId);
      if (span && !span.endTime) {
        span.endTime = performance.now();
        span.durationMs = Math.round((span.endTime - span.startTime) * 100) / 100;
        if (error) {
          span.error = typeof error === 'string' ? error : error.message;
        }
      }
    };

    const end = (status: 'ok' | 'error' = 'ok', statusCode?: number, error?: Error | string) => {
      if (tx.endTime) return; // Вже завершено
      tx.endTime = performance.now();
      tx.durationMs = Math.round((tx.endTime - tx.startTime) * 100) / 100;
      tx.status = status;
      tx.statusCode = statusCode;
      if (error) {
        tx.error = typeof error === 'string' ? error : error.message;
        tx.status = 'error';
      }

      // Закриваємо незавершені спани
      for (const span of tx.spans) {
        if (!span.endTime) {
          span.endTime = tx.endTime;
          span.durationMs = Math.round((span.endTime - span.startTime) * 100) / 100;
        }
      }

      this.activeTransactionsCount = Math.max(0, this.activeTransactionsCount - 1);

      // Додаємо в кільцевий буфер
      this.transactions.push(tx);
      if (this.transactions.length > this.MAX_TRANSACTIONS) {
        this.transactions.shift();
      }
    };

    const tx: Transaction = {
      traceId,
      id: transactionId,
      name,
      type,
      startTime,
      status: 'in_progress',
      metadata,
      spans,
      startSpan,
      endSpan,
      end
    };

    return tx;
  }

  /**
   * Отримання останніх транзакцій
   */
  public getRecentTransactions(limit: number = 50): Transaction[] {
    return this.transactions.slice(-limit).reverse();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Database Performance Monitoring
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Запис виконання запиту до бази даних SQLite
   */
  public recordQuery(
    sql: string,
    durationMs: number,
    caller?: string,
    params?: any[],
    traceId?: string
  ): void {
    this.totalQueriesCount++;
    this.totalQueryTimeMs += durationMs;

    if (durationMs >= this.SLOW_QUERY_THRESHOLD_MS) {
      const record: SlowQueryRecord = {
        id: crypto.randomBytes(6).toString('hex'),
        sql: sql.replace(/\s+/g, ' ').trim(),
        durationMs: Math.round(durationMs * 100) / 100,
        timestamp: Date.now(),
        caller,
        params,
        traceId
      };

      this.slowQueries.push(record);
      if (this.slowQueries.length > this.MAX_SLOW_QUERIES) {
        this.slowQueries.shift();
      }

      logger.warn(`Повільний запит до БД (${durationMs.toFixed(2)} мс)`, {
        sql: record.sql.substring(0, 150),
        caller,
        durationMs
      });
    }
  }

  public getSlowQueries(): SlowQueryRecord[] {
    return [...this.slowQueries].reverse();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Resource & Memory Profiling
  // ──────────────────────────────────────────────────────────────────────────

  private startResourceMonitoring(): void {
    this.takeResourceSnapshot();
    // Робимо знімок ресурсів кожні 30 секунд
    this.monitorTimer = setInterval(() => {
      this.takeResourceSnapshot();
    }, 30_000);
  }

  private startEventLoopLagMonitor(): void {
    let lastCheck = performance.now();
    this.eventLoopTimer = setInterval(() => {
      const now = performance.now();
      const delta = now - lastCheck;
      // Очікуваний інтервал 1000мс. Будь-яке перевищення є лагом черги подій Node.js
      this.currentEventLoopLag = Math.max(0, Math.round(delta - 1000));
      lastCheck = now;
    }, 1000);
  }

  private takeResourceSnapshot(): void {
    const mem = process.memoryUsage();
    const nowTime = performance.now();
    const cpu = process.cpuUsage(this.lastCpuUsage);

    const timeDeltaMs = nowTime - this.lastCpuTime;
    const totalCpuTimeMs = (cpu.user + cpu.system) / 1000;
    const cpuPercent = timeDeltaMs > 0 ? Math.min(100, Math.round((totalCpuTimeMs / timeDeltaMs) * 100)) : 0;

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = nowTime;

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      rssMb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
      heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
      heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
      externalMb: Math.round((mem.external / (1024 * 1024)) * 10) / 10,
      eventLoopLagMs: this.currentEventLoopLag,
      cpuPercent
    };

    this.memorySnapshots.push(snapshot);
    if (this.memorySnapshots.length > this.MAX_MEMORY_SNAPSHOTS) {
      this.memorySnapshots.shift();
    }
  }

  /**
   * Евристична перевірка на підозру витоку пам'яті (Memory Leak)
   * Якщо 6 останніх знімків поспіль показують зростання heapUsed
   */
  private isMemoryLeakSuspected(): boolean {
    if (this.memorySnapshots.length < 6) return false;
    const recent = this.memorySnapshots.slice(-6);
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].heapUsedMb <= recent[i - 1].heapUsedMb) {
        return false;
      }
    }
    const totalGrowth = recent[recent.length - 1].heapUsedMb - recent[0].heapUsedMb;
    return totalGrowth > 30; // Зростання більше ніж на 30MB без спаду
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Real User Monitoring (RUM)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Збереження клієнтських метрик Web Vitals та затримок
   */
  public recordRUMMetric(data: Partial<RUMMetric>): void {
    const metric: RUMMetric = {
      id: crypto.randomBytes(6).toString('hex'),
      timestamp: Date.now(),
      url: data.url || 'unknown',
      userAgent: data.userAgent || 'unknown',
      ttfbMs: data.ttfbMs,
      fcpMs: data.fcpMs,
      lcpMs: data.lcpMs,
      domContentLoadedMs: data.domContentLoadedMs,
      pageLoadMs: data.pageLoadMs,
      routeDurationMs: data.routeDurationMs,
      clientErrors: data.clientErrors || []
    };

    this.rumRecords.push(metric);
    if (this.rumRecords.length > this.MAX_RUM_RECORDS) {
      this.rumRecords.shift();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Агреговані Звіти та Статистика
  // ──────────────────────────────────────────────────────────────────────────

  public getStatsSummary(): APMStatsSummary {
    const completedTxs = this.transactions.filter(t => t.durationMs !== undefined);
    const durations = completedTxs.map(t => t.durationMs!).sort((a, b) => a - b);
    const total = completedTxs.length;

    const errorCount = completedTxs.filter(t => t.status === 'error').length;
    const errorRate = total > 0 ? `${((errorCount / total) * 100).toFixed(2)}%` : '0.00%';

    const p = (pct: number) => {
      if (durations.length === 0) return 0;
      const idx = Math.floor((durations.length * pct) / 100);
      return Math.round(durations[Math.min(idx, durations.length - 1)] * 10) / 10;
    };

    const avgDuration = total > 0
      ? Math.round((durations.reduce((sum, d) => sum + d, 0) / total) * 10) / 10
      : 0;

    const currentMem = process.memoryUsage();

    // RUM aggregation
    const rumWithFcp = this.rumRecords.filter(r => r.fcpMs !== undefined && r.fcpMs > 0);
    const avgFcp = rumWithFcp.length > 0
      ? Math.round(rumWithFcp.reduce((s, r) => s + (r.fcpMs || 0), 0) / rumWithFcp.length)
      : 0;

    const rumWithLcp = this.rumRecords.filter(r => r.lcpMs !== undefined && r.lcpMs > 0);
    const avgLcp = rumWithLcp.length > 0
      ? Math.round(rumWithLcp.reduce((s, r) => s + (r.lcpMs || 0), 0) / rumWithLcp.length)
      : 0;

    const rumWithTtfb = this.rumRecords.filter(r => r.ttfbMs !== undefined && r.ttfbMs > 0);
    const avgTtfb = rumWithTtfb.length > 0
      ? Math.round(rumWithTtfb.reduce((s, r) => s + (r.ttfbMs || 0), 0) / rumWithTtfb.length)
      : 0;

    const rumWithLoad = this.rumRecords.filter(r => r.pageLoadMs !== undefined && r.pageLoadMs > 0);
    const avgLoad = rumWithLoad.length > 0
      ? Math.round(rumWithLoad.reduce((s, r) => s + (r.pageLoadMs || 0), 0) / rumWithLoad.length)
      : 0;

    let webVitalsRating: 'Good' | 'Needs Improvement' | 'Poor' = 'Good';
    if (avgLcp > 4000 || avgFcp > 3000) {
      webVitalsRating = 'Poor';
    } else if (avgLcp > 2500 || avgFcp > 1800) {
      webVitalsRating = 'Needs Improvement';
    }

    const totalClientErrors = this.rumRecords.reduce((sum, r) => sum + (r.clientErrors?.length || 0), 0);

    return {
      uptimeSeconds: Math.round(process.uptime()),
      transactions: {
        total,
        active: this.activeTransactionsCount,
        errorRate,
        p50Ms: p(50),
        p90Ms: p(90),
        p95Ms: p(95),
        p99Ms: p(99),
        avgMs: avgDuration,
        maxMs: durations.length > 0 ? durations[durations.length - 1] : 0
      },
      database: {
        totalQueries: this.totalQueriesCount,
        slowQueriesCount: this.slowQueries.length,
        avgQueryTimeMs: this.totalQueriesCount > 0 ? Math.round((this.totalQueryTimeMs / this.totalQueriesCount) * 100) / 100 : 0,
        slowQueries: this.getSlowQueries().slice(0, 10)
      },
      resources: {
        currentMemory: {
          rssMb: Math.round((currentMem.rss / (1024 * 1024)) * 10) / 10,
          heapTotalMb: Math.round((currentMem.heapTotal / (1024 * 1024)) * 10) / 10,
          heapUsedMb: Math.round((currentMem.heapUsed / (1024 * 1024)) * 10) / 10
        },
        eventLoopLagMs: this.currentEventLoopLag,
        memoryLeakSuspected: this.isMemoryLeakSuspected(),
        history: this.memorySnapshots
      },
      rum: {
        totalSessions: this.rumRecords.length,
        avgTtfbMs: avgTtfb,
        avgFcpMs: avgFcp,
        avgLcpMs: avgLcp,
        avgPageLoadMs: avgLoad,
        webVitalsRating,
        recentClientErrors: totalClientErrors
      }
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. OpenTelemetry OTLP JSON Export
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Експорт зібраних транзакцій у стандартному OTLP/JSON форматі для передачі в Jaeger / Zipkin / Tempo
   */
  public exportOpenTelemetrySpans(): Record<string, any> {
    const resourceSpans = this.transactions.map(tx => ({
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'sf-bot-backend' } },
          { key: 'host.name', value: { stringValue: 'sf_server' } }
        ]
      },
      scopeSpans: [
        {
          scope: { name: 'sf.bot.apm', version: '1.0.0' },
          spans: [
            {
              traceId: tx.traceId,
              spanId: tx.id,
              name: tx.name,
              kind: 1, // SPAN_KIND_INTERNAL
              startTimeUnixNano: Math.floor((tx.startTime + performance.timeOrigin) * 1_000_000),
              endTimeUnixNano: tx.endTime ? Math.floor((tx.endTime + performance.timeOrigin) * 1_000_000) : undefined,
              status: { code: tx.status === 'ok' ? 1 : 2 },
              attributes: Object.entries(tx.metadata).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) }
              }))
            },
            ...tx.spans.map(s => ({
              traceId: tx.traceId,
              spanId: s.id,
              parentSpanId: tx.id,
              name: s.name,
              kind: 1,
              startTimeUnixNano: Math.floor((s.startTime + performance.timeOrigin) * 1_000_000),
              endTimeUnixNano: s.endTime ? Math.floor((s.endTime + performance.timeOrigin) * 1_000_000) : undefined,
              status: { code: s.error ? 2 : 1 },
              attributes: Object.entries(s.metadata || {}).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) }
              }))
            }))
          ]
        }
      ]
    }));

    return { resourceSpans };
  }

  public destroy(): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.eventLoopTimer) clearInterval(this.eventLoopTimer);
  }
}

export const apmService = APMService.getInstance();
