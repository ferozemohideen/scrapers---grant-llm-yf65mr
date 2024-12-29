import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // ^6.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes.constants';
import Button from './Button';
import classNames from 'classnames';

/**
 * Props interface for the Navbar component
 */
interface NavbarProps {
  className?: string;
  highContrastMode?: boolean;
}

/**
 * Interface for navigation menu items
 */
interface NavItem {
  label: string;
  path: string;
  requiredRole?: string;
  ariaLabel: string;
  icon?: React.ReactNode;
}

// Navigation items configuration with role-based access
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: ROUTES.DASHBOARD,
    requiredRole: 'analyst',
    ariaLabel: 'Navigate to dashboard'
  },
  {
    label: 'URL Configuration',
    path: '/config/url',
    requiredRole: 'manager',
    ariaLabel: 'Manage URL configurations'
  },
  {
    label: 'Analytics',
    path: ROUTES.ANALYTICS,
    requiredRole: 'analyst',
    ariaLabel: 'View analytics'
  }
];

/**
 * Navbar Component
 * Implements responsive navigation with authentication, accessibility, and security features
 */
const Navbar: React.FC<NavbarProps> = ({ 
  className,
  highContrastMode = false
}) => {
  // Authentication hooks and state
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Filter nav items based on user role
  const filteredNavItems = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter(item => 
      !item.requiredRole || user.role === item.requiredRole
    );
  }, [user]);

  // Virtual scrolling for large menu lists
  const rowVirtualizer = useVirtualizer({
    count: filteredNavItems.length,
    getScrollElement: () => document.querySelector('.nav-menu'),
    estimateSize: () => 40,
    overscan: 5
  });

  // Secure logout handler
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate(ROUTES.LOGIN);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, navigate]);

  // Mobile menu handlers with animation
  const toggleMobileMenu = useCallback(() => {
    setIsTransitioning(true);
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  // Cleanup transition state
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsMobileMenuOpen(false);
    }
  }, []);

  // Compose navbar classes
  const navbarClasses = classNames(
    'fixed top-0 w-full z-[var(--z-index-fixed)]',
    'bg-[var(--background-color)]',
    'border-b border-[var(--border-color)]',
    'transition-colors duration-[var(--duration-normal)]',
    {
      'high-contrast': highContrastMode,
      'border-[var(--high-contrast-border)]': highContrastMode
    },
    className
  );

  return (
    <nav 
      className={navbarClasses}
      role="navigation"
      aria-label="Main navigation"
      onKeyDown={handleKeyDown}
    >
      <div className="max-w-[var(--container-max-width)] mx-auto px-[var(--spacing-4)]">
        <div className="flex items-center justify-between h-16">
          {/* Logo and brand */}
          <Link 
            to={ROUTES.HOME}
            className="flex items-center"
            aria-label="Go to home page"
          >
            <span className="text-[var(--text-color)] text-xl font-bold">
              TechTransfer
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-[var(--spacing-4)]">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={classNames(
                  'text-[var(--text-color)] hover:text-[var(--primary-color)]',
                  'transition-colors duration-[var(--duration-normal)]',
                  'px-[var(--spacing-3)] py-[var(--spacing-2)]',
                  'rounded-[var(--border-radius-md)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]'
                )}
                aria-label={item.ariaLabel}
              >
                {item.label}
              </Link>
            ))}

            {/* Authentication buttons */}
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                ariaLabel="Log out of your account"
              >
                Logout
              </Button>
            ) : (
              <Link to={ROUTES.LOGIN}>
                <Button
                  variant="primary"
                  size="sm"
                  ariaLabel="Log in to your account"
                >
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="sr-only">
              {isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            </span>
            {/* Hamburger icon */}
            <div className="w-6 h-6 flex items-center justify-center">
              <span className={classNames(
                'block w-5 h-0.5 bg-[var(--text-color)] transition-transform',
                { 'rotate-45': isMobileMenuOpen }
              )} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        id="mobile-menu"
        className={classNames(
          'md:hidden',
          'transition-[max-height] duration-[var(--duration-normal)]',
          'overflow-hidden',
          {
            'max-h-0': !isMobileMenuOpen,
            'max-h-screen': isMobileMenuOpen
          }
        )}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="px-[var(--spacing-4)] py-[var(--spacing-2)] space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={classNames(
                'block px-[var(--spacing-3)] py-[var(--spacing-2)]',
                'text-[var(--text-color)] hover:text-[var(--primary-color)]',
                'rounded-[var(--border-radius-md)]',
                'transition-colors duration-[var(--duration-normal)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]'
              )}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={item.ariaLabel}
            >
              {item.label}
            </Link>
          ))}

          {/* Mobile authentication buttons */}
          <div className="pt-[var(--spacing-2)]">
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full"
                ariaLabel="Log out of your account"
              >
                Logout
              </Button>
            ) : (
              <Link to={ROUTES.LOGIN} className="block">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  ariaLabel="Log in to your account"
                >
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;