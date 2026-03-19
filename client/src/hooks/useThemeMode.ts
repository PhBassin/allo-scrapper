import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * Custom hook to access theme context
 * 
 * Provides access to:
 * - theme: Current theme mode ('light' | 'dark')
 * - toggleTheme: Function to toggle between light and dark
 * - setTheme: Function to set a specific theme
 * 
 * @example
 * const { theme, toggleTheme } = useThemeMode();
 * 
 * return (
 *   <button onClick={toggleTheme}>
 *     Current theme: {theme}
 *   </button>
 * );
 */
export function useThemeMode() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  
  return context;
}
