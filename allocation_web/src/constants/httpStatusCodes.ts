// HTTP status code constant definitions
export const HTTP_STATUS = {
  // Success status codes
  OK: 200,
  CREATED: 201,
  
  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  REQUEST_TIMEOUT: 408,
  
  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error code constants
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_GROUP: 'DUPLICATE_GROUP',
  DATABASE_BUSY: 'DATABASE_BUSY',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

// User-friendly messages corresponding to status codes
export const STATUS_MESSAGES = {
  [HTTP_STATUS.BAD_REQUEST]: '❌ Bad Request (400)',
  [HTTP_STATUS.REQUEST_TIMEOUT]: '⏰ Request Timeout (408)',
  [HTTP_STATUS.CONFLICT]: '⚠️ Conflict (409)',
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: '🔥 Server Error (500)',
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: '🚫 Service Unavailable (503)',
} as const;
