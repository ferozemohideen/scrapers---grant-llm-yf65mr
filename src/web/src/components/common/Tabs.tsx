/**
 * @fileoverview Accessible Tabs Component
 * @version 1.0.0
 * 
 * A reusable tabs component that provides an accessible, responsive tabbed interface
 * for organizing and displaying content in different panes. Supports keyboard navigation,
 * screen readers, responsive behavior, and both horizontal and vertical orientations.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { BREAKPOINTS } from '../../constants/ui.constants';
import styles from './Tabs.module.css';

/**
 * Interface for individual tab configuration
 */
export interface ITab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

/**
 * Props interface for the Tabs component
 */
export interface ITabsProps {
  tabs: ITab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Handles keyboard navigation between tabs
 */
const handleKeyDown = (
  event: React.KeyboardEvent,
  tabs: ITab[],
  activeTab: string,
  onChange: (tabId: string) => void,
  orientation: 'horizontal' | 'vertical'
): void => {
  const enabledTabs = tabs.filter(tab => !tab.disabled);
  const currentIndex = enabledTabs.findIndex(tab => tab.id === activeTab);
  
  const getNextTab = (direction: 1 | -1): string => {
    let nextIndex = currentIndex + direction;
    
    if (nextIndex < 0) {
      nextIndex = enabledTabs.length - 1;
    } else if (nextIndex >= enabledTabs.length) {
      nextIndex = 0;
    }
    
    return enabledTabs[nextIndex].id;
  };

  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown': {
      event.preventDefault();
      const isVerticalKey = event.key === 'ArrowDown';
      if (orientation === 'vertical' === isVerticalKey) {
        onChange(getNextTab(1));
      }
      break;
    }
    case 'ArrowLeft':
    case 'ArrowUp': {
      event.preventDefault();
      const isVerticalKey = event.key === 'ArrowUp';
      if (orientation === 'vertical' === isVerticalKey) {
        onChange(getNextTab(-1));
      }
      break;
    }
    case 'Home':
      event.preventDefault();
      onChange(enabledTabs[0].id);
      break;
    case 'End':
      event.preventDefault();
      onChange(enabledTabs[enabledTabs.length - 1].id);
      break;
  }
};

/**
 * Tabs component for content organization with accessibility support
 */
export const Tabs: React.FC<ITabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  orientation = 'horizontal'
}) => {
  const tabListRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = window.innerWidth < BREAKPOINTS.SM;

  // Force vertical orientation on small screens
  const effectiveOrientation = isSmallScreen ? 'vertical' : orientation;

  // Validate active tab and handle changes
  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      onChange(tabId);
    }
  }, [tabs, onChange]);

  // Set up focus management
  useEffect(() => {
    const activeElement = tabListRef.current?.querySelector(
      `[data-tab-id="${activeTab}"]`
    ) as HTMLElement;
    activeElement?.focus();
  }, [activeTab]);

  return (
    <div
      className={classNames(
        styles.tabs,
        {
          [styles['tabs--vertical']]: effectiveOrientation === 'vertical'
        },
        className
      )}
    >
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation={effectiveOrientation}
        className={styles.tabs__list}
        onKeyDown={(e) => handleKeyDown(e, tabs, activeTab, handleTabChange, effectiveOrientation)}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            data-tab-id={tab.id}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={tab.disabled}
            className={classNames(
              styles.tabs__tab,
              {
                [styles['tabs__tab--active']]: activeTab === tab.id,
                [styles['tabs__tab--disabled']]: tab.disabled
              }
            )}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={tab.id}
          hidden={activeTab !== tab.id}
          className={styles.tabs__content}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

export default Tabs;