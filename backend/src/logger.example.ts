/**
 * Example usage of the structured logging system
 * 
 * This file demonstrates how to use the Logger class in various scenarios.
 * Run with: tsx src/logger.example.ts
 */

import { Logger, LogLevel, createLogger, defaultLogger } from './logger';

// Example 1: Basic usage with default logger
console.log('\n=== Example 1: Basic Usage ===');
defaultLogger.info('Application started');
defaultLogger.debug('This is a debug message');
defaultLogger.warn('This is a warning');
defaultLogger.error('This is an error');

// Example 2: Creating a logger with custom context
console.log('\n=== Example 2: Custom Context ===');
const botLogger = new Logger('BotEngine');
botLogger.info('Bot engine initialized');
botLogger.info('Starting bot execution', { projectName: 'MyProject' });

// Example 3: Using child loggers
console.log('\n=== Example 3: Child Loggers ===');
const engineLogger = new Logger('BotEngine');
const nodeExecutor = engineLogger.child('NodeExecutor');
const actionHandler = nodeExecutor.child('ActionHandler');

engineLogger.info('Engine started');
nodeExecutor.info('Executing node', { nodeId: 'node-123', nodeType: 'action' });
actionHandler.debug('Processing action', { action: 'click', selector: '#button' });

// Example 4: Logging with metadata
console.log('\n=== Example 4: Metadata ===');
const apiLogger = createLogger('APIHandler');
apiLogger.info('API request received', {
  method: 'POST',
  endpoint: '/api/projects/save',
  userId: 'user-456',
  timestamp: Date.now()
});

// Example 5: Error logging with stack traces
console.log('\n=== Example 5: Error Logging ===');
const errorLogger = createLogger('ErrorHandler');
try {
  throw new Error('Connection timeout');
} catch (error) {
  errorLogger.error('Failed to connect to database', error as Error, {
    host: 'localhost',
    port: 5432,
    retryCount: 3
  });
}

// Example 6: Log level filtering
console.log('\n=== Example 6: Log Level Filtering ===');
console.log('Current LOG_LEVEL:', process.env.LOG_LEVEL || 'not set (defaults to INFO)');

const testLogger = createLogger('Test');
testLogger.debug('This will only show if LOG_LEVEL=0');
testLogger.info('This will show if LOG_LEVEL<=1');
testLogger.warn('This will show if LOG_LEVEL<=2');
testLogger.error('This will always show unless LOG_LEVEL>3');

// Example 7: Runtime log level changes
console.log('\n=== Example 7: Runtime Log Level Changes ===');
const dynamicLogger = createLogger('Dynamic');
console.log('Initial min level:', LogLevel[dynamicLogger.getMinLevel()]);

dynamicLogger.debug('Debug message (may not show)');
dynamicLogger.info('Info message');

dynamicLogger.setMinLevel(LogLevel.DEBUG);
console.log('Changed min level to:', LogLevel[dynamicLogger.getMinLevel()]);

dynamicLogger.debug('Debug message (should show now)');
dynamicLogger.info('Info message');

// Example 8: Real-world scenario - Bot execution
console.log('\n=== Example 8: Real-world Bot Execution ===');
const botExecutionLogger = createLogger('BotExecution');

botExecutionLogger.info('Starting bot execution', {
  projectName: 'SunflowerBot',
  startNode: 'start-1'
});

const nodeLogger = botExecutionLogger.child('NodeProcessor');
nodeLogger.debug('Processing node', {
  nodeId: 'action-1',
  nodeType: 'ActionNode',
  action: 'click'
});

nodeLogger.info('Node executed successfully', {
  nodeId: 'action-1',
  executionTime: 150,
  nextNode: 'condition-2'
});

const browserLogger = botExecutionLogger.child('BrowserManager');
browserLogger.info('Browser launched', {
  browserType: 'chromium',
  headless: false,
  viewport: { width: 1920, height: 1080 }
});

try {
  // Simulate an error
  throw new Error('Element not found: #submit-button');
} catch (error) {
  nodeLogger.error('Node execution failed', error as Error, {
    nodeId: 'action-2',
    selector: '#submit-button',
    timeout: 5000
  });
}

botExecutionLogger.info('Bot execution completed', {
  projectName: 'SunflowerBot',
  totalNodes: 15,
  successfulNodes: 14,
  failedNodes: 1,
  duration: 45000
});

console.log('\n=== Examples Complete ===');
console.log('To see different log levels, run with:');
console.log('  LOG_LEVEL=0 tsx src/logger.example.ts  # Show all logs (DEBUG and above)');
console.log('  LOG_LEVEL=1 tsx src/logger.example.ts  # Show INFO and above');
console.log('  LOG_LEVEL=2 tsx src/logger.example.ts  # Show WARN and above');
console.log('  LOG_LEVEL=3 tsx src/logger.example.ts  # Show ERROR only');
