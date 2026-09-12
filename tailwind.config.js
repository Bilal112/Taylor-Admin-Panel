/** @type {import('tailwindcss').Config} */
// Every color below (except pure white/transparent) reads from a CSS
// variable defined in globals.css, one set for light and one for `.dark` —
// that's the "single computed token set" the whole app themes from. Add a
// new color here only alongside its --var in globals.css, never as a literal
// hex, or it silently won't respond to the theme toggle.
const withOpacity = (varName) => `rgb(var(${varName}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-public-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: withOpacity('--color-bg'),
        surface: {
          DEFAULT: withOpacity('--color-surface'),
          hover: withOpacity('--color-surface-hover'),
        },
        border: withOpacity('--color-border'),
        ink: withOpacity('--color-ink'),
        muted: withOpacity('--color-muted'),
        faint: withOpacity('--color-faint'),
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          dark: withOpacity('--color-accent-strong'),
          soft: withOpacity('--color-accent-soft'),
        },
        // Kept as an alias so the ~20 existing `text-primary` / `bg-primary`
        // usages across the app stay correct — same variables as `accent`,
        // just the pre-existing name. New code should prefer `accent`.
        primary: {
          DEFAULT: withOpacity('--color-accent'),
          dark: withOpacity('--color-accent-strong'),
          light: withOpacity('--color-accent-soft'),
        },
        success: {
          DEFAULT: withOpacity('--color-success'),
          soft: withOpacity('--color-success-soft'),
        },
        warning: {
          DEFAULT: withOpacity('--color-warning'),
          soft: withOpacity('--color-warning-soft'),
        },
        danger: {
          DEFAULT: withOpacity('--color-danger'),
          soft: withOpacity('--color-danger-soft'),
        },
      },
      borderColor: {
        DEFAULT: withOpacity('--color-border'),
      },
    },
  },
  plugins: [],
};
