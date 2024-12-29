/**
 * Root Application Component
 * 
 * Implements the main application structure with secure routing, authentication context,
 * and comprehensive layout management. Features include:
 * - Protected routes with role-based access control
 * - Enhanced security measures with JWT validation
 * - Comprehensive accessibility features
 * - Performance optimizations with code splitting
 * 
 * @version 1.0.0
 */

import React, { Suspense, useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom'; // ^6.0.0
import { 
  ThemeProvider, 
  CssBaseline 
} from '@mui/material'; // ^5.0.0

// Internal imports
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import { ROUTES, routeConfig } from './constants/routes.constants';
import { USER_ROLES } from './constants/auth.constants';

// Lazy-loaded components for better performance
const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const AuthLayout = React.lazy(() => import('./layouts/AuthLayout'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage'));
const URLConfigPage = React.lazy(() => import('./pages/config/URLConfigPage'));
const AnalyticsPage = React.lazy(() => import('./pages/dashboard/AnalyticsPage'));

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div 
    role="progressbar" 
    aria-label="Loading application" 
    className="loading-container"
  >
    Loading...
  </div>
);

/**
 * Protected Route Component
 * Implements role-based access control and authentication checks
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRoles?: USER_ROLES[];
}> = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, user, hasPermission } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.some(role => hasPermission(role))) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};

/**
 * Main Application Component
 * Provides the core application structure with routing and context providers
 */
const App: React.FC = () => {
  // Set up security headers
  useEffect(() => {
    // Configure Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self' ${process.env.VITE_API_BASE_URL};
    `;
    document.head.appendChild(meta);
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider theme={{}}>
        <CssBaseline />
        <AuthProvider>
          <div 
            className="app-container"
            role="application"
            aria-label="Technology Transfer Data Platform"
          >
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Authentication Routes */}
                <Route
                  path={ROUTES.LOGIN}
                  element={
                    <AuthLayout>
                      <LoginPage />
                    </AuthLayout>
                  }
                />

                {/* Protected Dashboard Routes */}
                <Route
                  path={ROUTES.DASHBOARD}
                  element={
                    <ProtectedRoute>
                      <DashboardLayout>
                        <DashboardPage />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Protected Analytics Routes */}
                <Route
                  path={ROUTES.ANALYTICS}
                  element={
                    <ProtectedRoute requiredRoles={[USER_ROLES.ANALYST, USER_ROLES.ADMIN]}>
                      <DashboardLayout>
                        <AnalyticsPage />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Protected Configuration Routes */}
                <Route
                  path="/config/*"
                  element={
                    <ProtectedRoute requiredRoles={[USER_ROLES.MANAGER, USER_ROLES.ADMIN]}>
                      <DashboardLayout>
                        <Routes>
                          <Route path="url" element={<URLConfigPage />} />
                          {/* Add other config routes */}
                        </Routes>
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Default Route */}
                <Route
                  path="/"
                  element={
                    <MainLayout>
                      <Navigate to={ROUTES.DASHBOARD} replace />
                    </MainLayout>
                  }
                />

                {/* 404 Route */}
                <Route
                  path="*"
                  element={
                    <MainLayout>
                      <div role="alert" aria-label="Page not found">
                        404 - Page Not Found
                      </div>
                    </MainLayout>
                  }
                />
              </Routes>
            </Suspense>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;