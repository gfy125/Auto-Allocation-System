/**
 * Frontend input sanitization and validation utilities
 * Prevent malicious input (such as SQL injection, XSS, etc.) from being sent to backend
 */

// Regular expressions for dangerous characters and patterns
const DANGEROUS_PATTERNS = [
  // SQL injection related
  /(--|\/\*|\*\/|;|union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
  // XSS related
  /<script|<\/script|javascript:|on\w+\s*=|eval\(|expression\(/i,
  // Special characters
  /[<>'"&]/,
  // Control characters
  /[\x00-\x1f\x7f-\x9f]/
];

/**
 * Sanitize input string, remove or escape dangerous characters
 * @param input Original input
 * @param allowSpecialChars Whether to allow special characters (such as special characters in passwords)
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string, allowSpecialChars: boolean = false): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove leading and trailing whitespace
  let cleaned = input.trim();

  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  if (!allowSpecialChars) {
    // For usernames, etc., remove dangerous characters
    cleaned = cleaned.replace(/[<>'"&;]/g, '');
  }

  return cleaned;
};

/**
 * Validate username input
 * @param username Username
 * @returns Validation result
 */
export const validateUsername = (username: string): { isValid: boolean; error?: string } => {
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return { isValid: false, error: 'Username is required' };
  }

  const cleaned = sanitizeInput(username);
  
  if (cleaned.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }

  if (cleaned.length > 50) {
    return { isValid: false, error: 'Username must not exceed 50 characters' };
  }

  // Check if contains dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { isValid: false, error: 'Username contains invalid characters' };
    }
  }

  // Only allow letters, numbers, underscores and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores and hyphens' };
  }

  return { isValid: true };
};

/**
 * Validate password input
 * @param password Password
 * @returns Validation result
 */
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (!password || typeof password !== 'string' || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }

  if (password.length > 200) {
    return { isValid: false, error: 'Password must not exceed 200 characters' };
  }

  // Check if contains dangerous patterns (but allow special characters in passwords)
  for (const pattern of DANGEROUS_PATTERNS.slice(0, 2)) { // Only check SQL and XSS patterns
    if (pattern.test(password)) {
      return { isValid: false, error: 'Password contains invalid characters' };
    }
  }

  return { isValid: true };
};

/**
 * Sanitize and validate login credentials
 * @param credentials Login credentials
 * @returns Sanitized credentials and validation result
 */
export const sanitizeLoginCredentials = (credentials: { username: string; password: string }) => {
  const usernameResult = validateUsername(credentials.username);
  const passwordResult = validatePassword(credentials.password);

  return {
    credentials: {
      username: sanitizeInput(credentials.username),
      password: credentials.password // Password is not sanitized, only validated
    },
    validation: {
      username: usernameResult,
      password: passwordResult,
      isValid: usernameResult.isValid && passwordResult.isValid
    }
  };
};

/**
 * Sanitize text input (for project descriptions, group names, etc.)
 * @param text Text input
 * @param maxLength Maximum length
 * @returns Sanitized text
 */
export const sanitizeTextInput = (text: string, maxLength: number = 1000): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text.trim();

  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Escape HTML special characters
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
};

/**
 * Validate number input
 * @param value Input value
 * @param min Minimum value
 * @param max Maximum value
 * @returns Validation result
 */
export const validateNumberInput = (value: string | number, min?: number, max?: number): { isValid: boolean; error?: string; value?: number } => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { isValid: false, error: 'Invalid number format' };
  }

  if (min !== undefined && numValue < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && numValue > max) {
    return { isValid: false, error: `Value must not exceed ${max}` };
  }

  return { isValid: true, value: numValue };
};
