import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { validateToken, clearCurrentUser } from '../api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  userRole: 'admin' | 'student' | null;
  requireAdmin?: boolean; // whether admin permission is required
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  userRole, 
  requireAdmin = false 
}) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState<boolean>(requireAdmin);
  const [isTokenValid, setIsTokenValid] = useState<boolean>(true);

  // Validate token for admin-only routes
  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      if (!requireAdmin) return;

      // If userRole is not admin, skip API validation here; redirect will happen below
      if (userRole !== 'admin') {
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        const user = await validateToken();
        if (!user || user.role !== 'admin') {
          // Invalid token: clear local and redirect. Avoid network logout when backend may be down.
          clearCurrentUser();
          if (isMounted) setIsTokenValid(false);
        }
      } catch (e: any) {
        // Network/validation error: do not call logout API repeatedly; just clear local and redirect.
        clearCurrentUser();
        if (isMounted) setIsTokenValid(false);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [requireAdmin, userRole]);

  // if admin permission is required, perform verifications
  if (requireAdmin) {
    // 1. check user role
    if (userRole !== 'admin') {
      return <Navigate to="/login" replace />;
    }
    
    // 2. validate token via backend API
    if (isChecking) {
      // optionally render nothing while checking; could be a spinner if desired
      return <></>;
    }

    if (!isTokenValid) {
      return <Navigate to="/login" replace />;
    }
  }

  // if user has no identity and needs to login, redirect to login page
  if (!userRole && requireAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // other cases are allowed to access
  return <>{children}</>;
};

export default ProtectedRoute;
