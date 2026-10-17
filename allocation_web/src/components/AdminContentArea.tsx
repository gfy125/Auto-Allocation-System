import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enhancedTempStorage } from '../utils/tempStorage';
import './ContentArea.css';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import { getProjectById, getAllProjects, type ProjectApiData } from '../api/projectApi';
import { deleteProject as apiDeleteProject } from '../api/projectApi';
import DeleteConfirmModal from './DeleteConfirmModal';

interface AdminContentAreaProps {
  sidebarCompact: boolean;
  sidebarShowLabels: boolean;
}

//project attribute
interface Project {
  id: string;
  name: string;
  maxGroups: number | null;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  lastModified?: string;
  groupname?: string[];
  formData?: any;
}

const AdminContentArea: React.FC<AdminContentAreaProps> = ({ sidebarCompact, sidebarShowLabels }) => {
  const navigate = useNavigate();
  
  // use dynamic favicon hook
  useDynamicFavicon();

  // get existing projects from localStorage
  const [projects, setProjects] = useState<Project[]>(() => {
    const savedProjects = localStorage.getItem('createdProjects');
    return savedProjects ? JSON.parse(savedProjects) : [];
  });

  // top-level fetch error (non-blocking)
  const [fetchError, setFetchError] = useState<string>('');

  // preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<ProjectApiData | null>(null);
  const [showDeleteErrorModal, setShowDeleteErrorModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTopError, setDeleteTopError] = useState('');

  // search controls
  const [searchTag, setSearchTag] = useState<'name' | 'client' | 'field' | 'id'>('name');
  const [searchQuery, setSearchQuery] = useState('');

  const handleNewProject = () => {
    // check if there is cached project data
    const cachedProjectData = localStorage.getItem('newProjectFormTemp');
    let projectName = '';
    
    if (cachedProjectData) {
      try {
        const parsedData = JSON.parse(cachedProjectData);
        projectName = parsedData.projectName || '';
      } catch (error) {
        console.error('Failed to parse cached project data:', error);
      }
    }
    
    // if there is no cached name, use default "Unsaved Project"
    if (!projectName) {
      projectName = `Unsaved Project ${projects.length + 1}`;
    }
    
    // Generate a unique project ID in P## format
    const generateProjectId = () => {
      // Use localStorage as source of truth to avoid conflicts
      const savedProjects = localStorage.getItem('createdProjects');
      const existingProjects = savedProjects ? JSON.parse(savedProjects) : [];
      
      const existingIds = existingProjects.map((p: any) => {
        const match = String(p.id).match(/^P(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const maxId = Math.max(0, ...existingIds);
      const nextId = maxId + 1;
      return `P${nextId.toString().padStart(2, '0')}`;
    };

    // automatically create a new project card
    const newProject: Project = {
      id: generateProjectId(),
      name: projectName,
      lastModified: new Date().toISOString(),
      maxGroups: null,
      status: 'draft', // mark as draft
      createdAt: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      groupname: [],
      formData: {} // store form data
    };
    
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
    
    // navigate to edit page, pass project ID (admin route)
    navigate(`/admin/new_project/${newProject.id}`);
  };

  // map backend project to local Project card (completed status)
  const mapApiToLocal = (p: ProjectApiData): Project => {
    // Use projectId directly from backend, ensure P prefix format
    let projectId = p.projectId;
    if (!projectId) {
      // If no projectId, generate from projectID or index
      const numericId = (p as any).projectID || 1;
      projectId = `P${String(numericId).padStart(2, '0')}`;
    } else if (!projectId.startsWith('P')) {
      // If projectId doesn't start with P, add it
      projectId = `P${projectId}`;
    }
    
    return {
      id: projectId,
      name: p.projectName || `Project ${(p as any).id ?? ''}`,
      maxGroups: typeof p.maxGroups === 'number' ? p.maxGroups : parseInt(String((p as any).maxGroups || 0)) || 0,
      status: 'completed',
      createdAt: new Date().toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }),
      groupname: Array.isArray(p.groupname) ? p.groupname : [],
      formData: {
        projectName: p.projectName || '',
        maxGroups: String(p.maxGroups ?? ''),
        client: p.client || '',
        description: p.description || '',
        deliverables: p.deliverables || '',
        specificSkills: p.specificSkills || '',
        resourcesProvided: p.resourcesProvided || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        startTime: p.startTime || '',
        finishTime: p.finishTime || ''
      }
    };
  };

  // Check data consistency between localStorage and API data (only for completed projects)
  const checkDataConsistency = (localProjects: Project[], apiProjects: Project[]): boolean => {
    // Only compare completed projects, ignore drafts
    const localCompleted = localProjects.filter(p => p.status === 'completed');
    const apiCompleted = apiProjects.filter(p => p.status === 'completed');
    
    // Check if projectId formats are inconsistent for completed projects
    const localHasP = localCompleted.some(p => String(p.id).startsWith('P'));
    const apiHasP = apiCompleted.some(p => String(p.id).startsWith('P'));
    
    // If formats are different, need sync
    if (localHasP !== apiHasP) {
      return true;
    }
    
    // Check if completed project counts match
    if (localCompleted.length !== apiCompleted.length) {
      return true;
    }
    
    // Check if any completed project names don't match
    for (const localProject of localCompleted) {
      const matchingApiProject = apiCompleted.find(api => 
        api.name === localProject.name || 
        (api.id === localProject.id && api.name === localProject.name)
      );
      if (!matchingApiProject) {
        return true;
      }
    }
    
    return false;
  };

  const fetchAndMergeProjects = async () => {
    setFetchError('');
    try {
      const apiProjects = await getAllProjects();
      if (Array.isArray(apiProjects)) {
        // map to local Project cards (completed)
        const completedCards = apiProjects.map(mapApiToLocal);
        
        // Check consistency between localStorage and API data
        const localProjects = projects || [];
        const needsSync = checkDataConsistency(localProjects, completedCards);
        
        if (needsSync) {
          console.log('🔄 Data inconsistency detected, syncing with backend...');
          // Use backend data as source of truth for completed projects, preserve local drafts
          const localDrafts = localProjects.filter(p => p.status === 'draft');
          const syncedCompleted = completedCards.map(card => ({
            ...card,
            id: card.id.startsWith('P') ? card.id : `P${card.id}`
          }));
          
          // Filter out drafts that have corresponding completed projects in API
          const filteredDrafts = localDrafts.filter(draft => {
            const hasCorrespondingCompleted = syncedCompleted.some(completed => 
              completed.name === draft.name || 
              (draft.id && completed.id === draft.id)
            );
            return !hasCorrespondingCompleted;
          });
          
          const syncedProjects = [...filteredDrafts, ...syncedCompleted];
          setProjects(syncedProjects);
          localStorage.setItem('createdProjects', JSON.stringify(syncedProjects));
        } else {
          // Normal merge logic
          const byId = new Map<string, Project>();
          
          // Add local projects first (drafts)
          for (const p of localProjects) {
            byId.set(String(p.id), p);
          }
          
          // Add/update with backend projects (completed)
          for (const cp of completedCards) {
            byId.set(String(cp.id), cp);
          }
          const merged = Array.from(byId.values());
          setProjects(merged);
          localStorage.setItem('createdProjects', JSON.stringify(merged));
        }
      } else {
        setFetchError('Server returned invalid projects format.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch projects';
      setFetchError(msg);
    }
  };

  // on mount: try fetch from backend and merge
  useEffect(() => {
    fetchAndMergeProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // edit project function: completed -> edit_project/:id, otherwise use new_project/:id
  const handleEditProject = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj?.status === 'completed') {
      navigate(`/admin/edit_project/${projectId}`);
    } else {
      navigate(`/admin/new_project/${projectId}`);
    }
  };

  // view details via backend API
  const handleViewDetails = async (projectId: string) => {
    setPreviewLoading(true);
    setPreviewError('');
    setSelectedProject(null);
    setShowPreviewModal(true);

    // Draft projects: do NOT call backend; use local storage snapshot directly
    try {
      const draftCard = projects.find(p => p.id === projectId);
      if (draftCard && draftCard.status !== 'completed') {
        const fd = draftCard.formData || {};
        const localProject: ProjectApiData = {
          projectId: projectId,
          projectName: fd.projectName || draftCard.name,
          maxGroups: parseInt(String(fd.maxGroups || draftCard.maxGroups || 0)) || 0,
          description: fd.description || '',
          client: fd.client || '',
          deliverables: fd.deliverables || '',
          specificSkills: fd.specificSkills || '',
          resourcesProvided: fd.resourcesProvided || '',
          tags: Array.isArray(fd.tags) ? fd.tags : [],
          startTime: fd.startTime || '',
          finishTime: fd.finishTime || '',
          groupname: []
        };
        setSelectedProject(localProject);
        setPreviewLoading(false);
        return;
      }
    } catch (_) {}
    try {
      // Convert P01 format to numeric ID for backend API (remove P prefix)
      const numericId = projectId.startsWith('P') ? parseInt(projectId.substring(1), 10) : parseInt(projectId, 10);
      const data = await getProjectById(numericId);
      setSelectedProject(data);
      // Sync localStorage and file cache with latest backend snapshot
      try {
        const savedRaw = localStorage.getItem('createdProjects');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          const mappedFormData: any = {
            projectName: data.projectName || '',
            maxGroups: String(data.maxGroups ?? ''),
            client: data.client || '',
            description: data.description || '',
            deliverables: data.deliverables || '',
            specificSkills: data.specificSkills || '',
            resourcesProvided: data.resourcesProvided || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            startTime: data.startTime || '',
            finishTime: data.finishTime || ''
          };
          const updated = saved.map((p: any) => {
            if (p.id === projectId) {
              // Ensure ID is in P format
              let newId = (data as any)?.projectId || p.id;
              if (newId && !newId.startsWith('P')) {
                newId = `P${newId}`;
              }
              return {
                ...p,
                id: newId,
                name: mappedFormData.projectName || p.name,
                maxGroups: mappedFormData.maxGroups || p.maxGroups,
                status: 'completed',
                groupname: Array.isArray(data.groupname) ? data.groupname : (Array.isArray(p.groupname) ? p.groupname : []),
                formData: {
                  ...(p.formData || {}),
                  ...mappedFormData,
                  // persist projectId string for UI fill
                  projectId: (data as any)?.projectId || (p.formData?.projectId ?? '')
                }
              };
            }
            return p;
          });
          localStorage.setItem('createdProjects', JSON.stringify(updated));
          // Convert P01 format to numeric ID for temp storage
          const numericId = projectId.startsWith('P') ? parseInt(projectId.substring(1), 10) : parseInt(projectId, 10);
          enhancedTempStorage.saveProjectToFile(numericId, mappedFormData);
          // notify same-tab listeners
          window.dispatchEvent(new StorageEvent('storage', { key: 'createdProjects', newValue: JSON.stringify(updated) }));
        }
      } catch (_) {}
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to load project details');
      // Fallback to local snapshot for preview
      try {
        const savedRaw = localStorage.getItem('createdProjects');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          const card = saved.find((p: any) => p.id === projectId);
          const fd = card?.formData || {};
          const localProject: ProjectApiData = {
            projectId: String(projectId),
            projectName: fd.projectName || card?.name || `Project ${projectId}`,
            maxGroups: parseInt(String(fd.maxGroups || card?.maxGroups || 0)) || 0,
            description: fd.description || '',
            client: fd.client || '',
            deliverables: fd.deliverables || '',
            specificSkills: fd.specificSkills || '',
            resourcesProvided: fd.resourcesProvided || '',
            tags: Array.isArray(fd.tags) ? fd.tags : [],
            startTime: fd.startTime || '',
            finishTime: fd.finishTime || '',
            groupname: []
          };
          setSelectedProject(localProject);
        }
      } catch (_) {}
    } finally {
      setPreviewLoading(false);
    }
  };

  // delete project function
  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    setProjectToDelete({ id: projectId, name: project.name });
    setShowDeleteConfirm(true);
    setDeleteTopError('');
  };

  // confirm delete project
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    const project = projects.find(p => p.id === projectToDelete.id);
    if (!project) return;

    try {
      // Draft: local delete only
      if (project.status !== 'completed') {
        const updatedProjects = projects.filter(p => p.id !== projectToDelete.id);
        setProjects(updatedProjects);
        localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
        const tempKey = `newProjectFormTemp_${projectToDelete.id}`;
        localStorage.removeItem(tempKey);
        // Convert P01 format to numeric ID for temp storage
        const numericId = projectToDelete.id.startsWith('P') ? parseInt(projectToDelete.id.substring(1), 10) : parseInt(projectToDelete.id, 10);
        enhancedTempStorage.deleteProjectFile(numericId);
      } else {
        // Completed: call backend delete first
        const numericId = projectToDelete.id.startsWith('P') ? parseInt(projectToDelete.id.substring(1), 10) : parseInt(projectToDelete.id, 10);
        await apiDeleteProject(numericId);
        
        // Remove from local storage
        const updatedProjects = projects.filter(p => p.id !== projectToDelete.id);
        setProjects(updatedProjects);
        localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
        const tempKey = `newProjectFormTemp_${projectToDelete.id}`;
        localStorage.removeItem(tempKey);
        enhancedTempStorage.deleteProjectFile(numericId);
      }
      
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
      setDeleteTopError('');
    } catch (err: any) {
      // Check if it's a 404/not found error - if so, delete locally since backend doesn't have it
      if (err?.message?.includes('404') || err?.message?.includes('not found') || err?.message?.includes('Not Found')) {
        console.log('Project not found in backend, deleting local copy');
        const updatedProjects = projects.filter(p => p.id !== projectToDelete.id);
        setProjects(updatedProjects);
        localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
        const tempKey = `newProjectFormTemp_${projectToDelete.id}`;
        localStorage.removeItem(tempKey);
        // Convert P01 format to numeric ID for temp storage
        const numericId = projectToDelete.id.startsWith('P') ? parseInt(projectToDelete.id.substring(1), 10) : parseInt(projectToDelete.id, 10);
        enhancedTempStorage.deleteProjectFile(numericId);
        setShowDeleteConfirm(false);
        setProjectToDelete(null);
        setDeleteTopError('');
      } else {
        console.error('Delete failed:', err);
        const is409 = err?.message?.includes('409') || err?.message?.includes('ALLOCATION_RESULTS_GENERATED');
        const msg = is409 ? 'Delete Failed (409): Allocation results generated. Cannot delete this project.' : (err?.message || 'Failed to delete project');
        setDeleteTopError(msg);
        // keep the confirm modal open so user can see the error above it
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // cancel delete project
  const cancelDeleteProject = () => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
    setDeleteTopError('');
  };

  // listen to localStorage change
  useEffect(() => {
    const handleStorageChange = () => {
      const savedProjects = localStorage.getItem('createdProjects');
      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }
    };

    // listen to storage event (cross-tab)
    window.addEventListener('storage', handleStorageChange);
    
    // listen to custom storage event (same page)
    const handleCustomStorageChange = (event: any) => {
      if (event.key === 'createdProjects') {
        const savedProjects = localStorage.getItem('createdProjects');
        if (savedProjects) {
          setProjects(JSON.parse(savedProjects));
        }
      }
    };
    
    window.addEventListener('storage', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', handleCustomStorageChange);
    };
  }, []);

  // derive filtered projects based on search
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = React.useMemo(() => {
    if (!normalizedQuery) return projects;
    return projects.filter((p) => {
      if (searchTag === 'name') {
        const cardName = (p.name || '').toLowerCase();
        const formName = (p.formData?.projectName || '').toLowerCase();
        return cardName.includes(normalizedQuery) || formName.includes(normalizedQuery);
      }
      if (searchTag === 'client') {
        const client = (p.formData?.client || '').toLowerCase();
        return client.includes(normalizedQuery);
      }
      if (searchTag === 'field') {
        const tags = Array.isArray(p.formData?.tags) ? p.formData.tags : [];
        const tagString = tags.join(', ').toLowerCase();
        return tagString.includes(normalizedQuery);
      }
      if (searchTag === 'id') {
        return String(p.id).toLowerCase().includes(normalizedQuery);
      }
      return true;
    });
  }, [projects, normalizedQuery, searchTag]);

  return (
    <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
      <div className="content-header">
        <div className="header-left">
          <h1>Allocation Management System - Admin Panel</h1>
        </div>
        <div className="header-right">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* search controls */}
            <select
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value as any)}
              title="Search by"
              style={{ height: 32, borderRadius: 6, border: '1px solid #ddd', padding: '0 8px', background: '#fff' }}
            >
              <option value="name">Name</option>
              <option value="client">Client</option>
              <option value="field">Field</option>
              <option value="id">ID</option>
            </select>
            <input
              type="text"
              placeholder={`Search by ${searchTag}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: 32, borderRadius: 6, border: '1px solid #ddd', padding: '0 10px', minWidth: 220 }}
            />
            <button
              className="btn btn-secondary"
              onClick={fetchAndMergeProjects}
              title="Refresh projects"
              style={{ width: 28, height: 28, minWidth: 28, padding: 0, lineHeight: 1, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ⟳
            </button>
            <button className="btn btn-success" onClick={handleNewProject}>+ New Project</button>
          </div>
        </div>
      </div>

      <div className="content-body">
        {fetchError && (
          <div className="admin-welcome" style={{ marginBottom: 12 }}>
            <div className="welcome-card" style={{ borderLeft: '4px solid #e67e22' }}>
              <div className="welcome-icon">⚠️</div>
              <h3 style={{ margin: '0 0 8px 0' }}>Project list may be outdated</h3>
              <p style={{ margin: 0 }}>{fetchError}</p>
            </div>
          </div>
        )}
        {projects.length === 0 ? (
          // show welcome information when there is no project
          <div className="admin-welcome">
            <div className="welcome-card">
              <div className="welcome-icon"></div>
              <h2>Welcome to Admin Panel</h2>
              <p>Use the sidebar to access administrative functions:</p>
              
              <div className="admin-features">
                <div className="feature-grid">
                  <div className="feature-item">
                    <div className="feature-icon">➕</div>
                    <div className="feature-content">
                      <h4>Create New Project</h4>
                      <p>Create new projects for students to choose from</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <div className="feature-icon">📋</div>
                    <div className="feature-content">
                      <h4>Manage Projects</h4>
                      <p>View, edit, and delete existing projects</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <div className="feature-icon">👥</div>
                    <div className="feature-content">
                      <h4>Manage Groups</h4>
                      <p>View and manage student groups</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <div className="feature-icon">🎯</div>
                    <div className="feature-content">
                      <h4>Allocation System</h4>
                      <p>Manage project allocation and assignments</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <div className="feature-icon">📊</div>
                    <div className="feature-content">
                      <h4>Reports & Analytics</h4>
                      <p>View system reports and statistics</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <div className="feature-icon">⚙️</div>
                    <div className="feature-content">
                      <h4>System Settings</h4>
                      <p>Configure system parameters and preferences</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // show project card grid when there is project
          <div className="projects-grid">
            {filteredProjects
              .sort((a, b) => {
                // Draft projects first, then by creation time
                if (a.status === 'draft' && b.status !== 'draft') return -1;
                if (a.status !== 'draft' && b.status === 'draft') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map((project: Project) => (
              <div key={project.id} className={`project-card ${project.status === 'draft' ? 'draft' : project.status === 'active' ? 'active' : 'completed'}`}>
                <div className="project-header">
                  <h3 className="project-title">{project.name}</h3>
                  <div className="project-status">
                    {project.status === 'draft' ? '📝 Draft' : 
                     project.status === 'active' ? '🟢 Active' : '✅ Complete'}
                  </div>
                </div>
                <div className="project-content">
                  <p className="project-client">Client: {project.formData?.client || 'N/A'}</p>
                  <p className="project-groups">Max Groups: {project.formData?.maxGroups || project.maxGroups || 'N/A'}</p>
                  <p className="project-fields">Fields: {project.formData?.tags?.join(', ') || 'N/A'}</p>
                  <p className="project-created">
                    Created: {project.formData?.finishTime || project.formData?.startTime || project.createdAt}
                  </p>
                  <div className="project-actions">
                    <span className="action-icon" onClick={() => handleEditProject(project.id)} title="Edit Project">
                      ✏️
                    </span>
                    <span className="action-icon" title="View Details" onClick={() => handleViewDetails(project.id)}>👁️</span>
                    <span className="action-icon" onClick={() => handleDeleteProject(project.id)} title="Delete Project">
                      🗑️
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* preview modal */}
        {showPreviewModal && (
          <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Project Details</h3>
                <button className="close-button" onClick={() => setShowPreviewModal(false)}>×</button>
              </div>
              <div className="modal-body">
                {previewLoading ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading project...</p>
                  </div>
                ) : previewError ? (
                  <p className="empty-reason">{previewError}</p>
                ) : selectedProject ? (
                  <div className="group-details">
                    <div className="detail-section">
                      <h3>Basic Info</h3>
                      <div className="info-grid">
                        <div className="info-item"><span className="label">Project ID:</span><span className="value">{(selectedProject as any).projectID ?? (selectedProject as any).projectId ?? 'N/A'}</span></div>
                        <div className="info-item"><span className="label">Project Name:</span><span className="value">{selectedProject.projectName}</span></div>
                        <div className="info-item"><span className="label">Client:</span><span className="value">{selectedProject.client || 'N/A'}</span></div>
                        <div className="info-item"><span className="label">Max Groups:</span><span className="value">{selectedProject.maxGroups}</span></div>
                        <div className="info-item"><span className="label">Start Time:</span><span className="value">{selectedProject.startTime || 'N/A'}</span></div>
                        <div className="info-item"><span className="label">Finish Time:</span><span className="value">{selectedProject.finishTime || 'N/A'}</span></div>
                        <div className="info-item full-width"><span className="label">Tags:</span><span className="value">{Array.isArray(selectedProject.tags) ? selectedProject.tags.join(', ') : (selectedProject.tags || 'N/A')}</span></div>
                        <div className="info-item full-width"><span className="label">Resources Provided:</span><span className="value">{selectedProject.resourcesProvided || 'N/A'}</span></div>
                        <div className="info-item full-width"><span className="label">Deliverables:</span><span className="value">{selectedProject.deliverables || 'N/A'}</span></div>
                        <div className="info-item full-width"><span className="label">Specific Skills:</span><span className="value">{selectedProject.specificSkills || 'N/A'}</span></div>
                        <div className="info-item full-width"><span className="label">Description:</span><span className="value">{selectedProject.description || 'N/A'}</span></div>
                        <div className="info-item full-width"><span className="label">Group Names:</span><span className="value">{Array.isArray(selectedProject.groupname) && selectedProject.groupname.length > 0 ? selectedProject.groupname.join(', ') : 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="modal-footer">
                <button className="close-modal-button" onClick={() => setShowPreviewModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* delete error modal */}
        {showDeleteErrorModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>❌ Delete Failed</h3>
              </div>
              <div className="modal-body">
                <p>{deleteErrorMessage}</p>
                <p><strong>Local data has been preserved.</strong></p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => setShowDeleteErrorModal(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {showDeleteConfirm && projectToDelete && (
          <DeleteConfirmModal
            isOpen={showDeleteConfirm}
            onClose={cancelDeleteProject}
            onConfirm={confirmDeleteProject}
            projectName={projectToDelete.name}
            projectId={projectToDelete.id}
            isDeleting={isDeleting}
          />
        )}

        {/* Top-level delete error banner (shown above confirm modal) */}
        {deleteTopError && (
          <div style={{ position: 'fixed', top: 16, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', maxWidth: 720, width: 'calc(100% - 32px)', boxShadow: '0 6px 24px rgba(0,0,0,0.15)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>Delete Failed</span>
              <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{deleteTopError}</span>
              <button onClick={() => setDeleteTopError('')} style={{ background: 'transparent', border: 0, color: '#991b1b', cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContentArea;
