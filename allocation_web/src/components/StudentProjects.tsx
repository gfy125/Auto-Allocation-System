import React from 'react';
import Sidebar from './Sidebar';
import { getAllProjects, type ProjectApiData } from '../api/projectApi';

interface StudentProjectsProps {
  userRole: 'student';
  username: string;
}

const StudentProjects: React.FC<StudentProjectsProps> = ({ userRole }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);
  const [projects, setProjects] = React.useState<ProjectApiData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [emptyReason, setEmptyReason] = React.useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<ProjectApiData | null>(null);

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

  // Get all projects
  const fetchProjects = React.useCallback(async () => {
      try {
        setLoading(true);
        setEmptyReason('');
        const data = await getAllProjects();
        if (Array.isArray(data)) {
          setProjects(data);
          if (data.length === 0) {
            setEmptyReason('No projects have been created yet.');
          }
        } else {
          console.warn('API returned non-array project data:', data);
          setProjects([]);
          setEmptyReason('Server returned invalid data format. Please check backend implementation.');
        }
      } catch (err: any) {
        console.warn('Failed to fetch projects:', err.message);
        setProjects([]);
        if (err.message.includes('503') || err.message.includes('Service Unavailable')) {
          setEmptyReason('Backend server is not running. Please ensure the backend server is started.');
        } else if (err.message.includes('Failed to fetch')) {
          setEmptyReason('Cannot connect to backend server. Please check if the server is running.');
        } else if (err.message.includes('404')) {
          setEmptyReason('Projects API endpoint not found. Backend may not have implemented GET /api/projects yet.');
        } else {
          setEmptyReason(`Failed to load projects: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handlePreviewProject = (project: ProjectApiData) => {
    setSelectedProject(project);
    setShowPreviewModal(true);
  };

  const closePreview = () => {
    setShowPreviewModal(false);
    setSelectedProject(null);
  };

  return (
    <div className="app">
      <Sidebar onLogout={()=>{}} userRole={userRole} username="Student" />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <div className="content-header">
          <div className="header-left">
            <h1 style={{ textTransform: 'none' }}>project lists</h1>
          </div>
          <div className="header-right">
            <button 
              className="refresh-button"
              onClick={fetchProjects}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="content-body">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading projects...</p>
            </div>
          ) : (
            <>
              {projects.length === 0 ? (
                <div className="no-groups">
                  <h3>No Projects Found</h3>
                  <p className="empty-reason">{emptyReason || 'No projects available.'}</p>
                </div>
              ) : (
                <div className="projects-grid">
                  {projects.map((p, idx) => (
                    <div key={idx} className={`project-card active`} onClick={() => handlePreviewProject(p)} style={{ cursor: 'pointer' }}>
                      <div className="project-header">
                        <h3 className="project-title">{p.projectName}</h3>
                        <div className="project-status">Project</div>
                      </div>
                      <div className="project-content">
                        <p className="project-id">Project ID: {p.projectId || 'N/A'}</p>
                        <p className="project-client">Client: {p.client || 'N/A'}</p>
                        <p className="project-groups">Max Groups: {p.maxGroups}</p>
                        <p className="project-fields">Fields: {Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || 'N/A')}</p>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showPreviewModal && selectedProject && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Project Details: {selectedProject.projectName}</h2>
              <button className="close-button" onClick={closePreview}>×</button>
            </div>
            <div className="modal-body">
              <div className="group-details">
                <div className="detail-section">
                  <h3>Basic Info</h3>
                  <div className="info-grid">
                  <div className="info-item"><span className="label">Project ID:</span><span className="value">{selectedProject.projectId || 'N/A'}</span></div>
                    <div className="info-item"><span className="label">Project Name:</span><span className="value">{selectedProject.projectName}</span></div>
                    <div className="info-item"><span className="label">Client:</span><span className="value">{selectedProject.client || 'N/A'}</span></div>
                    <div className="info-item"><span className="label">Max Groups:</span><span className="value">{selectedProject.maxGroups}</span></div>
                    {/* intentionally hidden per requirements: startTime / finishTime */}
                    <div className="info-item full-width"><span className="label">Tags:</span><span className="value">{Array.isArray(selectedProject.tags) ? selectedProject.tags.join(', ') : (selectedProject.tags || 'N/A')}</span></div>
                    <div className="info-item full-width"><span className="label">Resources Provided:</span><span className="value">{selectedProject.resourcesProvided || 'N/A'}</span></div>
                    <div className="info-item full-width"><span className="label">Deliverables:</span><span className="value">{selectedProject.deliverables || 'N/A'}</span></div>
                    <div className="info-item full-width"><span className="label">Specific Skills:</span><span className="value">{selectedProject.specificSkills || 'N/A'}</span></div>
                    <div className="info-item full-width"><span className="label">Description:</span><span className="value">{selectedProject.description || 'N/A'}</span></div>
                    <div className="info-item full-width"><span className="label">Group Names:</span><span className="value">{Array.isArray(selectedProject.groupname) && selectedProject.groupname.length > 0 ? selectedProject.groupname.join(', ') : 'N/A'}</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="close-modal-button" onClick={closePreview}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProjects;


