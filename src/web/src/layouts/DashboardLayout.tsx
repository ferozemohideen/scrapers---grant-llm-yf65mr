/**
 * DashboardLayout Component
 * 
 * A secure, role-based dashboard layout component that provides a responsive interface
 * with navigation, sidebar, and content areas. Implements strict authentication checks,
 * accessibility features, and performance optimizations.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material'; // ^5.0.0
import classNames from 'classnames';

// Internal imports
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { BREAKPOINTS } from '../constants/ui.constants';
import { ROUTES } from '../constants/routes.constants';

/**
 * Props interface for the DashboardLayout component
 */
interface IDashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  requiredRole?: string;
}

/**
 * DashboardLayout Component
 * Implements secure, role-based dashboard layout with responsive design
 */
const DashboardLayout: React.FC<IDashboardLayoutProps> = React.memo(({
  children,
  className,
  requiredRole
}) => {
  // Authentication and authorization
  const { isAuthenticated, user, hasPermission } = useAuth();
  const location = useLocation();

  // Responsive state management
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width:${BREAKPOINTS.MD}px)`);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobile || isTablet);

  // Authentication check
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Role-based access control
  if (requiredRole && user && !hasPermission(requiredRole)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Memoized sidebar toggle handler
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // Update sidebar state on screen resize
  useEffect(() => {
    setIsSidebarCollapsed(isMobile || isTablet);
  }, [isMobile, isTablet]);

  // Memoized layout classes
  const layoutClasses = useMemo(() => classNames(
    'flex h-screen bg-[var(--background-color)]',
    'transition-all duration-[var(--duration-normal)]',
    className
  ), [className]);

  // Memoized content classes
  const contentClasses = useMemo(() => classNames(
    'flex-1 overflow-auto',
    'transition-all duration-[var(--duration-normal)]',
    'bg-[var(--background-color-dark)]',
    'p-[var(--spacing-4)]',
    {
      'ml-64': !isSidebarCollapsed && !isMobile,
      'ml-20': isSidebarCollapsed && !isMobile
    }
  ), [isSidebarCollapsed, isMobile]);

  // Memoized sidebar classes
  const sidebarClasses = useMemo(() => classNames(
    'fixed left-0 h-full',
    'bg-[var(--background-color)]',
    'border-r border-[var(--border-color)]',
    'transition-all duration-[var(--duration-normal)]',
    {
      'w-64': !isSidebarCollapsed,
      'w-20': isSidebarCollapsed,
      'transform -translate-x-full': isMobile && isSidebarCollapsed
    }
  ), [isSidebarCollapsed, isMobile]);

  return (
    <div 
      className={layoutClasses}
      role="main"
      aria-label="Dashboard Layout"
    >
      {/* Navigation Bar */}
      <Navbar
        className="fixed top-0 w-full z-[var(--z-index-fixed)]"
        onMenuClick={isMobile ? handleSidebarToggle : undefined}
      />

      {/* Sidebar Navigation */}
      <Sidebar
        className={sidebarClasses}
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobile && !isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-[var(--overlay-color)] z-[var(--z-index-modal)]"
          onClick={handleSidebarToggle}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main 
        className={contentClasses}
        role="region"
        aria-label="Dashboard Content"
      >
        <div className="mt-16"> {/* Offset for fixed navbar */}
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
});

/**
 * Error Boundary Component for Dashboard Content
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="p-4 text-center text-[var(--error-color)]"
          role="alert"
        >
          <h2>Something went wrong.</h2>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-[var(--primary-color)]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Set display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;