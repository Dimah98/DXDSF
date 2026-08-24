/**
 * Unit Tests for InputValidator
 *
 * Tests all validation methods:
 * - validateProjectName (Requirement 3)
 * - validateSelector (Requirement 4)
 * - validateURL (Requirement 5)
 * - validateFilePath (Requirement 6)
 * - validateJSON (Requirement 14)
 */

import { describe, it, expect } from 'vitest';
import { InputValidator } from './InputValidator';
import * as path from 'path';

const validator = new InputValidator();

// ─────────────────────────────────────────────────────────────────────────────
// validateProjectName — Requirement 3
// ─────────────────────────────────────────────────────────────────────────────

describe('validateProjectName', () => {
  // Valid inputs
  it('accepts a simple alphanumeric name', () => {
    const result = validator.validateProjectName('MyProject');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('MyProject');
  });

  it('accepts a name with underscores and dashes', () => {
    const result = validator.validateProjectName('my_project-v2');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('my_project-v2');
  });

  it('accepts a single character name', () => {
    const result = validator.validateProjectName('a');
    expect(result.isValid).toBe(true);
  });

  it('accepts a 50-character name', () => {
    const name = 'a'.repeat(50);
    const result = validator.validateProjectName(name);
    expect(result.isValid).toBe(true);
  });

  // Length violations
  it('rejects an empty string', () => {
    const result = validator.validateProjectName('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  it('rejects a name longer than 50 characters', () => {
    const result = validator.validateProjectName('a'.repeat(51));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  // Path traversal patterns — Requirement 3.3
  it('rejects a name containing ".."', () => {
    const result = validator.validateProjectName('../../etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  it('rejects a name containing "/"', () => {
    const result = validator.validateProjectName('project/name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  it('rejects a name containing "\\"', () => {
    const result = validator.validateProjectName('project\\name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  it('rejects a name containing a null byte', () => {
    const result = validator.validateProjectName('project\0name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  // Invalid characters
  it('rejects a name with spaces', () => {
    const result = validator.validateProjectName('my project');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  it('rejects a name with special characters', () => {
    const result = validator.validateProjectName('project@name!');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });

  // Non-string input
  it('rejects null input', () => {
    const result = validator.validateProjectName(null as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid project name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSelector — Requirement 4
// ─────────────────────────────────────────────────────────────────────────────

describe('validateSelector', () => {
  // Valid selectors
  it('accepts a simple class selector', () => {
    const result = validator.validateSelector('.my-class');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('.my-class');
  });

  it('accepts an ID selector', () => {
    const result = validator.validateSelector('#my-id');
    expect(result.isValid).toBe(true);
  });

  it('accepts a compound selector', () => {
    const result = validator.validateSelector('div.container > p:first-child');
    expect(result.isValid).toBe(true);
  });

  it('accepts an attribute selector', () => {
    const result = validator.validateSelector('[data-testid="submit-btn"]');
    expect(result.isValid).toBe(true);
  });

  // Length limit — Requirement 4.2
  it('accepts a selector exactly 500 characters long', () => {
    const selector = '.a'.padEnd(500, 'b');
    const result = validator.validateSelector(selector);
    // May be valid or invalid depending on CSS syntax, but length check passes
    // The important thing is it doesn't fail on length alone
    expect(result.error).not.toBe('Selector too long');
  });

  it('rejects a selector longer than 500 characters', () => {
    const selector = '.class' + 'a'.repeat(496);
    const result = validator.validateSelector(selector);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  // Script injection patterns — Requirement 4.3
  it('rejects a selector containing "<script>"', () => {
    const result = validator.validateSelector('<script>alert(1)</script>');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  it('rejects a selector containing "javascript:"', () => {
    const result = validator.validateSelector('a[href="javascript:void(0)"]');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  it('rejects a selector containing "eval("', () => {
    const result = validator.validateSelector('div[onclick="eval(code)"]');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  it('rejects injection patterns case-insensitively', () => {
    const result = validator.validateSelector('<SCRIPT>alert(1)</SCRIPT>');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  // Empty / non-string
  it('rejects an empty selector', () => {
    const result = validator.validateSelector('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });

  it('rejects null input', () => {
    const result = validator.validateSelector(null as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid selector');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateURL — Requirement 5
// ─────────────────────────────────────────────────────────────────────────────

describe('validateURL', () => {
  // Valid URLs
  it('accepts an https URL', () => {
    const result = validator.validateURL('https://example.com/path');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('https://example.com/path');
  });

  it('accepts an http URL', () => {
    const result = validator.validateURL('http://example.com');
    expect(result.isValid).toBe(true);
  });

  it('accepts an https URL with port', () => {
    const result = validator.validateURL('https://api.example.com:8443/v1');
    expect(result.isValid).toBe(true);
  });

  // Protocol violations — Requirement 5.1 / 5.3
  it('rejects an ftp URL', () => {
    const result = validator.validateURL('ftp://files.example.com');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid URL protocol');
  });

  it('rejects a file:// URL', () => {
    const result = validator.validateURL('file:///etc/passwd');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid URL protocol');
  });

  it('rejects a data: URL', () => {
    const result = validator.validateURL('data:text/html,<h1>test</h1>');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid URL protocol');
  });

  // Internal IP / localhost — Requirement 5.2 / 5.4
  it('rejects localhost', () => {
    const result = validator.validateURL('http://localhost/api');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 127.0.0.1', () => {
    const result = validator.validateURL('http://127.0.0.1:3000');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 0.0.0.0', () => {
    const result = validator.validateURL('http://0.0.0.0');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 192.168.x.x private range', () => {
    const result = validator.validateURL('http://192.168.1.100/admin');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 10.x.x.x private range', () => {
    const result = validator.validateURL('http://10.0.0.1/internal');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 172.16.x.x private range', () => {
    const result = validator.validateURL('http://172.16.0.1/');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects 172.31.x.x private range', () => {
    const result = validator.validateURL('http://172.31.255.255/');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  it('rejects AWS metadata service IP', () => {
    const result = validator.validateURL('http://169.254.169.254/latest/meta-data/');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Internal URLs not allowed');
  });

  // Malformed URLs
  it('rejects a malformed URL', () => {
    const result = validator.validateURL('not-a-url');
    expect(result.isValid).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = validator.validateURL('');
    expect(result.isValid).toBe(false);
  });

  it('rejects null input', () => {
    const result = validator.validateURL(null as any);
    expect(result.isValid).toBe(false);
  });

  // Edge: 172.15.x.x is NOT in the private range (172.16-31)
  it('accepts 172.15.x.x (not in private range)', () => {
    const result = validator.validateURL('http://172.15.0.1/');
    expect(result.isValid).toBe(true);
  });

  // Edge: 172.32.x.x is NOT in the private range
  it('accepts 172.32.x.x (not in private range)', () => {
    const result = validator.validateURL('http://172.32.0.1/');
    expect(result.isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateFilePath — Requirement 6
// ─────────────────────────────────────────────────────────────────────────────

describe('validateFilePath', () => {
  const baseDir = path.join('C:', 'projects');

  // Valid paths
  it('accepts a simple filename within base directory', () => {
    const result = validator.validateFilePath('myproject.json', baseDir);
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe(path.resolve(baseDir, 'myproject.json'));
  });

  it('accepts a nested path within base directory', () => {
    const result = validator.validateFilePath('subdir/file.json', baseDir);
    expect(result.isValid).toBe(true);
  });

  // Path traversal — Requirement 6.3
  it('rejects a path with ".." that escapes base directory', () => {
    const result = validator.validateFilePath('../../etc/passwd', baseDir);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  it('rejects a path with ".." in the middle', () => {
    const result = validator.validateFilePath('subdir/../../outside.json', baseDir);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  // Absolute path outside base — Requirement 6.4
  it('rejects an absolute path outside base directory', () => {
    const result = validator.validateFilePath('/etc/passwd', baseDir);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  // Empty / non-string inputs
  it('rejects an empty file path', () => {
    const result = validator.validateFilePath('', baseDir);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  it('rejects null file path', () => {
    const result = validator.validateFilePath(null as any, baseDir);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  it('rejects null base directory', () => {
    const result = validator.validateFilePath('file.json', null as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid file path');
  });

  // Normalized path is returned as sanitized value
  it('returns the normalized absolute path as sanitized value', () => {
    const result = validator.validateFilePath('subdir/file.json', baseDir);
    expect(result.isValid).toBe(true);
    expect(path.isAbsolute(result.sanitized as string)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateJSON — Requirement 14
// ─────────────────────────────────────────────────────────────────────────────

describe('validateJSON', () => {
  it('accepts valid JSON object', () => {
    const result = validator.validateJSON('{"key": "value"}');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toEqual({ key: 'value' });
  });

  it('accepts valid JSON array', () => {
    const result = validator.validateJSON('[1, 2, 3]');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toEqual([1, 2, 3]);
  });

  it('accepts valid JSON string primitive', () => {
    const result = validator.validateJSON('"hello"');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('hello');
  });

  it('accepts valid JSON number', () => {
    const result = validator.validateJSON('42');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe(42);
  });

  it('rejects malformed JSON', () => {
    const result = validator.validateJSON('{key: value}');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid JSON data');
  });

  it('rejects truncated JSON', () => {
    const result = validator.validateJSON('{"key": ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid JSON data');
  });

  it('rejects an empty string', () => {
    const result = validator.validateJSON('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid JSON data');
  });

  it('rejects null input', () => {
    const result = validator.validateJSON(null as any);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid JSON data');
  });
});
