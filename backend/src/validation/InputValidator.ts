/**
 * Input Validation Service
 * 
 * Validates and sanitizes all user input to prevent security vulnerabilities:
 * - Project names: prevent path traversal attacks
 * - CSS selectors: prevent injection attacks
 * - URLs: prevent SSRF attacks
 * - File paths: prevent path traversal attacks
 * - JSON data: prevent malformed data crashes
 * 
 * Requirements: 3, 4, 5, 6
 */

import { InputValidator as IInputValidator, ValidationResult } from '../types';
import { Logger } from '../logger';
import * as path from 'path';

const logger = new Logger('InputValidator');

/**
 * Input Validation Service implementation
 * Requirements: 3, 4, 5, 6
 */
export class InputValidator implements IInputValidator {
  /**
   * Validate project name
   * 
   * Requirement 3: Input Validation for Project Names
   * - Accept only alphanumeric characters, underscores, and dashes
   * - Length between 1 and 50 characters
   * - Reject path traversal patterns (.., /, \, null bytes)
   * 
   * @param name - Project name to validate
   * @returns ValidationResult with isValid flag and optional error message
   */
  validateProjectName(name: string): ValidationResult {
    // Check if name is provided
    if (!name || typeof name !== 'string') {
      logger.warn('Project name validation failed: empty or non-string', { name });
      return {
        isValid: false,
        error: 'Invalid project name'
      };
    }

    // Check length (1-50 characters)
    if (name.length < 1 || name.length > 50) {
      logger.warn('Project name validation failed: invalid length', { name, length: name.length });
      return {
        isValid: false,
        error: 'Invalid project name'
      };
    }

    // Check for path traversal patterns
    if (name.includes('..') || name.includes('/') || name.includes('\\') || name.includes('\0')) {
      logger.warn('Project name validation failed: path traversal attempt', { name });
      return {
        isValid: false,
        error: 'Invalid project name'
      };
    }

    // Check allowed characters: alphanumeric + underscore + dash
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(name)) {
      logger.warn('Project name validation failed: invalid characters', { name });
      return {
        isValid: false,
        error: 'Invalid project name'
      };
    }

