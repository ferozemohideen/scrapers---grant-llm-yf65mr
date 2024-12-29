import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useClickOutside } from 'react-use'; // ^17.4.0
import { classNames } from '../../utils/format.util';
import Button, { ButtonProps } from './Button';

// Global placement styles mapping with RTL support
const PLACEMENTS = {
  top: "bottom-full mb-2 [dir='rtl']:right-0",
  bottom: "top-full mt-2 [dir='rtl']:right-0", 
  left: "right-full mr-2 [dir='rtl']:left-full",
  right: "left-full ml-2 [dir='rtl']:right-full"
} as const;

/**
 * Interface for dropdown menu items with support for nesting and accessibility
 */
export interface DropdownItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: DropdownItem[];
  loading?: boolean;
}

/**
 * Props interface for Dropdown component with accessibility features
 */
export interface DropdownProps {
  items: DropdownItem[];
  trigger?: React.ReactNode;
  placement?: keyof typeof PLACEMENTS;
  onSelect: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
  highContrast?: boolean;
}

/**
 * Accessible dropdown component with keyboard navigation and screen reader support
 */
const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  placement = 'bottom',
  onSelect,
  disabled = false,
  className,
  highContrast = false,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);

  // Refs for DOM elements
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setFocusedIndex(-1);
      setActiveSubmenu(null);
    }
  });

  /**
   * Handles item selection with accessibility announcements
   */
  const handleSelect = useCallback((item: DropdownItem) => {
    if (item.disabled || item.loading) return;

    if (item.children?.length) {
      setActiveSubmenu(activeSubmenu === focusedIndex ? null : focusedIndex);
      return;
    }

    onSelect(item.value);
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();

    // Announce selection to screen readers
    const announcement = `Selected ${item.label}`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  }, [focusedIndex, activeSubmenu, onSelect]);

  /**
   * Handles keyboard navigation with accessibility support
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
          return;
        }

        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const lastIndex = items.length - 1;
        let newIndex = focusedIndex + direction;

        // Loop around when reaching edges
        if (newIndex < 0) newIndex = lastIndex;
        if (newIndex > lastIndex) newIndex = 0;

        setFocusedIndex(newIndex);
        menuRef.current?.children[newIndex]?.scrollIntoView({ block: 'nearest' });
        break;
      }

      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
          return;
        }

        const selectedItem = items[focusedIndex];
        if (selectedItem) {
          handleSelect(selectedItem);
        }
        break;
      }

      case 'Escape': {
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        setActiveSubmenu(null);
        triggerRef.current?.focus();
        break;
      }

      case 'Tab': {
        setIsOpen(false);
        setFocusedIndex(-1);
        setActiveSubmenu(null);
        break;
      }
    }
  }, [isOpen, focusedIndex, items, handleSelect]);

  // Render dropdown menu items
  const renderItems = (items: DropdownItem[], level = 0) => {
    return items.map((item, index) => {
      const isActive = focusedIndex === index;
      const hasSubmenu = Boolean(item.children?.length);
      const isSubmenuOpen = activeSubmenu === index;

      return (
        <li
          key={item.value}
          role="menuitem"
          aria-disabled={item.disabled}
          aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
        >
          <button
            className={classNames(
              'w-full px-4 py-2 text-left flex items-center',
              'focus:outline-none focus:bg-primary-50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isActive && 'bg-primary-50',
              highContrast && 'focus:ring-2 focus:ring-current'
            )}
            onClick={() => handleSelect(item)}
            disabled={item.disabled || item.loading}
            aria-current={isActive}
          >
            {item.icon && (
              <span className="mr-2" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.loading && (
              <span className="ml-2 animate-spin" aria-label="Loading">
                ⟳
              </span>
            )}
            {hasSubmenu && (
              <span className="ml-auto" aria-hidden="true">
                ▸
              </span>
            )}
          </button>
          
          {hasSubmenu && isSubmenuOpen && (
            <ul
              className={classNames(
                'absolute left-full top-0 mt-0',
                'bg-white shadow-lg rounded-md py-1',
                'min-w-[200px] z-[var(--z-index-dropdown)]',
                highContrast && 'border-2 border-current'
              )}
              role="menu"
              aria-label={`${item.label} submenu`}
            >
              {renderItems(item.children, level + 1)}
            </ul>
          )}
        </li>
      );
    });
  };

  return (
    <div ref={dropdownRef} className={classNames('relative inline-block', className)}>
      {trigger ? (
        React.cloneElement(trigger as React.ReactElement, {
          ref: triggerRef,
          onClick: () => !disabled && setIsOpen(!isOpen),
          'aria-expanded': isOpen,
          'aria-haspopup': true,
          disabled,
        })
      ) : (
        <Button
          ref={triggerRef}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          Toggle Menu
        </Button>
      )}

      {isOpen && (
        <ul
          ref={menuRef}
          className={classNames(
            'absolute z-[var(--z-index-dropdown)]',
            'bg-white shadow-lg rounded-md py-1',
            'min-w-[200px] max-h-[300px] overflow-auto',
            PLACEMENTS[placement],
            highContrast && 'border-2 border-current'
          )}
          role="menu"
          aria-orientation="vertical"
          onKeyDown={handleKeyDown}
        >
          {renderItems(items)}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;