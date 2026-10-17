import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NewGroupForm from './NewGroupForm';


interface NewGroupPageProps {
  userRole: 'admin' | 'student';
  username: string;
}

const NewGroupPage: React.FC<NewGroupPageProps> = ({ userRole, username }) => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const [sidebarCompact, setSidebarCompact] = useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = useState(false);
  const [existingGroup, setExistingGroup] = useState<any>(null);

  // load existing group data (if in edit mode)
  useEffect(() => {
    if (groupId) {
      const savedGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
      const group = savedGroups.find((g: any) => g.id === parseInt(groupId));
      if (group) {
        const isEditRoute = location.pathname.includes('/student_classic/edit_group/');
        setExistingGroup(isEditRoute ? { ...group, isEditRoute: true } : group);
      }
    }
  }, [groupId, location.pathname]);

  // listen to sidebar state change
useEffect(() => {
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
      <Sidebar onLogout={() => {}} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <NewGroupForm 
          onBack={() => window.history.back()} 
          existingGroup={existingGroup}
          onGroupCreated={(groupData) => {
            // update or create group data
            const existingGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
            // compute actual member count from groupData
            const students = [
              groupData.student1, groupData.student2, groupData.student3,
              groupData.student4, groupData.student5, groupData.student6, groupData.student7
            ].filter((s: string) => s && s.trim());
            const actualMemberCount = students.length;
            
            if (existingGroup) {
              const updatedGroups = existingGroups.map((g: any) => 
                g.id === existingGroup.id 
                  ? { 
                      ...g, 
                      // keep a normalized card structure
                      name: groupData.groupName || g.name,
                      members: actualMemberCount,
                      status: groupData.isComplete ? 'completed' : 'draft',
                      formData: { ...groupData }
                    }
                  : g
              );
              localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
            } else {
              // create new group
              const newGroup = {
                id: Date.now(),
                name: groupData.groupName || `Group ${existingGroups.length + 1}`,
                members: actualMemberCount,
                createdAt: new Date().toLocaleDateString(),
                status: groupData.isComplete ? 'completed' : 'draft',
                formData: { ...groupData }
              };
              const updatedGroups = [...existingGroups, newGroup];
              localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
            }
          }}
        />
      </div>
    </div>
  );
};

export default NewGroupPage;
