import { Logger } from '../logger';
import { NodeHandlerParams } from './types';
import { inputValidator } from '../validation/InputValidator';

const logger = new Logger('ApiNode');

export const apiNodeHandler = async ({ currentNode, ws, logToClient, context }: NodeHandlerParams) => {
  const { url, apiKey } = currentNode.data;
  
  // Requirement 5: Validate URL before making API request
  if (!url || typeof url !== 'string') {
    logger.warn(`API node ${currentNode.id}: missing or invalid URL`, { url });
    logToClient(`❌ API помилка: URL не вказано або невалідний`, 'error');
    return { data: { ...context, error: 'Invalid URL' }, nextHandle: ['error'] };
  }
  
  const urlValidation = inputValidator.validateURL(url);
  if (!urlValidation.isValid) {
    logger.warn(`API node ${currentNode.id}: URL validation failed`, { url, error: urlValidation.error });
    logToClient(`❌ API помилка: ${urlValidation.error}`, 'error');
    return { data: { ...context, error: urlValidation.error }, nextHandle: ['error'] };
  }
  
  const headers: Record<string, string> = {};
  
  logToClient(`🌐 API запит: ${url}`, 'debug');

  if (apiKey) {
    if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
    else headers['x-api-key'] = apiKey;
  }

  // Requirement 13.1: Wrap async operations in try-catch with logging
  // Requirement 13.4: Attempt cleanup on critical operation failures
  try {
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const errMsg = `HTTP ${res.status} ${res.statusText}`;
      logger.warn(`API request failed for node ${currentNode.id}`, { url, status: res.status });
      logToClient(`❌ API помилка: ${errMsg}`, 'error');
      return { data: { ...context, error: errMsg }, nextHandle: ['error'] };
    }

    const json = await res.json();
    
    // Requirement 13.2: Attach rejection handlers — ws.send wrapped in try-catch
    try {
      ws.send(JSON.stringify({ type: 'NODE_DATA_UPDATE', nodeId: currentNode.id, data: { lastResponse: json } }));
    } catch (sendErr) {
      logger.warn(`Failed to send NODE_DATA_UPDATE for node ${currentNode.id}`, { error: String(sendErr) });
    }
    
    logToClient(`✅ API відповідь отримана`, 'success');
    return { data: { ...context, raw: json, value: json } };
  } catch (err: any) {
    // Requirement 13.1: Log the error
    logger.error(`API request error for node ${currentNode.id}`, err instanceof Error ? err : new Error(String(err)), { url });
    logToClient(`❌ API помилка: ${err.message || String(err)}`, 'error');
    // Requirement 13.5: Continue execution through error handle path
    return { data: { ...context, error: err.message }, nextHandle: ['error'] };
  }
};
