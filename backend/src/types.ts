/**
 * TypeScript Type Definitions for Sunflower Land Bot Constructor
 * 
 * This file contains all type definitions for:
 * - WebSocket messages (discriminated unions)
 * - API requests and responses
 * - Enhanced ProjectSession interface with lifecycle fields
 * - Middleware and service component interfaces
 * 
 * Requirements: 22, 23
 */

import { Browser, BrowserContext, Page } from 'playwright';
import WebSocket from 'ws';
import { Request, Response, NextFunction } from 'express';
import { BaseNode, BaseEdge, WSMessage as SharedWSMessage, WSResponse as SharedWSResponse, isWSMessage as sharedIsWSMessage } from '@sf/shared-types';

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket Message Types (Discriminated Unions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discriminated union type for all WebSocket messages from client to server
 * Requirement 22: TypeScript Type Safety for WebSocket Messages
 */
export type WSMessage = SharedWSMessage;

/**
 * Discriminated union type for all WebSocket responses from server to client
 * Requirement 22: TypeScript Type Safety for WebSocket Messages
 */
export type WSResponse = SharedWSResponse;

/**
 * Type guard to validate WebSocket message structure
 * Requirement 22: Use type guards to validate WebSocket message structure
 */
export const isWSMessage = sharedIsWSMessage;

// ═══════════════════════════════════════════════════════════════════════════
// API Request/Response Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Authentication request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Authentication response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoginResponse {
  success: boolean;
  token?: string;
  csrfToken?: string;
  error?: string;
}

/**
 * Project save request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface SaveProjectRequest {
  name: string;
  data: {
    nodes: BaseNode[];
    edges: BaseEdge[];
    variables?: Record<string, unknown>;
    launchSettings?: unknown;
    browserSettings?: BrowserSettings;
  };
}

/**
 * Project save response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface SaveProjectResponse {
  success: boolean;
  error?: string;
}

/**
 * Project load response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface LoadProjectResponse {
  nodes: BaseNode[];
  edges: BaseEdge[];
  variables: Record<string, unknown>;
  launchSettings?: unknown;
  browserSettings?: BrowserSettings;
}

/**
 * Multiple projects run request
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface RunMultipleRequest {
  projectNames: string[];
  projectSettings?: Record<string, unknown>;
}

/**
 * Multiple projects run response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface RunMultipleResponse {
  success: boolean;
  results: Record<string, boolean>;
  error?: string;
}

/**
 * Project status information
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface ProjectStatus {
  isRunning: boolean;
  activeNodeTitle: string | null;
}

/**
 * Status response for all projects
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface StatusResponse {
  [projectName: string]: ProjectStatus;
}

/**
 * Health check response
 * Requirement 24: Health Check Endpoint
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  activeSessionCount: number;
  activeBrowserCount: number;
}

/**
 * Generic API error response
 * Requirement 23: TypeScript Type Safety for API Requests
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced ProjectSession Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Browser settings configuration
 */
export interface BrowserSettings {
  width?: number; // Ширина вікна браузера у пікселях
  height?: number; // Висота вікна браузера у пікселях
  profile?: string; // Назва профілю браузера
  profileDir?: string; // Директорія профілю браузера
  proxy?: string; // Рядок налаштування проксі-сервера
  disableImages?: boolean; // Прапорець вимкнення картинок
  headless?: boolean; // Прапорець запуску браузера у невидимому режимі
}

/**
 * Bot execution settings
 */
export interface BotSettings {
  photoDebug: boolean; // Прапорець для збереження фото-дебагових скріншотів під час виконання
  disableImages?: boolean; // Прапорець для вимкнення завантаження картинок (економія трафіку)
  headless?: boolean; // Прапорець для запуску браузера у невидимому (headless) режимі
  width?: number; // Ширина вікна браузера у пікселях
  height?: number; // Висота вікна браузера у пікселях
  browserWidth?: number; // Альтернативна ширина вікна браузера
  browserHeight?: number; // Альтернативна висота вікна браузера
  profile?: string; // Назва профілю браузера
  profileDir?: string; // Директорія профілю браузера
  proxy?: string; // Рядок налаштування проксі-сервера
  verboseLogs?: boolean; // Детальне логування кроків кожної ноди в консолі (за замовчуванням true)
}

