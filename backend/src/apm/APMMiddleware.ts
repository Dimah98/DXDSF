import { Request, Response, NextFunction } from 'express';
import { apmService, Transaction } from './APMService';

// Розширення інтерфейсу Request для збереження транзакції
declare global {
  namespace Express {
    interface Request {
      apmTransaction?: Transaction;
    }
  }
}

/**
 * APM Middleware для автоматичної інструментації Express HTTP запитів
 */
export function apmMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Не трекаємо статичні запити favicon чи health-check занадто шумно
  if (req.path === '/favicon.ico') {
    return next();
  }

  // Перевіряємо вхідний W3C TraceContext заголовок (traceparent)
  const traceparent = req.headers['traceparent'] as string;
  let customTraceId: string | undefined = undefined;

  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 4 && parts[1]) {
      customTraceId = parts[1];
    }
  }

  const transactionName = `${req.method} ${req.route?.path || req.path}`;
  const transaction = apmService.startTransaction(
    transactionName,
    'http',
    {
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    },
    customTraceId
  );

  req.apmTransaction = transaction;

  // Додаємо заголовок X-Trace-Id у відповідь для трасування клієнтом
  res.setHeader('X-Trace-Id', transaction.traceId);

  // Створюємо спан для middleware
  const middlewareSpan = transaction.startSpan('express_middleware', 'middleware');

  // Перехоплюємо завершення відповіді
  res.on('finish', () => {
    transaction.endSpan(middlewareSpan.id);
    const status = res.statusCode >= 400 ? 'error' : 'ok';
    transaction.end(status, res.statusCode);
  });

  res.on('close', () => {
    if (transaction.status === 'in_progress') {
      transaction.endSpan(middlewareSpan.id);
      transaction.end('error', res.statusCode || 499, 'З\'єднання перервано клієнтом до завершення');
    }
  });

  next();
}
