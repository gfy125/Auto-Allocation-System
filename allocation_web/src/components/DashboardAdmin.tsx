import React from 'react';
import Sidebar from './Sidebar';
import AdminContentArea from './AdminContentArea';

interface DashboardAdminProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

const DashboardAdmin: React.FC<DashboardAdminProps> = ({ userRole, onLogout, username }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);

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

    // use MutationObserver to listen to sidebar class change
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
      <AdminContentArea sidebarCompact={sidebarCompact} sidebarShowLabels={sidebarShowLabels} />
    </div>
  );
};

export default DashboardAdmin;
