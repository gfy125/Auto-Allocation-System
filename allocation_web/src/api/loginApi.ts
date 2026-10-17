import { API_CONFIG, createApiUrl } from './config';

// Login request data interface
export interface LoginRequest {
  username: string;
  password: string;
}

// Change password request data interface
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Change password response data interface
export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
}

// Create user request data interface
export interface CreateUserRequest {
  username: string;
  password: string;
  confirmPassword: string;
}

// Login response data interface
export interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
    role: 'admin';
    displayName?: string;
  };
  token?: string;
  expiresAt?: string;
}

// User information interface
export interface UserInfo {
  id: number;
  username: string;
  role: 'admin';
  displayName?: string;
}

// Authentication error interface
export interface AuthError {
  message: string;
  code?: string;
  details?: string;
}

// Login API call
export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.AUTH);
  
  try {
    console.log(' Attempting login for user:', credentials.username);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(credentials)
    });

    console.log(' Login response status:', response.status, response.statusText);
    
    const result = await response.json();
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    // Validate response data format
    if (!result.success) {
      throw new Error('Login failed: Invalid response format');
    }
    
    if (!result.user || !result.user.role) {
      throw new Error('Login failed: Missing user information');
    }
    
    // If token is returned, store it in localStorage
    if (result.token) {
      localStorage.setItem('authToken', result.token);
      if (result.expiresAt) {
        localStorage.setItem('tokenExpiresAt', result.expiresAt);
      }
    }
    
    console.log(' Login successful for user:', result.user.username, 'role:', result.user.role);
    
    return result as LoginResponse;

  } catch (error: any) {
    console.error(' Login error:', error);
    
    // HTTP status code pattern: return corresponding HTTP status code based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network connection error - backend not running
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    } else if (error.name === 'AbortError') {
      // Request timeout
      throw new Error('HTTP 408: Request Timeout\nRequest timed out\n\nPlease try again');
    } else if (error.message.includes('HTTP')) {
      // Already our thrown HTTP error, pass directly
      throw error;
    } else if (error.message.includes('Failed to fetch')) {
      // fetch failed - usually network issues
      throw new Error('HTTP 503: Service Unavailable\nNetwork connection failed\n\nPlease check your internet connection and backend server');
    } else {
      // Other unknown errors
      throw new Error(`HTTP 500: Internal Server Error\n${error.message}\n\nPlease contact support if this persists`);
    }
  }
};

// Logout API call
export const logoutUser = async (): Promise<{ success: boolean; message: string }> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.AUTH}/logout`);
  
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    // Clear locally stored token regardless of backend response
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiresAt');
    
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    const result = await response.json();
    console.log(' Logout successful');
    
    return result;

  } catch (error: any) {
    console.error(' Logout error:', error);
    
    // Even if logout fails, clear local token
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiresAt');
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    } else if (error.name === 'AbortError') {
      throw new Error('HTTP 408: Request Timeout\nRequest timed out\n\nPlease try again');
    } else if (error.message.includes('HTTP')) {
      throw error;
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nNetwork connection failed\n\nPlease check your internet connection and backend server');
    } else {
      throw new Error(`HTTP 500: Internal Server Error\n${error.message}\n\nPlease contact support if this persists`);
    }
  }
};

// Validate token validity
export const validateToken = async (): Promise<UserInfo | null> => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return null;
  }
  
  // Check if token is expired
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  if (expiresAt && new Date(expiresAt) < new Date()) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiresAt');
    return null;
  }
  
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.AUTH}/validate`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // Token invalid, clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('tokenExpiresAt');
      return null;
    }
    
    const result = await response.json();
    
    if (result.success && result.user) {
      return result.user as UserInfo;
    }
    
    return null;

  } catch (error: any) {
    console.error(' Token validation error:', error);
    
    // Validation failed, clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiresAt');
    
    return null;
  }
};

// Get current user information (from local storage)
export const getCurrentUser = (): UserInfo | null => {
  try {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      return JSON.parse(userStr) as UserInfo;
    }
  } catch (error) {
    console.error(' Error parsing current user:', error);
  }
  return null;
};

// Set current user information to local storage
export const setCurrentUser = (user: UserInfo): void => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

// Clear current user information
export const clearCurrentUser = (): void => {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authToken');
  localStorage.removeItem('tokenExpiresAt');
};

// Check if registration is available API call
export const checkRegistration = async (): Promise<{ success: boolean; canRegister: boolean; message: string }> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.AUTH}/check-registration`);
  
  try {
    console.log(' Checking registration status...');
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    console.log(' Check registration response status:', response.status, response.statusText);
    
    const result = await response.json();
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    console.log(' Registration check result:', result.canRegister);
    
    return {
      success: result.success,
      canRegister: result.canRegister,
      message: result.message
    };

  } catch (error: any) {
    console.error(' Check registration error:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    } else if (error.name === 'AbortError') {
      throw new Error('HTTP 408: Request Timeout\nRequest timed out\n\nPlease try again');
    } else if (error.message.includes('HTTP')) {
      throw error;
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nNetwork connection failed\n\nPlease check your internet connection and backend server');
    } else {
      throw new Error(`HTTP 500: Internal Server Error\n${error.message}\n\nPlease contact support if this persists`);
    }
  }
};

// Create user API call
export const createUser = async (userData: CreateUserRequest): Promise<LoginResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.AUTH}/create-user`);
  
  try {
    console.log(' Creating user:', userData.username);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(userData)
    });

    console.log(' Create user response status:', response.status, response.statusText);
    
    const result = await response.json();
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    // Validate response data format
    if (!result.success) {
      throw new Error('Create user failed: Invalid response format');
    }
    
    console.log(' User created successfully:', result.user?.username);
    
    return result as LoginResponse;

  } catch (error: any) {
    console.error(' Create user error:', error);
    
    // HTTP status code pattern: return corresponding HTTP status code based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network connection error - backend not running
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    } else if (error.name === 'AbortError') {
      // Request timeout
      throw new Error('HTTP 408: Request Timeout\nRequest timed out\n\nPlease try again');
    } else if (error.message.includes('HTTP')) {
      // Already our thrown HTTP error, pass directly
      throw error;
    } else if (error.message.includes('Failed to fetch')) {
      // fetch failed - usually network issues
      throw new Error('HTTP 503: Service Unavailable\nNetwork connection failed\n\nPlease check your internet connection and backend server');
    } else {
      // Other unknown errors
      throw new Error(`HTTP 500: Internal Server Error\n${error.message}\n\nPlease contact support if this persists`);
    }
  }
};

// Change password API call
export const changePassword = async (passwordData: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.AUTH}/change-password`);
  
  try {
    console.log(' Changing password...');
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(passwordData)
    });

    console.log(' Change password response status:', response.status, response.statusText);
    
    const result = await response.json();
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    console.log(' Password changed successfully');
    
    return result as ChangePasswordResponse;

  } catch (error: any) {
    console.error(' Change password error:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    } else if (error.name === 'AbortError') {
      throw new Error('HTTP 408: Request Timeout\nRequest timed out\n\nPlease try again');
    } else if (error.message.includes('HTTP')) {
      throw error;
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nNetwork connection failed\n\nPlease check your internet connection and backend server');
    } else {
      throw new Error(`HTTP 500: Internal Server Error\n${error.message}\n\nPlease contact support if this persists`);
    }
  }
};