/**
 * Extended WebSocket with project-specific properties
 * Requirement 8: WebSocket Connection Lifecycle Management
 */
export interface ExtendedWebSocket extends WebSocket {
  projectName: string;
  isStreaming: boolean;
  isBotRunning: boolean;
  isSingleNodeRun: boolean;
  lastActivity: number;
}

/**
 * Enhanced ProjectSession interface with lifecycle fields
 * Requirements: 8, 9, 10, 11, 21
 */
export interface ProjectSession {
  // Identification
  projectName: string;

  // Browser Resources (Requirement 9: Browser Instance Lifecycle Management)
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  cdpPort: number;
  currentlyRunningProfileDir: string | null;

  // WebSocket Connection (Requirement 8: WebSocket Connection Lifecycle Management)
  activeWs: ExtendedWebSocket | null;

  // Bot State
  isBotRunning: boolean;
  lastActiveNodeId: string | null;
  lastActiveNodeTitle: string | null;
  currentRunId?: string;

  // Network Interception Cache (for API Node)
  latestFarmId?: string | null;
  latestApiToken?: string | null;

  // Bot Configuration
  botSettings: BotSettings;
  globalVariables: Record<string, unknown>;
  nodeRuntimeState: Map<string, Record<string, unknown>>;

  // Streaming
  isStreaming: boolean;
  photoDebugEnabled: boolean;

  // Lifecycle (Requirement 21: Session State Persistence)
  createdAt: number;
  lastActivity: number;
  safetyTimeout: NodeJS.Timeout | null;
  timeout10mTimer?: NodeJS.Timeout | null;
}

/**
 * Persisted session state for disk storage
 * Requirement 21: Session State Persistence
 */
export interface PersistedSession {
  projectName: string;
  isBotRunning: boolean;
  lastActiveNodeId: string | null;
  globalVariables: Record<string, unknown>;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Security Layer Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JWT token payload
 * Requirement 1: JWT Authentication
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;  // issued at
  exp: number;  // expiration
}

/**
 * JWT Authentication Middleware interface
 * Requirement 1: JWT Authentication
 */
export interface AuthMiddleware {
  generateToken(userId: string, username: string): string;
  verifyToken(token: string): JWTPayload | null;
  middleware(req: Request, res: Response, next: NextFunction): void;
}

/**
 * CSRF Protection Middleware interface
 * Requirement 2: CSRF Protection
 */
export interface CSRFMiddleware {
  generateToken(sessionId: string): string;
  verifyToken(token: string, sessionId: string): boolean;
  middleware(req: Request, res: Response, next: NextFunction): void;
}

/**
 * Validation result
 * Requirements: 3, 4, 5, 6
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: unknown;
}

/**
 * Input Validation Service interface
 * Requirements: 3, 4, 5, 6
 */
export interface InputValidator {
  validateProjectName(name: string): ValidationResult;
  validateSelector(selector: string): ValidationResult;
  validateURL(url: string): ValidationResult;
  validateFilePath(path: string, baseDir: string): ValidationResult;
  validateJSON(data: string): ValidationResult;
}

/**
 * Rate limit result
 * Requirement 7: Rate Limiting for API Endpoints
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate Limiter interface
 * Requirement 7: Rate Limiting for API Endpoints
 */
export interface RateLimiter {
  checkLimit(identifier: string, endpoint: string): Promise<RateLimitResult>;
  resetLimit(identifier: string, endpoint: string): Promise<void>;
}

/**
 * Secrets Manager interface
 * Requirements: 17, 18
 */
