import { Router, Request, Response } from 'express';
import { apmService } from '../apm/APMService';
import { authMiddleware } from '../auth/AuthMiddleware';

const router = Router();

/**
 * GET /api/system/apm-metrics
 * Зведений звіт продуктивності системи: латентність (p50, p95, p99), БД, ресурси, RUM
 */
router.get('/api/system/apm-metrics', authMiddleware, (_req: Request, res: Response) => {
  const stats = apmService.getStatsSummary();
  res.json({
    success: true,
    data: stats
  });
});

/**
 * GET /api/system/traces
 * Список останніх транзакцій з деталізацією спанів (Waterfall / Flamegraph)
 */
router.get('/api/system/traces', authMiddleware, (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt((req.query.limit as string) || '50', 10));
  const traces = apmService.getRecentTransactions(limit);
  res.json({
    success: true,
    data: traces
  });
});

/**
 * GET /api/system/slow-queries
 * Список зафіксованих повільних запитів до бази даних SQLite
 */
router.get('/api/system/slow-queries', authMiddleware, (_req: Request, res: Response) => {
  const slowQueries = apmService.getSlowQueries();
  res.json({
    success: true,
    data: slowQueries
  });
});

/**
 * GET /api/system/traces/otlp
 * Експорт трас у стандартному форматі OpenTelemetry OTLP (JSON)
 */
router.get('/api/system/traces/otlp', authMiddleware, (_req: Request, res: Response) => {
  const otlpData = apmService.exportOpenTelemetrySpans();
  res.json(otlpData);
});

/**
 * POST /api/system/rum
 * Прийом клієнтських метрик продуктивності Web Vitals та помилок JS з фронтенду
 */
router.post('/api/system/rum', (req: Request, res: Response) => {
  const metric = req.body;
  if (metric && typeof metric === 'object') {
    apmService.recordRUMMetric({
      ...metric,
      userAgent: req.headers['user-agent'] || metric.userAgent
    });
  }
  res.status(202).json({ success: true });
});

/**
 * GET /api/system/rum
 * Отримання аналітики Real User Monitoring
 */
router.get('/api/system/rum', authMiddleware, (_req: Request, res: Response) => {
  const summary = apmService.getStatsSummary();
  res.json({
    success: true,
    data: summary.rum
  });
});

export default router;
