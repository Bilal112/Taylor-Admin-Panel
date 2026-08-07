/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1a56db', dark: '#1e429f', light: '#e8f0fe' },
        accent: { DEFAULT: '#d4a017', light: '#fef9ee' },
      }
    },
  },
  plugins: [],
};
