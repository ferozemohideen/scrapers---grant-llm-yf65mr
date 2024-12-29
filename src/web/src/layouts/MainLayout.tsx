/**
 * MainLayout Component
 * 
 * A top-level layout component that provides the main application structure with
 * navigation, sidebar, and content areas. Implements responsive design,
 * authentication-aware navigation, accessibility features, and performance optimizations.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';

// Internal imports
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import useAuth from '../hooks/useAuth';
import { BREAKPOINTS } from '../constants/ui.constants';
import { ROUTES } from '../constants/routes.constants';

// CSS Module import
import styles from './MainLayout.module.css';

/**
 * Props interface for the MainLayout component
 */
interface MainLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * Error boundary fallback component
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className={styles.errorContainer}>
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * MainLayout component that provides the application structure with responsive design
 * and authentication-aware routing
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  requireAuth = true
}) => {
  // Authentication state
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Responsive state management
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width:${BREAKPOINTS.MD}px)`);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobile || isTablet);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // Update sidebar state on screen resize
  useEffect(() => {
    setIsSidebarCollapsed(isMobile || isTablet);
  }, [isMobile, isTablet]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer} role="status">
        <span className={styles.loadingSpinner} aria-hidden="true" />
        <span className="sr-only">Loading application...</span>
      </div>
    );
  }

  // Authentication check
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return (
    <div 
      className={styles.mainLayout}
      data-testid="main-layout"
    >
      <header className={styles.header}>
        <Navbar 
          className={styles.navbar}
          onMenuClick={handleSidebarToggle}
        />
      </header>

      <div className={styles.container}>
        {isAuthenticated && (
          <aside 
            className={styles.sidebar}
            aria-label="Main navigation"
          >
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggle={handleSidebarToggle}
            />
          </aside>
        )}

        <main 
          className={styles.content}
          role="main"
          aria-label="Main content"
          data-sidebar-collapsed={isSidebarCollapsed}
        >
          <div className={styles.contentInner}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Error boundary wrapper
const MainLayoutWithErrorBoundary = withErrorBoundary(MainLayout, {
  FallbackComponent: ErrorFallback,
  onError: (error: Error) => {
    console.error('MainLayout Error:', error);
    // Add error reporting service integration here
  }
});

export default MainLayoutWithErrorBoundary;

// CSS Module definition
declare module '*.module.css' {
  const styles: {
    readonly [key: string]: string;
  };
  export default styles;
}