import { API_CONFIG, createApiUrl } from './config';


export interface GroupData {
  groupName: string;
  student1?: string;
  student2?: string;
  student3?: string;
  student4?: string;
  student5?: string;
  student6?: string;
  student7?: string;
  preference1?: string;
  preference2?: string;
  preference3?: string;
  preference4?: string;
  preference5?: string;
  wamHD?: string | number;
  wamD?: string | number;
  wamCR?: string | number;
  wamP?: string | number;
  dualEnrollment?: string;
  skills?: string[];
  description?: string;
  startTime?: string;
  finishTime?: string;
  allocated_project?: string;
}

// HTTP response type
export type ApiResponse<T> = T;

export interface MemberData {
  StudentName: string;
  StudentID: string;
  UniKey: string;
  UnitOfStudy: string;
  Grade: 'HD' | 'D' | 'CR' | 'PS';
  CreatedAt?: string; // Format: "2025-10-08 14:22:25"
}

export interface GroupApiData {
  // Database main table fields
  GroupID: number;
  GroupName: string;
  GroupDescription?: string;
  NumStudentsHD: number;
  NumStudentsD: number;
  NumStudentsCR: number;
  NumStudentsP: number;
  NumStudentsTwoUnitsEnrolled: number;
  allocated_project?: string | null;
  // flattened results fields
  Score?: number | null;
  
  // Related data
  members: Array<{
    StudentName: string;
    StudentID: string;
    UniKey: string;
    UnitOfStudy: string;
    MemberOrder: number;
  }>;
  preferences: string[]; // ProjectID array
  skills: string[];
  
  // Legacy fields (optional)
  groupName?: string;
  student1?: string;
  student2?: string;
  student3?: string;
  student4?: string;
  student5?: string;
  student6?: string;
  student7?: string;
  preference1?: string;
  preference2?: string;
  preference3?: string;
  preference4?: string;
  preference5?: string;
  wamHD?: number;
  wamD?: number;
  wamCR?: number;
  wamP?: number;
  dualEnrollment?: string;
  description?: string;
  startTime?: string;
  finishTime?: string;
}

export interface GroupScoreData {
  GroupID: number;
  GroupName: string;
  Score: number | null;
  PreferenceRank: number | null;
  ProjectID: string | null;
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
}

