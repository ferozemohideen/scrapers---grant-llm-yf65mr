/**
 * Sidebar Component
 * 
 * A responsive sidebar navigation component with role-based access control,
 * accessibility features, and dynamic navigation based on user permissions.
 * Implements collapsible behavior and mobile responsiveness.
 * 
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom'; // ^6.0.0
import { useMediaQuery } from '@mui/material'; // ^5.0.0
import {
  ROUTES,
  CONFIG_ROUTES,
  MONITORING_ROUTES
} from '../../constants/routes.constants';
import { BREAKPOINTS } from '../../constants/ui.constants';
import { useAuth } from '../../hooks/useAuth';
import { USER_ROLES } from '../../constants/auth.constants';

// Interface for sidebar component props
export interface ISidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

// Interface for navigation items with security features
interface INavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  requiredRole: USER_ROLES[];
  requiredPermissions: string[];
}

/**
 * Generates secure navigation items based on user role and permissions
 */
const getNavItems = (
  user: ReturnType<typeof useAuth>['user'],
  hasPermission: (permission: string) => boolean
): INavItem[] => {
  const baseItems: INavItem[] = [
    {
      label: 'Dashboard',
      path: ROUTES.DASHBOARD,
      icon: <span>📊</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.ANALYST, USER_ROLES.MANAGER, USER_ROLES.ADMIN],
      requiredPermissions: ['view:dashboard']
    },
    {
      label: 'Analytics',
      path: ROUTES.ANALYTICS,
      icon: <span>📈</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.ANALYST, USER_ROLES.MANAGER, USER_ROLES.ADMIN],
      requiredPermissions: ['view:analytics']
    }
  ];

  const configItems: INavItem[] = [
    {
      label: 'URL Configuration',
      path: CONFIG_ROUTES.URL_CONFIG,
      icon: <span>🔗</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.MANAGER, USER_ROLES.ADMIN],
      requiredPermissions: ['manage:urls']
    },
    {
      label: 'Institution Config',
      path: CONFIG_ROUTES.INSTITUTION_CONFIG,
      icon: <span>🏛️</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.MANAGER, USER_ROLES.ADMIN],
      requiredPermissions: ['manage:institutions']
    }
  ];

  const monitoringItems: INavItem[] = [
    {
      label: 'System Health',
      path: MONITORING_ROUTES.HEALTH,
      icon: <span>💓</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.ADMIN],
      requiredPermissions: ['view:health']
    },
    {
      label: 'Performance',
      path: MONITORING_ROUTES.PERFORMANCE,
      icon: <span>⚡</span>, // Replace with actual icon component
      requiredRole: [USER_ROLES.ADMIN],
      requiredPermissions: ['view:performance']
    }
  ];

  // Combine all items
  const allItems = [...baseItems, ...configItems, ...monitoringItems];

  // Filter items based on user role and permissions
  return allItems.filter(item => {
    if (!user) return false;
    
    const hasRole = item.requiredRole.includes(user.role);
    const hasRequiredPermissions = item.requiredPermissions.every(permission =>
      hasPermission(permission)
    );
    
    return hasRole && hasRequiredPermissions;
  });
};

/**
 * Sidebar Component
 * Implements secure navigation with role-based access control
 */
export const Sidebar: React.FC<ISidebarProps> = React.memo(({ 
  isCollapsed, 
  onToggle, 
  className 
}) => {
  const { user, hasPermission } = useAuth();
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);

  // Memoize navigation items to prevent unnecessary recalculation
  const navItems = useMemo(() => 
    getNavItems(user, hasPermission), 
    [user, hasPermission]
  );

  return (
    <nav
      className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${className || ''}`}
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="sidebar-header">
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-toggle"
          type="button"
        >
          {isCollapsed ? '→' : '←'} {/* Replace with actual icon component */}
        </button>
      </div>

      <ul className="sidebar-nav">
        {navItems.map((item) => (
          <li key={item.path} className="nav-item">
            <Link
              to={item.path}
              className="nav-link"
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {!isCollapsed && (
                <span className="nav-label">{item.label}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {user?.role === USER_ROLES.ADMIN && (
        <div className="sidebar-footer">
          <span className="version-info">
            {!isCollapsed && 'v1.0.0'}
          </span>
        </div>
      )}
    </nav>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;