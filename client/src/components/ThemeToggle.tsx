import React from 'react';
import { useThemeMode } from '../hooks/useThemeMode';

/**
 * ThemeToggle component provides a button to switch between light and dark mode
 * 
 * Displays:
 * - Sun icon in light mode (showing current state = day)
 * - Moon icon in dark mode (showing current state = night)
 * 
 * The button has a smooth animation when transitioning between themes.
 */
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        // Sun icon for light mode (current state = day)
        <svg
          className="w-5 h-5 text-yellow-500"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      ) : (
        // Moon icon for dark mode (current state = night)
        <svg
          className="w-5 h-5 text-gray-300"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
