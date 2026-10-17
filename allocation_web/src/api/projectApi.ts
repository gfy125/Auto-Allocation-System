import { API_CONFIG, createApiUrl } from './config';

export interface ProjectData {
  projectName: string;
  projectId: string;
  maxGroups?: string | number;
  client?: string;
  description?: string;
  deliverables?: string;
  specificSkills?: string;
  resourcesProvided?: string;
  tags?: string[];
  startTime?: string;
  finishTime?: string;
}

// HTTP status code directly returned
export type ApiResponse<T> = T;

export interface ProjectApiData {
  // primary identifier (from backend). If backend returns `id`, we map it here
  projectId: string;
  projectName: string;
  maxGroups: number;
  description: string;
  client: string;
  deliverables: string;
  specificSkills: string;
  resourcesProvided: string;
  tags: string[];
  startTime: string;
  finishTime: string;
  // groups assigned to this project (if provided by backend)
  groupname?: string[];
}

export interface BackendResponse {
  savedAt: string;
  // Optional fields for error cases (used to get detailed error information)
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
  message?: string;
  projectID?: number;
}

export interface UpdateProjectResponse extends BackendResponse {
  id?: number;
  data?: ProjectApiData;
}

// API call to create a project
export const createProject = async (projectData: ProjectData): Promise<BackendResponse> => {
  
  // Prepare API data format
  const apiData: ProjectApiData = {
    projectName: projectData.projectName,
    projectId: projectData.projectId,
    maxGroups: parseInt(String(projectData.maxGroups)) || 0,
    description: projectData.description || '',
    client: projectData.client || '',
    deliverables: projectData.deliverables || '',
    specificSkills: projectData.specificSkills || '',
    resourcesProvided: projectData.resourcesProvided || '',
    tags: projectData.tags || [],
    startTime: projectData.startTime || '',
    finishTime: projectData.finishTime || ''
  };
  
  // 🌐 Print request payload (data sent to backend)
  console.log('📨 createProject - request body (apiData):', apiData);
  console.log('📑 Fields:', Object.keys(apiData));

  // Both create and edit use the same request
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.PROJECTS);
  const method = 'POST';

  try {
    const response = await fetch(apiUrl, {
      method: method,
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(apiData)
    });

    // Print basic response status
    console.log('📡 createProject - response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log('📦 createProject - response body:', result);

    // Pure HTTP status code handling
    if (!response.ok) {
      // Try to get detailed error information from response body
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.error) {
        // If there is detailed error information, use it
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    // Validate that projectID (number) must be returned
    if (typeof result.projectID !== 'number') {
      throw new Error('HTTP 200: Missing projectID in response');
    }

    // Synchronously update local localStorage with newly created project id (match by projectName to find recent draft/new item)
    try {
      const savedProjectsRaw = localStorage.getItem('createdProjects');
      if (savedProjectsRaw) {
        const savedProjects = JSON.parse(savedProjectsRaw);
        // Prioritize updating name-matched draft projects; otherwise update first name-matched project
        let updated = false;
        const updatedProjects = savedProjects.map((p: any) => {
          if (!updated && p?.name === projectData.projectName && p?.status === 'draft') {
            updated = true;
            return { ...p, id: result.projectID };
          }
          return p;
        });
        if (!updated) {
          for (let i = 0; i < updatedProjects.length; i++) {
            if (updatedProjects[i]?.name === projectData.projectName) {
              updatedProjects[i] = { ...updatedProjects[i], id: result.projectID };
              updated = true;
              break;
            }
          }
        }
        if (updated) {
          localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
        }
      }
    } catch (e) {
      // Ignore local sync errors, don't affect main flow
      console.warn('Failed to sync projectID to localStorage:', (e as any)?.message || e);
    }

    // Return backend data on success (including projectID)
    return result;

  } catch (error: any) {
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

// API call to get all projects
export const getAllProjects = async (): Promise<ProjectApiData[]> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.PROJECTS);
  
  try {
    console.log('🚀 Fetching all projects from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error) {
          const details = errorData.error.details ? `\nDetails: ${errorData.error.details}` : '';
          errorMsg = `${errorData.error.message}${details}`;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (parseError) {
        // If unable to parse error response, use default error message
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    const result = await response.json();
    // Backend returns { projects: [...], count: ... } format
    const rawProjects: any[] = result.projects || result;
    // Normalize groupname field, ensure it's an array
    const projects: ProjectApiData[] = Array.isArray(rawProjects)
      ? rawProjects.map((p: any) => {
          const backendIdAny = p?.projectId ?? p?.projectID ?? p?.id;
          const backendIdStr = backendIdAny != null ? String(backendIdAny) : '';
          const numericId = /^\d+$/.test(String(p?.projectID ?? p?.id))
            ? parseInt(String(p?.projectID ?? p?.id), 10)
            : undefined;
          return {
            ...p,
            // Map backend identifier to frontend string projectId (preserve cases where backend is already string)
            projectId: backendIdStr || p?.projectId || '',
            // If backend also provides pure numeric ID, provide optional number version projectID for backward compatibility
            projectID: typeof p?.projectID === 'number' ? p.projectID : numericId,
            groupname: Array.isArray(p?.groupname) ? p.groupname : []
          } as any;
        })
      : [];
    console.log('📋 Fetched projects:', projects);
    
    return projects;

  } catch (error: any) {
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

// API call to delete a project
export const deleteProject = async (projectId: number): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}`);
  
  try {
    console.log('🚀 Deleting project:', projectId, 'from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error) {
          const details = errorData.error.details ? `\nDetails: ${errorData.error.details}` : '';
          errorMsg = `${errorData.error.message}${details}`;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (parseError) {
        // If unable to parse error response, use default error message
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    // DELETE success returns 204, no response body
    const result: BackendResponse = {
      savedAt: new Date().toISOString(),
      message: 'Project deleted successfully'
    };
    console.log('📋 Response data:', result);
    
    return result;

  } catch (error: any) {
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

// API call to assign group to project
export const assignGroupToProject = async (
  projectId: number,
  groupName: string
): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.PROJECTS}/assign-group`);
  
  try {
    console.log('🚀 Assigning group to project:', { projectId, groupName }, 'to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({ projectId, groupName })
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    const result = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if ((result as any).error) {
        const details = (result as any).error.details ? `\nDetails: ${(result as any).error.details}` : '';
        errorMsg = `${(result as any).error.message}${details}`;
      } else if ((result as any).message) {
        errorMsg = (result as any).message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    // Return backend data directly on success (consistent with createGroup/createProject return style)
    return result as BackendResponse;

  } catch (error: any) {
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

// API call to update project (PUT /api/projects/:id)
export const updateProject = async (
  projectId: number,
  projectData: ProjectData
): Promise<UpdateProjectResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}`);

  // Reuse consistent data formatting with creation
  const apiData: ProjectApiData = {
    projectName: projectData.projectName,
    projectId: projectData.projectId,
    maxGroups: parseInt(String(projectData.maxGroups)) || 0,
    description: projectData.description || '',
    client: projectData.client || '',
    deliverables: projectData.deliverables || '',
    specificSkills: projectData.specificSkills || '',
    resourcesProvided: projectData.resourcesProvided || '',
    tags: projectData.tags || [],
    startTime: projectData.startTime || '',
    finishTime: projectData.finishTime || ''
  };
  
  // 🌐 Print request payload (data sent to backend)
  console.log('📨 updateProject - request body (apiData):', apiData);
  console.log('📑 Fields:', Object.keys(apiData));

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(apiData)
    });
    
    // Print basic response status and content
    console.log('📡 updateProject - response status:', response.status, response.statusText);
    const result = await response.json();
    console.log('📦 updateProject - response body:', result);

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      if (result?.error) {
        const details = result.error.details ? `\nDetails: ${result.error.details}` : '';
        errorMsg = `${result.error.message}${details}`;
      } else if (result?.message) {
        errorMsg = result.message;
      }
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }

    return result as UpdateProjectResponse;

  } catch (error: any) {
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

// API call to get single project details (GET /api/projects/:id)
export const getProjectById = async (projectId: number): Promise<ProjectApiData> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      try {
        const errData = await response.json();
        if (errData?.error) {
          const details = errData.error.details ? `\nDetails: ${errData.error.details}` : '';
          errorMsg = `${errData.error.message}${details}`;
        } else if (errData?.message) {
          errorMsg = errData.message;
        }
      } catch (_) {
        // ignore parse error
      }
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }

    const raw = await response.json();
    const backendIdAny = (raw as any)?.projectId ?? (raw as any)?.projectID ?? (raw as any)?.id;
    const backendIdStr = backendIdAny != null ? String(backendIdAny) : '';
    const numericId = /^\d+$/.test(String((raw as any)?.projectID ?? (raw as any)?.id))
      ? parseInt(String((raw as any)?.projectID ?? (raw as any)?.id), 10)
      : undefined;
    const normalized: ProjectApiData = {
      ...(raw as any),
      projectId: backendIdStr || (raw as any)?.projectId || '',
      projectID: typeof (raw as any)?.projectID === 'number' ? (raw as any).projectID : numericId,
      groupname: Array.isArray((raw as any)?.groupname) ? (raw as any).groupname : []
    } as any;
    return normalized;

  } catch (error: any) {
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

// Remove group from project (POST /api/projects/remove-group)
export const deleteGroupFromProject = async (
  projectId: number,
  groupName: string
): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.PROJECTS}/remove-group`);
  try {
    console.log('🚀 Removing group from project:', { projectId, groupName }, 'to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({ projectId, groupName })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      if ((result as any).error) {
        const details = (result as any).error.details ? `\nDetails: ${(result as any).error.details}` : '';
        errorMsg = `${(result as any).error.message}${details}`;
      } else if ((result as any).message) {
        errorMsg = (result as any).message;
      }
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }

    return result as BackendResponse;
  } catch (error: any) {
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
