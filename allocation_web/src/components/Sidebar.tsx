import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import logoUni from '../assets/logo_uni.png';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import { logoutUser, clearCurrentUser, changePassword } from '../api';
import type { ChangePasswordRequest } from '../api';

interface SidebarProps {
  onLogout: () => void;
  userRole: 'admin' | 'student';
  username?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, userRole, username }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // dynamic favicon hook
  useDynamicFavicon();
  
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  const sidebarRef = useRef<HTMLDivElement>(null);

  // function to set active section based on current path
  const setActiveSectionFromPath = (path: string) => {
    if (path === '/student_classic' || path === '/admin') {
      setActiveSection('dashboard');
    } else if (path === '/student_classic/projects') {
      setActiveSection('projects');
    } else if (path.startsWith('/student_classic/new_group')) {
      setActiveSection('dashboard');  // Change to dashboard or other appropriate option
    } else if (path.startsWith('/admin/new_project')) {
      // Keep Dashboard highlighted on new/edit project pages
      setActiveSection('dashboard');
    } else if (path.startsWith('/student_classic/projects')) {
      setActiveSection('projects');
    } else if (path.startsWith('/admin/allocation_system')) {
      setActiveSection('allocation');
    } else if (path.startsWith('/admin/manage_groups')) {
      setActiveSection('groups');
    } else if (path.startsWith('/admin/reports_analytics')) {
      setActiveSection('reports');
    } else if (path.startsWith('/admin/admin_settings')) {
      setActiveSection('settings');
    } else {
      // Only set to info when explicitly not a home page path
      // If it's a home page path, should keep dashboard
      if (path === '/student_classic' || path === '/admin') {
        setActiveSection('dashboard');
      } else {
        setActiveSection('info');
      }
    }
  };

  // set active section based on current path
  useEffect(() => {
    setActiveSectionFromPath(window.location.pathname);
  }, []);

  // listen to path change
  useEffect(() => {
    setActiveSectionFromPath(location.pathname);
  }, [location.pathname]);

  const menuItems = userRole === 'admin' ? [
    { 
      id: 'info', 
      label: 'Information', 
      icon: 'ℹ️', 
      type: 'expand-panel',
      content: 'System Information and Help'
    },
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '🏠', 
      type: 'dashboard',
      content: 'Main Dashboard'
    },
    { 
      id: 'allocation', 
      label: 'Allocation System', 
      icon: '📊', 
      type: 'navigate',
      content: 'Project allocation and assignments',
      route: '/admin/allocation_system'
    },
    { 
      id: 'groups', 
      label: 'Manage Groups', 
      icon: '👥', 
      type: 'navigate',
      content: 'View and manage groups',
      route: '/admin/manage_groups'
    },
    
    { 
      id: 'reports', 
      label: 'Reports & Analytics', 
      icon: '📈', 
      type: 'navigate',
      content: 'View reports and analytics',
      route: '/admin/reports_analytics'
    },
    { 
      id: 'settings', 
      label: 'System Settings', 
      icon: '⚙️', 
      type: 'navigate',
      content: 'Configure system settings',
      route: '/admin/admin_settings'
    }
  ] : [
    { 
      id: 'info', 
      label: 'Information', 
      icon: 'ℹ️', 
      type: 'expand-panel',
      content: 'System Information and Help'
    },
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '📊', 
      type: 'dashboard',
      content: 'Overview and Statistics'
    },
    { 
      id: 'projects', 
      label: 'Projects', 
      icon: '📋', 
      type: 'navigate',
      content: 'View available projects',
      route: '/student_classic/projects'
    }
  ];

  // click outside automatically close sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const sidebar = sidebarRef.current;
      const expandedPanelElement = document.querySelector('.sidebar-panel-container');
      
      // check if clicked outside sidebar or expanded panel
      const isOutsideSidebar = sidebar && !sidebar.contains(target);
      const isOutsideExpandedPanel = expandedPanelElement && !expandedPanelElement.contains(target);
      
      if (isOutsideSidebar && isOutsideExpandedPanel) {
        // if clicked outside sidebar and expanded panel, close all expanded content
        console.log('Clicking outside, closing expanded panel'); // debug info
        setActiveSection('dashboard'); // keep dashboard active
        closeExpandedPanel(true); // immediately close
        setIsCompact(true);
        setShowLabels(false); // close labels, back to compact mode
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedPanel]); // add expandedPanel as dependency

  // function to close expanded panel
  const closeExpandedPanel = (immediate: boolean = false) => {
    if (expandedPanel) {
      if (immediate) {
        // immediately close, but use fast animation
        setIsClosing(true);
        setTimeout(() => {
          setExpandedPanel(null);
          setIsClosing(false);
        }, 300); // fast animation, 150ms
      } else {
        // use normal animation to close
        setIsClosing(true);
        setTimeout(() => {
          setExpandedPanel(null);
          setIsClosing(false);
        }, 500); // normal animation duration
      }
    }
  };

  // toggle display mode
  const toggleDisplayMode = () => {
    setShowLabels(!showLabels);
  };

  // student style switcher (admin removed)
  const handleStyleSwitch = () => {
    if (userRole === 'admin') return;
    const isModern = location.pathname.includes('student_modern');
    navigate(isModern ? '/student_classic' : '/student_modern');
  };

  // handle logout with API call
  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...');
      
      // Call logout API
      await logoutUser();
      
      // Clear local storage
      clearCurrentUser();
      
      // Call parent component's logout handler
      onLogout();
      
      console.log('✅ Logout successful');
      
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      
      // Even if API call fails, clear local data and logout
      clearCurrentUser();
      onLogout();
      
      // Show error message (optional)
      alert('Logout completed with some issues. Please refresh the page if needed.');
    }
  };

  // handle change password input change
  const handleChangePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setChangePasswordData(prev => ({...prev,[name]: value}));
    // clear error message
    if (changePasswordError) setChangePasswordError('');
    if (changePasswordSuccess) setChangePasswordSuccess('');
  };

  // handle change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    try {
      // Validate password match
      if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
        setChangePasswordError('New passwords do not match!');
        return;
      }

      // Validate password length
      if (changePasswordData.newPassword.length < 6) {
        setChangePasswordError('New password must be at least 6 characters long!');
        return;
      }

      const passwordData: ChangePasswordRequest = {
        currentPassword: changePasswordData.currentPassword,
        newPassword: changePasswordData.newPassword,
        confirmPassword: changePasswordData.confirmPassword
      };
      
      const response = await changePassword(passwordData);
      
      if (response.success) {
        setChangePasswordSuccess('Password changed successfully! You will be logged out automatically.');
        setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        
        // Auto logout
        setTimeout(async () => {
          try {
            await logoutUser();
            clearCurrentUser();
            onLogout();
            navigate('/login');
          } catch (error) {
            console.error('Auto logout error:', error);
            clearCurrentUser();
            onLogout();
            navigate('/login');
          }
        }, 2000);
      } else {
        setChangePasswordError('Failed to change password: Invalid response from server.');
      }
      
    } catch (error: any) {
      console.error('Change password error:', error);
      
      // Handle different types of errors
      if (error.message.includes('HTTP 401') && error.message.includes('INVALID_CURRENT_PASSWORD')) {
        setChangePasswordError('Current password is incorrect!');
      } else if (error.message.includes('HTTP 400')) {
        if (error.message.includes('PASSWORD_MISMATCH')) {
          setChangePasswordError('New passwords do not match!');
        } else if (error.message.includes('PASSWORD_TOO_SHORT')) {
          setChangePasswordError('New password must be at least 6 characters long!');
        } else {
          setChangePasswordError('Invalid input: Please check your information.');
        }
      } else if (error.message.includes('HTTP 503')) {
        setChangePasswordError('Service Unavailable: Backend server is not running.');
      } else if (error.message.includes('HTTP 408')) {
        setChangePasswordError('Request Timeout: Please try again.');
      } else if (error.message.includes('HTTP 500')) {
        setChangePasswordError('Internal Server Error: Please contact support if this persists.');
      } else {
        setChangePasswordError(`Change password failed: ${error.message}`);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // close change password modal
  const closeChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setChangePasswordError('');
    setChangePasswordSuccess('');
  };

  const handleItemClick = (itemId: string) => {
    const item = menuItems.find(menuItem => menuItem.id === itemId);
    
    if (item?.type === 'dashboard') {
      // Dashboard is the current home page, no need to expand sidebar
      closeExpandedPanel();
      setIsCompact(true);
      setActiveSection('dashboard'); // Ensure correct active section is set
      
      // redirect to corresponding dashboard based on user role
      if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/student_classic');
      }
    } else if (item?.type === 'expand-panel') {
      // for other projects, expand large sidebar
      if (expandedPanel === itemId) {
        closeExpandedPanel();
        setActiveSection('dashboard'); // Return to dashboard when closing panel
      } else {
        setExpandedPanel(itemId);
        setActiveSection(itemId); // set current active project
      }
      setIsCompact(true); // keep compact mode
    } else if (item?.type === 'navigate' && item.route) {
      // for navigation type projects, redirect directly
      navigate(item.route);
      closeExpandedPanel();
      setIsCompact(true);
      setActiveSection(itemId); // Set correct active section
    }
  };

  const renderExpandedPanel = (itemId: string) => {
    const item = menuItems.find(menuItem => menuItem.id === itemId);
    
    switch (itemId) {
      case 'info':
        return (
          <div className="sidebar-panel">
            <div className="panel-header">
              <h3>{item?.label}</h3>
            </div>
            <div className="panel-content">
              {/* user information area */}
              <div className="user-info-section">
                <div className="user-avatar">
                  <span className="avatar-icon">{userRole === 'admin' ? 'A' : 'S'}</span>
                </div>
                <div className="user-details">
                  <div className="user-role">{userRole === 'admin' ? 'Admin' : 'Student'}</div>
                  <div className="user-name-section">
                    <div className="user-name">
                      <span className="user-name">{userRole === 'admin' ? (username || 'Admin User') : 'Student User'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* style switcher for student only */}
              {userRole !== 'admin' && (
                <div className="style-switcher-section">
                  <div 
                    className={`info-item style-switcher-btn`}
                    onClick={handleStyleSwitch}
                  >
                    <span className="info-icon">🎨</span>
                    <span className="info-text">Style Switcher</span>
                  </div>
                </div>
              )}

              {/* Change Password button - only displayed for admin users */}
              {userRole === 'admin' && (
                <div className="change-password-section">
                  <button 
                    className="change-password-btn"
                    onClick={() => setShowChangePasswordModal(true)}
                    title="Change your password"
                  >
                    <span className="change-password-icon">🔒</span>
                    <span className="change-password-text">Change Password</span>
                  </button>
                </div>
              )}

              {/* Logout button - only displayed for admin users, placed at the bottom */}
              {userRole === 'admin' && (
                <div className="logout-section">
                  <button 
                    className="logout-btn"
                    onClick={handleLogout}
                    title="Logout and return to login page"
                  >
                    <span className="logout-icon">🚪</span>
                    <span className="logout-text">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="sidebar-panel">
            <div className="panel-header">
              <h3>{item?.label}</h3>
            </div>
            <div className="panel-content">
              <p>{item?.content}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className={`sidebar ${isCompact ? 'compact' : ''} ${isCompact && showLabels ? 'show-labels' : ''}`} ref={sidebarRef}>
        <div className="sidebar-header">
          <div className="profile-picture">
            <img src={logoUni} alt="University Logo" />
          </div>
          {!isCompact && <h2>Semester 2 2025</h2>}
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <div className="nav-item-content">
                <span className="nav-icon">{item.icon}</span>
                {(showLabels || !isCompact) && <span className="nav-label">{item.label}</span>}
              </div>
            
            </div>
          ))}
        </nav>
        
        {/* delete user information and logout button, move to information expand panel */}
        
        {/* toggle display mode button */}
        <div className="sidebar-footer">
          <button className="toggle-mode-btn" onClick={toggleDisplayMode}>
            {showLabels ? '⬅️' : '➡️'}
          </button>
        </div>
      </div>
      
      {/* large sidebar panel - now as a sibling element of sidebar */}
      {expandedPanel && (
        <div className={`sidebar-panel-container ${isClosing ? 'closing' : ''}`}>
          {renderExpandedPanel(expandedPanel)}
        </div>
      )}
      
      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={closeChangePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔒 Change Password</h3>
              <button 
                className="modal-close-btn"
                onClick={closeChangePasswordModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleChangePassword} className="change-password-form">
                <div className="form-group">
                  <label htmlFor="current-password">Current Password:</label>
                  <input
                    id="current-password"
                    name="currentPassword"
                    type="password"
                    value={changePasswordData.currentPassword}
                    onChange={handleChangePasswordInputChange}
                    placeholder="Enter current password"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="new-password">New Password:</label>
                  <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    value={changePasswordData.newPassword}
                    onChange={handleChangePasswordInputChange}
                    placeholder="Enter new password (min 6 characters)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-new-password">Confirm New Password:</label>
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type="password"
                    value={changePasswordData.confirmPassword}
                    onChange={handleChangePasswordInputChange}
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                {/* Error message */}
                {changePasswordError && (
                  <div className="error-message">
                    {changePasswordError}
                  </div>
                )}

                {/* Success message */}
                {changePasswordSuccess && (
                  <div className="success-message">
                    {changePasswordSuccess}
                  </div>
                )}

                <div className="modal-actions">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    onClick={closeChangePasswordModal}
                    disabled={isChangingPassword}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Sidebar;
