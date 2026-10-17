import React from 'react';
import Sidebar from './Sidebar';

interface AdminManageProjectsProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

const AdminManageProjects: React.FC<AdminManageProjectsProps> = ({ userRole, onLogout, username }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);

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
        <div className="content-header">
          <div className="header-left">
            <h1>Manage Projects</h1>
          </div>
        </div>
        <div className="content-body">
          {/* 空白内容区域 */}
        </div>
      </div>
    </div>
  );
};

export default AdminManageProjects;
