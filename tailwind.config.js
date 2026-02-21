/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B1120', // Deep Blue/Almost Black
        surface: '#1E293B', // Slightly lighter for cards
        primary: '#10B981', // Emerald Green (Money/Success)
        primaryHover: '#059669',
        secondary: '#3B82F6', // Blue for active states
        danger: '#EF4444', // Red for alerts/delete
        textMain: '#F8FAFC', // Slate 50
        textMuted: '#94A3B8', // Slate 400
        border: '#334155', // Slate 700
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glow': '0 0 15px -3px rgba(16, 185, 129, 0.4)',
      },
    },
  },
  plugins: [],
}