// API call to create a group
export const createGroup = async (groupData: GroupData, ): Promise<BackendResponse> => {
  
  // Prepare API data format (consistent with original logic)
  const apiData = {
    groupName: groupData.groupName,
    student1: groupData.student1 || '',
    student2: groupData.student2 || '',
    student3: groupData.student3 || '',
    student4: groupData.student4 || '',
    student5: groupData.student5 || '',
    student6: groupData.student6 || '',
    student7: groupData.student7 || '',
    preference1: groupData.preference1 || '',
    preference2: groupData.preference2 || '',
    preference3: groupData.preference3 || '',
    preference4: groupData.preference4 || '',
    preference5: groupData.preference5 || '',
    wamHD: parseInt(String(groupData.wamHD)) || 0,
    wamD: parseInt(String(groupData.wamD)) || 0,
    wamCR: parseInt(String(groupData.wamCR)) || 0,
    wamP: parseInt(String(groupData.wamP)) || 0,
    dualEnrollment: groupData.dualEnrollment || '',
    skills: groupData.skills || [],
    description: groupData.description || '',
    startTime: groupData.startTime || '',
    finishTime: groupData.finishTime || '',
    allocated_project: groupData.allocated_project || ''
  };

  // Both create and edit use the same request (because only unsubmitted groups can be edited)
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.GROUPS);
  const method = 'POST';

  try {
    console.log('🚀 Sending group API request to:', apiUrl);
    console.log('📦 Request data:', JSON.stringify(apiData, null, 2));
    
    const response = await fetch(apiUrl, {
      method: method,
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(apiData)
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log('📋 Response data:', result);

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
    
    // Return backend data directly on success
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

// API call to get all groups
export const getAllGroups = async (): Promise<GroupApiData[]> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.GROUPS);
  
  try {
    console.log('🚀 Fetching all groups from:', apiUrl);
    
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
    
    const groups: GroupApiData[] = await response.json();
    console.log('📋 Fetched groups:', groups);
    
    return groups;

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

// API call to get group score data
export const getGroupScores = async (): Promise<GroupScoreData[]> => {
  const apiUrl = createApiUrl(API_CONFIG.ENDPOINTS.GROUPS + '/scores');
  
  try {
    console.log('🚀 Fetching group scores from:', apiUrl);
    
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
    const scores: GroupScoreData[] = result.data || [];
    console.log('📋 Fetched group scores:', scores);
    
    return scores;

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

// API call to delete a group
export const deleteGroup = async (groupName: string): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.GROUPS}/${encodeURIComponent(groupName)}`);
  
  try {
    console.log(' Deleting group:', groupName, 'from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    console.log(' Response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log(' Response data:', result);

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

// Get specified group (by groupName)
export const getGroupByName = async (groupName: string): Promise<GroupApiData> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.GROUPS}/by-name/${encodeURIComponent(groupName)}`);
  
  try {
    console.log('🚀 Fetching group by name:', groupName, 'from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorMsg = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          const details = errorData.error.details ? `\nDetails: ${errorData.error.details}` : '';
          errorMsg = `${errorData.error.message}${details}`;
        } else if (errorData?.message) {
          errorMsg = errorData.message;
        }
      } catch (_) {
        // ignore parse error
      }
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }

    const group: GroupApiData = await response.json();
    console.log('📋 Fetched group:', group);
    return group;

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

// Update specified group (by groupName)
// Add student to group
export const addSTUtoGroup = async (groupName: string, member: MemberData): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.GROUPS}/by-name/${encodeURIComponent(groupName)}/members`);
  
  try {
    console.log('🚀 Adding member to group:', groupName);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify({
        ...member,
        CreatedAt: new Date().toISOString().replace('T', ' ').split('.')[0] // Format: "2025-10-08 14:22:25"
      })
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log('📋 Response data:', result);

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

// Delete student from group
export const deleteSTUfromGroup = async (groupName: string, member: MemberData): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.GROUPS}/by-name/${encodeURIComponent(groupName)}/members`);
  
  try {
    console.log('🚀 Deleting member from group:', groupName);
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(member)
    });

    console.log('📡 Response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log('📋 Response data:', result);

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

export const updateGroup = async (groupName: string, groupData: GroupData): Promise<BackendResponse> => {
  const apiUrl = createApiUrl(`${API_CONFIG.ENDPOINTS.GROUPS}/by-name/${encodeURIComponent(groupName)}`);
  
  // Format data as expected by API (reuse createGroup mapping)
  const apiData = {
    groupName: groupData.groupName,
    student1: groupData.student1 || '',
    student2: groupData.student2 || '',
    student3: groupData.student3 || '',
    student4: groupData.student4 || '',
    student5: groupData.student5 || '',
    student6: groupData.student6 || '',
    student7: groupData.student7 || '',
    preference1: groupData.preference1 || '',
    preference2: groupData.preference2 || '',
    preference3: groupData.preference3 || '',
    preference4: groupData.preference4 || '',
    preference5: groupData.preference5 || '',
    wamHD: parseInt(String(groupData.wamHD)) || 0,
    wamD: parseInt(String(groupData.wamD)) || 0,
    wamCR: parseInt(String(groupData.wamCR)) || 0,
    wamP: parseInt(String(groupData.wamP)) || 0,
    dualEnrollment: groupData.dualEnrollment || '',
    skills: groupData.skills || [],
    description: groupData.description || '',
    startTime: groupData.startTime || '',
    finishTime: groupData.finishTime || '',
    allocated_project: groupData.allocated_project || ''
  };

  try {
    console.log(' Updating group:', groupName, 'to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: API_CONFIG.DEFAULT_HEADERS,
      body: JSON.stringify(apiData)
    });

    console.log(' Response status:', response.status, response.statusText);
    const result: BackendResponse = await response.json();
    console.log(' Response data:', result);

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

