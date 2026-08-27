import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../logger';
import { inputValidator } from '../validation/InputValidator';
import { AuthMiddleware } from '../auth/AuthMiddleware';
import { CSRFMiddleware } from '../auth/CSRFMiddleware';
import { wsRateLimiter } from '../auth/RateLimiter';
import { wsLifecycle } from '../services';
import { getOrCreateSession } from '../browserManager';
import { handleClientMessage } from './wsHandlers';
import { ExtendedWebSocket } from '../types';

const logger = new Logger('WebSocketServer');

export function setupWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: http.IncomingMessage, socket: any, head: Buffer) => {
    const url = req.url || '';
    if (!url.startsWith('/ws')) return;

    const mockReq = Object.assign(req, {
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
          (req.socket as any)?.remoteAddress || 'unknown',
      method: 'GET',
      path: '/ws',
      route: undefined,
      app: undefined,
      user: undefined,
    }) as any;

    const mockRes = {
      status: (code: number) => ({
        json: (body: any) => {
          socket.write(
            `HTTP/1.1 ${code} Too Many Requests\r\n` +
            'Content-Type: application/json\r\n' +
            'Connection: close\r\n' +
            `X-RateLimit-Limit: 10\r\n` +
            '\r\n' +
            JSON.stringify(body)
          );
          socket.destroy();
        },
      }),
      set: () => mockRes,
      setHeader: () => mockRes,
      getHeader: () => undefined,
      removeHeader: () => mockRes,
      end: () => {},
      json: (body: any) => {
        socket.write(
          'HTTP/1.1 429 Too Many Requests\r\n' +
          'Content-Type: application/json\r\n' +
          'Connection: close\r\n' +
          '\r\n' +
          JSON.stringify(body)
        );
        socket.destroy();
      },
      headersSent: false,
    } as any;

    wsRateLimiter(mockReq, mockRes, () => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });
  });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    let projectName = url.searchParams.get('project') || 'default';
    
    if (!inputValidator.validateProjectName(projectName).isValid) {
      logger.warn(`WS: Invalid project name on connection`, { projectName });
      try { 
        ws.close(1008, 'Invalid project'); 
      } catch (e) {
        logger.debug('Failed to close WebSocket with invalid project name', { error: String(e) });
      }
      return;
    }
    
    const token = url.searchParams.get('token') || req.headers['authorization']?.split(' ')[1];
    const payload = AuthMiddleware.verifyToken(token || 'bypass-token');
    if (!payload) {
      logger.warn(`WS: Invalid or expired JWT token on connection`, { projectName });
      try {
        ws.close(1008, 'Invalid or expired token');
      } catch (e) {
        logger.debug('Failed to close WebSocket with invalid token', { error: String(e) });
      }
      return;
    }
    
    (ws as any).user = payload;
    (ws as any).projectName = projectName;
    
    logger.info(`WS: Client connected for project ${projectName}`, { userId: payload.userId, username: payload.username });
    
    const session = getOrCreateSession(projectName);
    session.activeWs = ws as unknown as ExtendedWebSocket;
    
    const sessionId = `${projectName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    (ws as any).sessionId = sessionId;
    const csrfToken = CSRFMiddleware.generateToken(sessionId);
    
    ws.send(JSON.stringify({ 
      type: 'CSRF_TOKEN', 
      token: csrfToken,
      sessionId: sessionId
    }));

    wsLifecycle.registerConnection(ws as any, projectName);

    (ws as any)._msgCount = 0;
    (ws as any)._msgResetTimer = setInterval(() => {
      (ws as any)._msgCount = 0;
    }, 1000);

    ws.on('close', () => {
      try {
        if ((ws as any)._streamTimer) clearTimeout((ws as any)._streamTimer);
        if ((ws as any)._msgResetTimer) clearInterval((ws as any)._msgResetTimer);
        if ((ws as any)._cdpScreencast) {
          try {
            (ws as any)._cdpScreencast.send('Page.stopScreencast').catch(() => {});
            (ws as any)._cdpScreencast.detach().catch(() => {});
          } catch (_) {}
          delete (ws as any)._cdpScreencast;
        }
        if ((ws as any).sessionId) {
          CSRFMiddleware.removeToken((ws as any).sessionId);
        }
        (ws as any).isStreaming = false;
      } catch (e) {
        logger.error(`Error in WS close handler for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      }
    });

    ws.on('error', (_err) => {
      try {
        if ((ws as any)._streamTimer) clearTimeout((ws as any)._streamTimer);
        if ((ws as any)._msgResetTimer) clearInterval((ws as any)._msgResetTimer);
        if ((ws as any)._cdpScreencast) {
          try {
            (ws as any)._cdpScreencast.send('Page.stopScreencast').catch(() => {});
            (ws as any)._cdpScreencast.detach().catch(() => {});
          } catch (_) {}
          delete (ws as any)._cdpScreencast;
        }
        if ((ws as any).sessionId) {
          CSRFMiddleware.removeToken((ws as any).sessionId);
        }
        (ws as any).isStreaming = false;
      } catch (e) {
        logger.error(`Error in WS error handler cleanup for ${projectName}`, e instanceof Error ? e : new Error(String(e)));
      }
    });

    ws.send(JSON.stringify({ type: 'GLOBAL_VARIABLES_UPDATE', variables: session.globalVariables }));
    
    if (session.isBotRunning) {
      ws.send(JSON.stringify({ type: 'BOT_RUNNING_STATE', isRunning: true }));
      if (session.lastActiveNodeId) {
        ws.send(JSON.stringify({ type: 'NODE_EXECUTING', nodeId: session.lastActiveNodeId }));
      }
    }

    ws.on('message', (message: string | Buffer) => {
      handleClientMessage(ws, message, session).catch(err => {
        logger.error(`Error handling WS message for ${projectName}`, err instanceof Error ? err : new Error(String(err)));
      });
    });
  });

  return wss;
}