export interface SecretsManager {
  getSecret(key: string): string | undefined;
  setSecret(key: string, value: string): void;
  encrypt(text: string): string;
  decrypt(encrypted: string): string;
  encryptProjectSecrets(projectData: unknown): unknown;
  decryptProjectSecrets(projectData: unknown): unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// Resource Management Layer Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WebSocket Lifecycle Manager interface
 * Requirements: 8, 28
 */
export interface WebSocketLifecycle {
  registerConnection(ws: ExtendedWebSocket, projectName: string): void;
  unregisterConnection(ws: ExtendedWebSocket): void;
  cleanupInactiveConnections(): void;
  closeAllConnections(): Promise<void>;
}

/**
 * Browser Lifecycle Manager interface
 * Requirements: 9, 27
 */
export interface BrowserLifecycle {
  launchBrowser(session: ProjectSession, settings: BrowserSettings): Promise<Page>;
  closeBrowser(session: ProjectSession): Promise<void>;
  setupSafetyTimeout(session: ProjectSession, timeoutMs: number): void;
  cleanupZombieBrowsers(): Promise<void>;
}

/**
 * Timer Manager interface
 * Requirement 10: Timer Lifecycle Management
 */
export interface TimerManager {
  registerTimer(key: string, timer: NodeJS.Timeout): void;
  clearTimer(key: string): void;
  cleanupInactiveTimers(): void;
  clearAllTimers(): void;
}

/**
 * Memory statistics
 * Requirement 11: Memory Usage Monitoring
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory Monitor interface
 * Requirement 11: Memory Usage Monitoring
 */
export interface MemoryMonitor {
  checkMemoryUsage(): MemoryStats;
  limitNodeRuntimeState(state: Map<string, unknown>, maxSize: number): void;
  reportMemoryStats(): void;
}

/**
 * Semaphore for concurrency control
 * Requirement 19: Concurrency Control for Browser Instances
 */
export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
  run<T>(fn: () => Promise<T>): Promise<T>;
  getAvailable(): number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Management Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log levels
 * Requirement 12: Structured Logging
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Structured Logger interface
 * Requirement 12: Structured Logging
 */
export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, error?: Error, meta?: unknown): void;
  setContext(context: string): Logger;
}

/**
 * Application configuration
 * Requirement 16: Centralized Configuration Management
 */
export interface AppConfig {
  HTTP_PORT: number;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  BOT_SAFETY_LIMIT: number;
  STREAM_QUALITY: number;
  STREAM_DELAY: number;
  SCREENSHOT_TIMEOUT: number;
  MAX_PARALLEL_BROWSERS: number;
  SESSION_CLEANUP_INTERVAL: number;
  LOG_LEVEL: LogLevel;
  ALLOWED_ORIGINS: string[];
  REQUEST_TIMEOUT: number;
}

/**
 * Config Manager interface
 * Requirement 16: Centralized Configuration Management
 */
export interface ConfigManager {
  get<T>(key: string, defaultValue: T): T;
  validate(): ValidationResult[];
  reload(): void;
  getConfig(): AppConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// Shutdown and Persistence Interfaces
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shutdown Manager interface
 * Requirement 20: Graceful Shutdown
 */
export interface ShutdownManager {
  registerCleanupTask(name: string, task: () => Promise<void>): void;
  shutdown(signal: string): Promise<void>;
}

/**
 * Session Persister interface
 * Requirement 21: Session State Persistence
 */
export interface SessionPersister {
  saveState(): Promise<void>;
  loadState(): Promise<void>;
  scheduleAutoSave(intervalMs: number): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Express Request Extensions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extended Express Request with JWT payload
 * Requirement 1: JWT Authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Extended Express Request with CSRF validation
 * Requirement 2: CSRF Protection
 */
export interface CSRFRequest extends Request {
  csrfToken?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom error class for validation errors
 * Requirements: 3, 4, 5, 6
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for authentication errors
 * Requirement 1: JWT Authentication
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for authorization errors
 * Requirement 2: CSRF Protection
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Custom error class for rate limit errors
 * Requirement 7: Rate Limiting for API Endpoints
 */
export class RateLimitError extends Error {
  constructor(message: string, public resetAt: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
