/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Use CSS variables for white-label theme support
        // Fallback to hardcoded values if CSS variables are not available
        primary: 'var(--theme-color-primary, #FECC00)',
        secondary: 'var(--theme-color-secondary, #1F2937)',
        accent: 'var(--theme-color-accent, #3B82F6)',
        background: 'var(--theme-color-background, #FFFFFF)',
        text: 'var(--theme-color-text, #1F2937)',
        'text-secondary': 'var(--theme-color-text-secondary, #6B7280)',
        border: 'var(--theme-color-border, #E5E7EB)',
        success: 'var(--theme-color-success, #10B981)',
        error: 'var(--theme-color-error, #EF4444)',
      },
      fontFamily: {
        heading: 'var(--theme-font-heading, Inter, sans-serif)',
        body: 'var(--theme-font-body, Inter, sans-serif)',
      },
    },
  },
  plugins: [],
}

