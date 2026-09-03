/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // enable class strategy for dark mode
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.css',
    './src/**/*.scss'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
