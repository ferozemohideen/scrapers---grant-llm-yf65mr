/**
 * useTheme Hook
 * 
 * A custom React hook for managing application theme state with support for
 * light/dark modes, system preference detection, persistence, and accessibility features.
 * 
 * @version 1.0.0
 * @package react ^18.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { useLocalStorage } from './useLocalStorage';

/**
 * Available theme options
 */
export enum Theme {
    LIGHT = 'light',
    DARK = 'dark',
    SYSTEM = 'system'
}

/**
 * Interface for theme state
 */
interface ThemeState {
    theme: Theme;
    isDarkMode: boolean;
}

// Constants
const THEME_STORAGE_KEY = 'app-theme';
const SYSTEM_DARK_THEME_QUERY = '(prefers-color-scheme: dark)';
const THEME_CHANGE_DEBOUNCE_MS = 150;

/**
 * Custom hook for managing application theme with system preference detection
 * and persistence.
 * 
 * @returns {Object} Theme state and controls
 */
export function useTheme(): ThemeState & { setTheme: (theme: Theme) => void } {
    // Initialize theme state from localStorage with encryption
    const [storedTheme, setStoredTheme] = useLocalStorage<Theme>(
        THEME_STORAGE_KEY,
        Theme.SYSTEM,
        {
            encrypt: true,
            syncTabs: true
        }
    );

    // Local state for theme and dark mode
    const [themeState, setThemeState] = useState<ThemeState>({
        theme: storedTheme || Theme.SYSTEM,
        isDarkMode: false
    });

    // Create media query for system dark mode preference
    const systemDarkModeQuery = window.matchMedia(SYSTEM_DARK_THEME_QUERY);

    /**
     * Determines if dark mode should be active based on theme and system preference
     */
    const calculateIsDarkMode = useCallback((theme: Theme): boolean => {
        if (theme === Theme.DARK) return true;
        if (theme === Theme.LIGHT) return false;
        return systemDarkModeQuery.matches;
    }, [systemDarkModeQuery.matches]);

    /**
     * Updates the theme state and applies necessary DOM changes
     */
    const updateThemeState = useCallback((newTheme: Theme) => {
        const isDarkMode = calculateIsDarkMode(newTheme);
        
        // Update DOM
        document.documentElement.classList.toggle('dark-mode', isDarkMode);
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute(
                'content',
                isDarkMode ? '#1a1a1a' : '#ffffff'
            );
        }

        // Update state
        setThemeState({ theme: newTheme, isDarkMode });
    }, [calculateIsDarkMode]);

    /**
     * Handles theme changes with validation
     */
    const setTheme = useCallback((newTheme: Theme) => {
        if (!Object.values(Theme).includes(newTheme)) {
            console.error(`Invalid theme value: ${newTheme}`);
            return;
        }

        setStoredTheme(newTheme);
        updateThemeState(newTheme);
    }, [setStoredTheme, updateThemeState]);

    /**
     * Handle system theme preference changes
     */
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout;

        const handleSystemThemeChange = () => {
            // Debounce updates to prevent rapid changes
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (themeState.theme === Theme.SYSTEM) {
                    updateThemeState(Theme.SYSTEM);
                }
            }, THEME_CHANGE_DEBOUNCE_MS);
        };

        // Set up system theme change listener
        systemDarkModeQuery.addEventListener('change', handleSystemThemeChange);

        // Initial theme setup
        updateThemeState(themeState.theme);

        // Cleanup
        return () => {
            systemDarkModeQuery.removeEventListener('change', handleSystemThemeChange);
            clearTimeout(debounceTimer);
        };
    }, [systemDarkModeQuery, themeState.theme, updateThemeState]);

    return {
        theme: themeState.theme,
        isDarkMode: themeState.isDarkMode,
        setTheme
    };
}

export default useTheme;
```

This implementation provides a robust theme management system with the following features:

1. Theme Options:
- Support for light, dark, and system preference modes
- Persistent theme storage with encryption
- Cross-tab synchronization

2. System Integration:
- Automatic system theme preference detection
- Real-time updates when system preference changes
- Debounced theme changes to prevent flickering

3. Accessibility:
- Proper DOM attribute updates for accessibility tools
- Meta theme-color updates for mobile browsers
- CSS class toggling for theme styling

4. Performance:
- Memoized callbacks with useCallback
- Debounced system theme change handling
- Efficient state updates

5. Type Safety:
- Full TypeScript support
- Enum-based theme options
- Proper interface definitions

The hook can be used in components like this:

```
