import { API_CONFIG, createApiUrl } from './config';

// Weight configuration interfaces
export interface WeightConfig {
  skillWeight: number;
  scoreWeight: number;
  descriptionWeight: number;
}

export interface WeightUpdateRequest {
  weight: number; // 0.0 - 1.0
}

export interface WeightUpdateResponse {
  success: boolean;
  message: string;
  currentWeights?: WeightConfig;
}

export interface AllocationResetResponse {
  success: boolean;
  message: string;
  resetCount?: number; // Number of groups reset
}

export interface AllocationStatusResponse {
  success: boolean;
  hasAllocationData: boolean;
  message: string;
}

export interface ResetAllocationResponse {
  success: boolean;
  message: string;
  resetCount?: number; // Number of groups reset
}

// Allocation result interfaces
export interface AllocationResult {
  groupId: number;
  projectId: number;
  score: number;
  preferenceRank: number;
  groupName: string;
  projectName: string;
}

export interface AllocationResultsResponse {
  success: boolean;
  message: string;
  results: AllocationResult[];
  totalAllocated: number;
}

export interface UnallocatedGroupScore {
  projectId: number;
  projectName: string;
  score: number;
}

export interface UnallocatedGroup {
  groupId: number;
  groupName: string;
  scores: UnallocatedGroupScore[];
}

export interface UnallocatedResultsResponse {
  success: boolean;
  message: string;
  unallocatedGroups: UnallocatedGroup[];
  availableProjects: Array<{
    projectId: number;
    projectName: string;
    remainingCapacity: number;
  }>;
  totalUnallocated: number;
}

// Allocation execution interfaces
export interface AllocationProgress {
  stage: string;
  progress: number; // 0-100
  message: string;
  details?: string;
  timestamp: string;
}

export interface AllocationExecutionResponse {
  success: boolean;
  message: string;
  progress?: AllocationProgress;
  results?: {
    totalGroups: number;
    allocatedGroups: number;
    unallocatedGroups: number;
    executionTime: number; // in milliseconds
  };
}

// New: Weights fetch response
export interface WeightsFetchResponse {
  success: boolean;
  message: string;
  currentWeights: WeightConfig;
}

// New: Config shape used in AdminSettings
export interface BaseConfig {
  databaseUri: string;
  frontendPort: number;
  backendPort: number;
  rateLimitMax?: number;
  skillWeight: number;
  scoreWeight: number;
  descriptionWeight: number;
  debug: boolean;
  sqlalchemyEcho: boolean;
}

export interface GetConfigResponse {
  success: boolean;
  message: string;
  config: BaseConfig;
}

export interface SaveConfigResponse {
  success: boolean;
  message: string;
  frontendPortChanged?: boolean;
  backendPortChanged?: boolean;
  config: BaseConfig;
}

// Update SKILL_WEIGHT
export const updateSkillWeight = async (weight: number): Promise<WeightUpdateResponse> => {
  if (weight < 0.0 || weight > 1.0) {
    throw new Error('Weight must be between 0.0 and 1.0');
  }

  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/weights/skill');
  
  try {
    console.log('🚀 Updating skill weight to:', weight);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({ weight })
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: WeightUpdateResponse = await response.json();
    console.log('📋 Response data:', result);

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    return result;

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

// Update SCORE_WEIGHT
export const updateScoreWeight = async (weight: number): Promise<WeightUpdateResponse> => {
  if (weight < 0.0 || weight > 1.0) {
    throw new Error('Weight must be between 0.0 and 1.0');
  }

  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/weights/score');
  
  try {
    console.log('🚀 Updating score weight to:', weight);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({ weight })
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: WeightUpdateResponse = await response.json();
    console.log('📋 Response data:', result);

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    return result;

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

// Update DESCRIPTION_WEIGHT
export const updateDescriptionWeight = async (weight: number): Promise<WeightUpdateResponse> => {
  if (weight < 0.0 || weight > 1.0) {
    throw new Error('Weight must be between 0.0 and 1.0');
  }

  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/weights/description');
  
  try {
    console.log('🚀 Updating description weight to:', weight);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({ weight })
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: WeightUpdateResponse = await response.json();
    console.log('📋 Response data:', result);

    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      
      if (result.message) {
        errorMsg = result.message;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    
    return result;

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

// Get current weights (hot)
export const getCurrentWeights = async (): Promise<WeightsFetchResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/weights');
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: API_CONFIG.DEFAULT_HEADERS });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.message || response.statusText}`);
    return result as WeightsFetchResponse;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    }
    throw error;
  }
};

// Get config.yml
export const getBaseConfig = async (): Promise<GetConfigResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/config');
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: API_CONFIG.DEFAULT_HEADERS });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.message || response.statusText}`);
    return result as GetConfigResponse;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    }
    throw error;
  }
};

// Save config.yml (partial allowed)
export const saveBaseConfig = async (configPatch: Partial<BaseConfig>): Promise<SaveConfigResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/config');
  try {
    const response = await fetch(apiUrl, { method: 'POST', headers: API_CONFIG.DEFAULT_HEADERS, body: JSON.stringify(configPatch) });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.message || response.statusText}`);
    return result as SaveConfigResponse;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server at ${API_CONFIG.BASE_URL}`);
    }
    throw error;
  }
};

