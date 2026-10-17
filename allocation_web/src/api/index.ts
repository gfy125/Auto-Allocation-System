// Unified API service exports
export * from './config';
export * from './groupApi';
export * from './projectApi';
export * from './loginApi';

// Re-export commonly used API methods
export { createGroup, getAllGroups, deleteGroup } from './groupApi';
export { createProject } from './projectApi';
export { loginUser, logoutUser, validateToken, getCurrentUser, setCurrentUser, clearCurrentUser } from './loginApi';

// Export types
export type { GroupData, ApiResponse, GroupApiData, BackendResponse } from './groupApi';
export type { ProjectData, ProjectApiData } from './projectApi';
export type { LoginRequest, LoginResponse, UserInfo, AuthError } from './loginApi';

export { API_CONFIG } from './config';
