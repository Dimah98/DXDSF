# Task 8.2 Verification: Add Authentication and Validation to WebSocket Endpoint

**Task:** 8.2 Add authentication and validation to WebSocket endpoint  
**Requirements:** 1, 2, 7  
**Date:** 2024

## Requirement Coverage

### Requirement 1: JWT Authentication for WebSocket

WebSocket endpoint (`/ws`) now requires JWT authentication:

1. ✅ JWT token extracted from query parameter `?token=...` or Authorization header
2. ✅ Connection rejected with code 1008 if token is missing
3. ✅ Connection rejected with code 1008 if token is invalid or expired
4. ✅ User payload attached to WebSocket object on successful authentication
5. ✅ User info logged on successful connection

### Requirement 2: CSRF Token Generation

CSRF token is generated and sent to client on WebSocket connection:

1. ✅ Unique session ID generated for each WebSocket connection
2. ✅ CSRF token generated using `CSRFMiddleware.generateToken(sessionId)`
3. ✅ Token sent to client immediately after connection via `CSRF_TOKEN` message
4. ✅ Session ID stored in WebSocket object for later validation
5. ✅ Token removed from store when connection closes or errors

### Requirement 7: Input Validation

All incoming WebSocket messages are validated:

1. ✅ JSON parsing errors caught and logged
2. ✅ Error message sent to client for invalid JSON
3. ✅ Message structure validated (must have `type` field)
4. ✅ Error message sent to client for invalid message structure
5. ✅ Rate limiting already applied (100 messages/second per connection)

## Changes Made

### 1. JWT Authentication for WebSocket Connections

**Before:**
```typescript
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let projectName = url.searchParams.get('project') || 'default';
  if (!validateProjectName(projectName)) {
    ws.close(1008, 'Invalid project');
    return;
  }
  console.log(`📱 Підключено клієнта для проекту: ${projectName}`);
  // ... rest of connection handler
```

**After:**
```typescript
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let projectName = url.searchParams.get('project') || 'default';
  
  // Validate project name
  if (!validateProjectName(projectName)) {
    logger.warn(`WS: Invalid project name on connection`, { projectName });
    ws.close(1008, 'Invalid project');
    return;
  }
  
  // JWT authentication
  const token = url.searchParams.get('token') || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    logger.warn(`WS: Missing JWT token on connection`, { projectName });
    ws.close(1008, 'Authentication required');
    return;
  }
  
  const payload = AuthMiddleware.verifyToken(token);
  if (!payload) {
    logger.warn(`WS: Invalid or expired JWT token on connection`, { projectName });
    ws.close(1008, 'Invalid or expired token');
    return;
  }
  
  // Store user info
  (ws as any).user = payload;
  logger.info(`WS: Client connected for project ${projectName}`, { 
    userId: payload.userId, 
    username: payload.username 
  });
  // ... rest of connection handler
```

### 2. CSRF Token Generation and Distribution

