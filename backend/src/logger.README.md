# Structured Logging System

A centralized, structured logging system for the Sunflower Land Bot Constructor backend.

## Features

- **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR
- **Structured Format**: `[TIMESTAMP] [LEVEL] [CONTEXT] message`
- **Context-based Logging**: Create child loggers with specific contexts
- **Metadata Support**: Attach structured data to log messages
- **Environment-based Filtering**: Control log verbosity via `LOG_LEVEL` environment variable
- **Error Stack Traces**: Automatically include error messages and stack traces
- **Type-safe**: Full TypeScript support with proper types

## Installation

The logger is already included in the project. Simply import it:

```typescript
import { Logger, createLogger, defaultLogger } from './logger';
```

## Basic Usage

### Using the Default Logger

```typescript
import { defaultLogger } from './logger';

defaultLogger.info('Application started');
defaultLogger.warn('Low memory warning');
defaultLogger.error('Failed to connect');
```

### Creating a Custom Logger

```typescript
import { Logger } from './logger';

const logger = new Logger('BotEngine');
logger.info('Bot engine initialized');
```

### Using the Helper Function

```typescript
import { createLogger } from './logger';

const logger = createLogger('WebSocketServer');
logger.info('WebSocket server listening on port 3001');
```

## Log Levels

The logger supports four log levels:

| Level | Value | Description | Console Method |
|-------|-------|-------------|----------------|
| DEBUG | 0 | Detailed debugging information | `console.log` |
| INFO  | 1 | General informational messages | `console.log` |
| WARN  | 2 | Warning messages | `console.warn` |
| ERROR | 3 | Error messages | `console.error` |

### Setting Log Level

Set the `LOG_LEVEL` environment variable to control which messages are displayed:

```bash
# Show all messages (DEBUG and above)
LOG_LEVEL=0 npm start

# Show INFO and above (default)
LOG_LEVEL=1 npm start

# Show WARN and above
LOG_LEVEL=2 npm start

# Show ERROR only
LOG_LEVEL=3 npm start
```

In `.env` file:
```env
LOG_LEVEL=1
```

## Advanced Features

### Child Loggers

Create child loggers to add hierarchical context:

```typescript
const engineLogger = new Logger('BotEngine');
const nodeExecutor = engineLogger.child('NodeExecutor');
const actionHandler = nodeExecutor.child('ActionHandler');

engineLogger.info('Engine started');
// Output: [2024-01-01T12:00:00.000Z] [INFO] [BotEngine] Engine started

nodeExecutor.info('Executing node');
// Output: [2024-01-01T12:00:00.000Z] [INFO] [BotEngine:NodeExecutor] Executing node

actionHandler.debug('Processing action');
// Output: [2024-01-01T12:00:00.000Z] [DEBUG] [BotEngine:NodeExecutor:ActionHandler] Processing action
```

### Logging with Metadata

Attach structured data to log messages:

```typescript
logger.info('User logged in', {
  userId: '12345',
  username: 'john_doe',
  timestamp: Date.now()
});
// Output: [2024-01-01T12:00:00.000Z] [INFO] [Auth] User logged in {"userId":"12345","username":"john_doe","timestamp":1704110400000}
```

### Error Logging

Log errors with automatic stack trace extraction:

```typescript
try {
  // Some operation
  throw new Error('Connection timeout');
} catch (error) {
  logger.error('Failed to connect to database', error as Error, {
    host: 'localhost',
    port: 5432,
    retryCount: 3
  });
}
// Output: [2024-01-01T12:00:00.000Z] [ERROR] [Database] Failed to connect to database {"host":"localhost","port":5432,"retryCount":3,"error":"Connection timeout","stack":"Error: Connection timeout\n    at ..."}
```

### Runtime Log Level Changes

Change the minimum log level at runtime:

```typescript
import { LogLevel } from './logger';

const logger = new Logger('Test');

logger.setMinLevel(LogLevel.DEBUG);
logger.debug('This will now be visible');

logger.setMinLevel(LogLevel.ERROR);
logger.info('This will be filtered out');
```

## Log Format

All log messages follow this format:

```
[TIMESTAMP] [LEVEL] [CONTEXT] message {metadata}
```

Example:
```
[2024-01-01T12:00:00.000Z] [INFO] [BotEngine] Bot started {"projectName":"MyBot","nodeCount":15}
```

Components:
- **TIMESTAMP**: ISO 8601 format (UTC)
- **LEVEL**: DEBUG, INFO, WARN, or ERROR
- **CONTEXT**: Logger context (e.g., 'BotEngine', 'WebSocket')
- **message**: The log message
- **metadata**: Optional JSON object with additional data

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// DEBUG: Detailed information for debugging
logger.debug('Processing node', { nodeId: 'action-1', nodeType: 'click' });

