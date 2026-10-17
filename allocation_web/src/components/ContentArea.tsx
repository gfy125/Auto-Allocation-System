import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ContentArea.css';
import { deleteGroup, type Group, getFilledStudentCount, getFilledStudents } from '../utils/groupUtils';
import { deleteGroup as deleteGroupApi, getGroupByName, type GroupApiData } from '../api/groupApi';


interface ContentAreaProps {
  sidebarCompact: boolean;
  sidebarShowLabels: boolean;
}

const ContentArea: React.FC<ContentAreaProps> = ({ sidebarCompact, sidebarShowLabels }) => {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [groupToPreview, setGroupToPreview] = useState<Group | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [fetchedPreviewGroup, setFetchedPreviewGroup] = useState<GroupApiData | null>(null);
  const [showDraftWarningModal, setShowDraftWarningModal] = useState(false);
  const [draftGroup, setDraftGroup] = useState<Group | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [groupForResult, setGroupForResult] = useState<Group | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string>('');
  const [fetchedGroup, setFetchedGroup] = useState<GroupApiData | null>(null);
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
  
  // remove expand/collapse logic, use image card layout

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
      formData: {} // store form data
    };
    
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));
    
    // navigate to edit page, pass group ID
    navigate(`/student_classic/new_group/${newGroup.id}`);
  };

  // edit group function
  const handleEditGroup = (groupId: number) => {
    const g = groups.find(gr => gr.id === groupId);
    if (g) {
      // Draft groups should open the new_group route to continue filling from localStorage
      if (g.status === 'draft') {
        navigate(`/student_classic/new_group/${groupId}`);
      } else {
        navigate(`/student_classic/edit_group/${groupId}`);
      }
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
        await deleteGroupApi(groupToDelete.name);
        canDeleteLocal = true;
      } catch (error: any) {
        // Check if it's a 404/not found error - if so, delete locally since backend doesn't have it
        if (error?.message?.includes('404') || error?.message?.includes('not found') || error?.message?.includes('Not Found')) {
          console.log('Group not found in backend, deleting local copy');
          canDeleteLocal = true;
        } else {
          console.warn('Backend delete failed; preserving local copy:', error);
          canDeleteLocal = false;
          setDeleteErrorMessage(error?.message || 'Failed to delete group from backend');
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
          console.log('Local delete operation failed:', error);
          setShowDeleteModal(false);
          setGroupToDelete(null);
        }
      );
    } else {
      // close modal without deleting locally
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
    setFetchedPreviewGroup(null);
    setPreviewError('');
    setPreviewLoading(true);
    setShowPreviewModal(true);
    try {
      const data = await getGroupByName(group.name || group.formData?.groupName || '');
      setFetchedPreviewGroup(data);
      // Sync localStorage with backend data for preview
      try {
        const savedRaw = localStorage.getItem('createdGroups');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          const mappedName = (data as any).GroupName || (data as any).groupName || (group.name || '');
          const membersArr = Array.isArray(data.members) ? data.members : [];
          const memberCount = membersArr.length;
          const prefs = Array.isArray(data.preferences) ? data.preferences : [];
          const studentStrings: string[] = [];
          for (let i = 0; i < 7; i++) {
            const m = membersArr[i];
            studentStrings[i] = m ? `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}` : '';
          }
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
          const updated = saved.map((g: any) => (
            g.id === group.id
              ? {
                  ...g,
                  name: mappedName,
                  members: memberCount,
                  status: g.status || 'completed',
                  allocated_project: (data as any).allocated_project || g.allocated_project,
                  formData: newFormData
                }
              : g
          ));
          localStorage.setItem('createdGroups', JSON.stringify(updated));
        }
      } catch (_) {}
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to load group details');
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

  // view allocation result
  const handleViewResult = async (group: Group) => {
    if (group.status !== 'completed') return;
    setGroupForResult(group);
    setFetchedGroup(null);
    setResultError('');
    setResultLoading(true);
    setShowResultModal(true);
    try {
      const data = await getGroupByName(group.name || group.formData?.groupName || '');
      setFetchedGroup(data);
      // Sync localStorage with backend data
      try {
        const savedRaw = localStorage.getItem('createdGroups');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          const mappedName = (data as any).GroupName || (data as any).groupName || (group.name || '');
          const membersArr = Array.isArray(data.members) ? data.members : [];
          const memberCount = membersArr.length;
          const prefs = Array.isArray(data.preferences) ? data.preferences : [];
          const studentStrings: string[] = [];
          for (let i = 0; i < 7; i++) {
            const m = membersArr[i];
            studentStrings[i] = m ? `${m.StudentName || ''}, ${m.StudentID || ''}, ${m.UniKey || ''}, ${m.UnitOfStudy || ''}` : '';
          }
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
          const updated = saved.map((g: any) => (
            g.id === group.id
              ? {
                  ...g,
                  name: mappedName,
                  members: memberCount,
                  status: 'completed',
                  allocated_project: (data as any).allocated_project || g.allocated_project,
                  formData: newFormData
                }
              : g
          ));
          localStorage.setItem('createdGroups', JSON.stringify(updated));
        }
      } catch (_) {}
    } catch (err: any) {
      // Check if error is "group not found" and update status to draft
      if (err?.message?.includes('not found') || err?.message?.includes('GROUP_NOT_FOUND')) {
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
      setResultError(err?.message || 'Failed to load group details');
    } finally {
      setResultLoading(false);
    }
  };

  // close allocation result modal
  const closeResultModal = () => {
    setShowResultModal(false);
    setGroupForResult(null);
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

  



  // get created groups data from localStorage
  const [groups, setGroups] = useState<Group[]>(() => {
    const savedGroups = localStorage.getItem('createdGroups');
    return savedGroups ? JSON.parse(savedGroups) : [];
  });

 

  // listen to localStorage change
  useEffect(() => {
    const handleStorageChange = () => {
      const savedGroups = localStorage.getItem('createdGroups');
      if (savedGroups) {
        setGroups(JSON.parse(savedGroups));
      }
    };

    // listen to temporary storage change, update draft status group name
    const checkTempStorage = () => {
      const tempData = localStorage.getItem('newGroupFormTemp');
      if (tempData) {
        try {
          const parsedData = JSON.parse(tempData);
          if (parsedData.groupName) {
            // update draft status group name
            setGroups(prevGroups => {
              const updatedGroups = prevGroups.map(group => {
                if (group.status === 'draft' && !group.formData.groupName) {
                  return {
                    ...group,
                    name: parsedData.groupName
                  };
                }
                return group;
              });
              
              // save updated groups to localStorage
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

    // check temporary storage periodically
    const intervalId = setInterval(checkTempStorage, 1000);

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
      <div className="content-header">
        <div className="header-left">
          <h1>Allocation Management System</h1>
        </div>
        <div className="header-right">
          <div className="search-container" style={{ marginRight: '15px' }}>
            <input
              type="text"
              placeholder="Search group by name..."
              value={searchTerm}
              onChange={handleSearchInputChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchGroup()}
              disabled={searchLoading}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '200px',
                opacity: searchLoading ? 0.6 : 1
              }}
            />
            {searchError && (
              <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                {searchError}
              </div>
            )}
          </div>
          <button
            className="btn btn-success"
            onClick={handleNewGroup}
          >
            + New Group
          </button>
        </div>
      </div>

      <div className="content-body">
        {/* use the same style structure as Admin project card */}
        <div className="projects-grid">
          {groups.length === 0 ? (
            <div className="no-groups">
              <p>No groups created yet. Click "+ New Group" to create your first group!</p>
            </div>
          ) : (
            groups.map((group: Group) => (
              <div
                key={group.id}
                className={`project-card ${group.status === 'draft' ? 'draft' : 'completed'}`}
              >
                <div className="project-header">
                  <h3 className="project-title">{group.name}</h3>
                  <div className="project-status">
                    {group.status === 'draft' ? ' Draft' : ' Complete'}
                  </div>
                </div>
                <div className="project-content">
                  <p className="project-id">Group ID: {group.id}</p>
                  <p className="project-client">Course: {group.name.substring(0, 8)}</p>
                  <p className="project-groups">Members: {getFilledStudentCount(group)}</p>
                  <p className="project-created">Created: {group.createdAt}</p>
                  <div className="project-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {group.status === 'completed' && (
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => handleViewResult(group)}
                        style={{ marginRight: '8px', padding: '2px 6px', fontSize: '12px', lineHeight: 1.2 }}
                      >
                         View Result
                      </button>
                    )}
                    <span
                      className="action-icon"
                      onClick={() => handleEditGroup(group.id)}
                      title="Edit Group"
                      style={{ fontSize: '14px', cursor: 'pointer' }}
                    >
                      ✏️
                    </span>
                    <span 
                      className="action-icon" 
                      title="View Details"
                      onClick={() => handlePreviewGroup(group)}
                      style={{ cursor: 'pointer', fontSize: '14px' }}
                    >
                      👥
                    </span>
                    <span
                      className="action-icon"
                      onClick={() => handleDeleteGroup(group.id)}
                      title="Delete Group"
                      style={{ fontSize: '14px', cursor: 'pointer' }}
                    >
                      🗑️
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* delete confirmation modal */}
      {showDeleteModal && groupToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3> Delete Group</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete group "{groupToDelete.name}"? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                 Delete
              </button>
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

      {/* preview modal */}
      {showPreviewModal && groupToPreview && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header">
              <h3>👥 Group Details</h3>
              
              <button className="close-btn" onClick={closePreview}>×</button>
            </div>
            {previewLoading && (
                    <div className="info-item full-width">
                      <span className="label">Loading:</span>
                      <span className="value">Fetching group details...</span>
                    </div>
                  )}
                  {previewError && (
                    <div className="info-item full-width">
                      <span className="label">Error:</span>
                      <span className="value">{previewError}</span>
                    </div>
                  )}
                  {previewError && (
                    <div className="info-item full-width">
                      <span className="label">Notice:</span>
                      <span className="value">Backend fetch failed. Showing local data snapshot.</span>
                    </div>
                  )}
            <div className="modal-body preview-body">
              <div className="preview-section">
                <h4> Basic Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Group ID:</span>
                    <span className="value">{groupToPreview.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Group Name:</span>
                    <span className="value">{groupToPreview.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Course:</span>
                    <span className="value">{groupToPreview.formData?.course || 'COMP3888'}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Status:</span>
                    <span className={`value status ${groupToPreview.status}`}>
                      {groupToPreview.status === 'draft' ? ' Draft' : ' Completed'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Created:</span>
                    <span className="value">{groupToPreview.createdAt}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Members Count:</span>
                    <span className="value">{getFilledStudentCount(groupToPreview)}</span>
                  </div>
                  
                </div>
              </div>

              <div className="preview-section">
                <h4>👨‍🎓 Members</h4>
                <div className="members-list">
                  {fetchedPreviewGroup && Array.isArray(fetchedPreviewGroup.members) && fetchedPreviewGroup.members.length > 0
                    ? fetchedPreviewGroup.members.map((m, idx) => (
                        <div key={idx} className="member-item">
                          <span className="member-number">{idx + 1}.</span>
                          <span className="member-name" title={m.StudentName}>{m.StudentName} ({m.StudentID})</span>
                        </div>
                      ))
                    : (
                      getFilledStudents(groupToPreview).length > 0 ? (
                        getFilledStudents(groupToPreview).map((student, index) => (
                          <div key={index} className="member-item">
                            <span className="member-number">{index + 1}.</span>
                            <span className="member-name" title={student}>{student}</span>
                          </div>
                        ))
                      ) : (
                        <p className="no-members">No members added yet</p>
                      )
                    )}
                </div>
              </div>

              {groupToPreview.formData && (
                <>
                  {/* Project Preferences */}
                  {(groupToPreview.formData.preference1 || groupToPreview.formData.preference2 || 
                    groupToPreview.formData.preference3 || groupToPreview.formData.preference4 || 
                    groupToPreview.formData.preference5) && (
                    <div className="preview-section">
                      <h4> Project Preferences</h4>
                      <div className="info-grid">
                        {[1, 2, 3, 4, 5].map(num => {
                          const preference = groupToPreview.formData?.[`preference${num}` as keyof typeof groupToPreview.formData] as string;
                          return preference ? (
                            <div key={num} className="info-item">
                              <span className="label">{num}{num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Preference:</span>
                              <span className="value">{preference}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* WAM Statistics */}
                  {(groupToPreview.formData.wamHD || groupToPreview.formData.wamD || 
                    groupToPreview.formData.wamCR || groupToPreview.formData.wamP) && (
                    <div className="preview-section">
                      <h4>📊 WAM Statistics</h4>
                      <div className="info-grid">
                        {groupToPreview.formData.wamHD && (
                          <div className="info-item">
                            <span className="label">HD (≥85):</span>
                            <span className="value">{groupToPreview.formData.wamHD}</span>
                          </div>
                        )}
                        {groupToPreview.formData.wamD && (
                          <div className="info-item">
                            <span className="label">D (≥75 and &lt;85):</span>
                            <span className="value">{groupToPreview.formData.wamD}</span>
                          </div>
                        )}
                        {groupToPreview.formData.wamCR && (
                          <div className="info-item">
                            <span className="label">CR (≥65 and &lt;75):</span>
                            <span className="value">{groupToPreview.formData.wamCR}</span>
                          </div>
                        )}
                        {groupToPreview.formData.wamP && (
                          <div className="info-item">
                            <span className="label">P (≥50 and &lt;65):</span>
                            <span className="value">{groupToPreview.formData.wamP}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  {(groupToPreview.formData.description || groupToPreview.formData.finishTime || groupToPreview.formData.preferences) && (
                    <div className="preview-section">
                      <h4> Additional Information</h4>
                      <div className="info-grid">
                        {groupToPreview.formData.description && (
                          <div className="info-item full-width">
                            <span className="label">Description:</span>
                            <span className="value">{groupToPreview.formData.description}</span>
                          </div>
                        )}
                        {groupToPreview.formData.finishTime && (
                          <div className="info-item">
                            <span className="label">Finish Time:</span>
                            <span className="value">{groupToPreview.formData.finishTime}</span>
                          </div>
                        )}
                        {groupToPreview.formData.preferences && (
                          <div className="info-item full-width">
                            <span className="label">Preferences:</span>
                            <span className="value">{groupToPreview.formData.preferences}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closePreview}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* draft warning modal */}
      {showDraftWarningModal && draftGroup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>⚠️ Draft Group Warning</h3>
            </div>
            <div className="modal-body">
              <p>You have an unfinished draft group "{draftGroup.name}". Please complete or delete it before creating a new group.</p>
              <div className="draft-group-info">
                <p><strong>Group ID:</strong> {draftGroup.id}</p>
                <p><strong>Created:</strong> {draftGroup.createdAt}</p>
                <p><strong>Status:</strong> <span className="status-draft"> Draft</span></p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeDraftWarning}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={editDraftGroup}>
                 Edit Draft
              </button>
              <button className="btn btn-danger" onClick={deleteDraftGroup}>
                 Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* allocation result modal */}
      {showResultModal && groupForResult && (
        <div className="modal-overlay">
          <div className="modal-content result-modal">
            
            <div className="modal-header">
              <h3>📊 Allocation Result</h3>
            </div>
            {resultLoading && (
                    <div className="info-item full-width">
                      <span className="label">Loading:</span>
                      <span className="value">Fetching allocation details...</span>
                    </div>
                  )}
                  {resultError && (
                    <div className="info-item full-width">
                      <span className="label">Error:</span>
                      <span className="value">{resultError}</span>
                    </div>
                  )}
                  {resultError && (
                    <div className="info-item full-width">
                      <span className="label">Notice:</span>
                      <span className="value">Backend fetch failed. Showing local data snapshot.</span>
                    </div>
                  )}
            <div className="modal-body">
              <div className="preview-section">
                <h4>📋 Group Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Group ID:</span>
                    <span className="value">{groupForResult.id}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Group Name:</span>
                    <span className="value">{groupForResult.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Status:</span>
                    <span className="value status completed">✅ Completed</span>
                  </div>
                  
                </div>
              </div>

              <div className="preview-section">
                <h4>👨‍🎓 Members</h4>
                <div className="members-list">
                  {fetchedGroup && Array.isArray(fetchedGroup.members) && fetchedGroup.members.length > 0
                    ? fetchedGroup.members.map((m, idx) => (
                        <div key={idx} className="member-item">
                          <span className="member-number">{idx + 1}.</span>
                          <span className="member-name" title={m.StudentName}>{m.StudentName} ({m.StudentID})</span>
                        </div>
                      ))
                    : (
                      getFilledStudents(groupForResult).length > 0 ? (
                        getFilledStudents(groupForResult).map((student, index) => (
                          <div key={index} className="member-item">
                            <span className="member-number">{index + 1}.</span>
                            <span className="member-name" title={student}>{student}</span>
                          </div>
                        ))
                      ) : (
                        <p className="no-members">No members found</p>
                      )
                    )}
                </div>
              </div>

              <div className="preview-section">
                <h4>🎯 Allocation Result</h4>
                <div className="info-grid">
                  <div className="info-item full-width">
                    <span className="label">Enrolled Project:</span>
                    <span className="value">{fetchedGroup?.allocated_project || 'N/A'}</span>
                  </div>
                  <div className="info-item full-width">
                    <span className="label">Allocation Status:</span>
                    <span className="value">{fetchedGroup ? 'Fetched from backend' : 'Pending Backend Implementation'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeResultModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group verification modal */}
      {showVerificationModal && searchedGroup && (
        <div className="modal-overlay">
          <div className="modal-content verification-modal">
            <div className="modal-header">
              <h3>🔍 Group Verification</h3>
              <button className="close-btn" onClick={closeVerificationModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="preview-section">
                <h4>🔐 Member Verification</h4>
                <p style={{ marginBottom: '15px', color: '#666' }}>
                  Please enter information for 3 group members to verify your identity. 
                  You can enter their name, student ID, or UniKey.
                </p>
                {[1, 2, 3].map((num) => (
                  <div key={num} style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                      Member {num}:
                    </label>
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
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                ))}
                {verificationError && (
                  <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
                    {verificationError}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeVerificationModal}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleVerifyMembers}>
                Verify & Add Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentArea;
