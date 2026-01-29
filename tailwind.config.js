/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gold-primary': '#d4af37',
        'gold-secondary': '#c5a028',
        'gold-highlight': '#fcf6ba',
        'bg-dark': '#050505',
        'dark-bg': '#0a0a0a',
        'glass-border': 'rgba(212, 175, 55, 0.2)',
        'text-muted': '#a0a0a0',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
