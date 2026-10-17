import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import DashboardAdmin from './components/DashboardAdmin';
import NewGroupPage from './components/NewGroupPage';
import StudentProjects from './components/StudentProjects';
import StudentProjectsShadcn from './components/StudentProjectsShadcn';
import AdminManageGroups from './components/AdminManageGroups';
import AdminReportsAnalytics from './components/AdminReportsAnalytics';
import AdminSettings from './components/AdminSettings';
import AdminAllocationSystem from './components/AdminAllocationSystem';
import NotFound from './components/NotFound';
import NewProjectPage from './components/NewProjectPage';
import DashboardShadcn from './components/DashboardShadcn';
import NewGroupFormShadcn from './components/NewGroupFormShadcn';
import NewGroupFormShadcnWrapper from './components/NewGroupFormShadcnWrapper';
import './App.css';
import { validateToken } from './api';

type UserRole = 'admin' | 'student' | null;

function App() {
  // App-level role state; admin is determined by backend token validation
  const [userRole, setUserRole] = useState<UserRole>(null);

  const [username, setUsername] = useState<string>('');



  // On load and when tab becomes visible, validate backend token
  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      try {
        const user = await validateToken();
        if (isMounted && user && user.role === 'admin') {
          setUserRole('admin');
          setUsername(user.displayName || user.username || 'Admin User');
        } else if (isMounted) {
          // Not admin or no token
          setUserRole(null);
          setUsername('');
        }
      } catch (_) {
        if (isMounted) {
          setUserRole(null);
          setUsername('');
        }
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        verify();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    verify();

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);


  const handleLogin = (role: 'admin' | 'student', userInputName?: string) => {
    if (role === 'admin') {
      setUserRole('admin');
      setUsername(userInputName || 'Admin User');
      // Do not create any local fake tokens; backend token is already stored by login API
    } else {
      // Keep student pages accessible without backend auth
      setUserRole('student');
      setUsername(userInputName || 'Student');
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setUsername('');
  };

  // No local token verification; ProtectedRoute + backend validateToken handles admin auth


  // route configuration
  return (
    <Router>
      <Routes>
        {/* login page - if already admin, redirect to admin panel */}
        <Route 
          path="/login" 
          element={
            userRole === 'admin' ? 
              <Navigate to="/admin" replace /> : 
              <Login onLogin={handleLogin} userRole={null} />
          } 
        />
        
        {/* Dashboard page - default is student permission, ordinary user can access directly */}
        <Route 
          path="/student_classic" 
          element={
            <Dashboard userRole="student" username="Student" />
          } 
        />
        
        {/* Dashboard Admin page - admin access (need login) */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <DashboardAdmin userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* New Group page - only student identity can access */}
        <Route 
          path="/student_classic/new_group" 
          element={
            <NewGroupPage userRole="student" username="Student" />
          } 
        />
        
        {/* Edit Group page - only student identity can access */}
        <Route 
          path="/student_classic/new_group/:groupId" 
          element={
            <NewGroupPage userRole="student" username="Student" />
          } 
        />

        {/* Edit Group (completed) page - reuse NewGroupPage but treat as edit route */}
        <Route 
          path="/student_classic/edit_group/:groupId" 
          element={
            <NewGroupPage userRole="student" username="Student" />
          } 
        />

        {/* Student Projects preview page (blank) */}
        <Route 
          path="/student_classic/projects" 
          element={
            <StudentProjects userRole="student" username="Student" />
          } 
        />
        
        {/* Admin New Project page */}
        <Route 
          path="/admin/new_project" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <NewProjectPage userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Edit Project page */}
        <Route 
          path="/admin/new_project/:projectId" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <NewProjectPage userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />

        {/* Admin Edit Group mapping for completed project → reuse NewProjectPage in edit mode */}
        <Route 
          path="/admin/edit_project/:projectId" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <NewProjectPage userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* Allocation System page - admin access (need login) */}
        <Route 
          path="/admin/allocation_system" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <AdminAllocationSystem userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* Manage Groups page - admin access (need login) */}
        <Route 
          path="/admin/manage_groups" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <AdminManageGroups userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        
        
        {/* Reports & Analytics page - admin access (need login) */}
        <Route 
          path="/admin/reports_analytics" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <AdminReportsAnalytics userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Settings page - admin access (need login) */}
        <Route 
          path="/admin/admin_settings" 
          element={
            <ProtectedRoute userRole={userRole} requireAdmin={true}>
              <AdminSettings userRole="admin" onLogout={handleLogout} username={username || 'Admin User'} />
            </ProtectedRoute>
          } 
        />
        
        {/* DashboardShadcn page - use shadcn/ui to rewrite Dashboard */}
        <Route 
          path="/student_modern" 
          element={<DashboardShadcn />} 
        />
        
        {/* NewGroupFormShadcn page - use shadcn/ui to rewrite NewGroupForm */}
        <Route 
          path="/student_modern/new_group" 
          element={
            <NewGroupFormShadcn onBack={() => window.location.href = '/student_modern'} />
          } 
        />
        
        {/* NewGroupFormShadcn edit page */}
        <Route 
          path="/student_modern/new_group/:groupId" 
          element={
            <NewGroupFormShadcnWrapper onBack={() => window.location.href = '/student_modern'} />
          } 
        />
        
        {/* NewGroupFormShadcn page - use shadcn/ui to rewrite NewGroupForm, support _shadcn suffix */}
        <Route 
          path="/student_modern/new_group_shadcn" 
          element={
            <NewGroupFormShadcn onBack={() => window.location.href = '/student_modern'} />
          } 
        />
        
        {/* NewGroupFormShadcn edit page - support _shadcn suffix */}
        <Route 
          path="/student_modern/new_group_shadcn/:groupId" 
          element={
            <NewGroupFormShadcnWrapper onBack={() => window.location.href = '/student_modern'} />
          } 
        />

        {/* Edit route for shadcn version */}
        <Route 
          path="/student_modern/edit_group_shadcn/:groupId" 
          element={
            <NewGroupFormShadcnWrapper onBack={() => window.location.href = '/student_modern'} />
          } 
        />
        
        {/* Student Projects Shadcn page */}
        <Route 
          path="/student_modern/projects_shadcn" 
          element={<StudentProjectsShadcn />} 
        />
        
        {/* Data sync test page - redirect to student page */}
        <Route 
          path="/data-sync-test" 
          element={<Navigate to="/student_classic" replace />} 
        />
        
        {/* Default redirect - redirect to login page */}
        <Route 
          path="/" 
          element={
            <Navigate to="/student_classic" replace />
          } 
        />
        
        {/* 404 page */}
        <Route 
          path="*" 
          element={<NotFound />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