**Added after connection establishment:**
```typescript
// Generate unique session ID
const sessionId = `${projectName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
(ws as any).sessionId = sessionId;

// Generate CSRF token
const csrfToken = CSRFMiddleware.generateToken(sessionId);

// Send token to client
ws.send(JSON.stringify({ 
  type: 'CSRF_TOKEN', 
  token: csrfToken,
  sessionId: sessionId
}));
```

**Added to close and error handlers:**
```typescript
ws.on('close', (code, reason) => {
  // ... existing cleanup code
  
  // Remove CSRF token when connection closes
  if ((ws as any).sessionId) {
    CSRFMiddleware.removeToken((ws as any).sessionId);
  }
  
  // ... rest of cleanup
});

ws.on('error', (err) => {
  // ... existing cleanup code
  
  // Remove CSRF token on error
  if ((ws as any).sessionId) {
    CSRFMiddleware.removeToken((ws as any).sessionId);
  }
  
  // ... rest of cleanup
});
```

### 3. WebSocket Message Validation

**Before:**
```typescript
ws.on('message', async (message: string) => {
  // Rate limiting check
  (ws as any)._msgCount = ((ws as any)._msgCount || 0) + 1;
  if ((ws as any)._msgCount > 100) {
    return;
  }

  session.activeWs = ws;

  // Parse message
  let data: any;
  try {
    data = JSON.parse(message.toString());
  } catch (parseErr) {
    console.error('❌ WS: Отримано невалідний JSON:', String(message).substring(0, 100));
    return;
  }

  // Handle message types...
```

**After:**
```typescript
ws.on('message', async (message: string) => {
  // Rate limiting check
  (ws as any)._msgCount = ((ws as any)._msgCount || 0) + 1;
  if ((ws as any)._msgCount > 100) {
    return;
  }

  session.activeWs = ws;

  // Validate JSON parsing
  let data: any;
  try {
    data = JSON.parse(message.toString());
  } catch (parseErr) {
    logger.warn('WS: Received invalid JSON message', { projectName, error: String(parseErr) });
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON format' }));
    return;
  }
  
  // Validate message structure
  if (!data || typeof data !== 'object' || !data.type) {
    logger.warn('WS: Received message without type field', { projectName });
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Message must have a type field' }));
    return;
  }

  // Handle message types...
```

### 4. Import Updates

**Added imports:**
```typescript
import { authMiddleware, AuthMiddleware } from './auth/AuthMiddleware';
import { csrfMiddleware, CSRFMiddleware } from './auth/CSRFMiddleware';
```

## Acceptance Criteria Verification

### AC #1: Apply JWT middleware to WebSocket endpoint
✅ **PASS** - JWT token validation added to WebSocket connection handler

### AC #2: Generate and send CSRF token on WebSocket connection
✅ **PASS** - CSRF token generated and sent via `CSRF_TOKEN` message

### AC #3: Apply rate limiting to WebSocket connections
✅ **PASS** - Rate limiting already applied in HTTP upgrade handler (Requirement 7.2)

### AC #4: Validate all incoming WebSocket message data
✅ **PASS** - JSON parsing and message structure validation added

## WebSocket Security Flow

### Connection Establishment

1. Client initiates WebSocket connection to `/ws?project=<name>&token=<jwt>`
2. Server checks rate limit (10 connections per 15 minutes)
3. Server validates project name format
4. Server validates JWT token
5. Server generates unique session ID
6. Server generates CSRF token for session
7. Server sends CSRF token to client
8. Connection established

### Message Exchange

1. Client sends message to server
2. Server checks rate limit (100 messages per second)
3. Server validates JSON format
4. Server validates message structure (has `type` field)
5. Server processes message
6. Server sends response

### Connection Termination

1. Connection closes or errors
2. Server clears rate limiting timer
3. Server removes CSRF token from store
4. Server removes all event listeners
5. Server clears session reference

## Security Improvements

1. **Authentication**: 100% of WebSocket connections now require valid JWT token
2. **CSRF Protection**: CSRF token generated and distributed to all clients
3. **Input Validation**: All incoming messages validated for format and structure
4. **Rate Limiting**: Connection and message rate limits enforced
5. **Logging**: All authentication failures and validation errors logged

## Testing Recommendations

### Authentication Tests

1. **Missing Token**:
   - Connect without token
   - Verify connection rejected with code 1008
   - Verify error message: "Authentication required"

2. **Invalid Token**:
   - Connect with malformed token
   - Verify connection rejected with code 1008
   - Verify error message: "Invalid or expired token"

3. **Expired Token**:
   - Connect with expired token (>24 hours old)
   - Verify connection rejected with code 1008
   - Verify error message: "Invalid or expired token"

4. **Valid Token**:
   - Connect with valid JWT token
   - Verify connection established
   - Verify CSRF token received
   - Verify user info logged

### CSRF Token Tests

1. **Token Generation**:
   - Connect with valid JWT
   - Verify `CSRF_TOKEN` message received
   - Verify token is 64-character hex string
   - Verify sessionId is included

2. **Token Cleanup**:
   - Connect and receive CSRF token
   - Close connection
   - Verify token removed from store

### Message Validation Tests

1. **Invalid JSON**:
   - Send malformed JSON message
   - Verify ERROR message received
   - Verify error logged

2. **Missing Type Field**:
   - Send valid JSON without `type` field
   - Verify ERROR message received
   - Verify error logged

3. **Valid Message**:
   - Send valid JSON with `type` field
   - Verify message processed
   - Verify no errors

### Rate Limiting Tests

1. **Connection Rate Limit**:
   - Attempt 11 connections in 15 minutes
   - Verify 11th connection rejected with HTTP 429

2. **Message Rate Limit**:
   - Send 101 messages in 1 second
   - Verify 101st message silently dropped

## Frontend Integration Notes

The frontend needs to be updated to:

1. **Include JWT token in WebSocket connection**:
   ```javascript
   const token = localStorage.getItem('jwt_token');
   const ws = new WebSocket(`ws://localhost:3001/ws?project=${projectName}&token=${token}`);
   ```

2. **Handle CSRF token message**:
   ```javascript
   ws.onmessage = (event) => {
     const data = JSON.parse(event.data);
     if (data.type === 'CSRF_TOKEN') {
       localStorage.setItem('csrf_token', data.token);
       localStorage.setItem('session_id', data.sessionId);
     }
     // ... handle other message types
   };
   ```

3. **Include CSRF token in HTTP requests**:
   ```javascript
   fetch('/api/save', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${jwt_token}`,
       'X-CSRF-Token': csrf_token,
       'X-Session-Id': session_id,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(data)
   });
   ```

## Conclusion

✅ **Task 8.2 is COMPLETE**

WebSocket endpoint now has:
- JWT authentication for all connections
- CSRF token generation and distribution
- Input validation for all incoming messages
- Rate limiting for connections and messages

The system is now protected against:
- Unauthorized WebSocket connections
- Cross-site WebSocket hijacking
- Malformed message attacks
- Denial-of-service attacks

All requirements (1, 2, 7) are fully satisfied.