// Legacy getAllocationResults/getUnallocatedResults removed in favor of generateReport

// Group member interface
export interface GroupMember {
  studentName: string;
  studentId: string;
  uniKey: string;
  unitOfStudy: string;
  memberOrder: number;
}

// Generate combined analytics report
export interface GenerateReportResponse {
  success: boolean;
  generatedAt: string;
  resultsCount: number;
  unallocatedCount: number;
  results: any[];
  unallocated: any[];
  availableProjects: any[];
  groupMembers: Record<number, GroupMember[]>;
  analytics: {
    score: { average: number | null; histogram: { bucket: string; count: number }[] };
    capacityUtilization: { projectId: number; projectName: string; capacity: number; used: number; remaining: number }[];
    skillCoverage: { groupId: number; groupName: string; projectId: number; projectName: string; requiredSkills: string[]; achievedSkills: string[]; coverage: number | null }[];
    riskFlags: {
      undersizedGroups: { groupId: number; groupName: string; size: number; projectId: number; projectName: string }[];
      unusedProjectCapacity: { projectId: number; projectName: string; remaining: number }[];
    }
  };
}

export const generateReport = async (): Promise<GenerateReportResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/report');
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: API_CONFIG.DEFAULT_HEADERS });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.message || response.statusText}`);
    return result as GenerateReportResponse;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nBackend server is not running');
    }
    throw error;
  }
};

// Get complete data required for export
export interface ExportDataResponse {
  success: boolean;
  data: {
    groups: Record<number, {
      groupId: number;
      groupName: string;
      numStudentsHD: number;
      numStudentsD: number;
      numStudentsCR: number;
      numStudentsP: number;
      groupDescription: string;
      allocatedProject: string | null;
    }>;
    projects: Record<number, {
      projectId: number;
      projectName: string;
      projectDescription: string;
      expectedOutcomes: string;
      requiredSkills: string;
      tags: string[];
    }>;
    groupSkills: Record<number, string[]>;
    skillToGroups: Record<string, Array<{ groupId: number; groupName: string }>>;
    tagToProjects: Record<string, Array<{ projectId: number; projectName: string }>>;
    enrolledGroupsByProject: Record<number, Array<{ groupId: number; groupName: string }>>;
  };
}

export const getExportData = async (): Promise<ExportDataResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/export-data');
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: API_CONFIG.DEFAULT_HEADERS });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result?.message || response.statusText}`);
    return result as ExportDataResponse;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nBackend server is not running');
    }
    throw error;
  }
};

// Reset allocation results (only automatic allocations)
export const resetAllocationResults = async (): Promise<ResetAllocationResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/reset');
  
  try {
    console.log('🔄 Resetting allocation results...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ResetAllocationResponse = await response.json();
    console.log('✅ Allocation results reset:', result);
    
    return result;

  } catch (error: any) {
    console.error('❌ Error resetting allocation results:', error);
    
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

// Check allocation status
export const checkAllocationStatus = async (): Promise<AllocationStatusResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/status');
  
  try {
    console.log('🔍 Checking allocation status...');
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: AllocationStatusResponse = await response.json();
    console.log('📊 Allocation status:', result);
    
    return result;

  } catch (error: any) {
    console.error('❌ Error checking allocation status:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('HTTP 503: Service Unavailable\nBackend server is not running\n\nPlease start the backend server on port 3001');
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

// Execute allocation algorithm with progress monitoring
export const executeAllocation = async (
  onProgress?: (progress: AllocationProgress) => void,
  onComplete?: (results: AllocationExecutionResponse) => void,
  onError?: (error: string) => void
): Promise<AllocationExecutionResponse> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.ALLOCATION + '/execute');
  
  try {
    console.log('🚀 Starting allocation algorithm execution');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({}) // Empty body for execution command
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle streaming response for progress updates
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: AllocationExecutionResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete JSON objects
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: AllocationExecutionResponse = JSON.parse(line);
            
            if (data.progress) {
              // Progress update
              console.log('📊 Progress update:', data.progress);
              onProgress?.(data.progress);
            } else if (data.results) {
              // Final result
              console.log('✅ Allocation completed:', data.results);
              finalResult = data;
              onComplete?.(data);
            }
          } catch (parseError) {
            console.warn('Failed to parse progress data:', line);
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error('No final result received from allocation execution');
    }

    return finalResult;

  } catch (error: any) {
    const errorMsg = error.message || 'Allocation execution failed';
    console.error('❌ Allocation execution error:', errorMsg);
    onError?.(errorMsg);
    
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

// Execute allocation with timeout
export const executeAllocationWithTimeout = async (
  timeoutMs: number = 300000, // 5 minutes default
  onProgress?: (progress: AllocationProgress) => void,
  onComplete?: (results: AllocationExecutionResponse) => void,
  onError?: (error: string) => void
): Promise<AllocationExecutionResponse> => {
  return Promise.race([
    executeAllocation(onProgress, onComplete, onError),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Allocation execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
};