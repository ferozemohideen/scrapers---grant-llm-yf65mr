/**
 * Layout Component
 * 
 * A secure, accessible, and responsive layout component that provides the main application
 * structure with navigation, sidebar, and content areas. Implements role-based access
 * control, comprehensive accessibility features, and performance optimizations.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material'; // ^5.0.0
import classNames from 'classnames'; // ^2.3.1

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { BREAKPOINTS } from '../../constants/ui.constants';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes.constants';

/**
 * Props interface for the Layout component
 */
interface ILayoutProps {
  children: React.ReactNode;
  className?: string;
  requiredRole?: string;
}

/**
 * Main layout component that provides the application structure with security
 * and accessibility features.
 */
const Layout: React.FC<ILayoutProps> = React.memo(({
  children,
  className,
  requiredRole
}) => {
  // Authentication and navigation hooks
  const { isAuthenticated, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  
  // Responsive state management
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobile);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // Handle screen resize
  useEffect(() => {
    setIsSidebarCollapsed(isMobile);
  }, [isMobile]);

  // Security check for required role
  useEffect(() => {
    if (requiredRole && (!isAuthenticated || !hasPermission(requiredRole))) {
      navigate(ROUTES.LOGIN, { 
        replace: true,
        state: { from: window.location.pathname }
      });
    }
  }, [isAuthenticated, user, requiredRole, hasPermission, navigate]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  // Skip to main content link handler
  const handleSkipToContent = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }
  }, []);

  // Compose layout classes
  const layoutClasses = classNames(
    'layout',
    'min-h-screen',
    'bg-[var(--background-color)]',
    'text-[var(--text-color)]',
    {
      'layout--authenticated': isAuthenticated,
      'layout--sidebar-collapsed': isSidebarCollapsed
    },
    className
  );

  // Compose main content classes
  const mainClasses = classNames(
    'layout__main',
    'flex-1',
    'transition-[margin]',
    'duration-[var(--duration-normal)]',
    {
      'ml-64': isAuthenticated && !isSidebarCollapsed,
      'ml-20': isAuthenticated && isSidebarCollapsed
    }
  );

  return (
    <div 
      className={layoutClasses}
      onKeyDown={handleKeyDown}
    >
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only"
        onClick={handleSkipToContent}
      >
        Skip to main content
      </a>

      {/* Navigation bar */}
      <Navbar className="fixed top-0 w-full z-[var(--z-index-fixed)]" />

      {/* Sidebar navigation */}
      {isAuthenticated && (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
          className="fixed left-0 h-full z-[var(--z-index-fixed)]"
        />
      )}

      {/* Main content area */}
      <main
        id="main-content"
        className={mainClasses}
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        <div className="layout__content container mx-auto px-4 py-6">
          {/* Error boundary could be added here */}
          {children}
        </div>
      </main>

      {/* Accessibility announcer for dynamic content */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      />
    </div>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;