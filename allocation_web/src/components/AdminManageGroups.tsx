import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { getAllGroups, deleteGroup, addSTUtoGroup, deleteSTUfromGroup, type GroupApiData, type MemberData } from '../api/groupApi';
import DeleteConfirmModal from './DeleteConfirmModal';

interface AdminManageGroupsProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

const AdminManageGroups: React.FC<AdminManageGroupsProps> = ({ userRole, onLogout, username }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);
  const [groups, setGroups] = useState<GroupApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyReason, setEmptyReason] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<GroupApiData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupApiData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTopError, setDeleteTopError] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{member: any, grade: string} | null>(null);
  const [newMemberData, setNewMemberData] = useState<Partial<MemberData>>({
    StudentName: '',
    StudentID: '',
    UniKey: '',
    UnitOfStudy: '',
    Grade: 'HD'
  });
  const [memberError, setMemberError] = useState('');

  // 获取所有组数据（可复用：首屏和刷新按钮）
  const fetchGroups = React.useCallback(async () => {
    try {
      setLoading(true);
      setEmptyReason('');
      const groupsData = await getAllGroups();
      
      // 确保 groupsData 是数组，如果不是则设置为空数组
      if (Array.isArray(groupsData)) {
        setGroups(groupsData);
        if (groupsData.length === 0) {
          setEmptyReason('No groups have been created yet.');
        }
      } else {
        console.warn('API returned non-array data:', groupsData);
        setGroups([]);
        setEmptyReason('Server returned invalid data format. Please check backend implementation.');
      }
    } catch (err: any) {
      console.warn('Failed to fetch groups:', err.message);
      setGroups([]);
      
      // 根据错误类型设置不同的空状态原因
      if (err.message.includes('503') || err.message.includes('Service Unavailable')) {
        setEmptyReason('Backend server is not running. Please ensure the backend server is started.');
      } else if (err.message.includes('Failed to fetch')) {
        setEmptyReason('Cannot connect to backend server. Please check if the server is running.');
      } else if (err.message.includes('404')) {
        setEmptyReason('Groups API endpoint not found. Backend may not have implemented GET /api/groups yet.');
      } else {
        setEmptyReason(`Failed to load groups: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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

  // 处理预览组信息
  const handlePreviewGroup = (group: GroupApiData) => {
    setSelectedGroup(group);
    setShowPreviewModal(true);
  };

  // 处理删除组
  const handleDeleteGroup = (groupId: number) => {
    const group = groups.find(g => g.GroupID === groupId);
    if (group) {
      setGroupToDelete(group);
      setShowDeleteModal(true);
      setDeleteTopError('');
    }
  };

  // 确认删除组
  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;

    setIsDeleting(true);
    try {
      await deleteGroup(groupToDelete.GroupName);
      // 重新获取组列表
      const groupsData = await getAllGroups();
      if (Array.isArray(groupsData)) {
        setGroups(groupsData);
      } else {
        setGroups([]);
      }
      setShowDeleteModal(false);
      setGroupToDelete(null);
      setDeleteTopError('');
    } catch (err: any) {
      const is409 = err?.message?.includes('409') || err?.message?.includes('ALLOCATION_RESULTS_GENERATED');
      if (is409) {
        setDeleteTopError('Delete Failed (409): Allocation results generated. Cannot delete this group.');
        // keep modal open so admin sees error
      } else {
        console.warn('Failed to delete group:', err?.message);
        // close modal for non-409 errors
        setShowDeleteModal(false);
        setGroupToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // 关闭模态框
  const closeModals = () => {
    setShowPreviewModal(false);
    setShowDeleteModal(false);
    setShowAddMemberModal(false);
    setShowDeleteMemberModal(false);
    setSelectedGroup(null);
    setGroupToDelete(null);
    setMemberToDelete(null);
    setNewMemberData({
      StudentName: '',
      StudentID: '',
      UniKey: '',
      UnitOfStudy: '',
      Grade: 'HD'
    });
    setMemberError('');
  };

  // Handle adding a new member
  const handleAddMember = async () => {
    if (!selectedGroup) return;

    try {
      setMemberError('');
      if (!newMemberData.StudentName || !newMemberData.StudentID || !newMemberData.UniKey || !newMemberData.UnitOfStudy) {
        setMemberError('All fields are required');
        return;
      }

      await addSTUtoGroup(selectedGroup.GroupName, newMemberData as MemberData);
      const groupsData = await getAllGroups();
      if (Array.isArray(groupsData)) {
        setGroups(groupsData);
        // Update the selected group with new data
        const updatedGroup = groupsData.find(g => g.GroupID === selectedGroup.GroupID);
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }
      setShowAddMemberModal(false);
      setNewMemberData({
        StudentName: '',
        StudentID: '',
        UniKey: '',
        UnitOfStudy: '',
        Grade: 'HD'
      });
    } catch (err: any) {
      setMemberError(err.message);
    }
  };

  // Handle deleting a member
  const handleDeleteMember = async () => {
    if (!selectedGroup || !memberToDelete) return;

    try {
      setMemberError('');
      await deleteSTUfromGroup(selectedGroup.GroupName, {
        ...memberToDelete.member,
        Grade: memberToDelete.grade
      } as MemberData);
      const groupsData = await getAllGroups();
      if (Array.isArray(groupsData)) {
        setGroups(groupsData);
        // Update the selected group with new data
        const updatedGroup = groupsData.find(g => g.GroupID === selectedGroup.GroupID);
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }
      setShowDeleteMemberModal(false);
      setMemberToDelete(null);
    } catch (err: any) {
      // 处理特定的错误消息
      if (err.message.includes('Cannot decrease') && err.message.includes('count is already 0')) {
        // 从错误消息中提取具体的成绩类型
        const gradeMatch = err.message.match(/NumStudents(HD|D|CR|P)/);
        if (gradeMatch) {
          const grade = gradeMatch[1];
          setMemberError(`Cannot remove member: There are no ${grade} grade students in this group.`);
        } else {
          setMemberError('Cannot remove member: The grade count is already 0.');
        }
      } else if (err.message.includes('HTTP 500')) {
        // 如果是其他500错误，尝试从响应中获取具体错误信息
        try {
          const errorData = JSON.parse(err.message.split('HTTP 500:')[1]);
          if (errorData.error && typeof errorData.error === 'string') {
            setMemberError(errorData.error);
          } else {
            setMemberError('Failed to remove member. Please try again.');
          }
        } catch {
          setMemberError('Failed to remove member. Please try again.');
        }
      } else {
        setMemberError(err.message);
      }
    }
  };

  // 取消删除
  const cancelDeleteGroup = () => {
    setShowDeleteModal(false);
    setGroupToDelete(null);
    setDeleteTopError('');
  };

  return (
    <div className="app">
      <Sidebar onLogout={onLogout} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        {deleteTopError && (
          <div style={{ position: 'fixed', top: 16, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', maxWidth: 720, width: 'calc(100% - 32px)', boxShadow: '0 6px 24px rgba(0,0,0,0.15)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>Delete Failed</span>
              <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{deleteTopError}</span>
              <button onClick={() => setDeleteTopError('')} style={{ background: 'transparent', border: 0, color: '#991b1b', cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        )}
        <div className="content-header">
          <div className="header-left">
            <h1>Manage Groups</h1>
          </div>
        </div>
        <div className="content-body">
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading groups...</p>
            </div>
          )}

          {!loading && (
            <div className="groups-container">
              <div className="groups-header">
                <h2>All Groups ({groups.length})</h2>
                <button 
                  className="refresh-button"
                  onClick={fetchGroups}
                >
                  Refresh
                </button>
              </div>

              {!Array.isArray(groups) || groups.length === 0 ? (
                <div className="no-groups">
                  <h3>No Groups Found</h3>
                  <p className="empty-reason">{emptyReason || 'No groups available.'}</p>
                  {emptyReason.includes('server') || emptyReason.includes('backend') ? (
                    <div className="empty-actions">
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="groups-grid">
                  {groups.map((group, index) => (
                    <div key={index} className="group-card">
                      <div className="group-card-header">
                        <h3>{group.GroupName}</h3>
                        <div className="group-actions">
                          <button 
                            className="preview-button"
                            onClick={() => handlePreviewGroup(group)}
                            title="Preview Group Details"
                          >
                            👁️
                          </button>
                          <button 
                            className="delete-button"
                            onClick={() => handleDeleteGroup(group.GroupID)}
                            title="Delete Group"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="group-card-content">
                        <div className="group-info">
                          <div className="info-item">
                            <span className="label">Members:</span>
                            <span className="value numeric">
                              {group.members ? group.members.length : 0}
                            </span>
                          </div>
                          
                          <div className="info-item">
                            <span className="label">Preferences:</span>
                            <span className="value text-content">
                              {group.preferences && group.preferences.length > 0 
                                ? group.preferences.map(pref => {
                                    // 确保P大写，如果已经是P开头就保持原样，否则添加P前缀
                                    if (pref.toLowerCase().startsWith('p')) {
                                      return 'P' + pref.slice(1);
                                    } else {
                                      return 'P' + pref;
                                    }
                                  }).join(', ')
                                : 'None'
                              }
                            </span>
                          </div>

                          {group.GroupDescription && (
                            <div className="info-item">
                              <span className="label">Description:</span>
                              <span className="value description">
                                {group.GroupDescription.length > 50 
                                  ? `${group.GroupDescription.substring(0, 50)}...` 
                                  : group.GroupDescription
                                }
                              </span>
                            </div>
                          )}

                          {group.allocated_project && (
                            <div className="info-item">
                              <span className="label">Allocated Project:</span>
                              <span className="value text-content">{group.allocated_project}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 预览组信息模态框 */}
      {showPreviewModal && selectedGroup && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Group Details: {selectedGroup.GroupName}</h2>
              <button className="close-button" onClick={closeModals}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="group-details">
                <div className="detail-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>Members</h3>
                    <button 
                      onClick={() => setShowAddMemberModal(true)}
                      style={{ 
                        padding: '4px 12px',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Add Member
                    </button>
                  </div>
                  <div className="members-list">
                    {selectedGroup.members && selectedGroup.members.length > 0 ? (
                      selectedGroup.members.map((member, index) => (
                        <div key={index} className="member-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <span className="member-number">{index + 1}.</span>
                            <span className="member-name">{member.StudentName} ({member.StudentID})</span>
                            <span style={{ marginLeft: '8px', color: '#666' }}>
                              {member.UniKey} - {member.UnitOfStudy}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setMemberToDelete({ member, grade: 'HD' });
                              setShowDeleteMemberModal(true);
                            }}
                            style={{ 
                              padding: '2px 8px',
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="no-members">No members found</p>
                    )}
                  </div>
                </div>

                {/* Add Member Modal */}
                {showAddMemberModal && (
                  <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" style={{ position: 'relative', background: 'white', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                      <h3>Add New Member</h3>
                      {memberError && (
                        <div style={{ color: '#dc3545', marginBottom: '10px' }}>{memberError}</div>
                      )}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
                          <input
                          type="text"
                          value={newMemberData.StudentName}
                          onChange={(e) => setNewMemberData({ ...newMemberData, StudentName: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Student ID:</label>
                          <input
                          type="text"
                          value={newMemberData.StudentID}
                          onChange={(e) => setNewMemberData({ ...newMemberData, StudentID: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>UniKey:</label>
                          <input
                          type="text"
                          value={newMemberData.UniKey}
                          onChange={(e) => setNewMemberData({ ...newMemberData, UniKey: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Unit of Study:</label>
                          <input
                          type="text"
                          value={newMemberData.UnitOfStudy}
                          onChange={(e) => setNewMemberData({ ...newMemberData, UnitOfStudy: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Grade:</label>
                        <select
                          value={newMemberData.Grade}
                          onChange={(e) => setNewMemberData({ ...newMemberData, Grade: e.target.value as 'HD' | 'D' | 'CR' | 'PS' })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#fff'
                          }}
                        >
                          <option value="HD">HD (85+)</option>
                          <option value="D">D (75-84)</option>
                          <option value="CR">CR (65-74)</option>
                          <option value="PS">PS (50-64)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => setShowAddMemberModal(false)}
                          style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddMember}
                          style={{ padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Member Modal */}
                {showDeleteMemberModal && memberToDelete && (
                  <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content" style={{ position: 'relative', background: 'white', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                      <h3>Remove Member</h3>
                      {memberError && (
                        <div style={{ color: '#dc3545', marginBottom: '10px' }}>{memberError}</div>
                      )}
                      <p>Are you sure you want to remove {memberToDelete.member.StudentName}?</p>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Select member's grade:</label>
                        <select
                          value={memberToDelete.grade}
                          onChange={(e) => setMemberToDelete({ ...memberToDelete, grade: e.target.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#fff'
                          }}
                        >
                          <option value="HD">HD (85+)</option>
                          <option value="D">D (75-84)</option>
                          <option value="CR">CR (65-74)</option>
                          <option value="PS">PS (50-64)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setShowDeleteMemberModal(false);
                            setMemberToDelete(null);
                          }}
                          style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteMember}
                          style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Project Preferences</h3>
                  <div className="preferences-list">
                    {selectedGroup.preferences && selectedGroup.preferences.length > 0 ? (
                      selectedGroup.preferences.map((pref, index) => (
                        <div key={index} className="preference-item">
                          <span className="preference-number">{index + 1}.</span>
                          <span className="preference-name">{pref}</span>
                        </div>
                      ))
                    ) : (
                      <p className="no-preferences">No preferences found</p>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>WAM Distribution</h3>
                  <div className="wam-distribution">
                    <div className="wam-item">
                      <span className="wam-label">HD (85+):</span>
                      <span className="wam-value">{selectedGroup.NumStudentsHD || 0}</span>
                    </div>
                    <div className="wam-item">
                      <span className="wam-label">D (75-84):</span>
                      <span className="wam-value">{selectedGroup.NumStudentsD || 0}</span>
                    </div>
                    <div className="wam-item">
                      <span className="wam-label">CR (65-74):</span>
                      <span className="wam-value">{selectedGroup.NumStudentsCR || 0}</span>
                    </div>
                    <div className="wam-item">
                      <span className="wam-label">P (50-64):</span>
                      <span className="wam-value">{selectedGroup.NumStudentsP || 0}</span>
                    </div>
                  </div>
                </div>

                {selectedGroup.GroupDescription && (
                  <div className="detail-section">
                    <h3>Description</h3>
                    <p className="group-description">{selectedGroup.GroupDescription}</p>
                  </div>
                )}

                {selectedGroup.skills && selectedGroup.skills.length > 0 && (
                  <div className="detail-section">
                    <h3>Skills</h3>
                    <div className="skills-list">
                      {selectedGroup.skills.map((skill, index) => (
                        <span key={index} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedGroup.NumStudentsTwoUnitsEnrolled > 0 && (
                  <div className="detail-section">
                    <h3>Dual Enrollment</h3>
                    <p>{selectedGroup.NumStudentsTwoUnitsEnrolled} students enrolled in two units</p>
                  </div>
                )}

                {(selectedGroup.startTime || selectedGroup.finishTime) && (
                  <div className="detail-section">
                    <h3>Time Preferences</h3>
                    <div className="time-preferences">
                      {selectedGroup.startTime && (
                        <div className="time-item">
                          <span className="time-label">Start Time:</span>
                          <span className="time-value">{selectedGroup.startTime}</span>
                        </div>
                      )}
                      {selectedGroup.finishTime && (
                        <div className="time-item">
                          <span className="time-label">Finish Time:</span>
                          <span className="time-value">{selectedGroup.finishTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="close-modal-button" onClick={closeModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {showDeleteModal && groupToDelete && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={cancelDeleteGroup}
          onConfirm={confirmDeleteGroup}
          projectName={groupToDelete.GroupName}
          projectId={groupToDelete.GroupID.toString()}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default AdminManageGroups;