// INFO: General informational messages
logger.info('Bot execution started', { projectName: 'MyBot' });

// WARN: Warning messages that don't prevent operation
logger.warn('High memory usage detected', { heapUsed: 500000000 });

// ERROR: Error conditions that need attention
logger.error('Failed to execute node', error, { nodeId: 'action-1' });
```

### 2. Create Module-specific Loggers

```typescript
// In BotEngine.ts
const logger = createLogger('BotEngine');

// In browserManager.ts
const logger = createLogger('BrowserManager');

// In WebSocket handler
const logger = createLogger('WebSocket');
```

### 3. Use Child Loggers for Sub-components

```typescript
class BotEngine {
  private logger = createLogger('BotEngine');
  
  async executeNode(nodeId: string) {
    const nodeLogger = this.logger.child(`Node:${nodeId}`);
    nodeLogger.info('Executing node');
    // ...
  }
}
```

### 4. Include Relevant Metadata

```typescript
// Good: Includes context for debugging
logger.info('API request received', {
  method: 'POST',
  endpoint: '/api/projects/save',
  userId: 'user-123',
  projectName: 'MyBot'
});

// Bad: Missing useful context
logger.info('Request received');
```

### 5. Always Log Errors with Context

```typescript
// Good: Includes error and context
try {
  await page.click(selector);
} catch (error) {
  logger.error('Failed to click element', error as Error, {
    selector,
    nodeId,
    timeout: 5000
  });
}

// Bad: Silent failure
try {
  await page.click(selector);
} catch (error) {
  // Nothing logged
}
```

## Integration with Existing Code

### Replace console.log

```typescript
// Before
console.log('Bot started');

// After
logger.info('Bot started');
```

### Replace console.error

```typescript
// Before
console.error('Error:', error);

// After
logger.error('Operation failed', error);
```

### Add Context to Logs

```typescript
// Before
console.log('Processing node', nodeId);

// After
logger.info('Processing node', { nodeId, nodeType, action });
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 12.1**: Format as `[TIMESTAMP] [LEVEL] [CONTEXT] message` ✓
- **Requirement 12.2**: Support DEBUG, INFO, WARN, ERROR levels ✓
- **Requirement 12.3**: Filter based on LOG_LEVEL environment variable ✓
- **Requirement 12.4**: Include error message and stack trace ✓
- **Requirement 12.5**: Support metadata objects ✓
- **Requirement 12.6**: Allow creating child loggers with context ✓
- **Requirement 31**: Audit logging for security events (ready for integration) ✓

## Testing

Run the test suite:

```bash
npm test src/logger.test.ts
```

Run the example:

```bash
# Show all logs
LOG_LEVEL=0 tsx src/logger.example.ts

# Show INFO and above
LOG_LEVEL=1 tsx src/logger.example.ts

# Show WARN and above
LOG_LEVEL=2 tsx src/logger.example.ts

# Show ERROR only
LOG_LEVEL=3 tsx src/logger.example.ts
```

## API Reference

### Logger Class

#### Constructor
```typescript
new Logger(context?: string)
```

#### Methods

##### `debug(message: string, meta?: object): void`
Log a DEBUG level message.

##### `info(message: string, meta?: object): void`
Log an INFO level message.

##### `warn(message: string, meta?: object): void`
Log a WARN level message.

##### `error(message: string, error?: Error, meta?: object): void`
Log an ERROR level message with optional error object.

##### `child(childContext: string): Logger`
Create a child logger with additional context.

##### `getContext(): string`
Get the current context string.

##### `getMinLevel(): LogLevel`
Get the current minimum log level.

##### `setMinLevel(level: LogLevel): void`
Set a new minimum log level.

### Helper Functions

#### `createLogger(context: string): Logger`
Create a new logger with the specified context.

#### `defaultLogger: Logger`
Pre-configured logger with 'App' context.

### LogLevel Enum

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}
```

## Examples

See `logger.example.ts` for comprehensive usage examples including:
- Basic usage
- Custom contexts
- Child loggers
- Metadata logging
- Error logging
- Log level filtering
- Runtime configuration
- Real-world bot execution scenario

## Next Steps

1. **Replace existing console.log calls** with structured logging
2. **Add audit logging** for security events (authentication failures, rate limits, etc.)
3. **Integrate with monitoring systems** (optional: send logs to external services)
4. **Add log rotation** (optional: for production deployments)
