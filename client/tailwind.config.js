/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FECC00', // Brand primary color
        secondary: '#1F2937',
      },
    },
  },
  plugins: [],
}

