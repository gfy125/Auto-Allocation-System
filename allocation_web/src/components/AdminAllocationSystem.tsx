import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { getGroupByName, getAllGroups, type GroupApiData } from '../api/groupApi';
import { getProjectById, getAllProjects, assignGroupToProject as apiAssignGroupToProject, deleteGroupFromProject as apiDeleteGroupFromProject, type ProjectApiData } from '../api/projectApi';
import { executeAllocation, checkAllocationStatus, generateReport, type AllocationProgress, type AllocationExecutionResponse } from '../api/allocationApi';

interface AdminAllocationSystemProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

type Project = {
  id: string;
  title: string;
  capacity: number;
  client?: string;
  description?: string;
  deliverables?: string;
  specificSkills?: string;
  resourcesProvided?: string;
  tags?: string[];
  startTime?: string;
  finishTime?: string;
  groupname?: string[];
};

type Group = {
  id: string;
  name: string;
  score?: number;
  suggestedProjectId?: string | number;
};

type AllocationState = {
  // projectId -> groups assigned
  projectIdToGroups: Record<string, Group[]>;
  // groups not assigned yet
  unassignedGroups: Group[];
};

const AdminAllocationSystem: React.FC<AdminAllocationSystemProps> = ({ userRole, onLogout, username }) => {
  const navigate = useNavigate();
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);
  
  // API data states
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [allGroups, setAllGroups] = React.useState<Group[]>([]);
  const [suggestedProjectNameByGroup, setSuggestedProjectNameByGroup] = React.useState<Record<string, string>>({});
  // scores are provided within getAllGroups now
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Allocation progress states
  const [isAllocating, setIsAllocating] = React.useState(false);
  const [allocationProgress, setAllocationProgress] = React.useState<AllocationProgress | null>(null);
  const [allocationResults, setAllocationResults] = React.useState<AllocationExecutionResponse | null>(null);
  const [showProgressModal, setShowProgressModal] = React.useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false);

  // Load data from API
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading data from API...');
      
      // Load projects and groups in parallel (groups include scores)
      const [projectsData, groupsData] = await Promise.all([
        getAllProjects(),
        getAllGroups()
      ]);
      
      console.log('📊 Loaded projects:', projectsData);
      console.log('👥 Loaded groups:', groupsData);
      // scores included in groupsData now
      
      // Transform projects data
      const transformedProjects: Project[] = projectsData.map((p, idx) => {
        // Use projectId directly from backend (P01, P02, etc.)
        const projectId = p.projectId || `P${String(idx + 1).padStart(2, '0')}`;
        return {
          id: projectId,
        title: p.projectName,
        capacity: p.maxGroups,
        client: p.client,
        description: p.description,
        deliverables: p.deliverables,
        specificSkills: p.specificSkills,
        resourcesProvided: p.resourcesProvided,
        tags: p.tags,
        startTime: p.startTime,
        finishTime: p.finishTime,
        groupname: p.groupname || []
        };
      });
      
      // Transform groups data
      const transformedGroups: Group[] = groupsData.map((g, idx) => ({
        id: g.GroupID ? `g${g.GroupID}` : `g${idx + 1}`,
        name: g.GroupName,
        score: (g as any).Score ?? undefined,
        preferenceRank: (g as any).PreferenceRank ?? undefined,
        suggestedProjectId: (g as any).SubOptionProjectID ?? undefined
      }));
      
      setProjects(transformedProjects);
      setAllGroups(transformedGroups);
      // no separate scores state required
      // Resolve suggested project names for unassigned groups where available
      try {
        const entries: Array<[string, string | number]> = transformedGroups
          .filter(g => g.suggestedProjectId != null)
          .map(g => [g.name, g.suggestedProjectId as any]);
        const nameMap: Record<string, string> = {};
        await Promise.all(entries.map(async ([groupName, suggId]) => {
          const numId = Number(suggId);
          if (!isNaN(numId) && numId > 0) {
            try {
              const p = await getProjectById(numId);
              nameMap[groupName] = p.projectName || String(suggId);
            } catch (_) {
              nameMap[groupName] = String(suggId);
            }
          } else {
            nameMap[groupName] = String(suggId);
          }
        }));
        setSuggestedProjectNameByGroup(nameMap);
      } catch (_) {
        // ignore resolving errors
      }
      
      console.log('✅ Data loaded successfully');
      
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const [allocation, setAllocation] = React.useState<AllocationState>({
    projectIdToGroups: {},
    unassignedGroups: [],
  });

  // NOTE: Placeholder generation now self-contained in runAutoAllocation

  // pagination states
  const [resultsPage, setResultsPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(8);
  const projectsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const poolContainerRef = React.useRef<HTMLDivElement | null>(null);
  const projectsGridRef = React.useRef<HTMLDivElement | null>(null);
  const [gridColumns, setGridColumns] = React.useState(1);
  const CARD_WIDTH = 260; // keep in sync with CSS
  const GRID_GAP = 12;    // keep in sync with CSS
  const [sortMode, setSortMode] = React.useState<'alpha' | 'full' | 'id'>('id');
  const [poolPage, setPoolPage] = React.useState(1);
  const [poolRowsPerPage, setPoolRowsPerPage] = React.useState(4); // selectable: 2,4,8,16 rows (2 columns per row)
  const [expandedProjectId, setExpandedProjectId] = React.useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = React.useState<{ projectId: string; groupId: string } | null>(null);
  const [closingProjectId, setClosingProjectId] = React.useState<string | null>(null);
  const [poolVersion, setPoolVersion] = React.useState(0);
  const [pendingOpenProjectId, setPendingOpenProjectId] = React.useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = React.useState<string | null>(null);
  const dragPreviewRef = React.useRef<HTMLElement | null>(null);
  const [openGroupInfo, setOpenGroupInfo] = React.useState<{ projectId: string; groupId: string; name: string } | null>(null);
  const [groupInfoLoading, setGroupInfoLoading] = React.useState(false);
  const [groupInfoError, setGroupInfoError] = React.useState<string | null>(null);
  const [groupInfoData, setGroupInfoData] = React.useState<GroupApiData | null>(null);
  const [closingGroupInfo, setClosingGroupInfo] = React.useState(false);
  const [groupInfoOpenActive, setGroupInfoOpenActive] = React.useState(false);
  const [groupPrefNames, setGroupPrefNames] = React.useState<string[]>([]);
  const [projectGuard, setProjectGuard] = React.useState<Record<string, { loading: boolean; error: string | null; lockedNames: Set<string> }>>({});
  const canQuickAssign = React.useMemo(() => {
    return allocation.unassignedGroups.some(g => (g as any).suggestedProjectId != null && typeof g.score === 'number');
  }, [allocation.unassignedGroups]);

  const findBackendProjectIdByProjectId = (projectId: string): number | null => {
    try {
      // Extract numeric ID from projectId (e.g., "P01" -> 1, "P16" -> 16, "p01" -> 1)
      const upperProjectId = projectId.toUpperCase();
      if (upperProjectId.startsWith('P') && /^\d+$/.test(upperProjectId.substring(1))) {
        return parseInt(upperProjectId.substring(1), 10);
      }
      return null;
    } catch {
      return null;
    }
  };

  const ensureProjectLocksLoaded = async (projectId: string) => {
    try {
      const guard = projectGuard[projectId];
      if (guard && (guard.loading || guard.lockedNames.size > 0 || guard.error)) return;
      const backendId = findBackendProjectIdByProjectId(projectId);
      setProjectGuard(prev => ({ ...prev, [projectId]: { loading: true, error: null, lockedNames: new Set<string>() } }));
      if (!backendId) {
        setProjectGuard(prev => ({ ...prev, [projectId]: { loading: false, error: 'Project not found locally', lockedNames: new Set<string>() } }));
        return;
      }
      const data: ProjectApiData = await getProjectById(backendId);
      const locked = new Set<string>(Array.isArray(data.groupname) ? data.groupname : []);
      setProjectGuard(prev => ({ ...prev, [projectId]: { loading: false, error: null, lockedNames: locked } }));
    } catch (err: any) {
      const msg = err?.message || 'Network error';
      setProjectGuard(prev => ({ ...prev, [projectId]: { loading: false, error: msg, lockedNames: new Set<string>() } }));
    }
  };

  const openGroupInfoPanel = (projectId: string, groupId: string, name: string) => {
    setGroupInfoLoading(true);
    setGroupInfoError(null);
    setGroupInfoData(null);
    setOpenGroupInfo({ projectId, groupId, name });
    setGroupInfoOpenActive(false);
    // defer open class to trigger CSS transition
    requestAnimationFrame(() => setGroupInfoOpenActive(true));
    getGroupByName(name)
      .then(data => setGroupInfoData(data))
      .catch((err: any) => setGroupInfoError(err?.message || 'Failed to load'))
      .finally(() => setGroupInfoLoading(false));
  };

  // Resolve project names for preferences when group info loads
  React.useEffect(() => {
    let cancelled = false;
    async function resolvePrefNames() {
      try {
        const prefs = (groupInfoData as any)?.preferences as string[] | undefined;
        if (!prefs || prefs.length === 0) {
          if (!cancelled) setGroupPrefNames([]);
          return;
        }
        const names = await Promise.all(
          prefs.map(async (pid) => {
            // Check if it's a P/p format first
            const upperProjectId = pid.toUpperCase();
            if (upperProjectId.startsWith('P') && /^\d+$/.test(upperProjectId.substring(1))) {
              // For P/p format, normalize to uppercase P format
              return upperProjectId;
            }
            
            // Try to parse as numeric ID (e.g., "1", "16")
            const backendId = parseInt(pid, 10);
            if (!isNaN(backendId)) {
              try {
                const p = await getProjectById(backendId);
                return p.projectName || pid;
              } catch (err) {
                console.warn(`Failed to fetch project ${backendId}:`, err);
                return pid;
              }
            }
            
            // If not recognized format, return as-is
            console.warn(`Could not parse project ID: ${pid}`);
            return pid;
          })
        );
        if (!cancelled) setGroupPrefNames(names);
      } catch (err) {
        console.warn('Failed to resolve preference names:', err);
        if (!cancelled) setGroupPrefNames([]);
      }
    }
    resolvePrefNames();
    return () => { cancelled = true; };
  }, [groupInfoData]);

  const openOrToggleProject = (projectId: string) => {
    setPendingRemoval(null);
    // If clicking the same card, close with animation
    if (expandedProjectId === projectId) {
      // start closing animation
      setClosingProjectId(projectId);
      window.setTimeout(() => {
        setExpandedProjectId(null);
        setClosingProjectId(null);
      }, 220);
      return;
    }
    // If another card is open, close it first, then open the new one after animation
    if (expandedProjectId && expandedProjectId !== projectId) {
      setPendingOpenProjectId(projectId);
      setClosingProjectId(expandedProjectId);
      window.setTimeout(() => {
        setExpandedProjectId(projectId);
        setClosingProjectId(null);
        setPendingOpenProjectId(null);
        // load backend locks after new project opens
        ensureProjectLocksLoaded(projectId);
      }, 220);
    } else {
      // No card open → open immediately
      setClosingProjectId(null);
      setExpandedProjectId(projectId);
      // load backend locks when opening by click
      ensureProjectLocksLoaded(projectId);
    }
  };

  const initializeAllocationState = () => {
    if (projects.length === 0 || allGroups.length === 0) {
      console.warn('No data available for allocation initialization');
      return;
    }

    // Initialize allocation with existing assignments from project data
    const projectIdToGroups: Record<string, Group[]> = {};
    const assignedGroupNames = new Set<string>();
    
    projects.forEach(p => {
      // Get groups assigned to this project from the project's groupname field
      const assignedGroups: Group[] = [];
      if (p.groupname && Array.isArray(p.groupname)) {
        p.groupname.forEach(groupName => {
          const group = allGroups.find(gr => gr.name === groupName);
          if (group) {
            assignedGroups.push(group);
            assignedGroupNames.add(groupName);
          }
        });
      }
      projectIdToGroups[p.id] = assignedGroups;
    });

    // Find unassigned groups (groups not in any project's groupname)
    const unassigned: Group[] = allGroups.filter(g => !assignedGroupNames.has(g.name));

    console.log('📊 Project assignments:', projectIdToGroups);
    console.log('👥 Unassigned groups:', unassigned);

    const next: AllocationState = {
      projectIdToGroups,
      unassignedGroups: unassigned,
    };
    setAllocation(next);
    // reset pagination to first pages
    setResultsPage(1);
    setPoolPage(1);
  };

  const runAutoAllocation = async () => {
    if (projects.length === 0 || allGroups.length === 0) {
      console.warn('No data available for allocation');
      setError('No data available for allocation');
      return;
    }

    try {
      // First check if allocation has already been run
      console.log('🔍 Checking allocation status...');
      const statusResult = await checkAllocationStatus();
      
      if (statusResult.hasAllocationData) {
        setError('Allocation results already exist. Please reset allocation results before running again. Go to System Settings and click the "Reset Allocation Results" button.');
        return;
      }

      // Only proceed if no existing allocation data
      console.log('✅ No existing allocation data found. Proceeding with allocation...');
      
      // Start allocation process
      setIsAllocating(true);
      setShowProgressModal(true);
      setAllocationProgress(null);
      setAllocationResults(null);
      setError(null);

      console.log('🚀 Starting allocation algorithm...');

      await executeAllocation(
        // Progress callback
        (progress: AllocationProgress) => {
          console.log('📊 Allocation progress:', progress);
          setAllocationProgress(progress);
        },
        // Complete callback
        (results: AllocationExecutionResponse) => {
          console.log('✅ Allocation completed:', results);
          setAllocationResults(results);
          const allocatedCount = results.results?.allocatedGroups || 0;
          const totalCount = results.results?.totalGroups || 0;
          const unallocatedCount = results.results?.unallocatedGroups || 0;
          const allocationRate = ((allocatedCount / totalCount) * 100).toFixed(1);
          
          setAllocationProgress({
            stage: 'Completed',
            progress: 100,
            message: 'Allocation algorithm completed',
            details: `Successfully allocated ${allocatedCount} groups (${allocationRate}%). ${unallocatedCount} groups remain unallocated.`,
            timestamp: new Date().toISOString()
          });
          
          // Refresh data after successful allocation
          setTimeout(async () => {
            await loadData();
            setShowProgressModal(false);
            setIsAllocating(false);
          }, 2000);
        },
        // Error callback
        (error: string) => {
          console.error('❌ Allocation failed:', error);
          setError(error);
          setShowProgressModal(false);
          setIsAllocating(false);
        }
      );
    } catch (err: any) {
      console.error('❌ Allocation execution failed:', err);
      
      // Handle specific error types
      let errorMessage = err.message || 'Allocation algorithm execution failed';
      
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Unable to connect to backend server. Please check your network connection';
      } else if (err.message.includes('EXISTING_ALLOCATION') || err.message.includes('Has existed allocation result')) {
        errorMessage = 'Allocation results already exist. Please reset results before running allocation again';
      }
      
      setError(errorMessage);
      setShowProgressModal(false);
      setIsAllocating(false);
    }
  };

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize allocation state when data is loaded
  React.useEffect(() => {
    if (!loading && projects.length > 0 && allGroups.length > 0) {
      initializeAllocationState();
    }
  }, [loading, projects, allGroups]);

  const handleGetReport = async () => {
    try {
      setIsGeneratingReport(true);
      const timestamp = new Date().toISOString();
      const report = await generateReport();
      const key = 'allocationReports';
      const existingRaw = localStorage.getItem(key);
      const history = existingRaw ? JSON.parse(existingRaw) : [];
      const entry = { timestamp, report };
      const nextHistory = Array.isArray(history) ? [...history, entry] : [entry];
      localStorage.setItem(key, JSON.stringify(nextHistory));

      // navigate to Reports & Analytics page
      navigate('/admin/reports_analytics');
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate report';
      setError(msg);
      try { alert(msg); } catch (_) {}
    }
    finally {
      setIsGeneratingReport(false);
    }
  };

  // Sync groupname[] in localStorage.createdProjects for a given project title
  const syncLocalStorageGroupName = (projectTitle: string, groupName: string, action: 'add' | 'remove') => {
    try {
      const raw = localStorage.getItem('createdProjects');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const idx = arr.findIndex((p: any) => {
        const title = (p?.formData?.projectName || p?.name || '').trim();
        return title === projectTitle;
      });
      if (idx === -1) return;
      const proj = arr[idx] || {};
      const current: string[] = Array.isArray(proj.groupname) ? proj.groupname : [];
      let next: string[] = current;
      if (action === 'add') {
        if (!current.includes(groupName)) next = [...current, groupName];
      } else {
        next = current.filter((n: string) => n !== groupName);
      }
      // immutably update
      arr[idx] = { ...proj, groupname: next };
      localStorage.setItem('createdProjects', JSON.stringify(arr));
      // notify same-tab listeners
      window.dispatchEvent(new StorageEvent('storage', { key: 'createdProjects', newValue: JSON.stringify(arr) }));
    } catch (_) {
      // ignore
    }
  };

  const assignGroupToProject = async (group: Group, projectId: string) => {
    try {
      // Find the project to get its backend ID
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        console.error('Project not found:', projectId);
        return;
      }

      // Get backend project ID from the project ID string (e.g., "P01" -> 1, "P16" -> 16)
      let backendProjectId;
      if (project.id.startsWith('P') && /^\d+$/.test(project.id.substring(1))) {
        backendProjectId = parseInt(project.id.substring(1), 10);
      } else {
        console.error('Invalid project ID format:', project.id);
        return;
      }
      
      if (isNaN(backendProjectId)) {
        console.error('Invalid project ID format:', project.id);
        return;
      }

      console.log('🔄 Assigning group to project via API:', { groupName: group.name, projectId: backendProjectId });

      // Call API to assign group to project
      await apiAssignGroupToProject(backendProjectId, group.name);

      // Refresh data after successful API call
      await loadData();

      console.log('✅ Group assigned successfully');

    } catch (error: any) {
      console.error('❌ Failed to assign group to project:', error);
      setError(error.message || 'Failed to assign group to project');
    }
  };


  const unassignGroupFromProject = async (group: Group, fromProjectId: string) => {
    try {
      // Find the project to get its backend ID
      const project = projects.find(p => p.id === fromProjectId);
      if (!project) {
        console.error('Project not found:', fromProjectId);
        return;
      }

      // Get backend project ID from the project ID string (e.g., "P01" -> 1, "P16" -> 16)
      let backendProjectId;
      if (project.id.startsWith('P') && /^\d+$/.test(project.id.substring(1))) {
        backendProjectId = parseInt(project.id.substring(1), 10);
      } else {
        console.error('Invalid project ID format:', project.id);
        return;
      }
      
      if (isNaN(backendProjectId)) {
        console.error('Invalid project ID format:', project.id);
        return;
      }

      console.log('🔄 Removing group from project via API:', { groupName: group.name, projectId: backendProjectId });

      // Call API to remove group from project
      await apiDeleteGroupFromProject(backendProjectId, group.name);

      // Refresh data after successful API call
      await loadData();

      // ensure the newly unassigned item is visible
      setPoolPage(1);
      // force list recompute to avoid stale memo edge-cases while overlay is open
      setPoolVersion(v => v + 1);
      // clear any dragging ghost
      setDraggingGroupId(null);

      console.log('✅ Group removed successfully');

    } catch (error: any) {
      console.error('❌ Failed to remove group from project:', error);
      setError(error.message || 'Failed to remove group from project');
    }
  };

  const capacityUsage = React.useMemo(() => {
    const usage: Record<string, { used: number; capacity: number }> = {};
    projects.forEach(p => {
      const used = allocation.projectIdToGroups[p.id]?.length || 0;
      usage[p.id] = { used, capacity: p.capacity };
    });
    return usage;
  }, [projects, allocation.projectIdToGroups]);

  const canAcceptMore = (projectId: string) => {
    const usage = capacityUsage[projectId];
    return usage ? usage.used < usage.capacity : true;
  };

  // bestMatchAssign removed from UI; keep helper available if needed later

  // drag & drop handlers
  const onGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.setData('text/plain', groupId);
    setDraggingGroupId(groupId);
    // Create a solid custom drag image cloned from the card
    const source = e.currentTarget as HTMLElement;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-1000px';
    clone.style.left = '-1000px';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '1';
    clone.style.transform = 'scale(0.96)';
    document.body.appendChild(clone);
    dragPreviewRef.current = clone;
    const rect = source.getBoundingClientRect();
    // Position drag image so the cursor is at the original click point (not centered)
    const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const offsetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    try { e.dataTransfer.setDragImage(clone, offsetX, offsetY); } catch (_) {}
  };

  const [dragOverProjectId, setDragOverProjectId] = React.useState<string | null>(null);
  const [projectDragDepth, setProjectDragDepth] = React.useState<Record<string, number>>({});

  const onProjectDragOver = (e: React.DragEvent, projectId: string) => {
    if (!canAcceptMore(projectId)) return;
    // block drag if network error for this project (cannot verify locks)
    if (projectGuard[projectId]?.error) return;
    e.preventDefault();
  };

  const onProjectDragEnter = (_e: React.DragEvent, projectId: string) => {
    if (!canAcceptMore(projectId)) return;
    setProjectDragDepth(prev => {
      const depth = (prev[projectId] || 0) + 1;
      const next = { ...prev, [projectId]: depth };
      setDragOverProjectId(projectId);
      return next;
    });
    if (expandedProjectId !== projectId) {
      setExpandedProjectId(projectId);
      ensureProjectLocksLoaded(projectId);
    }
  };

  const onProjectDragLeave = (_e: React.DragEvent, projectId: string) => {
    setProjectDragDepth(prev => {
      const current = prev[projectId] || 0;
      const depth = Math.max(0, current - 1);
      const next = { ...prev, [projectId]: depth };
      if (depth === 0 && dragOverProjectId === projectId) {
        setDragOverProjectId(null);
      }
      return next;
    });
  };

  const onProjectDrop = async (e: React.DragEvent, projectId: string) => {
    const groupId = e.dataTransfer.getData('text/plain');
    const group = allocation.unassignedGroups.find(g => g.id === groupId);
    if (!group) return;
    // disallow drop on network error or full capacity
    if (projectGuard[projectId]?.error || !canAcceptMore(projectId)) {
      // invalid drop → revert happens automatically when we don't alter allocation
      return;
    }
    await assignGroupToProject(group, projectId);
    setDragOverProjectId(null);
    setProjectDragDepth(prev => ({ ...prev, [projectId]: 0 }));
  };

  const toUiProjectId = (numericId: number): string => {
    return `P${String(numericId).padStart(2, '0')}`;
  };

  const quickAssignSuggestions = async () => {
    try {
      // collect candidates with suggested project
      const parseProjNum = (v: any): number => {
        if (typeof v === 'number') return v;
        const s = String(v || '').trim();
        const m = s.match(/\d+/);
        return m ? parseInt(m[0], 10) : NaN;
      };
      const toUiIdFromAny = (v: any): string | null => {
        if (typeof v === 'string' && v.startsWith('P')) return v;
        const n = parseProjNum(v);
        return isNaN(n) ? null : toUiProjectId(n);
      };

      const candidates = allocation.unassignedGroups
        .map(g => ({ group: g, projNum: parseProjNum((g as any).suggestedProjectId), uiId: toUiIdFromAny((g as any).suggestedProjectId), score: g.score ?? -Infinity }))
        .filter(x => !isNaN(x.projNum) && x.projNum > 0 && x.uiId);

      // build per-project candidate list sorted by score desc
      const perProject: Map<number, Array<{ group: Group; score: number }>> = new Map();
      for (const c of candidates) {
        const arr = perProject.get(c.projNum) || [];
        arr.push({ group: c.group, score: c.score });
        perProject.set(c.projNum, arr);
      }
      for (const [k, arr] of perProject) {
        arr.sort((a, b) => (b.score - a.score));
      }

      // assign greedily per project until capacity filled
      for (const [projNum, arr] of perProject) {
        const uiId = toUiProjectId(projNum);
        const usage = capacityUsage[uiId];
        const capacity = usage ? usage.capacity : 0;
        const used = usage ? usage.used : 0;
        let remaining = Math.max(0, capacity - used);
        if (remaining <= 0) continue;

        for (const { group } of arr) {
          if (remaining <= 0) break;
          // double-check: skip if already assigned in UI map (race-safe)
          const already = (allocation.projectIdToGroups[uiId] || []).some(g => g.name === group.name);
          if (already) continue;
          try {
            // Ensure numeric backend ID for API
            const backendId = projNum || findBackendProjectIdByProjectId(uiId) || NaN;
            if (isNaN(backendId)) throw new Error('Invalid project ID');
            await apiAssignGroupToProject(backendId, group.name);
            remaining -= 1;
          } catch (err) {
            console.warn('Quick assign failed:', (err as any)?.message || err);
          }
        }
      }

      await loadData();
      // reset pagination to show updates
      setPoolPage(1);
      setResultsPage(1);
    } catch (e) {
      console.warn('Quick assign suggestions error:', (e as any)?.message || e);
    }
  };

  // pagination helpers
  const resultsPageSize = React.useMemo(() => Math.max(1, rowsPerPage * Math.max(1, gridColumns)), [rowsPerPage, gridColumns]);
  // sort projects before pagination
  const sortedProjects = React.useMemo(() => {
    const list = [...projects];
    if (sortMode === 'id') {
      list.sort((a, b) => {
        const ai = a.id.startsWith('P') && /^\d+$/.test(a.id.substring(1)) ? parseInt(a.id.substring(1), 10) : NaN;
        const bi = b.id.startsWith('P') && /^\d+$/.test(b.id.substring(1)) ? parseInt(b.id.substring(1), 10) : NaN;
        if (!isNaN(ai) && !isNaN(bi)) return ai - bi;
        return a.id.localeCompare(b.id);
      });
      return list;
    }
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
      return list;
    }
    // full-first sorting; then by title
    list.sort((a, b) => {
      const aUsage = capacityUsage[a.id] || { used: 0, capacity: 0 };
      const bUsage = capacityUsage[b.id] || { used: 0, capacity: 0 };
      const aFull = aUsage.used >= aUsage.capacity;
      const bFull = bUsage.used >= bUsage.capacity;
      if (aFull !== bFull) return bFull ? -1 : 1; // full first
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [projects, sortMode, capacityUsage]);

  const totalResultsPages = Math.max(1, Math.ceil(sortedProjects.length / resultsPageSize));
  const poolPageSize = poolRowsPerPage * 2; // 2 columns per row
  const totalPoolPages = Math.max(1, Math.ceil(allocation.unassignedGroups.length / poolPageSize));
  const paginatedProjects = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? sortedProjects.filter(p => {
          const assigned = allocation.projectIdToGroups[p.id] || [];
          const matchProject = (p.title || '').toLowerCase().includes(term) || (p.client || '').toLowerCase().includes(term);
          const matchGroup = assigned.some(g => (g.name || '').toLowerCase().includes(term));
          return matchProject || matchGroup;
        })
      : sortedProjects;
    const start = (resultsPage - 1) * resultsPageSize;
    return filtered.slice(start, start + resultsPageSize);
  }, [sortedProjects, allocation.projectIdToGroups, resultsPage, resultsPageSize, searchTerm]);
  const paginatedUnassigned = React.useMemo(() => {
    const start = (poolPage - 1) * poolPageSize;
    return allocation.unassignedGroups.slice(start, start + poolPageSize);
  }, [allocation.unassignedGroups, poolPage, poolPageSize, poolVersion]);

  React.useEffect(() => {
    setPoolPage(1);
  }, [poolPageSize]);

  React.useEffect(() => {
    const handleSidebarStateChange = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const isCompact = sidebar.classList.contains('compact');
        const showLabels = sidebar.classList.contains('show-labels');
        setSidebarCompact(isCompact);
        setSidebarShowLabels(showLabels);
      }
    };

    const observer = new MutationObserver(handleSidebarStateChange);
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => observer.disconnect();
  }, []);

  // Calculate optimal rows based on container height
  const calculateOptimalRows = React.useCallback((containerHeight: number, itemHeight: number, minRows: number = 2, maxRows: number = 16) => {
    const availableHeight = containerHeight - 100; // subtract header and pagination height
    const possibleRows = Math.floor(availableHeight / itemHeight);
    return Math.max(minRows, Math.min(maxRows, possibleRows));
  }, []);

  // Measure grid columns and container heights using ResizeObserver
  React.useEffect(() => {
    const gridEl = projectsGridRef.current;
    const projectsContainer = projectsContainerRef.current;
    const poolContainer = poolContainerRef.current;
    
    if (!gridEl || !projectsContainer || !poolContainer) return;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;
        const height = entry.contentRect.height;

        if (element === gridEl) {
          // Handle grid columns
          const width = entry.contentRect.width;
          const cols = Math.max(1, Math.floor((width + GRID_GAP) / (CARD_WIDTH + GRID_GAP)));
          setGridColumns(cols);
        } else if (element === projectsContainer) {
          // Handle results rows
          const optimalRows = calculateOptimalRows(height, 100); // 100px is approximate card height
          setRowsPerPage(optimalRows);
        } else if (element === poolContainer) {
          // Handle pool rows
          const optimalRows = calculateOptimalRows(height, 80); // 80px is approximate pool item height
          setPoolRowsPerPage(optimalRows);
        }
      }
    });

    ro.observe(gridEl);
    ro.observe(projectsContainer);
    ro.observe(poolContainer);

    return () => ro.disconnect();
  }, [projectsGridRef.current, projectsContainerRef.current, poolContainerRef.current, calculateOptimalRows]);

  // Reset to page 1 when page size changes
  React.useEffect(() => {
    setResultsPage(1);
  }, [resultsPageSize]);

  React.useEffect(() => {
    setResultsPage(1);
  }, [sortMode]);

  // Collapse expanded card when clicking outside
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!expandedProjectId) return;
      const grid = projectsGridRef.current;
      if (!grid) return;
      const expandedEl = grid.querySelector(`[data-project-id="${expandedProjectId}"]`);
      if (expandedEl && e.target instanceof Node && !expandedEl.contains(e.target)) {
        setClosingProjectId(expandedProjectId);
        window.setTimeout(() => {
          setExpandedProjectId(null);
          setClosingProjectId(null);
        }, 220);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [expandedProjectId]);

  return (
    <div className="app">
      <Sidebar onLogout={onLogout} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <div className="content-header">
          <div className="header-left">
            <h1>Allocation System</h1>
            {loading && <span className="loading-indicator">Loading data...</span>}
            {error && <span className="error-indicator">Error: {error}</span>}
          </div>
          <div className="header-right">
            <button className="btn btn-primary" onClick={runAutoAllocation} disabled={loading || isAllocating}>
              {isAllocating ? 'Running allocation...' : 'Run allocation'}
            </button>
            <button className="btn btn-success" onClick={handleGetReport} disabled={loading || isGeneratingReport}> {isGeneratingReport ? 'Generating…' : 'Get Report'}</button>
            <button className="btn btn-secondary" onClick={loadData} disabled={loading}> Refresh data</button>
          </div>
        </div>
        <div className="content-body">
          <div className="allocation-container">
            <div className="layout">
              <div className="left" ref={projectsContainerRef}>
                <div className="section-header">
                  <div className="results-header-left">
                    <h3>Allocation Results</h3>
                    <input
                      type="text"
                      placeholder="Search by project or group..."
                      className="search-input"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPoolPage(1); setResultsPage(1); }}
                    />
                  </div>
                  <div className="controls">
                    <div className="rows-control">
                      <label className="rows-label" htmlFor="sort-select">Sort:</label>
                      <select
                        id="sort-select"
                        className="rows-select"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as 'alpha' | 'full' | 'id')}
                      >
                        <option value="id">Project ID</option>
                        <option value="alpha">Alphabetical</option>
                        <option value="full">Full first</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="projects" ref={projectsGridRef}>
                  {paginatedProjects.map(project => {
                    const assigned = allocation.projectIdToGroups[project.id] || [];
                    const usage = capacityUsage[project.id];
                    const isExpanded = expandedProjectId === project.id;
                    return (
                      <div
                        key={project.id}
                        className={`project-card ${canAcceptMore(project.id) ? 'droppable' : 'full'} ${(dragOverProjectId === project.id) ? 'drag-expanded' : ''} ${isExpanded ? 'expanded' : ''}`}
                        data-project-id={project.id}
                        onDragOver={e => onProjectDragOver(e, project.id)}
                        onDragEnter={e => onProjectDragEnter(e, project.id)}
                        onDragLeave={e => onProjectDragLeave(e, project.id)}
                        onDrop={e => onProjectDrop(e, project.id)}
                        onClick={() => openOrToggleProject(project.id)}
                        role="button"
                        aria-expanded={isExpanded}
                      >
                        <div className="project-header">
                          <div className="project-title">{project.title}</div>
                          <div className="capacity">{usage.used}/{usage.capacity}</div>
                        </div>
                        <div className="project-summary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{assigned.length} assigned {projectGuard[project.id]?.loading ? '• Checking locks…' : projectGuard[project.id]?.error ? '• Network issue' : ''}</span>
                          <button
                            type="button"
                            className="score-chip"
                            title={`Project ID: ${project.id}`}
                            onClick={(e) => { e.stopPropagation(); /* reserved for future actions */ }}
                          >
                            {project.id}
                          </button>
                        </div>
                        <div
                          className={`project-body ${isExpanded ? 'open' : ''} ${closingProjectId === project.id ? 'closing' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (pendingRemoval && pendingRemoval.projectId === project.id) {
                              setPendingRemoval(null);
                            }
                            // clicking blank area closes group info with animation
                            if (openGroupInfo && openGroupInfo.projectId === project.id) {
                              const panel = (e.target as HTMLElement).closest('[data-group-info="true"]');
                              if (!panel) {
                                setClosingGroupInfo(true);
                                setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180);
                              }
                            }
                          }}
                          onDragOver={e => onProjectDragOver(e, project.id)}
                          onDragEnter={e => onProjectDragEnter(e, project.id)}
                          onDragLeave={e => onProjectDragLeave(e, project.id)}
                          onDrop={e => onProjectDrop(e, project.id)}
                        >
                          {projectGuard[project.id]?.error && (
                            <div className="info-error" style={{ marginBottom: 8 }}>Network issue, groups cannot be removed</div>
                          )}
                          {openGroupInfo && openGroupInfo.projectId === project.id && (
                            <div className={`group-info-panel ${groupInfoOpenActive ? 'open' : ''} ${closingGroupInfo ? 'closing' : ''}`} data-group-info="true">
                              <div className="info-header">
                                <div className="info-title">{groupInfoData?.GroupName || openGroupInfo.name}</div>
                                <button className="chip-action" onClick={(ev) => { ev.stopPropagation(); setClosingGroupInfo(true); setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180); }} title="Close">✖</button>
                              </div>
                              {groupInfoLoading && (<div className="info-loading">Loading...</div>)}
                              {groupInfoError && (<div className="info-error">{groupInfoError}</div>)}
                          {groupInfoData && !groupInfoLoading && !groupInfoError && (
                            <div className="info-content">
                              <div className="info-row"><span className="meta-label">Members:</span>
                                <span className="meta-value">{groupInfoData.members?.map((m) => `${m.StudentName}(${m.MemberOrder})`).join(', ') || 'N/A'}</span>
                              </div>
                              <div className="info-row"><span className="meta-label">Skills:</span>
                                <div className="meta-value skill-chips">
                                  {(groupInfoData.skills || []).length > 0 ? (
                                    (groupInfoData.skills || []).map((s: string, idx: number) => (
                                      <span key={idx} className="skill-chip">{s}</span>
                                    ))
                                  ) : 'N/A'}
                                </div>
                              </div>
                              <div className="info-row pref-row"><span className="meta-label">Preferences:</span>
                                <div className="meta-value pref-list">
                                  {(() => {
                                    const list = (groupPrefNames && groupPrefNames.length > 0)
                                      ? groupPrefNames
                                      : ((groupInfoData as any)?.preferences || []);
                                    return (list && list.length > 0)
                                      ? list.map((label: string, i: number) => (
                                          <div key={i} className="pref-item"><span className="pref-index">{i + 1})</span> <span className="pref-name">{label}</span></div>
                                        ))
                                      : 'N/A';
                                  })()}
                                </div>
                              </div>
                              {groupInfoData.GroupDescription && (
                                <div className="info-row"><span className="meta-label">Notes:</span>
                                  <span className="meta-value">{groupInfoData.GroupDescription}</span>
                                </div>
                              )}
                            </div>
                          )}
                            </div>
                          )}
                          <div className="project-meta">
                            <div className="meta-row"><span className="meta-label">Project:</span><span className="meta-value">{project.title}</span></div>
                            <div className="meta-row"><span className="meta-label">Client:</span><span className="meta-value">{project.client || 'Unknown'}</span></div>
                          </div>
                          <div className="assigned-groups">
                            {assigned.length === 0 && (
                              <div className="empty">No groups assigned</div>
                            )}
                            {assigned.map(g => {
                              const isLocked = g.score !== undefined;
                              const isPending = pendingRemoval && pendingRemoval.projectId === project.id && pendingRemoval.groupId === g.id;
                              
                              return (
                                <div
                                  key={g.id}
                                  className={`group-chip ${isPending ? 'pending-remove' : ''} ${isLocked ? 'locked' : ''}`}
                                  onClick={async () => {
                                    if (isPending && !isLocked) {
                                      await unassignGroupFromProject(g, project.id);
                                      setPendingRemoval(null);
                                      // close expanded panel after removal to reveal pool update immediately
                                      setClosingProjectId(project.id);
                                      window.setTimeout(() => {
                                        setExpandedProjectId(null);
                                        setClosingProjectId(null);
                                      }, 220);
                                    } else if (!isLocked) {
                                      // Open info panel for non-locked groups
                                      openGroupInfoPanel(project.id, g.id, g.name);
                                    }
                                  }}
                                >
                                  <span
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      if (isLocked) {
                                        // For locked groups, show info panel with score data
                                        openGroupInfoPanel(project.id, g.id, g.name);
                                        return;
                                      }
                                      if (isPending) return; // don't open info when pending remove
                                      openGroupInfoPanel(project.id, g.id, g.name);
                                    }}
                                  >
                                    {g.name}
                                    {isLocked && g.score !== undefined && (
                                      <span className="score-badge"> (Score: {g.score.toFixed(1)})</span>
                                    )}
                                  </span>
                                  {!isLocked && (
                                    <button
                                      className={`chip-action ${isPending ? 'confirm' : ''}`}
                                      onClick={async (ev) => {
                                        ev.stopPropagation();
                                        if (isPending) {
                                          await unassignGroupFromProject(g, project.id);
                                          setPendingRemoval(null);
                                          setClosingProjectId(project.id);
                                          window.setTimeout(() => {
                                            setExpandedProjectId(null);
                                            setClosingProjectId(null);
                                          }, 220);
                                        } else {
                                          setPendingRemoval({ projectId: project.id, groupId: g.id });
                                          // if info panel is open for this group, close it
                                          if (openGroupInfo && openGroupInfo.projectId === project.id && openGroupInfo.groupId === g.id) {
                                            setClosingGroupInfo(true);
                                            setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180);
                                          }
                                        }
                                      }}
                                      title={isPending ? 'Confirm removal' : 'Mark for removal'}
                                    >
                                      {isPending ? 'Confirm' : '✖'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {dragOverProjectId === project.id && (
                              <div className="drop-hint">Drop here to assign</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pagination">
                  <button className="pg-btn" disabled={resultsPage <= 1} onClick={() => setResultsPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="pg-info">{resultsPage}/{totalResultsPages}</span>
                  <button className="pg-btn" disabled={resultsPage >= totalResultsPages} onClick={() => setResultsPage(p => Math.min(totalResultsPages, p + 1))}>Next</button>
                </div>
              </div>
              <div className="right" ref={poolContainerRef}>
                <div className="section-header">
                  <h3>Unassigned Pool</h3>
                  <div className="controls">
                    <button className="btn btn-success" onClick={quickAssignSuggestions} disabled={loading || isAllocating || !canQuickAssign} title={!canQuickAssign ? 'No score/suggestion available' : undefined}>
                      Quick assign suggestions
                    </button>
                  </div>
                </div>
                <div className="unassigned-list">
                  {allocation.unassignedGroups.length === 0 && (
                    <div className="empty">No unassigned groups</div>
                  )}
                  {paginatedUnassigned.map(g => (
                    <div
                      key={g.id}
                      className={`unassigned-card ${draggingGroupId === g.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={e => onGroupDragStart(e, g.id)}
                      onDragEnd={() => {
                        // Cleanup preview and reset state; if not assigned, item simply reappears
                        if (dragPreviewRef.current) {
                          try { document.body.removeChild(dragPreviewRef.current); } catch (_) {}
                          dragPreviewRef.current = null;
                        }
                        setDraggingGroupId(null);
                      }}
                      onClick={(e) => {
                        // ignore click that was part of a drag
                        if (draggingGroupId) return;
                        // toggle panel for this group in pool
                        e.stopPropagation();
                        if (openGroupInfo && openGroupInfo.projectId === 'pool' && openGroupInfo.groupId === g.id) {
                          setClosingGroupInfo(true);
                          setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180);
                        } else {
                          // open and fetch
                          setGroupInfoLoading(true);
                          setGroupInfoError(null);
                          setGroupInfoData(null);
                          setOpenGroupInfo({ projectId: 'pool', groupId: g.id, name: g.name });
                          setGroupInfoOpenActive(false);
                          requestAnimationFrame(() => setGroupInfoOpenActive(true));
                          getGroupByName(g.name)
                            .then(data => setGroupInfoData(data))
                            .catch((err: any) => setGroupInfoError(err?.message || 'Failed to load'))
                            .finally(() => setGroupInfoLoading(false));
                        }
                      }}
                    >
                      {/* pool group info panel now rendered as overlay at higher layer */}
                      <div className="unassigned-header">
                        <div className="group-name">{g.name}</div>
                      </div>
                    <div className="unassigned-footer" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="score-chip"
                          title={g.score !== undefined ? `Comprehensive Score: ${g.score.toFixed(1)}` : 'No score'}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            // open info panel for this group in pool
                            setGroupInfoLoading(true);
                            setGroupInfoError(null);
                            setGroupInfoData(null);
                            setOpenGroupInfo({ projectId: 'pool', groupId: g.id, name: g.name });
                            setGroupInfoOpenActive(false);
                            requestAnimationFrame(() => setGroupInfoOpenActive(true));
                            getGroupByName(g.name)
                              .then(data => setGroupInfoData(data))
                              .catch((err: any) => setGroupInfoError(err?.message || 'Failed to load'))
                              .finally(() => setGroupInfoLoading(false));
                          }}
                        >
                          {g.score !== undefined ? `Score: ${g.score.toFixed(1)}` : 'Score: N/A'}
                        </button>
                      {g.suggestedProjectId != null && (
                        <span className="score-chip" title="Suggested best match (does not allocate)">
                          Suggest: {suggestedProjectNameByGroup[g.name] || String(g.suggestedProjectId)}
                        </span>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pagination">
                  <button className="pg-btn" disabled={poolPage <= 1} onClick={() => setPoolPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="pg-info">{poolPage}/{totalPoolPages}</span>
                  <button className="pg-btn" disabled={poolPage >= totalPoolPages} onClick={() => setPoolPage(p => Math.min(totalPoolPages, p + 1))}>Next</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .allocation-container {
          padding: 16px;
          max-width: 1400px;
          margin: 0 auto;
          height: calc(100vh - 150px);
        }
        .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; align-items: stretch; height: 100%; }
        /* Keep side-by-side until narrow; preserve ~2/3 : 1/3 proportion */
        @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
        .left, .right { height: 100%; display: flex; flex-direction: column; min-height: 0; }
        .left h3, .right h3 { margin: 8px 0 12px 0; color: #2c3e50; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 12px 0; }
        .controls { display: inline-flex; align-items: center; gap: 12px; }
        .rows-control { display: inline-flex; align-items: center; gap: 8px; }
        .rows-label { font-size: 12px; color: #6b7280; }
        .rows-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; }
        .projects { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; justify-content: start; align-content: start; flex: 1; overflow-y: auto; overflow-x: hidden; position: relative; }
        .project-card { background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 10px; transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, border-width 150ms ease; cursor: pointer; position: relative; overflow: visible; }
        .project-card::before { content: ''; position: absolute; left: -1px; right: -1px; top: -1px; height: 4px; border-top-left-radius: 10px; border-top-right-radius: 10px; background: transparent; transition: background 180ms ease; }
        .project-card.droppable { outline: 2px dashed #93c5fd; outline-offset: -6px; }
        .project-card.full { border-color: #ef4444; }
        .project-card.full::before { background: #ef4444; }
        .project-card.drag-expanded { transform: scale(1.05); box-shadow: 0 14px 28px rgba(59, 130, 246, 0.22); border-color: #60a5fa; border-width: 3px; }
        /* Keep card footprint fixed; only show overlay body when expanded */
        .project-card.expanded { box-shadow: 0 10px 24px rgba(0,0,0,0.08); border-color: #dbeafe; z-index: 5; }
        .project-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px; }
        .project-title { font-weight: 600; font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
        .capacity { font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 6px; border-radius: 999px; flex-shrink: 0; }
        .project-summary { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
        .project-body { max-height: 0; overflow: hidden; transition: max-height 220ms ease, opacity 200ms ease, transform 200ms ease; opacity: 0; transform: translateY(-4px); }
        /* Overlay body renders outside fixed card footprint */
        .project-card.expanded .project-body { position: absolute; left: -6px; right: -6px; top: calc(100% + 6px); max-height: none; overflow: visible; background: #fff; border: 1px solid #93c5fd; outline: 2px dashed #93c5fd; outline-offset: -6px; border-radius: 10px; padding: 10px; box-shadow: 0 16px 32px rgba(0,0,0,0.12); }
        .project-card.full.expanded .project-body { border-color: #ef4444; outline-color: #ef4444; }
        .project-body.open { max-height: none; opacity: 1; transform: translateY(0); }
        .project-body.closing { opacity: 0; transform: translateY(-4px); }
        .project-meta { display: grid; grid-template-columns: 1fr; row-gap: 4px; margin-bottom: 6px; }
        .meta-row { display: flex; gap: 6px; align-items: flex-start; }
        .meta-label { font-size: 11px; color: #6b7280; flex: 0 0 auto; white-space: nowrap; }
        /* Allow values to wrap and break long words/IDs */
        .meta-value { font-size: 12px; color: #111827; font-weight: 500; overflow: visible; text-overflow: unset; white-space: normal; word-break: break-word; }
        .assigned-groups { display: flex; flex-wrap: wrap; gap: 6px; }
        .group-info-panel { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; margin-bottom: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); transition: max-height 200ms ease, opacity 180ms ease, transform 180ms ease; opacity: 0; transform: translateY(-4px); max-height: 0; overflow: hidden; }
        .group-info-panel.open { opacity: 1; transform: translateY(0); max-height: 600px; }
        .group-info-panel.closing { opacity: 0; transform: translateY(-4px); max-height: 0; }
        .info-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .info-title { font-weight: 600; color: #111827; }
        .info-loading { font-size: 12px; color: #6b7280; }
        .info-error { font-size: 12px; color: #ef4444; }
        .info-content { display: grid; row-gap: 6px; }
        .info-row { display: flex; align-items: center; gap: 8px; }
        .pref-row { align-items: flex-start; }
        .group-chip { display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #e5e7eb; padding: 4px 8px; border-radius: 999px; transition: background 140ms ease, border-color 140ms ease, color 140ms ease; font-size: 11px; }
        .group-chip.pending-remove { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
        .group-chip.locked { background: #f3f4f6; border-color: #d1d5db; color: #9ca3af; cursor: pointer; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .skill-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .pref-list { display: grid; row-gap: 2px; }
        .pref-item { display: flex; align-items: baseline; gap: 6px; }
        .pref-index { color: #6b7280; font-size: 12px; min-width: 18px; text-align: right; }
        .pref-name { font-size: 12px; color: #111827; }
        .score-badge { font-size: 0.8em; color: #28a745; font-weight: 600; }
        .chip-action { border: none; background: transparent; cursor: pointer; font-size: 10px; color: #ef4444; }
        .chip-action.confirm { color: #fff; background: #ef4444; border-radius: 999px; padding: 1px 6px; }
        .drop-hint { font-size: 11px; color: #3b82f6; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 6px; padding: 4px 6px; }
        .empty { color: #9ca3af; font-size: 14px; padding: 8px 0; }
        .unassigned-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; flex: 1; overflow: auto; align-content: start; }
        @media (max-width: 420px) { .unassigned-list { grid-template-columns: 1fr; } }
        .unassigned-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; transition: transform 160ms ease, opacity 160ms ease; min-height: 60px; }
        .unassigned-card.dragging { opacity: 0; transform: scale(0.98); }
        .unassigned-header { display: flex; justify-content: center; align-items: center; }
        .group-name { font-weight: 600; font-size: 14px; color: #111827; }
        .unassigned-footer { margin-top: 8px; display: flex; justify-content: center; }
        .score-chip { border: 1px solid #93c5fd; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; }
        .score-chip:hover { background: #dbeafe; }
        .content-header { display: flex; justify-content: space-between; align-items: center; }
        .header-left { display: flex; flex-direction: column; gap: 4px; }
        .header-right { display: flex; gap: 8px; }
        .results-header-left { display: flex; align-items: center; gap: 10px; }
        .search-input { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 12px; min-width: 220px; }
        .loading-indicator { font-size: 12px; color: #3498db; font-style: italic; }
        .error-indicator { font-size: 12px; color: #e74c3c; font-weight: 500; }
        .btn { padding: 8px 14px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background-color: #3498db; color: #fff; }
        .btn-success { background-color: #28a745; color: #fff; }
        .btn-secondary { background-color: #6c757d; color: #fff; }
        .btn.small { padding: 6px 10px; font-size: 12px; }
        .pagination { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
        /* Pin paginations to bottom of each column */
        .left .pagination, .right .pagination { margin-top: auto; }
        .pg-btn { padding: 6px 10px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; }
        .pg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pg-info { font-size: 12px; color: #6b7280; }
      `}</style>
      <style>{`
        .global-overlay { position: fixed; inset: 0; background: rgba(17,24,39,0.3); display: flex; align-items: flex-start; justify-content: center; padding: 60px 16px; opacity: 0; transform: translateY(-6px); transition: opacity 180ms ease, transform 180ms ease; z-index: 50; }
        .global-overlay.open { opacity: 1; transform: translateY(0); }
        .global-overlay.closing { opacity: 0; transform: translateY(-6px); }
        .overlay-panel { width: min(720px, 96%); background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; box-shadow: 0 24px 48px rgba(0,0,0,0.18); }
        
        /* Allocation Progress Modal Styles */
        .allocation-progress-modal { max-width: 500px; }
        .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
        .progress-header h3 { margin: 0; color: #111827; }
        .progress-status { font-size: 14px; color: #6b7280; }
        .progress-content { margin-bottom: 20px; }
        .progress-stage { font-size: 16px; color: #111827; margin-bottom: 8px; }
        .progress-message { font-size: 14px; color: #374151; margin-bottom: 4px; }
        .progress-details { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
        .progress-bar-container { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .progress-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #1d4ed8); transition: width 300ms ease; }
        .progress-percentage { font-size: 12px; font-weight: 600; color: #111827; min-width: 40px; text-align: right; }
        .progress-timestamp { font-size: 11px; color: #9ca3af; }
        .allocation-results { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .allocation-results h4 { margin: 0 0 12px 0; color: #111827; }
        .results-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .stat-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f9fafb; border-radius: 6px; }
        .stat-label { font-size: 12px; color: #6b7280; }
        .stat-value { font-size: 14px; font-weight: 600; }
        .stat-value.success { color: #059669; }
        .stat-value.warning { color: #d97706; }
        .progress-actions { display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
      `}</style>
      {/* Global overlay for pool group info */}
      {isGeneratingReport && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17,24,39,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '60px 16px',
            zIndex: 9999
          }}
        >
          <div className="overlay-panel" style={{ maxWidth: 420 }}>
            <div className="progress-header">
              <h3 style={{ margin: 0 }}>Generating Report…</h3>
              <div className="progress-status">Please wait</div>
            </div>
            <div className="progress-content">
              <div className="progress-bar-container">
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: '100%', animation: 'pulse 1.2s ease-in-out infinite alternate' }}></div></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {openGroupInfo && openGroupInfo.projectId === 'pool' && (
        <div className={`global-overlay ${groupInfoOpenActive ? 'open' : ''} ${closingGroupInfo ? 'closing' : ''}`} onClick={() => { setClosingGroupInfo(true); setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180); }}>
          <div className="overlay-panel" onClick={(e) => e.stopPropagation()} data-group-info="true">
            <div className="info-header">
              <div className="info-title">{groupInfoData?.GroupName || openGroupInfo.name}</div>
              <button className="chip-action" onClick={() => { setClosingGroupInfo(true); setTimeout(() => { setOpenGroupInfo(null); setClosingGroupInfo(false); }, 180); }} title="Close">✖</button>
            </div>
            {groupInfoLoading && (<div className="info-loading">Loading...</div>)}
            {groupInfoError && (<div className="info-error">{groupInfoError}</div>)}
                          {groupInfoData && !groupInfoLoading && !groupInfoError && (
                            <div className="info-content">
                              <div className="info-row"><span className="meta-label">Members:</span>
                                <span className="meta-value">{groupInfoData.members?.map((m) => `${m.StudentName}(${m.MemberOrder})`).join(', ') || 'N/A'}</span>
                              </div>
                              <div className="info-row"><span className="meta-label">Skills:</span>
                                <div className="meta-value skill-chips">
                                  {(groupInfoData.skills || []).length > 0 ? (
                                    (groupInfoData.skills || []).map((s: string, idx: number) => (
                                      <span key={idx} className="skill-chip">{s}</span>
                                    ))
                                  ) : 'N/A'}
                                </div>
                              </div>
                              <div className="info-row pref-row"><span className="meta-label">Preferences:</span>
                                <div className="meta-value pref-list">
                                  {(() => {
                                    const list = (groupPrefNames && groupPrefNames.length > 0)
                                      ? groupPrefNames
                                      : ((groupInfoData as any)?.preferences || []);
                                    return (list && list.length > 0)
                                      ? list.map((label: string, i: number) => (
                                          <div key={i} className="pref-item"><span className="pref-index">{i + 1})</span> <span className="pref-name">{label}</span></div>
                                        ))
                                      : 'N/A';
                                  })()}
                                </div>
                              </div>
                              {groupInfoData.GroupDescription && (
                                <div className="info-row"><span className="meta-label">Notes:</span>
                                  <span className="meta-value">{groupInfoData.GroupDescription}</span>
                                </div>
                              )}
                            </div>
                          )}
          </div>
        </div>
        )}

        {/* Allocation Progress Modal */}
        {showProgressModal && (
          <div className="global-overlay open">
            <div className="overlay-panel allocation-progress-modal" onClick={(e) => e.stopPropagation()}>
              <div className="progress-header">
                <h3>Allocation in Progress</h3>
                <div className="progress-status">
                  {isAllocating ? 'Running...' : 'Completed'}
                </div>
              </div>
              
              {allocationProgress && (
                <div className="progress-content">
                  <div className="progress-stage">
                    <strong>{allocationProgress.stage}</strong>
                  </div>
                  <div className="progress-message">
                    {allocationProgress.message}
                  </div>
                  {allocationProgress.details && (
                    <div className="progress-details">
                      {allocationProgress.details}
                    </div>
                  )}
                  
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${allocationProgress.progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-percentage">
                      {allocationProgress.progress}%
                    </div>
                  </div>
                  
                  <div className="progress-timestamp">
                    {new Date(allocationProgress.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}

              {allocationResults && (
                <div className="allocation-results">
                  <h4>Allocation Results</h4>
                  <div className="results-stats">
                    <div className="stat-item">
                      <span className="stat-label">Total Groups:</span>
                      <span className="stat-value">{allocationResults.results?.totalGroups || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Allocated:</span>
                      <span className="stat-value success">{allocationResults.results?.allocatedGroups || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Unallocated:</span>
                      <span className="stat-value warning">{allocationResults.results?.unallocatedGroups || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Allocation Rate:</span>
                      <span className={`stat-value ${(allocationResults.results?.allocatedGroups || 0) / (allocationResults.results?.totalGroups || 1) >= 0.8 ? 'success' : 'warning'}`}>
                        {((allocationResults.results?.allocatedGroups || 0) / (allocationResults.results?.totalGroups || 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Execution Time:</span>
                      <span className="stat-value">{allocationResults.results?.executionTime || 0}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="allocation-error">
                  <h4 style={{ color: '#dc2626', margin: '0 0 12px 0' }}>❌ Error</h4>
                  <div style={{ 
                    padding: '12px', 
                    background: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '6px',
                    color: '#dc2626',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                </div>
              )}

              {!isAllocating && (
                <div className="progress-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setShowProgressModal(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

export default AdminAllocationSystem;
