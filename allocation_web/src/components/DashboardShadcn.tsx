import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import AnimatedStyleSwitcher from './AnimatedStyleSwitcher';
import { deleteGroup, type Group, getFilledStudentCount, getFilledStudents } from '../utils/groupUtils';
import { getGroupByName, deleteGroup as deleteGroupApi, type GroupApiData } from '../api/groupApi';
import { 
  Plus, 
  Edit, 
  Users, 
  Trash2, 
  BookOpen, 
  FileText,
  BarChart3,
  Info,
  CheckCircle,
  ListOrdered
} from "lucide-react";

interface DashboardShadcnProps {}

const DashboardShadcn: React.FC<DashboardShadcnProps> = () => {
  const navigate = useNavigate();
  
  // use dynamic favicon hook
  useDynamicFavicon();
  
  const [sidebarCompact, setSidebarCompact] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [groupToPreview, setGroupToPreview] = useState<Group | null>(null);
  // preview state banners
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [fetchedPreviewGroup, setFetchedPreviewGroup] = useState<GroupApiData | null>(null);
  // const [fetchedPreviewGroup, setFetchedPreviewGroup] = useState<GroupApiData | null>(null);
  const [showDraftWarningModal, setShowDraftWarningModal] = useState(false);
  const [draftGroup, setDraftGroup] = useState<Group | null>(null);
  const [showDeleteErrorModal, setShowDeleteErrorModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  
  // Search functionality states
  const [searchTerm, setSearchTerm] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [searchedGroup, setSearchedGroup] = useState<GroupApiData | null>(null);
  const [verificationInputs, setVerificationInputs] = useState(['', '', '']);
  const [verificationError, setVerificationError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');




  // get created groups data from localStorage
  const [groups, setGroups] = useState<Group[]>(() => {
    const savedGroups = localStorage.getItem('createdGroups');
    return savedGroups ? JSON.parse(savedGroups) : [];
  });

  // add create new group function
  const handleNewGroup = () => {
    // if there is a draft group, show warning modal
    const draftGroup = groups.find(g => g.status === 'draft');
    if (draftGroup) {
      setDraftGroup(draftGroup);
      setShowDraftWarningModal(true);
      return;
    }
    // check if there is cached group data
    const cachedGroupData = localStorage.getItem('newGroupFormTemp');
    let groupName = '';
    
    if (cachedGroupData) {
      try {
        const parsedData = JSON.parse(cachedGroupData);
        groupName = parsedData.groupName || '';
      } catch (error) {
        console.error('Failed to parse cached group data:', error);
      }
    }
    
    // if there is no cached name, use default "Unsaved Group" name
    if (!groupName) {
      groupName = `Unsaved Group ${groups.length + 1}`;
    }
    
    // automatically create a new group card
    const newGroup: Group = {
      id: Date.now(),
      name: groupName,
      course: '',
      members: 0,
      createdAt: new Date().toLocaleDateString(),
      status: 'draft', // mark as draft status
      formData: {} 
    };
    
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
    
    // navigate to edit page, pass group ID
    navigate(`/student_modern/new_group_shadcn/${newGroup.id}`);
  };

  // edit group function
  const handleEditGroup = async (groupId: number) => {
    const g = groups.find(x => x.id === groupId);
    // Always allow edit; for completed, prefetch latest from backend by name and sync localStorage
    if (g && g.status === 'completed') {
      try {
        const name = g.name || g.formData?.groupName;
        if (name) {
          const data = await getGroupByName(name);
          // sync localStorage with latest backend snapshot
          const savedRaw = localStorage.getItem('createdGroups');
          if (savedRaw) {
            const saved = JSON.parse(savedRaw);
            const membersArr = Array.isArray(data.members) ? data.members : [];
            const memberCount = membersArr.length;
            const prefs = Array.isArray(data.preferences) ? data.preferences : [];
            const studentStrings: string[] = [];
            for (let i = 0; i < 7; i++) {
              const m = membersArr[i];
              studentStrings[i] = m ? `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}` : '';
            }
            const mappedName = (data as any).GroupName || (data as any).groupName || name;
            const newFormData: any = {
              groupName: mappedName,
              student1: studentStrings[0] || '',
              student2: studentStrings[1] || '',
              student3: studentStrings[2] || '',
              student4: studentStrings[3] || '',
              student5: studentStrings[4] || '',
              student6: studentStrings[5] || '',
              student7: studentStrings[6] || '',
              preference1: prefs[0] || '',
              preference2: prefs[1] || '',
              preference3: prefs[2] || '',
              preference4: prefs[3] || '',
              preference5: prefs[4] || '',
              wamHD: String((data as any).NumStudentsHD ?? '0'),
              wamD: String((data as any).NumStudentsD ?? '0'),
              wamCR: String((data as any).NumStudentsCR ?? '0'),
              wamP: String((data as any).NumStudentsP ?? '0'),
              dualEnrollment: ((data as any).NumStudentsTwoUnitsEnrolled ?? 0) > 0 ? 'yes' : 'no',
              skills: Array.isArray(data.skills) ? data.skills : [],
              description: (data as any).GroupDescription || ''
            };
            const updated = saved.map((it: any) => (
              it.id === g.id
                ? {
                    ...it,
                    name: mappedName,
                    members: memberCount,
                    status: 'completed',
                    allocated_project: (data as any).allocated_project || it.allocated_project,
                    formData: newFormData
                  }
                : it
            ));
            localStorage.setItem('createdGroups', JSON.stringify(updated));
          }
        }
      } catch (e: any) {
        // Check if error is "group not found" and update status to draft, then navigate to new route for auto-submit
        if (e?.message?.includes('not found') || e?.message?.includes('GROUP_NOT_FOUND')) {
          console.log('🔄 Group not found, updating status to draft and navigating to new route for auto-submit:', g?.name);
          try {
            const savedRaw = localStorage.getItem('createdGroups');
            if (savedRaw) {
              const saved = JSON.parse(savedRaw);
              const updated = saved.map((group: any) => (
                group.id === g.id
                  ? { ...group, status: 'draft' }
                  : group
              ));
              localStorage.setItem('createdGroups', JSON.stringify(updated));
              // Update local state
              setGroups(updated);
            }
          } catch (updateErr) {
            console.error('Failed to update group status:', updateErr);
          }
          // Navigate to new route for auto-submit (createGroup)
          navigate(`/student_modern/new_group_shadcn/${groupId}`);
          return;
        }
        // ignore other errors; we'll still navigate
      }
    }
    // completed -> edit route, draft -> new route
    if (g && g.status === 'completed') {
      navigate(`/student_modern/edit_group_shadcn/${groupId}`);
    } else {
      navigate(`/student_modern/new_group_shadcn/${groupId}`);
    }
  };


  // delete group function
  const handleDeleteGroup = (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setGroupToDelete(group);
      setShowDeleteModal(true);
    }
  };

  // confirm delete
  const confirmDelete = async () => {
    if (!groupToDelete) return;
    let canDeleteLocal = true;
    if (groupToDelete.status === 'completed') {
      try {
        const name = groupToDelete.name || groupToDelete.formData?.groupName;
        if (name) await deleteGroupApi(name);
        canDeleteLocal = true;
      } catch (e: any) {
        // Check if it's a 404/not found error - if so, delete locally since backend doesn't have it
        if (e?.message?.includes('404') || e?.message?.includes('not found') || e?.message?.includes('Not Found')) {
          console.log('Group not found in backend, deleting local copy');
          canDeleteLocal = true;
        } else {
          console.warn('Backend delete failed; preserving local copy:', e?.message);
          canDeleteLocal = false;
          setDeleteErrorMessage(e?.message || 'Failed to delete group from backend');
          setShowDeleteErrorModal(true);
        }
      }
    }
    if (groupToDelete.status === 'draft' || canDeleteLocal) {
      deleteGroup(
        groupToDelete.id,
        () => {
          const updatedGroups = groups.filter(g => g.id !== groupToDelete.id);
          setGroups(updatedGroups);
          setShowDeleteModal(false);
          setGroupToDelete(null);
        },
        (error) => {
          console.log('Delete operation failed:', error);
          setShowDeleteModal(false);
          setGroupToDelete(null);
        }
      );
    } else {
      setShowDeleteModal(false);
      setGroupToDelete(null);
    }
  };

  // cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
  };

  // preview group function
  const handlePreviewGroup = async (group: Group) => {
    setGroupToPreview(group);
    setPreviewError('');
    setPreviewLoading(true);
    setShowPreviewModal(true);
    try {
      const data = await getGroupByName(group.name || group.formData?.groupName || '');
      setFetchedPreviewGroup(data);
      // sync localStorage with latest backend snapshot
      const savedRaw = localStorage.getItem('createdGroups');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        const membersArr = Array.isArray(data.members) ? data.members : [];
        const memberCount = membersArr.length;
        const prefs = Array.isArray(data.preferences) ? data.preferences : [];
        const studentStrings: string[] = [];
        for (let i = 0; i < 7; i++) {
          const m = membersArr[i];
          studentStrings[i] = m ? `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}` : '';
        }
        const mappedName = (data as any).GroupName || (data as any).groupName || (group.name || '');
        const newFormData: any = {
          groupName: mappedName,
          student1: studentStrings[0] || '',
          student2: studentStrings[1] || '',
          student3: studentStrings[2] || '',
          student4: studentStrings[3] || '',
          student5: studentStrings[4] || '',
          student6: studentStrings[5] || '',
          student7: studentStrings[6] || '',
          preference1: prefs[0] || '',
          preference2: prefs[1] || '',
          preference3: prefs[2] || '',
          preference4: prefs[3] || '',
          preference5: prefs[4] || '',
          wamHD: String((data as any).NumStudentsHD ?? '0'),
          wamD: String((data as any).NumStudentsD ?? '0'),
          wamCR: String((data as any).NumStudentsCR ?? '0'),
          wamP: String((data as any).NumStudentsP ?? '0'),
          dualEnrollment: ((data as any).NumStudentsTwoUnitsEnrolled ?? 0) > 0 ? 'yes' : 'no',
          skills: Array.isArray(data.skills) ? data.skills : [],
          description: (data as any).GroupDescription || ''
        };
        const updated = saved.map((it: any) => (
          it.id === group.id
            ? {
                ...it,
                name: mappedName,
                members: memberCount,
                status: it.status || 'completed',
                allocated_project: (data as any).allocated_project || it.allocated_project,
                formData: newFormData
              }
            : it
        ));
        localStorage.setItem('createdGroups', JSON.stringify(updated));
      }
    } catch (e: any) {
      // Check if error is "group not found" and update status to draft
      if (e?.message?.includes('not found') || e?.message?.includes('GROUP_NOT_FOUND')) {
        console.log('🔄 Group not found, updating status to draft:', group.name);
        try {
          const savedRaw = localStorage.getItem('createdGroups');
          if (savedRaw) {
            const saved = JSON.parse(savedRaw);
            const updated = saved.map((g: any) => (
              g.id === group.id
                ? { ...g, status: 'draft' }
                : g
            ));
            localStorage.setItem('createdGroups', JSON.stringify(updated));
            // Update local state
            setGroups(updated);
          }
        } catch (updateErr) {
          console.error('Failed to update group status:', updateErr);
        }
      }
      setPreviewError(e?.message || 'Failed to load group details');
    } finally {
      setPreviewLoading(false);
    }
  };

  // close preview
  const closePreview = () => {
    setShowPreviewModal(false);
    setGroupToPreview(null);
  };

  // close draft warning modal
  const closeDraftWarning = () => {
    setShowDraftWarningModal(false);
    setDraftGroup(null);
  };

  // edit draft group
  const editDraftGroup = () => {
    if (draftGroup) {
      closeDraftWarning();
      handleEditGroup(draftGroup.id);
    }
  };

  // delete draft group
  const deleteDraftGroup = () => {
    if (draftGroup) {
      closeDraftWarning();
      handleDeleteGroup(draftGroup.id);
    }
  };

  // Search group function
  const handleSearchGroup = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Please enter a group name');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    
    try {
      const groupData = await getGroupByName(searchTerm.trim());
      setSearchedGroup(groupData);
      setVerificationInputs(['', '', '']);
      setVerificationError('');
      setShowVerificationModal(true);
    } catch (error: any) {
      setSearchError(error.message || 'Failed to search group');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle input change with search loading state
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSearchError(''); // Clear error when user starts typing
  };

  // Verify group members function
  const handleVerifyMembers = () => {
    if (!searchedGroup) return;

    const members = searchedGroup.members || [];
    const verifiedCount = verificationInputs.filter(input => {
      const trimmedInput = input.trim();
      return members.some(member => 
        member.StudentName?.toLowerCase().includes(trimmedInput.toLowerCase()) ||
        member.StudentID === trimmedInput ||
        member.UniKey?.toLowerCase().includes(trimmedInput.toLowerCase())
      );
    }).length;

    if (verifiedCount < 3) {
      setVerificationError(`Only ${verifiedCount} member(s) verified. Please verify 3 members.`);
      return;
    }

    const groupName = searchedGroup.GroupName || searchedGroup.groupName || searchTerm;
    
    // Check if group with same name already exists
    const existingGroupIndex = groups.findIndex(g => 
      g.name === groupName || g.formData?.groupName === groupName
    );
    
    const newFormData = {
      groupName: groupName,
      student1: members[0] ? `${members[0].StudentName}, ${members[0].StudentID}, ${members[0].UniKey}, ${members[0].UnitOfStudy}` : '',
      student2: members[1] ? `${members[1].StudentName}, ${members[1].StudentID}, ${members[1].UniKey}, ${members[1].UnitOfStudy}` : '',
      student3: members[2] ? `${members[2].StudentName}, ${members[2].StudentID}, ${members[2].UniKey}, ${members[2].UnitOfStudy}` : '',
      student4: members[3] ? `${members[3].StudentName}, ${members[3].StudentID}, ${members[3].UniKey}, ${members[3].UnitOfStudy}` : '',
      student5: members[4] ? `${members[4].StudentName}, ${members[4].StudentID}, ${members[4].UniKey}, ${members[4].UnitOfStudy}` : '',
      student6: members[5] ? `${members[5].StudentName}, ${members[5].StudentID}, ${members[5].UniKey}, ${members[5].UnitOfStudy}` : '',
      student7: members[6] ? `${members[6].StudentName}, ${members[6].StudentID}, ${members[6].UniKey}, ${members[6].UnitOfStudy}` : '',
      preference1: searchedGroup.preferences?.[0] || '',
      preference2: searchedGroup.preferences?.[1] || '',
      preference3: searchedGroup.preferences?.[2] || '',
      preference4: searchedGroup.preferences?.[3] || '',
      preference5: searchedGroup.preferences?.[4] || '',
      wamHD: String(searchedGroup.NumStudentsHD || '0'),
      wamD: String(searchedGroup.NumStudentsD || '0'),
      wamCR: String(searchedGroup.NumStudentsCR || '0'),
      wamP: String(searchedGroup.NumStudentsP || '0'),
      dualEnrollment: (searchedGroup.NumStudentsTwoUnitsEnrolled || 0) > 0 ? 'yes' : 'no',
      skills: searchedGroup.skills || [],
      description: searchedGroup.GroupDescription || '',
      allocated_project: searchedGroup.allocated_project || ''
    };

    let updatedGroups;
    if (existingGroupIndex !== -1) {
      // Update existing group
      console.log('🔄 Updating existing group:', groupName);
      updatedGroups = groups.map((group, index) => 
        index === existingGroupIndex 
          ? {
              ...group,
              name: groupName,
              members: members.length,
              status: 'completed' as const,
              formData: newFormData
            }
          : group
      );
    } else {
      // Create new group
      console.log('➕ Creating new group:', groupName);
      const newGroup: Group = {
        id: Date.now(),
        name: groupName,
        course: 'COMP3888',
        members: members.length,
        createdAt: new Date().toLocaleDateString(),
        status: 'completed',
        formData: newFormData
      };
      updatedGroups = [...groups, newGroup];
    }

    setGroups(updatedGroups);
    localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));

    // Close modal and reset search
    setShowVerificationModal(false);
    setSearchedGroup(null);
    setSearchTerm('');
    setVerificationInputs(['', '', '']);
    setVerificationError('');
  };

  // Close verification modal
  const closeVerificationModal = () => {
    setShowVerificationModal(false);
    setSearchedGroup(null);
    setVerificationInputs(['', '', '']);
    setVerificationError('');
  };

  // listen to localStorage change
  useEffect(() => {
    const handleStorageChange = () => {
      const savedGroups = localStorage.getItem('createdGroups');
      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      }
    };

    const checkTempStorage = () => {
      const tempData = localStorage.getItem('newGroupFormTemp');
      if (tempData) {
        try {
          const parsedData = JSON.parse(tempData);
          if (parsedData.groupName) {
            setGroups(prevGroups => {
              const updatedGroups = prevGroups.map(group => {
                if (group.status === 'draft' && !group.formData?.groupName) {
                  return {
                    ...group,
                    name: parsedData.groupName
                  };
                }
                return group;
              });
              
              if (JSON.stringify(updatedGroups) !== JSON.stringify(prevGroups)) {
                localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
              }
              
              return updatedGroups;
            });
          }
        } catch (error) {
          console.error('Failed to parse temp storage data:', error);
        }
      }
    };

    const intervalId = setInterval(checkTempStorage, 1000);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  // sidebar menu items - simplified version
  const menuItems = [
    { id: 'info', label: 'Information', icon: Info, type: 'expand-panel', content: 'System Information and Help' },
         { id: 'dashboard', label: 'Dashboard', icon: BarChart3, type: 'navigate', route: '/student_modern' },
    { id: 'projects', label: 'Projects', icon: FileText, type: 'navigate', route: '/student_modern/projects_shadcn' }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        sidebarCompact ? 'w-16' : 'w-64'
      }`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <img 
              src="/logo_uni_tran.png" 
              alt="University Logo" 
              className={`transition-all duration-300 ${
                sidebarCompact ? 'h-8 w-8' : 'h-10 w-10'
              }`}
            />
          </div>
        </div>

        <nav className="p-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div key={item.id} className="mb-2">
                {item.type === 'expand-panel' ? (
                  <div>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${
                        sidebarCompact ? 'px-2' : 'px-4'
                      }`}
                      onClick={() => setExpandedPanel(expandedPanel === item.id ? null : item.id)}
                    >
                      <IconComponent className="h-4 w-4 mr-2" />
                      {!sidebarCompact && item.label}
                      {!sidebarCompact && (
                        <span className={`ml-auto transition-transform duration-200 ${
                          expandedPanel === item.id ? 'rotate-180' : ''
                        }`}>
                          ▼
                        </span>
                      )}
                    </Button>
                    
                    {/* Expandable Panels */}
                    {expandedPanel === item.id && !sidebarCompact && (
                      <div className="mt-2 ml-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="space-y-3">
                          <div className="text-sm text-gray-600">
                            {item.content}
                          </div>
                          
                          {/* Style Switcher for Info Panel */}
                          {item.id === 'info' && (
                            <div className="pt-2 border-t border-gray-200">
                              <AnimatedStyleSwitcher />
                            </div>
                          )}
                          
                          
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className={`w-full justify-start ${
                      sidebarCompact ? 'px-2' : 'px-4'
                    }`}
                    onClick={() => {
                      if (item.type === 'navigate' && item.route) {
                        navigate(item.route);
                      }
                    }}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {!sidebarCompact && item.label}
                  </Button>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Bottom Section */}
        <div className="mt-auto p-4 border-t border-gray-200 bg-white">
          {/* Sidebar Toggle Button */}
          <div className="flex items-center justify-center mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCompact(!sidebarCompact)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              {sidebarCompact ? '→' : '←'}
            </Button>
          </div>
          
          {/* User Info */}
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
            {!sidebarCompact && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Student</p>
                <p className="text-xs text-gray-500">Student User</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Allocation Management System</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search group by name..."
                  value={searchTerm}
                  onChange={handleSearchInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchGroup()}
                  disabled={searchLoading}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {searchError && (
                  <div className="text-red-500 text-xs">
                    {searchError}
                  </div>
                )}
              </div>
              <Button onClick={handleNewGroup} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Group</span>
              </Button>
            </div>
          </div>

          {/* Stats Cards removed */}

          {/* Groups Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Your Groups</h2>
              <Badge variant="outline" className="text-sm">
                {groups.length} {groups.length === 1 ? 'group' : 'groups'}
              </Badge>
            </div>

            {groups.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No groups created yet</h3>
                  <p className="text-gray-600 mb-4">Click "New Group" to create your first group!</p>
                  <Button onClick={handleNewGroup}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Group
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-10">
                {groups.map((group) => (
                  <Card key={group.id} className={`hover:shadow-lg transition-shadow ${
                    group.status === 'draft' ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <Badge variant={group.status === 'completed' ? 'default' : 'secondary'} className="flex items-center space-x-1">
                          {group.status === 'completed' ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span>Complete</span>
                            </>
                          ) : (
                            <>
                              <FileText className="h-3 w-3" />
                              <span>Draft</span>
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4" />
                        <span>{group.name.substring(0, 8)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Group ID:</span>
                        <span className="font-medium">{group.id}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Members:</span>
                        <span className="font-medium">{getFilledStudentCount(group)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">{group.createdAt}</span>
                      </div>
                      
                      {/* show student information */}
                      {group.status === 'completed' && (group.student1 || group.student2 || group.student3 || group.student4 || group.student5 || group.student6 || group.student7) && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium">Students:</div>
                            <div className="text-xs text-gray-600 space-y-1">
                              {[group.student1, group.student2, group.student3, group.student4, group.student5, group.student6, group.student7]
                                .filter(Boolean)
                                .map((student, index) => (
                                  <div key={index} className="truncate">
                                    {student}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                      
                      <Separator />
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditGroup(group.id)}
                          className="flex items-center space-x-1 min-w-0 flex-1"
                        >
                          <Edit className="h-3 w-3" />
                          <span className="truncate">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewGroup(group)}
                          className="flex items-center space-x-1 min-w-0 flex-1"
                        >
                          <Users className="h-3 w-3" />
                          <span className="truncate">View</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-700 min-w-0 flex-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="truncate">Delete</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      


      {/* Delete Confirmation Modal */}
      {showDeleteModal && groupToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                <span>Delete Group</span>
              </CardTitle>
              <CardDescription>
                Are you sure you want to delete group "{groupToDelete.name}"? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Error Modal */}
      {showDeleteErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                <span>Delete Failed</span>
              </CardTitle>
              <CardDescription>
                {deleteErrorMessage}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Local data has been preserved.</strong>
              </p>
              <div className="flex items-center justify-end">
                <Button variant="outline" onClick={() => setShowDeleteErrorModal(false)}>
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* preview modal */}
      {showPreviewModal && groupToPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Group Details</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* status banners inside modal */}
              {previewLoading && (
                <div className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200 text-sm">
                  <span className="text-gray-600">Loading:</span>
                  <span className="font-medium">Fetching group details...</span>
                </div>
              )}
              {!!previewError && (
                <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200 text-sm">
                  <span className="text-red-700">Error:</span>
                  <span className="font-medium text-red-800">{previewError}</span>
                </div>
              )}
              {!!previewError && (
                <div className="flex items-center justify-between p-2 rounded bg-yellow-50 border border-yellow-200 text-sm">
                  <span className="text-yellow-700">Notice:</span>
                  <span className="font-medium text-yellow-800">Backend fetch failed. Showing local data snapshot.</span>
                </div>
              )}
              <div className="space-y-3">
                <h4 className="text-base font-semibold flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Basic Information</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Group ID</Label>
                    <p className="text-sm font-medium">{groupToPreview.id}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Group Name</Label>
                    <p className="text-sm font-medium">{groupToPreview.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Course</Label>
                    <p className="text-sm font-medium">{groupToPreview.formData?.course || 'COMP3888'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
                    <Badge variant={groupToPreview.status === 'draft' ? 'secondary' : 'default'}>
                      {groupToPreview.status === 'draft' ? ' Draft' : ' Completed'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Created</Label>
                    <p className="text-sm font-medium">{groupToPreview.createdAt}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Members Count</Label>
                    <p className="text-sm font-medium">{getFilledStudentCount(groupToPreview)}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Allocated Project</Label>
                    <p className="text-sm font-medium">{(fetchedPreviewGroup as any)?.allocated_project || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-base font-semibold flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                </h4>
                <div className="space-y-1">
                  {getFilledStudents(groupToPreview).length > 0 ? (
                    getFilledStudents(groupToPreview).map((student, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded-md">
                        <span className="text-sm font-medium text-muted-foreground min-w-[20px]">{index + 1}.</span>
                        <span className="text-sm font-medium flex-1 truncate" title={student}>{student}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground italic py-8">No members added yet</p>
                  )}
                </div>
              </div>

              {groupToPreview.formData && (
                <>
                  {/* Project Preferences */}
                  {(groupToPreview.formData.preference1 || groupToPreview.formData.preference2 || 
                    groupToPreview.formData.preference3 || groupToPreview.formData.preference4 || 
                    groupToPreview.formData.preference5) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-base font-semibold flex items-center space-x-2">
                          <ListOrdered className="h-4 w-4" />
                          <span>Project Preferences</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[1, 2, 3, 4, 5].map(num => {
                            const preference = groupToPreview.formData?.[`preference${num}` as keyof typeof groupToPreview.formData] as string;
                            return preference ? (
                              <div key={num} className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                  {num}{num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Preference
                                </Label>
                                <p className="text-sm font-medium">{preference}</p>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* WAM Statistics */}
                  {(groupToPreview.formData.wamHD || groupToPreview.formData.wamD || 
                    groupToPreview.formData.wamCR || groupToPreview.formData.wamP) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-base font-semibold flex items-center space-x-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>WAM Statistics</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {groupToPreview.formData.wamHD && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">HD (≥85)</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.wamHD}</p>
                            </div>
                          )}
                          {groupToPreview.formData.wamD && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">D (≥75 and &lt;85)</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.wamD}</p>
                            </div>
                          )}
                          {groupToPreview.formData.wamCR && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">CR (≥65 and &lt;75)</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.wamCR}</p>
                            </div>
                          )}
                          {groupToPreview.formData.wamP && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">P (≥50 and &lt;65)</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.wamP}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Additional Information */}
                  {(groupToPreview.formData.description || groupToPreview.formData.finishTime || groupToPreview.formData.preferences) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-base font-semibold flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>Additional Information</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {groupToPreview.formData.description && (
                            <div className="md:col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.description}</p>
                            </div>
                          )}
                          {groupToPreview.formData.finishTime && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Finish Time</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.finishTime}</p>
                            </div>
                          )}
                          {groupToPreview.formData.preferences && (
                            <div className="md:col-span-2 space-y-1">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Preferences</Label>
                              <p className="text-sm font-medium">{groupToPreview.formData.preferences}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
            <div className="flex items-center justify-end space-x-2 p-4 pt-0">
              <Button variant="outline" onClick={closePreview}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* draft warning modal */}
      {showDraftWarningModal && draftGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-orange-600">
                <span>⚠️</span>
                <span>Draft Group Warning</span>
              </CardTitle>
              <CardDescription>
                You have an unfinished draft group "{draftGroup.name}". Please complete or delete it before creating a new group.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-orange-700 font-medium">Group ID:</span>
                    <span className="text-orange-800">{draftGroup.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 font-medium">Created:</span>
                    <span className="text-orange-800">{draftGroup.createdAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 font-medium">Status:</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">📝 Draft</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="flex items-center justify-end space-x-2 p-6 pt-0">
              <Button variant="outline" onClick={closeDraftWarning}>
                Cancel
              </Button>
              <Button variant="outline" onClick={editDraftGroup} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                <Edit className="h-4 w-4 mr-2" />
                Edit Draft
              </Button>
              <Button variant="destructive" onClick={deleteDraftGroup}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Draft
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Group verification modal */}
      {showVerificationModal && searchedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Group Verification</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={closeVerificationModal}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Group Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Group Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Group Name</Label>
                    <p className="font-medium">{searchedGroup.GroupName || searchedGroup.groupName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Members Count</Label>
                    <p className="font-medium">{searchedGroup.members?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Group Members */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Group Members</h4>
                <div className="space-y-2">
                  {searchedGroup.members && searchedGroup.members.length > 0 ? (
                    searchedGroup.members.map((member, idx) => (
                      <div key={idx} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium text-gray-500">{idx + 1}.</span>
                        <span className="text-sm">
                          {member.StudentName} ({member.StudentID}) - {member.UniKey}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No members found</p>
                  )}
                </div>
              </div>

              {/* Member Verification */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Member Verification</h4>
                <p className="text-sm text-gray-600">
                  Please enter information for 3 group members to verify your identity. 
                  You can enter their name, student ID, or UniKey.
                </p>
                <div className="space-y-3">
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="space-y-1">
                      <Label className="text-sm font-medium">Member {num}:</Label>
                      <input
                        type="text"
                        value={verificationInputs[num - 1]}
                        onChange={(e) => {
                          const newInputs = [...verificationInputs];
                          newInputs[num - 1] = e.target.value;
                          setVerificationInputs(newInputs);
                          setVerificationError('');
                        }}
                        placeholder="Enter name, student ID, or UniKey"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                  {verificationError && (
                    <div className="text-red-500 text-sm">
                      {verificationError}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end space-x-2 p-4 border-t">
              <Button variant="outline" onClick={closeVerificationModal}>
                Cancel
              </Button>
              <Button onClick={handleVerifyMembers}>
                Verify & Add Group
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardShadcn;
