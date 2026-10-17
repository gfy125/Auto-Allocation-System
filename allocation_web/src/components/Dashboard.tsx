import React from 'react';
import Sidebar from './Sidebar';
import ContentArea from './ContentArea';

interface DashboardProps {
  userRole: 'student';
  username: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole, username }) => {
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
      <Sidebar onLogout={() => {}} userRole={userRole} username={username} />
      <ContentArea sidebarCompact={sidebarCompact} sidebarShowLabels={sidebarShowLabels} />
    </div>
  );
};

export default Dashboard;