    logger.debug('Project name validated successfully', { name });
    return {
      isValid: true,
      sanitized: name
    };
  }

  /**
   * Validate CSS selector
   * 
   * Requirement 4: Input Validation for CSS Selectors
   * - Fast syntax validation (balanced brackets, quotes, no invalid delimiters)
   * - Reject selectors longer than 500 characters
   * - Reject selectors containing script injection patterns
   * 
   * @param selector - CSS selector to validate
   * @returns ValidationResult with isValid flag and optional error message
   */
  validateSelector(selector: string): ValidationResult {
    // Check if selector is provided
    if (!selector || typeof selector !== 'string') {
      logger.warn('Selector validation failed: empty or non-string', { selector });
      return {
        isValid: false,
        error: 'Invalid selector'
      };
    }

    // Check length (max 500 characters)
    if (selector.length > 500) {
      logger.warn('Selector validation failed: exceeds max length', { 
        selector: selector.substring(0, 50) + '...', 
        length: selector.length 
      });
      return {
        isValid: false,
        error: 'Invalid selector'
      };
    }

    // Check for script injection patterns
    const dangerousPatterns = ['<script', 'javascript:', 'eval(', 'expression(', 'onload=', 'onerror=', 'vbscript:'];
    const lower = selector.toLowerCase();
    for (const pattern of dangerousPatterns) {
      if (lower.includes(pattern)) {
        logger.warn('Selector validation failed: script injection attempt', { 
          selector: selector.substring(0, 50) + '...',
          pattern 
        });
        return {
          isValid: false,
          error: 'Invalid selector'
        };
      }
    }

    // Check for HTML tags or braces (<, {, })
    if (/[<{}]/.test(selector)) {
      logger.warn('Selector validation failed: contains illegal characters (<, {, })', { selector });
      return {
        isValid: false,
        error: 'Invalid selector'
      };
    }

    // Verify balanced quotes and brackets without VM overhead
    const stack: string[] = [];
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let isEscaped = false;

    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (inDoubleQuote || inSingleQuote) {
        continue;
      }

      if (char === '[' || char === '(') {
        stack.push(char);
      } else if (char === ']') {
        if (stack.pop() !== '[') {
          return { isValid: false, error: 'Invalid selector' };
        }
      } else if (char === ')') {
        if (stack.pop() !== '(') {
          return { isValid: false, error: 'Invalid selector' };
        }
      }
    }

    if (inDoubleQuote || inSingleQuote || stack.length > 0 || isEscaped) {
      logger.warn('Selector validation failed: unbalanced brackets/quotes or trailing escape', { selector });
      return {
        isValid: false,
        error: 'Invalid selector'
      };
    }

    logger.debug('Selector validated successfully', { selector });
    return {
      isValid: true,
      sanitized: selector
    };
  }

  /**
   * Validate URL
   * 
   * Requirement 5: Input Validation for URLs
   * - Accept only http: and https: protocols
   * - Reject internal IP addresses and localhost
   * - Prevent SSRF attacks
   * 
   * @param url - URL to validate
   * @returns ValidationResult with isValid flag and optional error message
   */
  validateURL(url: string): ValidationResult {
    // Check if URL is provided
    if (!url || typeof url !== 'string') {
      logger.warn('URL validation failed: empty or non-string', { url });
      return {
        isValid: false,
        error: 'Invalid URL protocol'
      };
    }

    // Parse URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      logger.warn('URL validation failed: malformed URL', { 
        url: url.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isValid: false,
        error: 'Invalid URL protocol'
      };
    }

    // Check protocol (only http and https allowed)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      logger.warn('URL validation failed: invalid protocol', { 
        url: url.substring(0, 100) + '...',
        protocol: parsedUrl.protocol 
      });
      return {
        isValid: false,
        error: 'Invalid URL protocol'
      };
    }

    // Check for internal/private IP addresses and hostnames
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check for localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      logger.warn('URL validation failed: localhost not allowed', { 
        url: url.substring(0, 100) + '...',
        hostname 
      });
      return {
        isValid: false,
        error: 'Internal URLs not allowed'
      };
    }

    // Check for private IP ranges
    const privateIPPatterns = [
      /^192\.168\./,           // 192.168.0.0/16
      /^10\./,                 // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^169\.254\.169\.254$/   // AWS metadata service
    ];

    for (const pattern of privateIPPatterns) {
      if (pattern.test(hostname)) {
        logger.warn('URL validation failed: private IP not allowed', { 
          url: url.substring(0, 100) + '...',
          hostname 
        });
        return {
          isValid: false,
          error: 'Internal URLs not allowed'
        };
      }
    }

    logger.debug('URL validated successfully', { url: url.substring(0, 100) + '...' });
    return {
      isValid: true,
      sanitized: url
    };
  }

  /**
   * Validate file path
   * 
   * Requirement 6: Input Validation for File Paths
   * - Normalize paths using path resolution
   * - Verify path is within allowed base directory
   * - Prevent path traversal attacks
   * 
   * @param filePath - File path to validate
   * @param baseDir - Base directory that the path must be within
   * @returns ValidationResult with isValid flag and optional error message
   */
  validateFilePath(filePath: string, baseDir: string): ValidationResult {
    // Check if path is provided
    if (!filePath || typeof filePath !== 'string') {
      logger.warn('File path validation failed: empty or non-string', { filePath });
      return {
        isValid: false,
        error: 'Invalid file path'
      };
    }

    // Check if base directory is provided
    if (!baseDir || typeof baseDir !== 'string') {
      logger.warn('File path validation failed: invalid base directory', { baseDir });
      return {
        isValid: false,
        error: 'Invalid file path'
      };
    }

    try {
      // Normalize both paths
      const normalizedBase = path.resolve(baseDir);
      const normalizedPath = path.resolve(baseDir, filePath);

      // Check if normalized path is within base directory
      if (!normalizedPath.startsWith(normalizedBase)) {
        logger.warn('File path validation failed: path traversal attempt', { 
          filePath,
          baseDir,
          normalizedPath,
          normalizedBase
        });
        return {
          isValid: false,
          error: 'Invalid file path'
        };
      }

      // Additional check for .. segments that might escape
      const relativePath = path.relative(normalizedBase, normalizedPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        logger.warn('File path validation failed: path escapes base directory', { 
          filePath,
          baseDir,
          relativePath
        });
        return {
          isValid: false,
          error: 'Invalid file path'
        };
      }

      logger.debug('File path validated successfully', { 
        filePath,
        normalizedPath: normalizedPath.substring(0, 100) + '...'
      });
      return {
        isValid: true,
        sanitized: normalizedPath
      };
    } catch (error) {
      logger.warn('File path validation failed: error during normalization', { 
        filePath,
        baseDir,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isValid: false,
        error: 'Invalid file path'
      };
    }
  }

  /**
   * Validate JSON data
   * 
   * Requirement 14: Error Handling for JSON Parsing
   * - Safely parse JSON with error handling
   * - Return validation result with parsed data or error
   * 
   * @param data - JSON string to validate
   * @returns ValidationResult with isValid flag and optional error message
   */
  validateJSON(data: string): ValidationResult {
    // Check if data is provided
    if (!data || typeof data !== 'string') {
      logger.warn('JSON validation failed: empty or non-string', { data });
      return {
        isValid: false,
        error: 'Invalid JSON data'
      };
    }

    try {
      const parsed = JSON.parse(data);
      logger.debug('JSON validated successfully');
      return {
        isValid: true,
        sanitized: parsed
      };
    } catch (error) {
      logger.warn('JSON validation failed: parse error', { 
        data: data.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isValid: false,
        error: 'Invalid JSON data'
      };
    }
  }
}

// Export singleton instance
export const inputValidator = new InputValidator();
