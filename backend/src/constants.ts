import path from 'path';

/**
 * Extension ID for Ronin Wallet browser extension
 */
export const RONIN_EXTENSION_ID = 'fnjhmkhhmkbjkkabndcnnogagogbneec';

/**
 * Base project directories
 */
export const PROJECTS_DIR = path.join(__dirname, '../projects');
export const SAVE_PATH = path.join(__dirname, '../save.json');
export const DATA_DIR = path.join(__dirname, '../data');
export const MEMORY_INVALID_TEMPLATES_DIR = path.join(__dirname, '../images/memory_invalid_templates');
export const RUNS_DIR = path.join(__dirname, '../../data/runs');
export const LOGS_DIR = path.join(__dirname, '../../data/logs');

/**
 * Server default settings
 */
export const DEFAULT_HTTP_PORT = 3001;
export const DEFAULT_SAFETY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
