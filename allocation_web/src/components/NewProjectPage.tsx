import React from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import NewProjectForm from './NewProjectForm';

interface NewProjectPageProps {
  userRole: 'admin' | 'student';
  onLogout: () => void;
  username: string;
  onProjectSubmitted?: () => void; // 添加项目提交成功后的回调
}

const NewProjectPage: React.FC<NewProjectPageProps> = ({ userRole, onLogout, username, onProjectSubmitted }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);
  const { projectId } = useParams<{ projectId: string }>();

  // Load existing project data for edit mode
  const existingProject = React.useMemo(() => {
    if (projectId) {
      const savedProjects = localStorage.getItem('createdProjects');
      if (savedProjects) {
        const projects = JSON.parse(savedProjects);
        // Match by string ID (P01 format) or convert numeric ID to P format
        const projectIdStr = projectId.startsWith('P') ? projectId : `P${projectId.padStart(2, '0')}`;
        return projects.find((p: any) => p.id === projectIdStr);
      }
    }
    return null;
  }, [projectId]);

  // Only treat as edit mode for completed projects; drafts behave like new (submit/create)
  const editProjectId = React.useMemo(() => {
    if (existingProject && existingProject.status === 'completed') {
      // Convert P01 format to numeric ID for backend API
      return projectId.startsWith('P') ? parseInt(projectId.substring(1), 10) : parseInt(projectId, 10);
    }
    return undefined;
  }, [existingProject, projectId]);

  // listen to sidebar state change
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

  return (
    <div className="app">
      <Sidebar onLogout={onLogout} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <NewProjectForm 
          onBack={() => window.history.back()} 
          existingProjectId={editProjectId}
          draftProjectId={!editProjectId && existingProject ? (projectId.startsWith('P') ? parseInt(projectId.substring(1), 10) : parseInt(projectId, 10)) : undefined}
          onProjectCreated={(projectData) => {
            const existingProjects = JSON.parse(localStorage.getItem('createdProjects') || '[]');
            if (existingProject) {
              // Update existing project; keep payload under formData for card rendering
              const updatedProjects = existingProjects.map((p: any) => 
                p.id === existingProject.id 
                  ? { 
                      ...p,
                      name: projectData.projectName || p.name,
                      maxGroups: projectData.maxGroups || p.maxGroups || 0,
                      status: projectData.isComplete ? 'completed' : 'draft',
                      formData: {
                        ...(p.formData || {}),
                        ...projectData
                      }
                    }
                  : p
              );
              localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
            } else {
              // For new projects, if completed, remove the draft from localStorage
              if (projectData.isComplete) {
                const updatedProjects = existingProjects.filter((p: any) => p.id !== projectId);
                localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
                console.log('🗑️ Removed draft project from localStorage after successful submission');
                // Notify parent component to refresh data
                if (onProjectSubmitted) {
                  onProjectSubmitted();
                }
              } else {
                // Update existing draft project with form data
                const updatedProjects = existingProjects.map((p: any) => 
                  p.id === projectId 
                    ? { 
                        ...p,
                        name: projectData.projectName || p.name,
                        maxGroups: projectData.maxGroups || p.maxGroups || 0,
                        status: 'draft',
                        formData: {
                          ...(p.formData || {}),
                          ...projectData
                        }
                      }
                    : p
                );
                localStorage.setItem('createdProjects', JSON.stringify(updatedProjects));
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default NewProjectPage;
